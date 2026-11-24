// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at cfc726e93 (staging, 2026-11-23):
//   packages/client/src/lib/translate-text.ts (the whole file)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; api.post("/translate", body) is the same io.translate the message translation uses
//     (src/marinara/use-translate.js setTranslateIO). The body has no deeplxUrl (DeepL and DeepLX are removed, 소망 2026-11-23).
import { useTranslationStore } from "./translation.store.js";
import { translateIO } from "./use-translate.js";

/** Standalone translate helper for on-demand translation flows. direction: "input" | "output" */
export async function translateText(text, direction = "output") {
  const store = useTranslationStore.getState();
  const isInput = direction === "input";
  const result = await translateIO().translate({
    chatId: store.config.chatId,
    text,
    provider: store.config.provider,
    targetLanguage: isInput ? store.config.inputTargetLanguage : store.config.outputTargetLanguage,
    connectionId: store.config.connectionId,
    systemPrompt: isInput ? store.config.inputSystemPrompt : store.config.outputSystemPrompt,
  });
  return result.translatedText;
}
