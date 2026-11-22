// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at 32c47a1 (staging, 2026-11-20):
//   packages/client/src/components/chat/ConversationInput.tsx — the attachment parts only:
//     the Attachment shape, TEXT_ATTACHMENT_EXTENSIONS, PDF_ATTACHMENT_MIME_TYPE, getFileExtension, inferAttachmentType,
//     isSupportedChatAttachment, handleFileUpload (the reading loop), the pendingAttachments mapping in handleSend,
//     and the file input's accept list
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed;
//   - handleFileUpload is a React callback there (it shows a toast for each refused file and appends into the
//     composer's state). Here it is readChatAttachments(files, { onError, onRead }): the same checks and the same
//     loop, with the toast as onError(reason, name) and the append as its returned list;
//   - the rest of the component (drafts per chat, the composer, slash commands, the GIF picker) is not brought.
import { prepareImageAttachment, readBlobAsDataUrl } from "./chat-attachment-images.js";

export const TEXT_ATTACHMENT_EXTENSIONS = new Set([
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
export const PDF_ATTACHMENT_MIME_TYPE = "application/pdf";

/** The file input's `accept` list. */
export const CHAT_ATTACHMENT_ACCEPT =
  "image/*,application/pdf,.pdf,.txt,.md,.markdown,.json,.jsonl,.csv,.log,.xml,.yaml,.yml";

export const CHAT_ATTACHMENT_MAX_SIZE = 20 * 1024 * 1024;

export function getFileExtension(fileName) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function inferAttachmentType(file) {
  const extension = getFileExtension(file.name);
  if (extension === "pdf") return PDF_ATTACHMENT_MIME_TYPE;
  if (file.type) return file.type;
  if (extension === "json" || extension === "jsonl") return "application/json";
  if (extension === "csv") return "text/csv";
  if (extension === "md" || extension === "markdown") return "text/markdown";
  if (extension === "xml") return "application/xml";
  if (extension === "yaml" || extension === "yml") return "application/yaml";
  if (extension === "txt" || extension === "log") return "text/plain";
  return "application/octet-stream";
}

export function isSupportedChatAttachment(file) {
  if (file.type.startsWith("image/")) return true;
  if (file.type.startsWith("text/")) return true;
  const type = inferAttachmentType(file);
  if (type === PDF_ATTACHMENT_MIME_TYPE) return true;
  if (
    type === "application/json" ||
    type === "application/xml" ||
    type === "application/yaml" ||
    type === "application/x-yaml"
  ) {
    return true;
  }
  return TEXT_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name));
}

/**
 * handleFileUpload: files over 20 MB and unsupported files are refused, images are prepared (resized, GIFs made
 * still), the rest is read as it is. onError(reason, name): "size" | "unsupported" | "prepare" | "read".
 * onRead(): one accepted file is done (read or failed), for a "reading…" count.
 */
export async function readChatAttachments(files, { onError = () => {}, onRead = () => {}, prepare = prepareImageAttachment, read = readBlobAsDataUrl } = {}) {
  if (!files) return [];
  const MAX_SIZE = CHAT_ATTACHMENT_MAX_SIZE;
  const acceptedFiles = Array.from(files).filter((file) => {
    if (file.size > MAX_SIZE) {
      onError("size", file.name);
      return false;
    }
    if (!isSupportedChatAttachment(file)) {
      onError("unsupported", file.name || "");
      return false;
    }
    return true;
  });

  const attachments = [];
  if (acceptedFiles.length === 0) return attachments;

  for (const file of acceptedFiles) {
    const displayName = file.name || "pasted-file";
    if (file.type.startsWith("image/")) {
      try {
        attachments.push(await prepare(file, displayName));
      } catch {
        onError("prepare", displayName);
      } finally {
        onRead();
      }
      continue;
    }

    try {
      const data = await read(file);
      attachments.push({ type: inferAttachmentType(file), data, name: displayName });
    } catch {
      onError("read", displayName);
    } finally {
      onRead();
    }
  }
  return attachments;
}

/** handleSend's pendingAttachments: what goes with the message. */
export function toPendingAttachments(attachments) {
  return attachments.map((attachment) => ({
    type: attachment.type,
    data: attachment.data,
    filename: attachment.name,
    name: attachment.name,
  }));
}
