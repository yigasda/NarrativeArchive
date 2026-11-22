// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at 32c47a1 (staging, 2026-11-20):
//   packages/shared/src/constants/image-captioning-prompt.ts (the whole file)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; nothing else
/** Built-in instructions for describing image attachments. Used when a chat has no custom captioning prompt. */
export const DEFAULT_IMAGE_CAPTIONING_PROMPT =
  "You describe image attachments for a downstream chat model that may not support vision. " +
  "Write a faithful, concise description of the visible content, including readable text, subjects, setting, style, and any details important for conversation continuity. " +
  "Do not answer the chat and do not add speculation beyond what is visible.";
