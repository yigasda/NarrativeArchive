// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at 32c47a1 (staging, 2026-11-20):
//   packages/server/src/services/generation/prompt-attachments.ts (the whole file)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed;
//   - Node's Buffer is not in the browser: Buffer.byteLength(x, "utf8") → utf8ByteLength(x) (TextEncoder), Buffer.from(x, "base64").toString("utf8") → atob + TextDecoder; nothing else


const IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT = 6 * 1024 * 1024;
const FILE_ATTACHMENT_PROVIDER_BYTE_LIMIT = 20 * 1024 * 1024;
const READABLE_ATTACHMENT_PROMPT_BYTE_LIMIT = 20 * 1024 * 1024;
const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  "csv",
  "json",
  "jsonl",
  "log",
  "markdown",
  "md",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

const utf8ByteLength = (text) => new TextEncoder().encode(text).length;

/** Parse a JSON extra field safely. */
export function parseExtra(extra) {
  if (!extra) return {};
  try {
    const parsed = typeof extra === "string" ? JSON.parse(extra) : extra;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed)
      : {};
  } catch {
    return {};
  }
}

/**
 * A Conversation selfie the character sent. Selfies are the only generated images saved as
 * `selfie_*` with type "image"; Illustrator images share that type but stay hidden from the model.
 */
export function isSentSelfieAttachment(attachment) {
  return attachment.type === "image" && !!attachment.filename?.startsWith("selfie_");
}

export function getAttachmentFilename(attachment) {
  const rawName = attachment.filename ?? attachment.name;
  return typeof rawName === "string" && rawName.trim() ? rawName.trim() : "attachment";
}

export function extractImageAttachmentDataUrls(attachments) {
  return (attachments ?? [])
    .filter((attachment) => typeof attachment.type === "string" && attachment.type.startsWith("image/"))
    .map((attachment) => attachment.data)
    .filter((data) => typeof data === "string" && data.length > 0)
    .filter((data) => estimateDataUrlBytes(data) <= IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT);
}

export function extractFileAttachmentInputs(
  attachments,
) {
  return (attachments ?? []).flatMap((attachment) => {
    const type = normalizeProviderFileAttachmentType(attachment);
    if (!type || typeof attachment.data !== "string") return [];
    if (estimateDataUrlBytes(attachment.data) > READABLE_ATTACHMENT_PROMPT_BYTE_LIMIT) return [];
    const data = normalizeDataUrlMimeType(attachment.data, type);
    if (!data) return [];
    return [{ type, data, filename: getAttachmentFilename(attachment) }];
  });
}

function normalizeProviderFileAttachmentType(attachment) {
  const type = typeof attachment.type === "string" ? attachment.type.toLowerCase().trim() : "";
  const filename = getAttachmentFilename(attachment).toLowerCase();
  if (type === "application/pdf" || filename.endsWith(".pdf")) return "application/pdf";
  return null;
}

function normalizeDataUrlMimeType(dataUrl, mimeType) {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return null;
  const meta = dataUrl.slice(5, commaIndex).toLowerCase();
  if (!meta.includes(";base64")) return null;
  return `data:${mimeType};base64,${dataUrl.slice(commaIndex + 1)}`;
}

function estimateDataUrlBytes(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return utf8ByteLength(dataUrl);

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  if (!meta.includes(";base64")) {
    let bytes = 0;
    let segmentStart = 0;
    for (const match of payload.matchAll(/%[0-9a-f]{2}/gi)) {
      bytes += utf8ByteLength(payload.slice(segmentStart, match.index)) + 1;
      segmentStart = match.index + match[0].length;
    }
    return bytes + utf8ByteLength(payload.slice(segmentStart));
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function isReadableTextAttachment(attachment) {
  const type = typeof attachment.type === "string" ? attachment.type.toLowerCase() : "";
  if (type.startsWith("text/")) return true;
  if (
    type === "application/json" ||
    type === "application/ld+json" ||
    type === "application/xml" ||
    type === "application/x-yaml" ||
    type === "application/yaml"
 ) {
    return true;
  }

  const name = getAttachmentFilename(attachment).toLowerCase();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return !!extension && TEXT_ATTACHMENT_EXTENSIONS.has(extension);
}

function decodeDataUrlText(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return null;

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (meta.includes(";base64")) {
      return new TextDecoder("utf-8").decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)));
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

export function escapeXmlAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Read the same bounded source text for prompt formatting and derived memories. */
export function readableAttachmentText(
  attachment,
) {
  if (!isReadableTextAttachment(attachment) || typeof attachment.data !== "string") return null;
  if (estimateDataUrlBytes(attachment.data) > FILE_ATTACHMENT_PROVIDER_BYTE_LIMIT) return null;
  const text = decodeDataUrlText(attachment.data);
  if (!text?.trim()) return null;
  return {
    filename: getAttachmentFilename(attachment),
    type: typeof attachment.type === "string" && attachment.type.trim() ? attachment.type.trim() : "text/plain",
    text,
  };
}

export function buildReadableAttachmentBlocks(attachments) {
  return (attachments ?? []).flatMap((attachment) => {
    const readable = readableAttachmentText(attachment);
    if (!readable) return [];
    const { filename, type, text } = readable;

    return [
      [
        `<attached_file name="${escapeXmlAttribute(filename)}" type="${escapeXmlAttribute(type)}">`,
        text,
        `</attached_file>`,
      ].join("\n"),
    ];
  });
}

export function appendReadableAttachmentsToContent(
  content,
  attachments,
) {
  const blocks = buildReadableAttachmentBlocks(attachments);
  if (blocks.length === 0) return content;
  return `${content}${content.trim() ? "\n\n" : ""}${blocks.join("\n\n")}`;
}
