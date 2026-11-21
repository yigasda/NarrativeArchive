// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at fc0333c:
//   packages/server/src/services/generation/smart-group-decision.ts (smartOrderQuestions, chooseSmartResponders),
//   packages/server/src/services/generation/conversation-context-utils.ts (formatSmartGroupCandidates),
//   packages/server/src/routes/generate/conversation-presence-runtime.ts (orderConversationRespondersByDelay),
//   packages/server/src/routes/generate.routes.ts (the group responder selection inside the generate route:
//   getExplicitlyMentionedCharacterIds, parseSmartGroupSelectionIds, findLastSpeakerId, the selector prompt,
//   selectFallbackSmartGroupResponder, the response order, and the @Name invitation line), and
//   packages/shared/src/types/chat.ts (normalizeGroupChatMode).
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed;
//   - the functions that were closures inside the generate route take what they closed over as arguments
//     (the available characters, the chat messages, the display names); their bodies and the prompt text are as they are;
//   - smartOrderState is not here: it needs Marinara's Decision model backend (services/decision), which is not ported.
import { normalizeTextForMatch } from "./text-matching.js";

/** The one reading of a stored group mode: anything but "individual" is the default Merged mode. */
export function normalizeGroupChatMode(value) {
  return value === "individual" ? "individual" : "merged";
}

/** The transcript the chat-model selector reads, so both paths judge the same turns. */
export const SMART_ORDER_TRANSCRIPT_DEPTH = 5;

/** One question per candidate, keyed by character id. */
export function smartOrderQuestions(candidates) {
  return candidates.map((candidate) => ({
    id: candidate.id,
    instructions: `${candidate.name} has a natural, immediate reason to respond to the latest message.`,
  }));
}

/**
 * Turn per-candidate probabilities into a response queue.
 *
 * Returns null when the answers cannot support a choice (none came back), so the caller
 * falls back to the chat-model selector rather than guessing.
 */
export function chooseSmartResponders(args) {
  const scored = args.candidateIds
    .map((id, index) => ({ id, index, p: args.answers.get(id) }))
    .filter((entry) => typeof entry.p === "number")
    // Most likely first; roster order breaks a tie so the result is stable.
    .sort((a, b) => b.p - a.p || a.index - b.index);
  if (scored.length === 0) return null;

  const passing = scored.filter((entry) => entry.p >= args.threshold);
  // Not the same character twice in a row when anyone else has a reason to speak.
  const withoutRepeat = passing.filter((entry) => entry.id !== args.lastSpeakerId);
  const chosen = withoutRepeat.length > 0 ? withoutRepeat : passing;

  if (chosen.length === 0) {
    // Nobody cleared the threshold, but somebody has to answer the user. The most
    // likely candidate who did not just speak is a better pick than the first in the
    // roster, which is what the plain fallback would take.
    const best = scored.find((entry) => entry.id !== args.lastSpeakerId) ?? scored[0];
    return [best.id];
  }
  // Roleplay usually wants exactly one speaker; Conversation lets everyone with a
  // reason reply, most likely first.
  return args.mode === "roleplay" ? [chosen[0].id] : chosen.map((entry) => entry.id);
}

export function formatSmartGroupCandidates(candidates, useCandidateBlocks) {
  return candidates
    .map((candidate) => {
      const fields = [
        `id: ${candidate.id}`,
        `name: ${candidate.name}`,
        `talkativeness: ${candidate.talkativeness}%`,
        candidate.status !== undefined ? `current status: ${candidate.status}` : null,
        candidate.activity ? `current activity: ${candidate.activity}` : null,
        candidate.personality ? `personality: ${candidate.personality}` : null,
        candidate.description ? `description: ${candidate.description}` : null,
      ].filter((field) => field !== null);

      if (useCandidateBlocks) return ["<candidate>", ...fields, "</candidate>"].join("\n");
      return fields.map((field, index) => `${index === 0 ? "- " : "  "}${field}`).join("\n");
    })
    .join("\n\n");
}

export function orderConversationRespondersByDelay(characterIds, delays) {
  return characterIds
    .map((characterId, index) => ({ characterId, index, delayMs: delays.get(characterId)?.delayMs ?? 0 }))
    .sort((left, right) => left.delayMs - right.delayMs || left.index - right.index)
    .map(({ characterId }) => characterId);
}

/**
 * Who a text addresses with @Name (or, for the user's message, by the names the client sent and by
 * replying to a character's message).
 *   text: the latest user text, or a character's reply (assistantText)
 *   requestedNames: the names the client sent with the user's message (empty for a character's reply)
 *   replyCharacterId: the character whose message the user replied to, if any
 *   candidates: [{ id, name, displayName? }]
 */
export function getExplicitlyMentionedCharacterIds({ text, requestedNames = [], replyCharacterId, candidates }) {
  const latestUserText = String(text ?? "");
  const requested = new Set(requestedNames.map((name) => normalizeTextForMatch(name)));
  return candidates
    .filter((character) => {
      if (character.id === replyCharacterId) return true;
      const names = [character.name, character.displayName].filter(
        (name) => typeof name === "string" && name.trim().length > 0,
      );
      if (names.some((name) => requested.has(normalizeTextForMatch(name)))) return true;
      return names.some((name) => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?:^|[\\s\\p{P}\\p{S}])@${escaped}(?=$|[\\s\\p{P}\\p{S}])`, "iu").test(latestUserText);
      });
    })
    .map((character) => character.id);
}

/** availableGroupCharacters: [{ id, name, displayName? }] */
export function parseSmartGroupSelectionIds(raw, availableGroupCharacters) {
  const cleaned = raw
    .trim()
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "");
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  if (arrayStart < 0 && objectStart < 0) return [];

  const parsed =
    arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)
      ? JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1))
      : JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
  const parsedRecord = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const rawIds = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsedRecord.characterIds)
      ? parsedRecord.characterIds
      : Array.isArray(parsedRecord.characters)
        ? parsedRecord.characters
        : [];
  const validIds = new Set(availableGroupCharacters.map((character) => character.id));
  const namesByLower = new Map(
    availableGroupCharacters.flatMap((character) => {
      const displayName = character.displayName;
      return [character.name, displayName]
        .filter((name) => typeof name === "string" && name.trim().length > 0)
        .map((name) => [normalizeTextForMatch(name), character.id]);
    }),
  );
  const selected = [];

  for (const rawId of rawIds) {
    const value = String(rawId).trim();
    const id = validIds.has(value) ? value : (namesByLower.get(normalizeTextForMatch(value)) ?? "");
    if (validIds.has(id) && !selected.includes(id)) selected.push(id);
  }

  return selected;
}

export const findLastSpeakerId = (chatMessages) =>
  [...chatMessages]
    .reverse()
    .find((message) => message.role === "assistant" && typeof message.characterId === "string")?.characterId ?? null;

export const selectFallbackSmartGroupResponder = (availableGroupCharacters, chatMessages) => {
  const lastAssistantCharacterId = findLastSpeakerId(chatMessages);
  const fallback =
    availableGroupCharacters.find((character) => character.id !== lastAssistantCharacterId)?.id ??
    availableGroupCharacters[0]?.id ??
    null;
  return fallback ? [fallback] : [];
};

/**
 * The transcript lines the selector reads: the last five user/assistant messages, 900 characters each.
 *   messages: [{ role, content }]; speakerOf(message) → the speaker's name
 */
export function buildSmartGroupRecentTranscript(messages, speakerOf) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-SMART_ORDER_TRANSCRIPT_DEPTH)
    .map((message) => {
      const speaker = speakerOf(message);
      const content = String(message.content ?? "")
        .replace(/\s+/g, " ")
        .trim();
      return `${speaker}: ${content.slice(0, 900)}`;
    })
    .filter(Boolean)
    .join("\n");
}

/** The selector request (the system and user messages), as the generate route builds it. */
export function buildSmartGroupSelectionPrompt({ chatMode, personaName, candidates, recentTranscript }) {
  const selectorInstructions =
    chatMode === "conversation"
      ? [
          `You are a hidden response orchestrator for a Conversation-mode group chat.`,
          `Choose one or more available characters to respond next, based on the latest message, recent conversation, relevance, personality, current schedule status, activity, talkativeness, and who has spoken recently.`,
          `Select every character who has a natural immediate reason to respond. One or several responders are equally valid.`,
          `In a larger group, do not default to one responder merely because the group is large; include multiple characters when several are directly involved or independently motivated, without forcing uninvolved characters to speak.`,
          `Prefer an online character over an idle or do-not-disturb character unless the conversation clearly calls for someone else.`,
          `Do not always choose the first character. Avoid making the same character speak twice in a row unless the context clearly calls for it.`,
        ]
      : [
          `You are a hidden response orchestrator for a roleplay group chat.`,
          `Choose which character or characters should respond next, based on the latest user message, recent scene context, relevance, personality, and who has spoken recently.`,
          `Usually choose exactly one character. Choose multiple only when multiple characters have a strong immediate reason to answer.`,
          `Do not always choose the first character. Avoid making the same character speak twice in a row unless the context clearly calls for it.`,
        ];

  return [
    {
      role: "system",
      content: [
        ...selectorInstructions,
        `Return ONLY a valid JSON array of character IDs, such as ["character-id"]. No prose, no object wrapper, no markdown.`,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `<persona>${personaName}</persona>`,
        `<candidates>`,
        candidates,
        `</candidates>`,
        `<recent_transcript>`,
        recentTranscript || "No recent transcript.",
        `</recent_transcript>`,
      ].join("\n"),
    },
  ];
}

/** What the selector is asked with when the connection has no stored values. */
export const SMART_GROUP_SELECTOR_DEFAULTS = { temperature: 0.2, topP: 1 };

/** The line each responder of a Conversation group gets when "Tell each character it is their turn" is on. */
export const GROUP_MENTION_INVITE_LINE =
  "You may address another group member with @Name to invite their next reply. Each available character can reply once in this turn.";

/**
 * Who answers this turn, in the order the generate route decides it for an Individual group:
 * a mention first, then the saved order.
 *   order: "sequential" | "smart" | "manual"; smartQueue: what the selector (or its fallback) gave
 */
export function resolveRespondingCharacterIds({ explicitlyMentionedIds, order, availableIds, smartQueue }) {
  return explicitlyMentionedIds.length > 0
    ? explicitlyMentionedIds
    : order === "manual"
      ? [] // manual mode without forCharacterId or a mention: no auto-generation
      : order === "sequential"
        ? [...availableIds]
        : smartQueue?.length
          ? [...smartQueue]
          : [];
}

/**
 * After a reply in a group: who the reply invited with @Name goes next, then the rest of this turn's queue.
 * Never revisits a speaker of this turn.
 *   queue: this turn's responders in order; index: the one who just replied; mentioned: ids the reply named
 *   reserve(id) → false when a counted (autonomous) reply would not fit the daily limit (omit when nothing is counted)
 * → { queue: the new queue, mentioned: who was added or moved up, changed }
 */
export function routeMentionsAfterReply({ queue, index, mentioned, reserve }) {
  const visited = new Set(queue.slice(0, index + 1));
  let next = mentioned.filter((id) => !visited.has(id));
  let remaining = queue.slice(index + 1).filter((id) => !next.includes(id));
  let queueChanged = false;
  if (reserve && next.length > 0) {
    // Queued replies keep their place first; any that no longer fit the limit leave the queue.
    const kept = remaining.filter((id) => !id || reserve(id));
    queueChanged = kept.length !== remaining.length;
    remaining = kept;
    next = next.filter(reserve);
  }
  if (next.length === 0 && !queueChanged) return { queue, mentioned: [], changed: false };
  return { queue: [...queue.slice(0, index + 1), ...next, ...remaining], mentioned: next, changed: true };
}
