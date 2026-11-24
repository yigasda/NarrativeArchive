// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at cfc726e93 (staging, 2026-11-23):
//   packages/shared/src/utils/translator-defaults.ts (the whole file)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed (TranslationConfig is described in words below);
//   - DeepL and DeepLX are removed (소망, 2026-11-23): their two keys ("translationDeeplApiKey", "translationDeeplxUrl") are
//     not in the string keys, "deepl" and "deeplx" are not among the providers kept, and the config has no deeplApiKey or
//     deeplxUrl. A saved "deepl" or "deeplx" is dropped as Marinara drops a provider it does not know, so it reads as Google.
export const TRANSLATOR_DEFAULTS_SETTINGS_KEY = "translator-defaults";

const stringKeys = [
  "translationProvider",
  "translationConnectionId",
  "translationTargetLang",
  "translationInputTargetLang",
  "translationOutputTargetLang",
];
const promptKeys = ["translationPrompt", "translationInputPrompt", "translationOutputPrompt"];
const booleanKeys = ["autoTranslate", "translateInput", "showInputTranslateButton", "translationDisplayOnly"];
export const TRANSLATOR_SETTINGS_KEYS = [...stringKeys, ...promptKeys, ...booleanKeys];

/** Keep only reusable translator settings, including explicit false, empty and prompt-reset values. */
export function normalizeTranslatorSettings(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value;
  const settings = {};
  for (const key of stringKeys) {
    if (typeof source[key] === "string") settings[key] = source[key];
  }
  for (const key of promptKeys) {
    if (source[key] === null || typeof source[key] === "string") settings[key] = source[key];
  }
  for (const key of booleanKeys) {
    if (typeof source[key] === "boolean") settings[key] = source[key];
  }
  if (!["google", "ai"].includes(settings.translationProvider)) {
    delete settings.translationProvider;
  }
  // Resolve legacy shared values before layering a profile over global defaults.
  for (const key of ["translationInputTargetLang", "translationOutputTargetLang"]) {
    if (!(key in settings) && "translationTargetLang" in settings) settings[key] = settings.translationTargetLang;
  }
  for (const key of ["translationInputPrompt", "translationOutputPrompt"]) {
    if (!(key in settings) && "translationPrompt" in settings) settings[key] = settings.translationPrompt;
  }
  return settings;
}

// TranslationConfig: { chatId?, provider: "ai" | "google", inputTargetLanguage, outputTargetLanguage, connectionId?,
//   inputSystemPrompt?, outputSystemPrompt? }

export function getChatTranslationConfig(chatId, metadata) {
  const chatMeta = normalizeTranslatorSettings(metadata);
  const legacyTargetLanguage =
    (typeof chatMeta.translationTargetLang === "string" ? chatMeta.translationTargetLang.trim() : "") || "en";
  const legacySystemPrompt = typeof chatMeta.translationPrompt === "string" ? chatMeta.translationPrompt : undefined;
  const inputSystemPrompt =
    chatMeta.translationInputPrompt === undefined
      ? legacySystemPrompt
      : typeof chatMeta.translationInputPrompt === "string"
        ? chatMeta.translationInputPrompt
        : undefined;
  const outputSystemPrompt =
    chatMeta.translationOutputPrompt === undefined
      ? legacySystemPrompt
      : typeof chatMeta.translationOutputPrompt === "string"
        ? chatMeta.translationOutputPrompt
        : undefined;
  return {
    chatId,
    provider: chatMeta.translationProvider ?? "google",
    // Cleared fields retain the legacy/default language.
    inputTargetLanguage:
      (typeof chatMeta.translationInputTargetLang === "string" ? chatMeta.translationInputTargetLang.trim() : "") ||
      legacyTargetLanguage,
    outputTargetLanguage:
      (typeof chatMeta.translationOutputTargetLang === "string" ? chatMeta.translationOutputTargetLang.trim() : "") ||
      legacyTargetLanguage,
    connectionId: chatMeta.translationConnectionId,
    inputSystemPrompt,
    outputSystemPrompt,
  };
}
