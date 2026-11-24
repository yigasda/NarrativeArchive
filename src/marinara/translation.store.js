// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at cfc726e93 (staging, 2026-11-23):
//   packages/client/src/stores/translation.store.ts (the whole file)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; zustand's create() is a few lines here (getState · setState · subscribe), with set()
//     merging what the function returns as zustand does. The actions are word for word.
//   - The default config has no DeepL fields (DeepL and DeepLX are removed, 소망 2026-11-23).

function create(init) {
  let state;
  const listeners = new Set();
  const set = (partial) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...next };
    for (const fn of [...listeners]) {
      try { fn(state); } catch { /* a listener's error is its own */ }
    }
  };
  state = init(set);
  return {
    getState: () => state,
    setState: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

// ── Store for translation cache ──
//   config: the currently active chat's TranslationConfig · translations: messageId -> translated text ·
//   translationSources: messageId -> the source text that was translated (used to detect stale swipe/edit content) ·
//   hiddenTranslationIds: messageId -> hidden translation display state · translating: messageId -> currently translating
export const useTranslationStore = create((set) => ({
  config: { provider: "google", inputTargetLanguage: "en", outputTargetLanguage: "en" },
  setConfig: (config) => set({ config }),
  translations: {},
  translationSources: {},
  hiddenTranslationIds: {},
  translating: {},
  setTranslation: (id, text, source) =>
    set((s) => {
      const { [id]: _, ...hiddenRest } = s.hiddenTranslationIds;
      return {
        translations: { ...s.translations, [id]: text },
        translationSources: source === undefined ? s.translationSources : { ...s.translationSources, [id]: source },
        hiddenTranslationIds: hiddenRest,
      };
    }),
  removeTranslation: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.translations;
      const { [id]: __, ...sourceRest } = s.translationSources;
      return {
        translations: rest,
        translationSources: sourceRest,
        hiddenTranslationIds: { ...s.hiddenTranslationIds, [id]: true },
      };
    }),
  /** Drop a cached translation so it can be regenerated, without marking the message hidden. */
  invalidateTranslation: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.translations;
      const { [id]: __, ...sourceRest } = s.translationSources;
      return { translations: rest, translationSources: sourceRest };
    }),
  setTranslating: (id, val) => set((s) => ({ translating: { ...s.translating, [id]: val } })),
  /** Clear all translations (e.g. on chat switch) */
  clearAll: () => set({ translations: {}, translationSources: {}, translating: {}, hiddenTranslationIds: {} }),
  /** Seed translations from message extras (e.g. on chat load) */
  seedFromMessages: (messages) =>
    set((s) => {
      const seeded = {};
      const seededSources = {};
      for (const msg of messages) {
        if (!msg.extra || s.translating[msg.id]) continue;
        try {
          const extra = typeof msg.extra === "string" ? JSON.parse(msg.extra) : msg.extra;
          if (
            extra.translation &&
            typeof extra.translation === "string" &&
            extra.translationHidden !== true &&
            !s.hiddenTranslationIds[msg.id]
          ) {
            seeded[msg.id] = extra.translation;
            if (typeof extra.translationSource === "string") {
              seededSources[msg.id] = extra.translationSource;
            } else if (typeof msg.content === "string") {
              seededSources[msg.id] = msg.content;
            }
          }
        } catch {
          // Skip messages with malformed extra JSON
        }
      }
      // Server translations can arrive after an older result was seeded on chat
      // navigation. Persisted extras win unless a manual translation is in flight.
      return {
        translations: { ...s.translations, ...seeded },
        translationSources: { ...s.translationSources, ...seededSources },
      };
    }),
}));
