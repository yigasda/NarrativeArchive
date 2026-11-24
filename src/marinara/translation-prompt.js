// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at cfc726e93 (staging, 2026-11-23):
//   packages/shared/src/constants/defaults.ts (lines 51–58: the translation prompt and its placeholder; the rest of that
//   file is other features' defaults and is not taken)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; the prompt is word for word

/** Default system prompt for AI-backed translation. */
export const DEFAULT_TRANSLATION_SYSTEM_PROMPT =
  "You are a translator. Translate the given text accurately into {{targetLanguage}}, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.";

/** Resolve the documented language placeholder in a custom translation prompt. */
export function resolveTranslationSystemPrompt(prompt, targetLanguage) {
  return prompt.replaceAll("{{targetLanguage}}", targetLanguage.trim());
}
