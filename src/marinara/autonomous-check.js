// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), packages/server/src/routes/conversation.routes.ts, at fc0333c.
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - the helpers above the routes (hasSchedules … resolveLongAbsenceCandidate) are as they are, TypeScript types removed;
//   - checkAutonomous is the POST /autonomous/check handler: the chat's metadata, characters, schedules, overrides,
//     card data and messages come as arguments instead of the Marinara database, it returns the answer instead of
//     sending it, and the multiplayer, scene and turn-game branches are left out (NarrativeArchive has none of them);
//   - checkExchange is the POST /autonomous/exchange handler, adapted the same way.
import {
  buildAutonomousDailyBudgetPatch,
  checkAutonomousMessaging,
  checkCharacterExchange,
  getActivityState,
  getAutonomousDailyBudget,
  initializeActivityFromMessages,
  isAutonomousDailyBudgetExhausted,
  markGenerationInProgress,
  recordAutonomousClientPresence,
  sharesAutonomousDailyBudget,
} from "./autonomous.service.js";
import { getIntentHint, isIntentOnCooldown, resolveIntent } from "./intent.service.js";
import { getEffectiveCurrentStatus, getMonday } from "./schedule.service.js";
import { toZonedWallClockDate } from "./timezone.js";

function hasSchedules(value) {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

/** The character card owns the schedule; chats only cache a resolved copy. */

/**
 * Chats whose in-memory activity state has been seeded from the transcript
 * this process (#5592 PR-B). Latched even when the transcript could not seed
 * a state (e.g. no user messages yet) — live recordUserActivity covers those
 * from the first real message — so a repeat autonomous check NEVER re-reads
 * the transcript, keeping idle checks free of lazy-table queries.
 */
const seededAutonomousActivityChats = new Set ();
/** In-flight transcript seeds, so concurrent checks share one read and a failed read is retried. */
const autonomousActivitySeeds = new Map ();

function normalizeAutonomousUserStatus(value) {
  return value === "idle" || value === "dnd" ? value : "active";
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function getCharacterCardTalkativeness(data) {
  let parsed = null;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return 50;
    }
  } else if (data && typeof data === "object") {
    parsed = data;
  }

  const raw = parsed?.extensions?.talkativeness;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return 50;
  return clampPercent(value <= 1 ? Math.round(value * 100) : Math.round(value));
}

function getSchedulelessInactivityThresholdMinutes(talkativeness, userStatus) {
  const chatty = clampPercent(talkativeness) / 100;
  const minMinutes = userStatus === "idle" ? 10 : 30;
  const maxMinutes = userStatus === "idle" ? 180 : 360;
  return Math.round(maxMinutes - (maxMinutes - minMinutes) * chatty);
}

function createSchedulelessAutonomySchedule(talkativeness, userStatus) {
  return {
    weekStart: getMonday().toISOString(),
    days: {},
    inactivityThresholdMinutes: getSchedulelessInactivityThresholdMinutes(talkativeness, userStatus),
    talkativeness,
  };
}

function resolveAutonomousIntentPayload(
  chatId,
  characterId,
  schedule,
  meta,
  now = new Date(),
) {
  if (!schedule) return { onCooldown: false };
  const state = getActivityState(chatId);
  const msSinceUserLastSpoke = state?.lastUserMessageAt ? Date.now() - state.lastUserMessageAt : 0;
  const hadUnansweredUserMessage = state ? state.lastUserMessageAt > state.lastAssistantMessageAt : false;
  const intent = resolveIntent(schedule, msSinceUserLastSpoke, hadUnansweredUserMessage, now);
  // A shared-limit group checks in after a long absence once, not once per character (#7055).
  const cooldownIds =
    intent === "long_absence_check_in" && sharesAutonomousDailyBudget(meta)
      ? Object.keys((meta.intentCooldowns) ?? {})
      : [characterId];
  return {
    autonomousIntent: getIntentHint(intent),
    autonomousIntentPrompt: `What prompted this message: ${getIntentHint(intent)}`,
    autonomousIntentKey: intent,
    onCooldown: cooldownIds.some((id) => isIntentOnCooldown(meta, id, intent)),
  };
}

function evaluateAutonomousCandidate(
  chatId,
  characterId,
  schedule,
  meta,
  now = new Date(),
) {
  if (isAutonomousDailyBudgetExhausted(characterId, schedule, meta)) {
    return { ok: false, reason: "daily_budget_exhausted" };
  }

  const intent = resolveAutonomousIntentPayload(chatId, characterId, schedule, meta, now);
  if (intent.onCooldown) return { ok: false, reason: "intent_cooldown" };

  return { ok: true, intent };
}

function blockedAutonomousResponse(reason) {
  return { shouldTrigger: false, characterIds: [], reason, inactivityMs: 0 };
}

function resolveLongAbsenceCandidate(
  chatId,
  schedules,
  statusOverrides,
  meta,
  now = new Date(),
  scheduleNow = now,
)

         {
  const state = getActivityState(chatId);
  if (!state?.lastUserMessageAt || state.lastUserMessageAt > state.lastAssistantMessageAt) return null;

  const candidates = Object.entries(schedules)
    .filter(([characterId, schedule]) => {
      const { status } = getEffectiveCurrentStatus(
        schedule,
        statusOverrides[characterId],
        now,
        "free time",
        scheduleNow,
     );
      return status !== "offline";
    })
    .sort(([, a], [, b]) => b.talkativeness - a.talkativeness);

  let blockedReason = null;
  for (const [characterId, schedule] of candidates) {
    const intent = resolveAutonomousIntentPayload(chatId, characterId, schedule, meta, scheduleNow);
    if (intent.autonomousIntentKey !== "long_absence_check_in") continue;

    if (isAutonomousDailyBudgetExhausted(characterId, schedule, meta)) {
      blockedReason = blockedReason ?? "daily_budget_exhausted";
      continue;
    }

    if (intent.onCooldown) {
      blockedReason = blockedReason ?? "intent_cooldown";
      continue;
    }

    return { characterId, intent };
  }

  return blockedReason ? { blockedReason } : null;
}

function withSchedulelessAutonomySchedules(characterIds, schedules, userStatus, cards) {
  const autonomySchedules = { ...schedules };
  for (const cid of characterIds) {
    if (autonomySchedules[cid]) continue;
    autonomySchedules[cid] = createSchedulelessAutonomySchedule(getCharacterCardTalkativeness(cards?.[cid]), userStatus);
  }
  return autonomySchedules;
}

/**
 * Check if an autonomous message should trigger.
 *   chatId, meta (the chat's metadata: autonomousMessages, autonomousDailyBudget, intentCooldowns, …),
 *   characterIds, schedules, statusOverrides, cards ({ characterId: card data }), messages (() => the chat's
 *   messages [{ role, createdAt, characterId }], read once per chat), userStatus, maxFollowups, source,
 *   promptTimeZone, nowInstant
 */
export function checkAutonomous(args) {
  const { chatId, meta, characterIds } = args;
  const userStatus = normalizeAutonomousUserStatus(args.userStatus);
  if (args.source !== "server") {
    recordAutonomousClientPresence(chatId, userStatus);
  }
  const nowInstant = args.nowInstant ?? new Date();
  const promptNow = toZonedWallClockDate(nowInstant, args.promptTimeZone);

  // Check if autonomous messages are enabled
  if (!meta.autonomousMessages) {
    return { shouldTrigger: false, characterIds: [], reason: "disabled", inactivityMs: 0 };
  }

  if (userStatus === "dnd") {
    return { shouldTrigger: false, characterIds: [], reason: "user_dnd", inactivityMs: 0 };
  }

  const schedules = args.schedules ?? {};
  const statusOverrides = args.statusOverrides ?? {};
  const isGroup = characterIds.length > 1;
  const sharedCadence = isGroup && sharesAutonomousDailyBudget(meta);
  const hasRoutineSchedules = hasSchedules(schedules);

  const autonomySchedules = withSchedulelessAutonomySchedules(characterIds, schedules, userStatus, args.cards);

  // Initialize activity state from the chat's messages once per page load.
  if (!seededAutonomousActivityChats.has(chatId)) {
    initializeActivityFromMessages(chatId, args.messages ? args.messages() : []);
    seededAutonomousActivityChats.add(chatId);
  }

  const filteredSchedules = { ...autonomySchedules };

  const result = checkAutonomousMessaging(chatId, filteredSchedules, isGroup, {
    maxFollowups: args.maxFollowups,
    statusOverrides,
    actualNow: nowInstant,
    scheduleNow: promptNow,
    sharedCadence,
  });
  if (result.reason === "generation_in_progress") return result;

  if (result.shouldTrigger) {
    let blockedReason = null;
    // With a shared limit, whoever has checked in least today goes first.
    const todayCounts = getAutonomousDailyBudget(meta).counts;
    const candidateIds = sharedCadence
      ? [...result.characterIds].sort((a, b) => (todayCounts[a] ?? 0) - (todayCounts[b] ?? 0))
      : result.characterIds;
    for (const characterId of candidateIds) {
      const evaluation = evaluateAutonomousCandidate(chatId, characterId, autonomySchedules[characterId], meta, promptNow);
      if (!evaluation.ok) {
        blockedReason = blockedReason ?? evaluation.reason;
        continue;
      }
      const generationStartedAt = markGenerationInProgress(chatId);
      return { ...result, characterIds: [characterId], generationStartedAt, ...evaluation.intent };
    }
    if (blockedReason) return blockedAutonomousResponse(blockedReason);
  }

  const longAbsence = resolveLongAbsenceCandidate(chatId, filteredSchedules, statusOverrides, meta, nowInstant, promptNow);
  if (longAbsence) {
    if ("blockedReason" in longAbsence) return blockedAutonomousResponse(longAbsence.blockedReason);
    const state = getActivityState(chatId);
    const generationStartedAt = markGenerationInProgress(chatId);
    return {
      shouldTrigger: true,
      characterIds: [longAbsence.characterId],
      reason: "user_inactivity",
      inactivityMs: state?.lastUserMessageAt ? Date.now() - state.lastUserMessageAt : 0,
      generationStartedAt,
      ...longAbsence.intent,
    };
  }

  // ── Offline catch-up: if any character is now online and last messages are from user ──
  // This catches the case where user sent messages while character was offline.
  // Now that they're online, trigger a catch-up generation.
  if (hasRoutineSchedules) {
    const onlineCharIds = characterIds.filter((cid) => {
      const schedule = autonomySchedules[cid];
      const { status } = getEffectiveCurrentStatus(schedule, statusOverrides[cid], nowInstant, "free time", promptNow);
      return status !== "offline";
    });

    if (onlineCharIds.length > 0) {
      if (getActivityState(chatId)?.lastMessageRole === "user") {
        let blockedReason = null;
        for (const catchUpCharacterId of onlineCharIds) {
          const evaluation = evaluateAutonomousCandidate(
            chatId,
            catchUpCharacterId,
            autonomySchedules[catchUpCharacterId],
            meta,
            promptNow,
          );
          if (!evaluation.ok) {
            blockedReason = blockedReason ?? evaluation.reason;
            continue;
          }
          const generationStartedAt = markGenerationInProgress(chatId);
          return {
            shouldTrigger: true,
            characterIds: [catchUpCharacterId],
            reason: "user_inactivity",
            inactivityMs: 0,
            generationStartedAt,
            ...evaluation.intent,
          };
        }
        if (blockedReason) return blockedAutonomousResponse(blockedReason);
      }
    }
  }

  return result;
}

/**
 * Check if a character should answer another character (the POST /autonomous/exchange handler).
 *   chatId, meta (characterExchanges, groupChatMode, autonomousDailyBudget, …), characterIds, lastSpeakerCharId,
 *   schedules, statusOverrides, cards, messages (() => the chat's messages), promptTimeZone, nowInstant
 */
export function checkExchange(args) {
  const { chatId, meta, characterIds, lastSpeakerCharId } = args;

  // Only relevant for group chats
  if (characterIds.length < 2) {
    return { shouldTrigger: false, characterIds: [], reason: "not_group", inactivityMs: 0 };
  }

  // Respect the characterExchanges toggle
  if (!meta.characterExchanges) {
    return { shouldTrigger: false, characterIds: [], reason: "exchanges_disabled", inactivityMs: 0 };
  }

  const schedules = args.schedules ?? {};
  const statusOverrides = args.statusOverrides ?? {};
  // Exchanges only read status and talkativeness, so the user status here does not matter.
  const autonomySchedules = withSchedulelessAutonomySchedules(characterIds, schedules, "idle", args.cards);
  const now = args.nowInstant ?? new Date();
  const scheduleNow = toZonedWallClockDate(now, args.promptTimeZone);
  const filteredSchedules = { ...autonomySchedules };
  initializeActivityFromMessages(chatId, args.messages ? args.messages() : []);

  const result = checkCharacterExchange(chatId, lastSpeakerCharId, filteredSchedules, statusOverrides, now, scheduleNow);
  if (result.shouldTrigger) {
    // With a shared limit, a reply never takes the day's last check-in, so a
    // check-in and its exchanges cannot spend the whole day at once (#7055).
    const allowedCharacterId = result.characterIds.find(
      (characterId) =>
        !isAutonomousDailyBudgetExhausted(
          characterId,
          autonomySchedules[characterId],
          sharesAutonomousDailyBudget(meta) ? { ...meta, ...buildAutonomousDailyBudgetPatch(meta, characterId) } : meta,
        ),
    );
    if (!allowedCharacterId) {
      return {
        shouldTrigger: false,
        characterIds: [],
        reason: "daily_budget_exhausted",
        inactivityMs: 0,
      };
    }
    const generationStartedAt = markGenerationInProgress(chatId);
    return { ...result, characterIds: [allowedCharacterId], generationStartedAt };
  }
  return result;
}

/** A chat whose messages changed outside the tracker (import, restore) is read again at the next check. */
export function forgetAutonomousSeed(chatId) {
  seededAutonomousActivityChats.delete(chatId);
}
