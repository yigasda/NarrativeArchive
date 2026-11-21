// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), packages/server/src/routes/generate/generate-route-utils.ts (the hiddenFromAI checks) and packages/server/src/services/generation/prompt-attachments.ts (parseExtra), at fc0333c.
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive: TypeScript types removed; nothing else.

function parseExtra(extra) {
  if (!extra) return {};
  try {
    const parsed = typeof extra === "string" ? JSON.parse(extra) : extra;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed)
      : {};
  } catch {
    return {};
  }
}

export function isMessageHiddenFromAI(message) {
  return parseExtra(message.extra).hiddenFromAI === true;
}

export function getMessageHiddenFromAICharacterIds(message) {
  const value = parseExtra(message.extra).hiddenFromAICharacterIds;
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function isMessageHiddenFromAIForCharacter(
  message,
  characterId,
) {
  if (isMessageHiddenFromAI(message)) return true;
  return typeof characterId === "string" && getMessageHiddenFromAICharacterIds(message).includes(characterId);
}
