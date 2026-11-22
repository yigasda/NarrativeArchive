// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at 32c47a1 (staging, 2026-11-20):
//   packages/server/src/services/generation/image-captioning-runtime.ts — these parts:
//     the caption limits, normalizePromptAttachments, normalizeImageCaptionText, effectiveCaptionPrompt,
//     captionPromptKey, readCachedImageCaption, formatImageCaptionBlock, appendImageCaptionBlocksToContent,
//     generateImageCaptionForDataUrl, generateImageCaptionsForDataUrls, resolvePromptAttachmentInputs
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; the debug logging lines are left out;
//   - captionPromptKey used node:crypto (sha256, first 16 hex). The browser's Web Crypto gives the same digest but only
//     asynchronously, so captionPromptKey and readCachedImageCaption are async and their callers await them;
//   - the caption request keeps its messages, temperature 0.2 and 700 tokens; the Engine's own options
//     (applyProviderMaxTokensOverride, enableCaching, anthropicExtendedCacheTtl, cachingAtDepth) are not sent:
//     imageCaptioning.provider is whatever the caller gives, with chatComplete(messages, options) → { content };
//   - not brought (they need the Engine's connections, catalogs and providers): resolveImageCaptioningRuntime,
//     resolveVisionCaptioningRuntime, captioningWith, captionSentSelfies, withImageCaptionFallback,
//     redactImageCaptionMessagesForLog. The caller builds the runtime { enabled, connectionId, connection:
//     { model, provider }, provider, prompt, unavailableReason } itself.
import { DEFAULT_IMAGE_CAPTIONING_PROMPT } from "./image-captioning-prompt.js";
import {
  appendReadableAttachmentsToContent,
  escapeXmlAttribute,
  extractFileAttachmentInputs,
  extractImageAttachmentDataUrls,
  getAttachmentFilename,
  parseExtra,
} from "./prompt-attachments.js";

export const DISABLED_IMAGE_CAPTIONING = {
  enabled: false,
  connectionId: null,
  connection: null,
  provider: null,
};

const IMAGE_CAPTION_MAX_TOKENS = 700;
const IMAGE_CAPTION_MAX_CHARS = 4_000;
const IMAGE_CAPTION_MAX_GENERATIONS = 8;
const IMAGE_CAPTION_CONCURRENCY = 2;

export function normalizePromptAttachments(extra) {
  const rawAttachments = parseExtra(extra).attachments;
  if (!Array.isArray(rawAttachments)) return undefined;
  const attachments = rawAttachments.filter(
    (attachment) =>
      !!attachment && typeof attachment === "object" && !Array.isArray(attachment),
  );
  return attachments.length ? attachments : undefined;
}

function normalizeImageCaptionText(value) {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (!text) return null;
  return text.length > IMAGE_CAPTION_MAX_CHARS ? `${text.slice(0, IMAGE_CAPTION_MAX_CHARS).trim()}...` : text;
}

function effectiveCaptionPrompt(imageCaptioning) {
  return imageCaptioning.prompt?.trim() || DEFAULT_IMAGE_CAPTIONING_PROMPT;
}

export async function captionPromptKey(prompt) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(prompt));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function readCachedImageCaption(attachment, imageCaptioning) {
  const caption = normalizeImageCaptionText(attachment.imageCaption);
  if (!caption || !imageCaptioning.connection) return null;
  if (attachment.imageCaptionConnectionId !== imageCaptioning.connectionId) return null;
  if (attachment.imageCaptionModel !== imageCaptioning.connection.model) return null;
  if (attachment.imageCaptionProvider !== imageCaptioning.connection.provider) return null;
  // A changed prompt makes a new caption. Captions from before prompts were editable used the default.
  const prompt = effectiveCaptionPrompt(imageCaptioning);
  const cachedKey = attachment.imageCaptionPromptKey ?? (await captionPromptKey(DEFAULT_IMAGE_CAPTIONING_PROMPT));
  if (cachedKey !== (await captionPromptKey(prompt))) return null;
  return caption;
}

export function formatImageCaptionBlock(attachment, caption) {
  const name = getAttachmentFilename(attachment);
  const type = typeof attachment.type === "string" && attachment.type.trim() ? attachment.type.trim() : "image";
  return [
    `<attached_image name="${escapeXmlAttribute(name)}" type="${escapeXmlAttribute(type)}">`,
    caption,
    `</attached_image>`,
  ].join("\n");
}

export function appendImageCaptionBlocksToContent(content, blocks) {
  if (blocks.length === 0) return content;
  return `${content}${content.trim() ? "\n\n" : ""}${blocks.join("\n\n")}`;
}

export async function generateImageCaptionForDataUrl(
  filename,
  imageDataUrl,
  imageCaptioning,
  signal,
) {
  if (!imageCaptioning.provider || !imageCaptioning.connection) return null;
  const messages = [
    { role: "system", content: effectiveCaptionPrompt(imageCaptioning) },
    {
      role: "user",
      content: `Describe this image attachment named "${filename}" for use inside a chat prompt. Return only the description.`,
      images: [imageDataUrl],
    },
  ];
  // Failures stop the turn: sending the raw image instead would quietly ignore the user's captioning setting.
  const result = await imageCaptioning.provider
    .chatComplete(messages, {
      model: imageCaptioning.connection.model,
      temperature: 0.2,
      maxTokens: IMAGE_CAPTION_MAX_TOKENS,
      stream: false,
      signal,
    })
    .catch((error) => {
      if (signal.aborted) throw error;
      throw new Error(`Image captioning failed for "${filename}"`, { cause: error });
    });
  const caption = normalizeImageCaptionText(result.content);
  if (!caption) throw new Error(`Image captioning failed for "${filename}": the captioning model sent back no text`);
  return caption;
}

export async function generateImageCaptionsForDataUrls(
  inputs,
  imageCaptioning,
  signal,
) {
  const results = new Array(inputs.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(IMAGE_CAPTION_CONCURRENCY, inputs.length) }, async () => {
    while (nextIndex < inputs.length) {
      signal.throwIfAborted();
      const index = nextIndex++;
      const input = inputs[index];
      results[index] = {
        input,
        caption: await generateImageCaptionForDataUrl(
          input.filename,
          input.imageDataUrl,
          imageCaptioning,
          signal,
        ),
      };
    }
  });
  await Promise.all(workers);
  return results;
}

export async function resolvePromptAttachmentInputs(args) {
  const { attachments, imageCaptioning, signal } = args;
  const files = extractFileAttachmentInputs(attachments);
  let content = appendReadableAttachmentsToContent(args.content, attachments);

  if (!imageCaptioning.enabled) {
    return {
      content,
      images: extractImageAttachmentDataUrls(attachments),
      files,
      updatedAttachments: null,
    };
  }
  if (!imageCaptioning.provider || !imageCaptioning.connection) {
    if (extractImageAttachmentDataUrls(attachments).length) {
      throw new Error(`Image captioning failed: ${imageCaptioning.unavailableReason ?? "no captioning connection"}`);
    }
    return { content, images: [], files, updatedAttachments: null };
  }

  const captionBlocks = [];
  const fallbackImages = [];
  let updatedAttachments = null;
  const sourceAttachments = attachments ?? [];
  const captionConnection = imageCaptioning.connection;
  const resolvedImages = await Promise.all(sourceAttachments.map(async (attachment, index) => {
    const imageDataUrl = extractImageAttachmentDataUrls([attachment])[0];
    if (!imageDataUrl) return null;
    return {
      index,
      attachment,
      imageDataUrl,
      caption: await readCachedImageCaption(attachment, imageCaptioning),
      updatedAttachment: null,
    };
  }));
  const captionsToGenerate = resolvedImages
    .filter((result) => result !== null && result.caption === null)
    .slice(0, IMAGE_CAPTION_MAX_GENERATIONS);
  const generatedCaptions = await generateImageCaptionsForDataUrls(
    captionsToGenerate.map((result) => ({
      filename: getAttachmentFilename(result.attachment),
      imageDataUrl: result.imageDataUrl,
      result,
    })),
    imageCaptioning,
    signal,
  );
  for (const { input, caption } of generatedCaptions) {
    input.result.caption = caption;
    if (caption) {
      input.result.updatedAttachment = {
        ...input.result.attachment,
        imageCaption: caption,
        imageCaptionConnectionId: imageCaptioning.connectionId,
        imageCaptionModel: captionConnection.model,
        imageCaptionProvider: captionConnection.provider,
        imageCaptionPromptKey: await captionPromptKey(effectiveCaptionPrompt(imageCaptioning)),
        imageCaptionedAt: new Date().toISOString(),
      };
    }
  }

  for (const result of resolvedImages) {
    if (!result) continue;
    const { index, attachment, imageDataUrl, caption, updatedAttachment } = result;
    if (updatedAttachment) {
      updatedAttachments ??= sourceAttachments.map((item) => ({ ...item }));
      updatedAttachments[index] = updatedAttachment;
    }
    if (caption) {
      captionBlocks.push(
        formatImageCaptionBlock(updatedAttachment ?? updatedAttachments?.[index] ?? attachment, caption),
      );
    } else {
      fallbackImages.push(imageDataUrl);
    }
  }

  content = appendImageCaptionBlocksToContent(content, captionBlocks);
  return {
    content,
    images: fallbackImages,
    files,
    updatedAttachments,
  };
}
