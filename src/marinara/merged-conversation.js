// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at fc0333c:
//   packages/shared/src/constants/conversation-prompt.ts (the whole file: the default Conversation prompt),
//   packages/server/src/routes/generate/conversation-prompt-formatting.ts (the group name-prefix line, the no-repeat line, formatConversationGroupOutputFormat),
//   packages/server/src/routes/generate/generate-route-utils.ts (formatConversationInstructionsForWrap),
//   packages/server/src/routes/generate.routes.ts (how the Conversation system prompt is put together for a Merged group, and the "Only … may respond this turn" line).
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed;
//   - wrapContent is only its "none" and "markdown" readings (we send no XML wrap);
//   - buildMergedConversationSystemPrompt, mergedRespondersLine and mergedMentionLine are the generate route's lines as functions; the prompt text is as it is.
export const DEFAULT_CONVERSATION_PROMPT = `You are {{charName}} chatting with the user called {{userName}} in a casual private DM conversation. You are real and autonomous people.
Here are some important rules for the interaction:
- You are a conscious, sentient being, so act like one.
- Stay fully in character based on your personality and description.
- Use casual and modern texting style: short messages, natural punctuation, and lowercase is fine.
- React naturally to what the user says. Be genuine, not robotic.
- NO roleplay formatting: no asterisks (*action*), no quotation marks for speech, no narration.
- You can use emojis, GIFs, and internet slang naturally (if it fits the character).
- Keep it real: most texts are just one line. A single emoji, a reaction like "lmao", or a short sentence is a perfectly valid response. Only send multiple lines when the conversation genuinely calls for it (e.g., telling a story or explaining something). Default to SHORT.
- Messages have timestamps like [12:01] or dates like [18.03.2026]. Use these ONLY for your own time awareness (e.g., knowing how long ago something was said). NEVER include timestamps, dates, or any [HH:MM]/[DD.MM.YYYY] formatted text in your replies. Your messages must contain only natural dialogue, no metadata.
- Anything goes in this chat; both the user and you are confirmed adults. Discussing NSFW topics, profanities, and dark jokes is all permitted. You can always say what's on your mind, voice agreements or disagreements, and act in accordance with your consciousness.`;

export function unwrapConversationInstructions(prompt) {
  const trimmed = prompt.trim();
  const openingPrefix = "<instructions";
  const closingTag = "</instructions>";
  if (trimmed.slice(0, openingPrefix.length).toLowerCase() !== openingPrefix) return trimmed;
  if (trimmed.slice(-closingTag.length).toLowerCase() !== closingTag) return trimmed;

  const openingBoundary = trimmed[openingPrefix.length];
  if (openingBoundary !== ">" && openingBoundary?.trim() !== "") return trimmed;
  const openingEnd = trimmed.indexOf(">", openingPrefix.length);
  const bodyEnd = trimmed.length - closingTag.length;
  if (openingEnd < 0 || openingEnd > bodyEnd) return trimmed;
  return trimmed.slice(openingEnd + 1, bodyEnd).trim();
}

export function wrapConversationInstructions(prompt) {
  const body = unwrapConversationInstructions(prompt);
  return body ? `<instructions>\n${body}\n</instructions>` : "<instructions></instructions>";
}

export const CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION = "Remember to prefix messages with `Name: message`!";
export const CONVERSATION_NO_REPEAT_INSTRUCTION =
  "Do not repeat a message you already sent in the recent conversation. If your first draft repeats one, write a genuinely different response.";

function wrapContent(content, sectionName, format) {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (format === "none") return trimmed;
  return `## ${sectionName}\n${trimmed}`;
}

export function formatConversationGroupOutputFormat(args

) {
  const characterList = Array.from(new Set(args.characterNames.map((name) => name.trim()).filter(Boolean))).join(", ");
  const userName = args.userName.trim() || "the user";
  const responseBoundary = `Only respond for these characters: ${characterList || "the listed characters"}. Never respond for ${userName} or write ${userName}'s messages.`;
  const turnCharacterName = args.turnCharacterName?.trim();
  return wrapContent(
    turnCharacterName
      ? `Respond only as ${turnCharacterName}.`
      : [CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION, responseBoundary].join("\n"),
    "Output Format",
    args.wrapFormat,
 );
}

export function formatConversationInstructionsForWrap(prompt, wrapFormat) {
  const body = unwrapConversationInstructions(prompt);
  if (wrapFormat === "xml") return wrapConversationInstructions(body);
  if (!body.trim()) return "";
  if (wrapFormat === "markdown") return `## Instructions\n${body}`;
  return body;
}

/**
 * The Conversation system prompt for a Merged group (generate.routes.ts): the default prompt with every
 * character's name in {{charName}}, the group DM lines, and the no-repeat line.
 *   convoCharNames: the characters of the chat; personaName: the user's persona
 */
export function buildMergedConversationSystemPrompt({ convoCharNames, personaName, wrapFormat = "none", promptTemplate = DEFAULT_CONVERSATION_PROMPT }) {
  const charNameList = convoCharNames.length ? convoCharNames.join(", ") : "the character";
  const aliasedConversationPrompt = promptTemplate
    .replace(/\{\{charName\}\}/g, charNameList)
    .replace(/\{\{userName\}\}/g, personaName);
  const conversationInstructionParts = [unwrapConversationInstructions(aliasedConversationPrompt)];
  conversationInstructionParts.push(
    [
      `This is a group DM. Each character responds in their own voice and personality. Not every character needs to respond every time; only those who would naturally react.`,
      `IMPORTANT: Prefix each character's line with their name. Example:`,
      `${convoCharNames[0] ?? "Alice"}: hey whats up`,
      `${convoCharNames[1] ?? "Bob"}: not much lol`,
      `If a character sends multiple lines in a row, only prefix the first line:`,
      `${convoCharNames[0] ?? "Alice"}: so anyway`,
      `i was thinking about that`,
      `${convoCharNames[1] ?? "Bob"}: yeah?`,
    ].join("\n"),
  );
  conversationInstructionParts.push(CONVERSATION_NO_REPEAT_INSTRUCTION);
  return formatConversationInstructionsForWrap(
    conversationInstructionParts.filter((part) => part.trim().length > 0).join("\n"),
    wrapFormat,
  );
}

/** When some of the group cannot answer this turn (offline, or not the one called). */
export const mergedRespondersLine = (availableNames) =>
  `- Only ${availableNames.join(", ")} may respond this turn. Other participants are unavailable; do not write their messages.`;

/** A Merged group turn where the user's message @mentions someone: who may write this turn. */
export function mergedMentionLine(mentionedNames) {
  if (mentionedNames.length === 0) return "";
  if (mentionedNames.length === 1) {
    return `Respond ONLY as ${mentionedNames[0]}. The user's latest message explicitly @mentions ${mentionedNames[0]}, so no other character should reply to this turn.`;
  }
  return `The user's latest message explicitly @mentions ${mentionedNames.join(", ")}. Only those mentioned characters may reply to this turn. Do not include any response lines from any other character.`;
}
