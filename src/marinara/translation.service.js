// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at cfc726e93 (staging, 2026-11-23):
//   packages/server/src/services/translation.service.ts (the whole file) and
//   packages/server/src/routes/translate.routes.ts (POST /api/translate: translateText with the body — here a call)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive (the same code runs in the browser and in the server plugin's worker):
//   - TypeScript types removed. Marinara's database is our Orbit: what the functions read and write comes in `store`
//     (src/phone2translate.js makes it):
//       store.connections.getWithKey(id) → the connection or null (Marinara's createConnectionsStorage(db).getWithKey):
//         { id, kind ("custom" | "vertex" | "source" | "ai" | "profile"), baseUrl (custom: its address; the others go
//           through SillyTavern and need none: "-"), model, storedMaxTokens (the connection's own max tokens, Marinara's
//           saved defaultParameters.maxTokens) | undefined, maxTokensOverride | null,
//           chatComplete(messages, { model, debugMode, temperature, maxTokens }) → { content } }
//       store.chats: getMessage(messageId) → { id, chatId, role, content, extra } | null (a message is its own swipe here:
//         a reply set aside by a swipe keeps its own messages) · updateMessageExtraForSwipe(messageId, swipeIndex, partial,
//         expectedContent) → the message | null (Marinara's chats.storage.ts, with the same "edited or hidden since" check)
//   - zod: the schema is checked by hand with zod's limits (validateTranslateInput). A body that fails throws
//     "유효성 검사 오류" (Marinara's error handler answers "Validation Error") with each issue in `details`.
//   - DeepL and DeepLX are removed (소망, 2026-11-23): the provider is "ai" or "google"; translateWithDeepLX,
//     resolveDeeplApiKey and translateWithDeepL are not here, and neither are their body keys (deeplApiKey, deeplxUrl).
//   - The fallback connection (Marinara's connections.getFallbackForMain + withConnectionFallbackProvider) is not here:
//     this extension has no fallback connection yet (docs/MARINARA-PORT.md "꼭 할 것").
//   - safeFetch → fetch: the 15-second timeout and the 1 MB answer limit are kept (Marinara's readCappedResponse
//     error, in Korean). Google answers any page (access-control-allow-origin: *), so the browser calls it itself.
//   - Error and log texts are Marinara's, in Korean (합니다체). statusCode is kept on each error.
//   - logDebugOverride is our shim (src/marinara/shims.js): there is no debug mode here.
import { isDebugAgentsEnabled, logDebugOverride } from "./shims.js";
import { DEFAULT_TRANSLATION_SYSTEM_PROMPT, resolveTranslationSystemPrompt } from "./translation-prompt.js";

const GOOGLE_MAX_LENGTH = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

// (Marinara's translateSchema, zod 4: the same keys, types, limits and trim; an unknown key is dropped as zod does)
//   chatId?: string · debugMode?: boolean · text: string 1..50000 · provider: "ai" | "google" · targetLanguage: string,
//   trimmed, 1..100 · connectionId?: string · systemPrompt?: string ≤ 5000 | null
const PROVIDERS = ["ai", "google"];
export function validateTranslateInput(body) {
  const issues = [];
  const out = {};
  const src = body && typeof body === "object" && !Array.isArray(body) ? body : null;
  if (!src) {
    issues.push({ path: "", message: "잘못된 입력: object가 필요합니다" });
  } else {
    const str = (key, { optional = false, nullable = false, min = null, max = null, trim = false } = {}) => {
      let v = src[key];
      if (v === undefined && optional) return;
      if (v === null && nullable) { out[key] = null; return; }
      if (typeof v !== "string") {
        issues.push({ path: key, message: `잘못된 입력: string이 필요하지만 ${v === undefined ? "undefined" : v === null ? "null" : Array.isArray(v) ? "array" : typeof v}을(를) 받았습니다` });
        return;
      }
      if (trim) v = v.trim();
      if (min !== null && v.length < min) { issues.push({ path: key, message: `너무 작음: string은 ${min}자 이상이어야 합니다` }); return; }
      if (max !== null && v.length > max) { issues.push({ path: key, message: `너무 큼: string은 ${max}자 이하여야 합니다` }); return; }
      out[key] = v;
    };
    str("chatId", { optional: true });
    if (src.debugMode !== undefined) {
      if (typeof src.debugMode === "boolean") out.debugMode = src.debugMode;
      else issues.push({ path: "debugMode", message: "잘못된 입력: boolean이 필요합니다" });
    }
    str("text", { min: 1, max: 50000 });
    if (PROVIDERS.includes(src.provider)) out.provider = src.provider;
    else issues.push({ path: "provider", message: `잘못된 선택: ${PROVIDERS.map((p) => `"${p}"`).join("|")} 중 하나가 필요합니다` });
    str("targetLanguage", { trim: true, min: 1, max: 100 });
    str("connectionId", { optional: true });
    str("systemPrompt", { optional: true, nullable: true, max: 5000 });
  }
  if (issues.length) throw Object.assign(new Error("유효성 검사 오류"), { statusCode: 400, details: issues });
  return out;
}

export async function translateText(store, body, onFallback) {
  const input = validateTranslateInput(body);
  const connections = store.connections;
  switch (input.provider) {
    case "ai":
      return translateWithAI(input, connections, onFallback);
    case "google":
      return translateWithGoogle(input);
  }
}

/** Translate the saved, final swipe so closing the browser cannot skip translation or its persistence. */
export async function translateGeneratedMessage(store, input, onFallback) {
  const chats = store.chats;
  const message = await chats.getMessage(input.messageId);
  if (!message || message.chatId !== input.chatId || message.role !== "assistant") return null;
  const swipe = message;
  const extra = swipe.extra && typeof swipe.extra === "object" ? swipe.extra : {};
  if (extra.translationHidden === true || extra.hiddenFromUser === true || extra.commandOnly === true) return null;
  // (Marinara's Game mode builds its own source here; there is no Game mode in this extension)
  const text = swipe.content;
  if (!text.trim() || (extra.translationSource === text && typeof extra.translation === "string" && extra.translation))
    return null;
  // Mark this source before the provider call so a reconnect cannot start a second automatic attempt.
  if (
    !(await chats.updateMessageExtraForSwipe(
      message.id,
      input.swipeIndex,
      { automaticTranslationSource: swipe.content },
      swipe.content,
    ))
  )
    return null;
  const { config } = input;
  const { translatedText } = await (store.translateText ?? translateText)(
    store,
    {
      chatId: input.chatId,
      text,
      provider: config.provider,
      targetLanguage: config.outputTargetLanguage,
      connectionId: config.connectionId,
      systemPrompt: config.outputSystemPrompt,
      debugMode: input.debugMode,
    },
    onFallback,
  );
  if (!translatedText.trim()) throw new Error("번역 제공자가 텍스트를 반환하지 않았습니다");
  return chats.updateMessageExtraForSwipe(
    message.id,
    input.swipeIndex,
    {
      translation: translatedText,
      translationSource: text,
      translationHidden: false,
    },
    swipe.content,
  );
}

// ── AI Translation (via configured LLM connection) ──
async function translateWithAI(input, connections, _onFallback) {
  if (!input.connectionId) {
    throw Object.assign(new Error("AI 번역에는 연결 ID가 필요합니다"), { statusCode: 400 });
  }

  const conn = await connections.getWithKey(input.connectionId);
  if (!conn) {
    throw Object.assign(new Error("API 연결을 찾을 수 없습니다"), { statusCode: 400 });
  }

  const baseUrl = conn.baseUrl;
  if (!baseUrl) {
    throw Object.assign(new Error("이 연결에 기본 URL이 설정되지 않았습니다"), { statusCode: 400 });
  }

  // (no fallback connection here: the connection itself)
  const provider = conn;
  const systemPrompt = resolveTranslationSystemPrompt(
    input.systemPrompt?.trim() || DEFAULT_TRANSLATION_SYSTEM_PROMPT,
    input.targetLanguage,
  );
  logDebugOverride(
    input.debugMode === true || isDebugAgentsEnabled(),
    "[translate] system=%s user=%s",
    systemPrompt,
    `Translate the following text to ${input.targetLanguage}:\n\n${input.text}`,
  );
  const result = await provider.chatComplete(
    [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Translate the following text to ${input.targetLanguage}:\n\n${input.text}`,
      },
    ],
    {
      model: conn.model,
      debugMode: input.debugMode,
      temperature: 0.3,
      // (Marinara's resolveStoredMaxTokens(conn.defaultParameters, provider.maxTokensOverrideValue ?? 4096))
      maxTokens: conn.storedMaxTokens ?? conn.maxTokensOverride ?? 4096,
    },
  );

  return { translatedText: (result.content ?? "").trim() };
}

// (safeFetch's buffered answer, at most maxResponseBytes: Marinara's readCappedResponse)
async function readCapped(response, maxBytes) {
  const buf = await response.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new Error(`외부 응답이 ${maxBytes}바이트를 초과했습니다`);
  return JSON.parse(new globalThis.TextDecoder().decode(buf));
}

// ── Google Translate (free API) ──
async function translateWithGoogle(input) {
  if (input.text.length > GOOGLE_MAX_LENGTH) {
    throw Object.assign(
      new Error(
        `Google 번역에는 텍스트가 너무 깁니다(최대 ${GOOGLE_MAX_LENGTH}자). 더 긴 텍스트에는 AI 제공자를 사용하세요.`,
      ),
      { statusCode: 400 },
    );
  }

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", input.targetLanguage);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", input.text);

  const response = await globalThis.fetch(url.toString(), {
    signal: globalThis.AbortSignal.timeout(15_000),
  }).catch((err) => {
    if (err.name === "TimeoutError")
      throw Object.assign(new Error("Google 번역 요청 시간이 초과되었습니다"), { statusCode: 502 });
    throw err;
  });

  if (!response.ok) {
    throw Object.assign(new Error(`Google 번역이 ${response.status}을(를) 반환했습니다`), { statusCode: 502 });
  }

  const data = await readCapped(response, MAX_RESPONSE_BYTES);

  // Google returns nested arrays: [[["translated text", "original text", ...], ...], ...]
  let translated = "";
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (const segment of data[0]) {
      if (Array.isArray(segment) && segment[0]) {
        translated += segment[0];
      }
    }
  }

  return { translatedText: translated };
}
