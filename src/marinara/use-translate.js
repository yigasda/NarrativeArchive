// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at cfc726e93 (staging, 2026-11-23):
//   packages/client/src/hooks/use-translate.ts (the whole file)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed. React's hook becomes a plain function (useTranslate() returns the same fields; the
//     screen draws again from the store instead of re-rendering).
//   - Marinara's queryClient · api are our Orbit: `io` (src/phone2translate.js setTranslateIO) gives
//       io.translate(body) → { translatedText }   (Marinara: api.post("/translate", body) → the server's translateText)
//       io.patchExtra(chatId, messageId, extra)   (Marinara: api.patch(`/chats/${chatId}/messages/${messageId}/extra`)
//                                                  then the cached message's extra; here one write into the message the
//                                                  screen draws, and the save)
//       io.toastError(text) · io.logError(...args)
//   - The request body has no deeplxUrl (DeepL and DeepLX are removed, 소망 2026-11-23).
//   - Error texts are Marinara's, in Korean ("Translation failed" → "번역에 실패했습니다", "Translation failed:" in the log).
import { useTranslationStore } from "./translation.store.js";

let io = {
  translate: async () => { throw new Error("번역할 수 없습니다"); },
  patchExtra: async () => {},
  toastError: () => {},
  logError: () => {},
};
export const setTranslateIO = (next) => { io = { ...io, ...next }; };
export const translateIO = () => io;

const translationPersistenceQueues = new Map();
const pendingTranslations = new Map();
const queuedTranslations = new Set();

/** Editing a source also invalidates requests that have not returned yet. */
export function invalidateTranslation(messageId) {
  for (const pending of [...pendingTranslations.values(), ...queuedTranslations]) {
    if (pending.messageId === messageId) pending.invalidated = true;
  }
  useTranslationStore.getState().invalidateTranslation(messageId);
}

export function enqueueTranslationPersistence(chatId, messageId, extra, isValid = () => true) {
  const queueKey = `${chatId}:${messageId}`;
  const previous = translationPersistenceQueues.get(queueKey) ?? Promise.resolve();
  const request = previous
    .catch(() => undefined)
    .then(async () => {
      if (!isValid()) return;
      await io.patchExtra(chatId, messageId, extra);
    });
  const settled = request.then(
    () => undefined,
    () => undefined,
  );
  translationPersistenceQueues.set(queueKey, settled);
  void settled.finally(() => {
    if (translationPersistenceQueues.get(queueKey) === settled) {
      translationPersistenceQueues.delete(queueKey);
    }
  });
  return request;
}

/** Shared by manual and automatic translation; navigation must not change the request's settings. */
export function translateMessage(messageId, text, config, chatId) {
  const requestChatId = chatId ?? config.chatId;
  const key = `${requestChatId ?? ""}:${messageId}`;
  const pending = pendingTranslations.get(key);
  if (pending) {
    // Finish the previous source (including persistence) before translating a regenerated reply.
    if (pending.text === text && !pending.invalidated) return pending.request;
    const queued = { messageId, invalidated: false };
    queuedTranslations.add(queued);
    return pending.request
      .catch(() => undefined)
      .then(() => {
        queuedTranslations.delete(queued);
        if (!queued.invalidated) return translateMessage(messageId, text, config, chatId);
      });
  }
  const store = useTranslationStore.getState();
  const isCurrentChat = () => useTranslationStore.getState().config.chatId === requestChatId;
  if (isCurrentChat()) store.setTranslating(messageId, true);
  const attempt = { messageId, text, request: Promise.resolve(), invalidated: false };
  const request = (async () => {
    let translatedText;
    try {
      const result = await io.translate({
        chatId: requestChatId,
        text,
        provider: config.provider,
        targetLanguage: config.outputTargetLanguage,
        connectionId: config.connectionId,
        systemPrompt: config.outputSystemPrompt,
      });
      if (attempt.invalidated) return;
      translatedText = result.translatedText;
      if (chatId) {
        await enqueueTranslationPersistence(
          chatId,
          messageId,
          { translation: translatedText, translationSource: text, translationHidden: false },
          () => !attempt.invalidated,
        ).catch(() => {});
      }
      // Navigation can return to this chat while its extras are being saved.
      // Publish after persistence so a seeded, older translation cannot win.
      if (!attempt.invalidated && isCurrentChat()) store.setTranslation(messageId, translatedText, text);
    } finally {
      if (isCurrentChat()) store.setTranslating(messageId, false);
    }
  })();
  attempt.request = request;
  pendingTranslations.set(key, attempt);
  void request
    .finally(() => {
      if (pendingTranslations.get(key)?.request === request) pendingTranslations.delete(key);
    })
    .catch(() => {});
  return request;
}

// ── Hook ──
export function useTranslate() {
  const { translations, translationSources, translating, config } = useTranslationStore.getState();

  const translate = async (messageId, text, chatId, currentSourceAliases = []) => {
    const store = useTranslationStore.getState();
    const requestChatId = chatId ?? store.config.chatId;
    const isCurrentChat = () => useTranslationStore.getState().config.chatId === requestChatId;
    const storedSource = store.translationSources[messageId];
    const translationMatchesCurrentText = storedSource === text || currentSourceAliases.includes(storedSource);

    // Toggle off if already translated. Keep the saved translation, but persist the hidden display state.
    if (store.translations[messageId] && translationMatchesCurrentText) {
      store.removeTranslation(messageId);
      if (chatId) {
        enqueueTranslationPersistence(chatId, messageId, { translationHidden: true }).catch(() => {});
      }
      return;
    }

    try {
      await translateMessage(messageId, text, store.config, chatId);
    } catch (err) {
      io.logError("번역에 실패했습니다:", err);
      if (isCurrentChat()) io.toastError(err instanceof Error ? err.message : "번역에 실패했습니다");
    }
  };

  return {
    translate,
    translations,
    translationSources,
    translating,
    config,
  };
}
