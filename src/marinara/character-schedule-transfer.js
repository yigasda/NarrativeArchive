// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), packages/client/src/lib/character-schedule-transfer.ts, at fc0333c.
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive: TypeScript types removed; normalizeBlock keeps a block's "place" (NarrativeArchive's own field).
import {
  CONVERSATION_SCHEDULE_DAYS,

} from "./conversation-presence.js";

export const CHARACTER_SCHEDULE_EXPORT_KIND = "marinara.character-schedule";
export const CHARACTER_SCHEDULE_EXPORT_VERSION = 1;
export const MAX_CHARACTER_SCHEDULE_FILE_SIZE = 1024 * 1024;

const PRESENCE_STATUSES = new Set (["online", "idle", "dnd", "offline"]);
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

export function getCurrentMondayIso(now = new Date()) {
  const date = new Date(now);
  const diff = date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function createCharacterScheduleExport(schedule, characterName) {
  return {
    kind: CHARACTER_SCHEDULE_EXPORT_KIND,
    version: CHARACTER_SCHEDULE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    ...(characterName?.trim() ? { characterName: characterName.trim() } : {}),
    schedule: cloneSchedule(schedule),
  };
}

export function parseCharacterScheduleImport(
  value,
  currentWeekStart = getCurrentMondayIso(),
) {
  if (!isRecord(value)) return { ok: false, reason: "invalid" };

  let format = "legacy";
  let source = value;
  if ("kind" in value || "version" in value || "schedule" in value) {
    if (value.kind !== CHARACTER_SCHEDULE_EXPORT_KIND || value.version !== CHARACTER_SCHEDULE_EXPORT_VERSION) {
      return {
        ok: false,
        reason:
          value.kind === CHARACTER_SCHEDULE_EXPORT_KIND && typeof value.version === "number"
            ? "unsupported-version"
            : "invalid",
      };
    }
    format = "current";
    source = value.schedule;
  }

  const schedule = normalizeSchedule(source, currentWeekStart);
  return schedule ? { ok: true, schedule, format } : { ok: false, reason: "invalid" };
}

function normalizeSchedule(value, currentWeekStart) {
  if (!isRecord(value) || !isRecord(value.days)) return null;
  if (!isValidNumber(value.inactivityThresholdMinutes, 15, 360)) return null;
  if (!isValidNumber(value.talkativeness, 0, 100)) return null;
  if (!isOptionalNumber(value.idleResponseDelayMinutes, 0, 120)) return null;
  if (!isOptionalNumber(value.dndResponseDelayMinutes, 0, 120)) return null;
  if (!isOptionalCap(value.autonomousDailyCapOverride)) return null;
  if (!isOptionalString(value.routineSummary) || !isOptionalString(value.routineSummaryGeneratedAt)) return null;

  const days = {};
  for (const day of CONVERSATION_SCHEDULE_DAYS) {
    const blocks = value.days[day];
    if (blocks !== undefined && !Array.isArray(blocks)) return null;
    const normalizedBlocks = [];
    for (const block of blocks ?? []) {
      const normalized = normalizeBlock(block);
      if (!normalized) return null;
      normalizedBlocks.push(normalized);
    }
    days[day] = normalizedBlocks;
  }

  const disabledAutonomousIntents = normalizeMessageIntents(value.disabledAutonomousIntents);
  if (disabledAutonomousIntents === null) return null;

  return {
    weekStart: currentWeekStart,
    days,
    inactivityThresholdMinutes: value.inactivityThresholdMinutes,
    talkativeness: value.talkativeness,
    ...(typeof value.idleResponseDelayMinutes === "number"
      ? { idleResponseDelayMinutes: value.idleResponseDelayMinutes }
      : {}),
    ...(typeof value.dndResponseDelayMinutes === "number"
      ? { dndResponseDelayMinutes: value.dndResponseDelayMinutes }
      : {}),
    ...(value.autonomousDailyCapOverride === null || typeof value.autonomousDailyCapOverride === "number"
      ? { autonomousDailyCapOverride: value.autonomousDailyCapOverride }
      : {}),
    ...(value.routineSummary === null || typeof value.routineSummary === "string"
      ? { routineSummary: value.routineSummary }
      : {}),
    ...(value.routineSummaryGeneratedAt === null || typeof value.routineSummaryGeneratedAt === "string"
      ? { routineSummaryGeneratedAt: value.routineSummaryGeneratedAt }
      : {}),
    ...(disabledAutonomousIntents.length > 0 ? { disabledAutonomousIntents } : {}),
  };
}

function normalizeBlock(value) {
  if (!isRecord(value) || typeof value.time !== "string" || typeof value.activity !== "string") return null;
  if (!PRESENCE_STATUSES.has(value.status)) return null;
  return {
    time: value.time,
    activity: value.activity,
    status: value.status,
    // NarrativeArchive: a block's place (where the activity happens) is kept
    ...(typeof value.place === "string" && value.place.trim() ? { place: value.place.trim() } : {}),
  };
}

function normalizeMessageIntents(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const intents = new Set ();
  for (const intent of value) {
    if (!MESSAGE_INTENTS.has(intent)) return null;
    intents.add(intent);
  }
  return Array.from(intents);
}

function cloneSchedule(schedule) {
  return {
    ...schedule,
    days: Object.fromEntries(
      CONVERSATION_SCHEDULE_DAYS.map((day) => [day, (schedule.days[day] ?? []).map((block) => ({ ...block }))]),
   ),
    ...(schedule.disabledAutonomousIntents
      ? { disabledAutonomousIntents: [...schedule.disabledAutonomousIntents] }
      : {}),
  };
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isValidNumber(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isOptionalNumber(value, min, max) {
  return value === undefined || isValidNumber(value, min, max);
}

function isOptionalCap(value) {
  return value === undefined || value === null || (typeof value === "number" && Number.isInteger(value) && value >= 1);
}

function isOptionalString(value) {
  return value === undefined || value === null || typeof value === "string";
}
