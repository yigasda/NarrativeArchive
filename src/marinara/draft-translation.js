// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at cfc726e93 (staging, 2026-11-23):
//   packages/client/src/lib/draft-translation.ts (the whole file)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; sonner's toast.error is the same io.toastError the message translation uses
//     (src/marinara/use-translate.js setTranslateIO: SillyTavern's toastr in the browser).
//   - Texts are Marinara's, in Korean: "Translation returned an empty message." · "Failed to translate draft".
import { translateIO } from "./use-translate.js";

export async function translateDraftText(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const { translateText } = await import("./translate-text.js");
    const translated = await translateText(trimmed, "input");
    const next = translated.trim();
    if (!next) {
      translateIO().toastError("번역 결과가 빈 메시지입니다.");
      return null;
    }
    return next;
  } catch (error) {
    translateIO().toastError(error instanceof Error ? error.message : "초안을 번역하지 못했습니다");
    return null;
  }
}
