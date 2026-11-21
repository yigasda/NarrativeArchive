// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), packages/server/src/routes/generate/conversation-context-block.ts, at fc0333c.
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive: TypeScript types removed; imports point at this folder (wrapContent → shims.js: we wrap the block ourselves).
import { normalizeTextForMatch, } from "./text-matching.js";

import { getIntentHint, isMessageIntent } from "./intent.service.js";
import {
  formatZonedConversationDate,
  formatZonedConversationTime,
  getZonedWeekdayName,
} from "./timezone.js";
import { wrapContent } from "./shims.js";

export function buildConversationCurrentContextBlock(args

 ) {
  const timeStr = formatZonedConversationTime(args.nowInstant, args.promptTimeZone);
  const dateStr = formatZonedConversationDate(args.nowInstant, args.promptTimeZone);
  const dayName = getZonedWeekdayName(args.nowInstant, args.promptTimeZone);

  const scheduleLines = [];
  for (const character of args.convoCharInfo) {
    if (character.todaySchedule) {
      const prefix =
        args.convoCharInfo.length > 1
          ? `${character.name}'s schedule today (${dayName}): `
          : `Your schedule today (${dayName}): `;
      scheduleLines.push(prefix + character.todaySchedule);
    }
  }

  const statusLines = buildConversationStatusLines(args.convoCharInfo, args.primaryCharacterId);

  const userStatusLabels = {
    active: "online",
    idle: "idle / away from the computer",
    dnd: "do not disturb",
  };
  const shouldIncludeUserStatus = args.userStatus !== "invisible";
  const userStatusLabel = userStatusLabels[args.userStatus ?? "active"] ?? "online";
  const userActivity = args.userActivity?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "";
  const userStatusLine = userActivity ? `${userStatusLabel} - ${userActivity}` : userStatusLabel;

  const mentionLine = buildMentionLine({
    mentionedCharacterNames: args.mentionedCharacterNames,
    convoCharInfo: args.convoCharInfo,
    personaName: args.personaName,
  });

  const latestVisiblePromptTurn = [...args.finalMessages]
    .reverse()
    .find((message) => message.role === "user" || message.role === "assistant");
  const proactiveTurnLine =
    latestVisiblePromptTurn?.role === "assistant" && !args.userMessage?.trim()
      ? `No new message from ${args.personaName} was sent in this request; this is a proactive/autonomous turn. Do not write ${args.personaName}'s side of the conversation.`
      : null;
  const autonomousIntentKey = typeof args.autonomousIntentKey === "string" ? args.autonomousIntentKey : "";
  const intentHint = isMessageIntent(autonomousIntentKey) ? getIntentHint(autonomousIntentKey) : "";

  const contextLines = [
    ...statusLines,
    ...(shouldIncludeUserStatus ? [`${args.personaName}'s status: ${userStatusLine}.`] : []),
    ...(proactiveTurnLine ? [proactiveTurnLine] : []),
    ...(mentionLine ? [mentionLine] : []),
    ...(intentHint ? [`What prompted this message: ${intentHint}`] : []),
    ...scheduleLines,
    `The current time and date: ${timeStr}, ${dateStr}.`,
  ];

  return wrapContent(contextLines.join("\n"), "Context", args.wrapFormat);
}

function buildConversationStatusLines(
  convoCharInfo,
  primaryCharacterId,
) {
  const statusLabels = {
    online: "online",
    idle: "idle / away",
    dnd: "busy / do not disturb",
    offline: "offline",
  };
  const buildCharStatus = (character) => {
    const label = statusLabels[character.status] ?? "online";
    return character.activity ? `${label} (${character.activity})` : label;
  };
  const promptName = (character) => character.displayName?.trim() || character.name;
  const primaryCharacter = primaryCharacterId
    ? convoCharInfo.find((character) => character.charId === primaryCharacterId)
    : null;

  if (!primaryCharacter || convoCharInfo.length === 1) {
    const statusLine =
      convoCharInfo.length === 1
        ? buildCharStatus(convoCharInfo[0])
        : convoCharInfo.map((character) => `${character.name}: ${buildCharStatus(character)}`).join("; ");
    return [`Your current status: ${statusLine}.`];
  }

  return [
    `Your current status: ${promptName(primaryCharacter)}: ${buildCharStatus(primaryCharacter)}.`,
    ...convoCharInfo
      .filter((character) => character !== primaryCharacter)
      .map((character) => `${promptName(character)}'s status: ${buildCharStatus(character)}.`),
  ];
}

export function replaceConversationContextBlockForTarget(
  content,
  sharedContextBlock,
  targetContextBlock,
) {
  if (!sharedContextBlock || sharedContextBlock === targetContextBlock || !content.includes(sharedContextBlock)) {
    return content;
  }
  return content.split(sharedContextBlock).join(targetContextBlock);
}

function buildMentionLine(args

 ) {
  const mentionedNames = (args.mentionedCharacterNames ?? []).filter((name) =>
    args.convoCharInfo.some((character) => normalizeTextForMatch(character.name) === normalizeTextForMatch(name)),
  );
  if (mentionedNames.length === 0) return null;

  if (args.convoCharInfo.length === 1) {
    return `${args.personaName} @mentioned you directly — treat this as an urgent ping that demands your attention even if you are busy or away.`;
  }

  return `${args.personaName} @mentioned: ${mentionedNames.join(", ")} — this is an urgent ping directed at ${
    mentionedNames.length === 1 ? "that person" : "those people"
  } specifically. The mentioned character(s) should feel compelled to respond promptly even if busy or away.`;
}
