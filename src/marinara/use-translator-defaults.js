// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at cfc726e93 (staging, 2026-11-23):
//   packages/client/src/hooks/use-translator-defaults.ts (the whole file), with the server side it calls:
//   packages/server/src/routes/app-settings.routes.ts (GET/PUT /app-settings/translator-defaults: 233~269, the part for
//   this key) and the screen's save/forget handler (packages/client/src/features/chat-settings/sections/
//   TranslationSection.tsx 60~82: its toasts)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; react-query's hooks become plain async functions.
//   - Marinara's app setting "translator-defaults" is our extension setting of the same name (`io` from
//     src/phone2translate.js: readSetting · writeSetting). The chat it is saved from is that room's settings
//     (io.readChatMetadata, chatId `<world id>:<room id>`). waitForPendingChatMetadataSaves is io.waitForSaves.
//   - The server's DeepL key mask (maskTranslatorDefaults · resolveChatMetadataSecretPlaceholders · sealChatMetadataSecrets)
//     is not here: DeepL is removed (소망, 2026-11-23), so no key is ever in these settings.
//   - The toasts are the screen's (TranslationSection.tsx): saveTranslatorDefaultsWithToast does what its handler does.
//     Their texts are Marinara's en.json, in Korean.
import { TRANSLATOR_DEFAULTS_SETTINGS_KEY, normalizeTranslatorSettings } from "./translator-defaults.js";

let io = {
  readSetting: () => null,
  writeSetting: async () => {},
  readChatMetadata: async () => ({}),
  waitForSaves: async () => {},
  toastSuccess: () => {},
  toastError: () => {},
};
export const setTranslatorDefaultsIO = (next) => { io = { ...io, ...next }; };

/** Whether new-chat translator defaults are saved (Marinara: Boolean(GET /app-settings/translator-defaults .value)). */
export async function useTranslatorDefaults() {
  return Boolean(await io.readSetting(TRANSLATOR_DEFAULTS_SETTINGS_KEY));
}

/** Save the latest persisted translator choices; null forgets only the new-chat defaults. */
export async function useSaveTranslatorDefaults(chatId) {
  let value = "";
  if (chatId) {
    await io.waitForSaves(chatId);
    const metadata = await io.readChatMetadata(chatId);
    value = JSON.stringify(normalizeTranslatorSettings(metadata));
  }
  await io.writeSetting(TRANSLATOR_DEFAULTS_SETTINGS_KEY, value);
  return Boolean(value);
}

// (TranslationSection.tsx saveTranslatorDefaults: the toasts around the save)
export async function saveTranslatorDefaultsWithToast(sourceChatId) {
  try {
    await useSaveTranslatorDefaults(sourceChatId);
    io.toastSuccess(sourceChatId ? "새 채팅용 번역기 기본값을 저장했습니다." : "저장한 번역기 기본값을 지웠습니다. 기존 채팅은 설정을 그대로 유지합니다.");
    return true;
  } catch {
    io.toastError("번역기 기본값을 바꾸지 못했습니다. 다시 시도해 주세요.");
    return false;
  }
}
