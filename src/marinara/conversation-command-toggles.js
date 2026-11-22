// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at 32c47a1 (staging, 2026-11-20):
//   packages/shared/src/types/chat.ts — CONVERSATION_COMMAND_KEYS, readConversationCommandToggles,
//     isConversationCommandToggleOn, CONVERSATION_COMMAND_AGENT_IDS (lines 81–147)
//   packages/client/src/features/chat-settings/lib/conversation-command-toggles.ts (the whole file)
//   packages/server/src/services/generation/conversation-command-runtime.ts — isConversationCommandEnabled (the
//     chat's toggle part) and the chat's master switch, `chatMeta.characterCommands !== false`
//     (packages/server/src/routes/generate.routes.ts line 3464)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed;
//   - isConversationCommandEnabled: the shared-room check (roomConversationCommandAllowed) is left out — there are no
//     shared rooms here; conversationCommandsOn is the master switch as a function. Nothing else.
export const CONVERSATION_COMMAND_KEYS = [
  "schedule_update",
  "cross_post",
  "selfie",
  "video",
  "memory",
  "scene",
  "call",
  "uno",
  "chess",
  "poker",
  "eightball",
  "tic_tac_toe",
  "rock_paper_scissors",
  "music",
  "haptic",
  "influence",
  "note",
  "react",
];

/** The command type grammar a package command is registered under, so its toggle key always reads back. */
const CONVERSATION_COMMAND_TOGGLE_KEY = /^[a-z][a-z0-9_-]*$/;

/**
 * Reads stored Conversation command toggles. Every well-formed key is kept, not only the built-in ones, so a
 * package game's toggle survives while that package is not installed and is not lost when another toggle is saved.
 */
export function readConversationCommandToggles(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const toggles = {};
  for (const [key, enabled] of Object.entries(value)) {
    if (typeof enabled === "boolean" && CONVERSATION_COMMAND_TOGGLE_KEY.test(key)) toggles[key] = enabled;
  }
  return toggles;
}

/** Whether a Conversation command is on. Videos is opt-in, unlike the other commands: each video message is a video request. */
export function isConversationCommandToggleOn(toggles, command) {
  return command === "video" ? toggles.video === true : toggles[command] !== false;
}

/** Downloadable agent package that owns each optional Conversation command. */
export const CONVERSATION_COMMAND_AGENT_IDS = {
  selfie: "illustrator",
  video: "illustrator",
  call: "conversation-calls",
  uno: "uno",
  chess: "chess",
  poker: "poker",
  eightball: "eightball",
  tic_tac_toe: "tic-tac-toe",
  rock_paper_scissors: "rock-paper-scissors",
  music: "spotify",
  haptic: "haptic",
};

/** The chat's master switch for character commands. */
export function conversationCommandsOn(metadata) {
  return metadata.characterCommands !== false;
}

/** `key` is a built-in command, or a package command's type such as `wordle`. */
export function isConversationCommandEnabled(metadata, key) {
  return readConversationCommandToggles(metadata.conversationCommandToggles)[key] !== false;
}

export const CONVERSATION_COMMAND_TOGGLE_OPTIONS = [
  {
    id: "schedule_update",
    label: "Schedule Updates",
    description: "Let characters change their current status and activity.",
  },
  {
    id: "cross_post",
    label: "Cross-Post",
    description: "Let characters redirect a message into another shared chat.",
  },
  {
    id: "selfie",
    label: "Selfies",
    description: "Let characters request a generated selfie.",
  },
  {
    id: "video",
    label: "Videos",
    description: "Let characters send short video messages.",
    labelKey: "ui.chat.conversationcommands.videos",
    descriptionKey: "ui.chat.conversationcommands.videosDescription",
  },
  {
    id: "memory",
    label: "Memories",
    description: "Let characters create memories for other characters.",
  },
  {
    id: "scene",
    label: "Scenes",
    description: "Let characters start an immersive scene from the conversation.",
  },
  {
    id: "music",
    label: "Music",
    description: "Let characters play songs through the active Music Player.",
  },
  {
    id: "haptic",
    label: "Haptics",
    description: "Let characters control connected haptic devices.",
  },
  {
    id: "influence",
    label: "Influence",
    description: "Let characters send one-shot influence to a connected chat.",
  },
  {
    id: "note",
    label: "Notes",
    description: "Let characters save durable notes for a connected chat.",
  },
  {
    id: "call",
    label: "Calls",
    description: "Let characters ring you for a Conversation call.",
  },
  {
    id: "react",
    label: "Reactions",
    description: "Let characters react to messages with emoji badges.",
  },
  {
    id: "uno",
    label: "UNO",
    description: "Let characters start a game of UNO at the table when you agree to play.",
  },
  {
    id: "chess",
    label: "Chess",
    description: "Let characters accept a one-on-one chess challenge at the table.",
  },
  {
    id: "poker",
    label: "Poker",
    description: "Let characters sit down for a game of Texas Hold'em poker at the table.",
  },
  {
    id: "eightball",
    label: "8-Ball Pool",
    description: "Let characters rack up a game of 8-ball pool at the table.",
  },
  {
    id: "tic_tac_toe",
    label: "Tic-Tac-Toe",
    description: "Let characters accept a one-on-one tic-tac-toe challenge at the table.",
  },
  {
    id: "rock_paper_scissors",
    label: "Rock-Paper-Scissors",
    description: "Let characters accept a one-on-one rock-paper-scissors match at the table.",
  },
];

/**
 * The Commands toggles a chat offers: the built-in commands whose package is installed, then each installed
 * package turn game a character can start by tag (Blackjack, Wordle). The server lists only games without a
 * built-in toggle, so none appears twice.
 */
export function buildConversationCommandToggleOptions(
  installedAgentIds,
  packageTurnGames,
  builtInOptions = CONVERSATION_COMMAND_TOGGLE_OPTIONS,
) {
  return [
    ...builtInOptions.filter((command) => {
      const agentId = CONVERSATION_COMMAND_AGENT_IDS[command.id];
      return !agentId || installedAgentIds.has(agentId);
    }),
    ...packageTurnGames.map((game) => ({
      id: game.commandType,
      label: game.label,
      description: game.description ?? `Let characters start a game of ${game.label} when you agree to play.`,
      ...(game.description
        ? {}
        : {
            descriptionKey: "ui.chat.conversationcommands.packageGameDescription",
            descriptionValues: { game: game.label },
          }),
    })),
  ];
}
