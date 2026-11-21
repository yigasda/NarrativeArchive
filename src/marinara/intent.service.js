// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), packages/server/src/services/conversation/intent.service.ts, at fc0333c.
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive: TypeScript types removed; nothing else.
import { blockDurationMinutes, getAdjacentBlocks, } from "./schedule.service.js";

const INTENT_HINTS = {
  check_in: "You have a free moment and the user has been quiet.",
  long_absence_check_in: "The user has been away for a long while. Check in with them.",
  came_back_online:
    "You were unavailable earlier when the user wrote. You just became free and are getting back to them.",
  after_busy: "You just wrapped up a busy stretch. You have some breathing room now.",
  good_morning: "You just woke up and are starting your day. This is your first message of the morning.",
  good_night: "You are winding down for the night and checking in before you go offline.",
  meal_break: "You are on a short break, eating or stepping away briefly. A good moment to drop a quick message.",
  transition_ping: "You just moved from one thing to another and thought of the user.",
};

const MEAL_KEYWORDS = ["eating", "lunch", "dinner", "breakfast", "brunch", "meal", "food"];
const LONG_ABSENCE_MS = 18 * 60 * 60 * 1000;
const GOOD_NIGHT_WINDOW_MINUTES = 90;

const MESSAGE_INTENTS = new Set ([
  "check_in",
  "long_absence_check_in",
  "came_back_online",
  "after_busy",
  "good_morning",
  "good_night",
  "meal_break",
  "transition_ping",
]);

const INTENT_COOLDOWNS_MS = {
  check_in: 0,
  long_absence_check_in: 36 * 60 * 60 * 1000,
  came_back_online: 4 * 60 * 60 * 1000,
  after_busy: 3 * 60 * 60 * 1000,
  good_morning: 20 * 60 * 60 * 1000,
  good_night: 20 * 60 * 60 * 1000,
  meal_break: 3 * 60 * 60 * 1000,
  transition_ping: 2 * 60 * 60 * 1000,
};

function hasStatus(block, status) {
  return block?.status === status;
}

function minutesUntilBlockStart(block, now) {
  const [startStr] = block.time.split("-");
  if (!startStr) return Infinity;
  const [hourRaw, minuteRaw] = startStr.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Infinity;

  const startMinutes = hour * 60 + minute;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return startMinutes >= currentMinutes ? startMinutes - currentMinutes : 1440 - currentMinutes + startMinutes;
}

export function resolveIntent(
  schedule,
  msSinceUserLastSpoke,
  hadUnansweredUserMessage,
  now = new Date(),
) {
  const { previous, current, next } = getAdjacentBlocks(schedule, now);
  const hour = now.getHours();

  if (!hadUnansweredUserMessage && msSinceUserLastSpoke >= LONG_ABSENCE_MS) {
    return "long_absence_check_in";
  }

  if (hadUnansweredUserMessage && hasStatus(previous, "offline") && current?.status !== "offline") {
    return "came_back_online";
  }

  if (hasStatus(previous, "offline") && current?.status !== "offline" && hour >= 5 && hour < 11) {
    return "good_morning";
  }

  if (
    next &&
    next.status === "offline" &&
    blockDurationMinutes(next) >= 360 &&
    minutesUntilBlockStart(next, now) <= GOOD_NIGHT_WINDOW_MINUTES
  ) {
    return "good_night";
  }

  if (hasStatus(previous, "dnd") && (current?.status === "online" || current?.status === "idle")) {
    return "after_busy";
  }

  if (
    current?.status === "idle" &&
    MEAL_KEYWORDS.some((keyword) => current.activity.toLowerCase().includes(keyword)) &&
    blockDurationMinutes(current) <= 90
  ) {
    return "meal_break";
  }

  if (previous && current && previous.status !== current.status) {
    return "transition_ping";
  }

  return "check_in";
}

export function getIntentHint(intent) {
  return INTENT_HINTS[intent];
}

export function isMessageIntent(value) {
  return MESSAGE_INTENTS.has(value);
}

export function getIntentCooldowns(chatMeta, characterId) {
  const all = chatMeta.intentCooldowns;
  return all?.[characterId] ?? {};
}

export function isIntentOnCooldown(
  chatMeta,
  characterId,
  intent,
  now = Date.now(),
) {
  const cooldownMs = INTENT_COOLDOWNS_MS[intent];
  if (!cooldownMs) return false;
  const cooldowns = getIntentCooldowns(chatMeta, characterId);
  const lastFired = cooldowns[intent];
  if (!lastFired) return false;
  return now - new Date(lastFired).getTime() < cooldownMs;
}

export function buildIntentCooldownPatch(
  chatMeta,
  characterId,
  intent,
  now = new Date(),
) {
  const all = (chatMeta.intentCooldowns) ?? {};
  return {
    intentCooldowns: {
      ...all,
      [characterId]: {
        ...(all[characterId] ?? {}),
        [intent]: now.toISOString(),
      },
    },
  };
}
