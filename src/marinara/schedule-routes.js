// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), packages/server/src/routes/conversation.routes.ts, at fc0333c.
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - the helpers (parseWeekScheduleDraftMode … preserveAutonomousScheduleControls) are as they are, TypeScript types removed;
//   - scheduleDraft, scheduleSummary and scheduleGenerate are the POST /schedule/draft, /schedule/summary and
//     /schedule/generate handlers: the character, its schedule, the chat metadata, the provider and the abort signal
//     come as arguments instead of the Marinara database and connection store, and they return (or throw) instead of
//     replying. A failed draft throws an error that carries rawResponse, as the route's reply did.
import { CONVERSATION_SCHEDULE_DAYS } from "./conversation-presence.js";
import {
  ScheduleDraftError,
  generateCharacterDaySchedule,
  generateCharacterSchedule,
  generateScheduleRoutineSummary,
  getMonday,
  scheduleNeedsRefresh,
} from "./schedule.service.js";
import { normalizePromptTimeZone, resolveConversationTimeZone, toZonedWallClockDate } from "./timezone.js";

function parseWeekScheduleDraftMode(value) {
  return value === "adjust" || value === "vary" || value === "repair" || value === "rewrite" ? value : "rewrite";
}

function getScheduleGenerationError(error, fallback) {
  if (error instanceof SyntaxError || (error instanceof ScheduleDraftError && error.cause instanceof SyntaxError))
    return "The model returned invalid schedule JSON. Try again or choose another model.";
  return error instanceof Error && error.message ? error.message : fallback;
}

const SCHEDULE_CONTINUITY_MAX_CHARS = 6000;

function parseDateKeyMs(dateKey) {
  const match = dateKey.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return 0;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

function coerceSummaryEntry(value) {
  if (typeof value === "string") {
    const summary = value.trim();
    return summary ? { summary, keyDetails: [] } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value;
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  const keyDetails = Array.isArray(record.keyDetails)
    ? record.keyDetails.filter((detail) => typeof detail === "string" && detail.trim().length > 0)
    : [];
  return summary || keyDetails.length > 0 ? { summary, keyDetails } : null;
}

function getRecentSummaryEntries(raw, limit) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw)
    .map(([key, value]) => ({ key, entry: coerceSummaryEntry(value), time: parseDateKeyMs(key) }))
    .filter((item) => !!item.entry)
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(({ key, entry }) => ({ key, entry }));
}

function limitText(value, maxChars) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1).trim()}…` : trimmed;
}

function formatSummaryEntry(label, entry) {
  const lines = [`- ${label}: ${limitText(entry.summary, 700)}`];
  if (entry.keyDetails.length > 0) {
    lines.push(
      ` Key details: ${entry.keyDetails
        .slice(0, 8)
        .map((detail) => limitText(detail, 180))
        .join("; ")}`,
   );
  }
  return lines;
}

function summarizePreviousSchedule(schedule) {
  return Object.entries(schedule.days)
    .slice(0, 7)
    .map(([day, blocks]) => {
      const activities = blocks
        .slice(0, 8)
        .map((block) => `${block.time} ${block.activity} (${block.status})`)
        .join("; ");
      return `- ${day}: ${activities}`;
    });
}

function buildScheduleContinuityContext(args

) {
  const { meta, charData, existingSchedule } = args;
  const sections = [];

  sections.push(`<previous_schedule weekStart="${existingSchedule.weekStart}">`);
  sections.push(...summarizePreviousSchedule(existingSchedule));
  sections.push(`</previous_schedule>`);

  const weekSummaries = getRecentSummaryEntries(meta.weekSummaries, 2);
  if (weekSummaries.length > 0) {
    sections.push(``, `<recent_week_summaries>`);
    for (const { key, entry } of weekSummaries) {
      sections.push(...formatSummaryEntry(`Week of ${key}`, entry));
    }
    sections.push(`</recent_week_summaries>`);
  }

  const daySummaries = getRecentSummaryEntries(meta.daySummaries, 7);
  if (daySummaries.length > 0) {
    sections.push(``, `<recent_day_summaries>`);
    for (const { key, entry } of daySummaries) {
      sections.push(...formatSummaryEntry(key, entry));
    }
    sections.push(`</recent_day_summaries>`);
  }

  const rollingSummary = typeof meta.summary === "string" ? meta.summary.trim() : "";
  if (rollingSummary) {
    sections.push(``, `<rolling_chat_summary>`, limitText(rollingSummary, 1200), `</rolling_chat_summary>`);
  }

  const memories = Array.isArray(charData.extensions?.characterMemories)
    ? (charData.extensions.characterMemories)
    : [];
  const previousScheduleStartMs = new Date(existingSchedule.weekStart).getTime();
  const recentMemories = memories
    .filter((memory) => typeof memory.summary === "string" && memory.summary.trim())
    .filter((memory) => {
      if (!Number.isFinite(previousScheduleStartMs) || !memory.createdAt) return true;
      const memoryTime = new Date(memory.createdAt).getTime();
      return !Number.isFinite(memoryTime) || memoryTime >= previousScheduleStartMs;
    })
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 8);
  if (recentMemories.length > 0) {
    sections.push(``, `<recent_character_memories>`);
    for (const memory of recentMemories) {
      const date = memory.createdAt ? memory.createdAt.slice(0, 10) : "unknown date";
      const from = memory.from ? ` from ${memory.from}` : "";
      sections.push(`- ${date}${from}: ${limitText(memory.summary ?? "", 350)}`);
    }
    sections.push(`</recent_character_memories>`);
  }

  return sections.join("\n").slice(0, SCHEDULE_CONTINUITY_MAX_CHARS);
}

function preserveDraftScheduleFields(schedule, existing) {
  if (!existing) return schedule;
  const merged = {
    ...schedule,
    inactivityThresholdMinutes: existing.inactivityThresholdMinutes,
    talkativeness: existing.talkativeness,
    routineSummary: null,
    routineSummaryGeneratedAt: null,
  };
  if (typeof existing.idleResponseDelayMinutes === "number")
    merged.idleResponseDelayMinutes = existing.idleResponseDelayMinutes;
  if (typeof existing.dndResponseDelayMinutes === "number")
    merged.dndResponseDelayMinutes = existing.dndResponseDelayMinutes;
  return preserveAutonomousScheduleControls(merged, existing);
}

function preserveAutonomousScheduleControls(schedule, existing) {
  const merged = { ...schedule };
  if (typeof existing.autonomousDailyCapOverride === "number") {
    merged.autonomousDailyCapOverride = existing.autonomousDailyCapOverride;
  } else if (existing.autonomousDailyCapOverride === null) {
    merged.autonomousDailyCapOverride = null;
  }
  if (Array.isArray(existing.disabledAutonomousIntents)) {
    merged.disabledAutonomousIntents = existing.disabledAutonomousIntents;
  }
  return merged;
}

function scheduleError(error, fallback) {
  const out = new Error(getScheduleGenerationError(error, fallback), { cause: error });
  if (error instanceof ScheduleDraftError) out.rawResponse = error.rawResponse;
  return out;
}

/** POST /schedule/draft: a week or one day, made from the draft that is passed in. Nothing is saved. */
export async function scheduleDraft(args) {
  const { mode, provider, model = "", charData, signal } = args;
  const guidance = typeof args.guidance === "string" ? args.guidance.trim() : "";
  const dayGuidance = typeof args.dayGuidance === "string" ? args.dayGuidance.trim() : "";
  const requestedTimeZone = normalizePromptTimeZone(args.timeZone);
  if (args.timeZone != null && !requestedTimeZone) throw new Error("timeZone must be a valid IANA timezone");
  const scheduleTimeZone = requestedTimeZone ?? resolveConversationTimeZone(args.meta ?? {});
  const scheduleNow = toZonedWallClockDate(args.nowInstant ?? new Date(), scheduleTimeZone);

  try {
    if (mode === "day") {
      const day = typeof args.day === "string" ? args.day : "";
      if (!CONVERSATION_SCHEDULE_DAYS.includes(day)) throw new Error("Invalid schedule day");
      if (!args.schedule) throw new Error("schedule is required for day regeneration");
      const { blocks } = await generateCharacterDaySchedule(
        provider,
        model,
        charData.name,
        charData.description ?? "",
        charData.personality ?? "",
        day,
        args.schedule,
        guidance,
        dayGuidance,
        {
          timeZone: scheduleTimeZone,
          draftMode: args.draftMode === undefined ? "vary" : parseWeekScheduleDraftMode(args.draftMode),
          debugMode: args.debugMode === true,
          signal,
        },
      );
      return { day, blocks, weekStart: getMonday(scheduleNow).toISOString() };
    }

    const { schedule } = await generateCharacterSchedule(
      provider,
      model,
      charData.name,
      charData.description ?? "",
      charData.personality ?? "",
      guidance,
      args.schedule ? `Current draft schedule:\n${summarizePreviousSchedule(args.schedule).join("\n")}` : undefined,
      {
        draftMode: parseWeekScheduleDraftMode(args.draftMode),
        timeZone: scheduleTimeZone,
        debugMode: args.debugMode === true,
        signal,
      },
    );
    const fullSchedule = preserveDraftScheduleFields(
      { ...schedule, weekStart: getMonday(scheduleNow).toISOString() },
      args.schedule,
    );
    return { schedule: fullSchedule };
  } catch (error) {
    if (signal?.aborted) throw error;
    throw scheduleError(error, "Schedule draft generation failed");
  }
}

/** POST /schedule/summary */
export async function scheduleSummary(args) {
  const { schedule, provider, model = "", charData, signal } = args;
  if (!schedule) throw new Error("schedule is required");
  const guidance = typeof args.guidance === "string" ? args.guidance.trim() : "";
  try {
    const { summary } = await generateScheduleRoutineSummary(
      provider,
      model,
      charData.name,
      schedule,
      guidance,
      args.debugMode === true,
      signal,
    );
    return { summary, generatedAt: new Date().toISOString() };
  } catch (error) {
    if (signal?.aborted) throw error;
    throw scheduleError(error, "Schedule summary generation failed");
  }
}

/**
 * POST /schedule/generate: generate or refresh weekly schedules.
 *   existingSchedules: { characterId: WeekSchedule }; cards: { characterId: charData (name, description, personality,
 *   extensions.conversationScheduleAutoRenew, …) }; meta: the chat metadata (week/day summaries, conversationTimeZone)
 */
export async function scheduleGenerate(args) {
  const { forceRefresh, provider, model = "", signal } = args;
  const rawPrefs = args.scheduleGenerationPreferences;
  if (rawPrefs != null && typeof rawPrefs !== "string") throw new Error("scheduleGenerationPreferences must be a string");
  const userSchedulePreferences = typeof rawPrefs === "string" ? rawPrefs.trim() : "";
  const requestedTimeZone = normalizePromptTimeZone(args.timeZone);
  if (args.timeZone != null && !requestedTimeZone) throw new Error("timeZone must be a valid IANA timezone");

  const meta = args.meta ?? {};
  const scheduleTimeZone = requestedTimeZone ?? resolveConversationTimeZone(meta);
  const nowInstant = args.nowInstant ?? new Date();
  const scheduleNow = toZonedWallClockDate(nowInstant, scheduleTimeZone);
  const existingSchedules = args.existingSchedules ?? {};
  const characterIds = args.characterIds ?? [];
  const mondayStr = getMonday(scheduleNow).toISOString();

  const preserveTimingSettings = (schedule, existing) => {
    if (!existing) {
      return schedule;
    }
    const merged = {
      ...schedule,
      inactivityThresholdMinutes: existing.inactivityThresholdMinutes,
    };
    if (typeof existing.idleResponseDelayMinutes === "number") {
      merged.idleResponseDelayMinutes = existing.idleResponseDelayMinutes;
    }
    if (typeof existing.dndResponseDelayMinutes === "number") {
      merged.dndResponseDelayMinutes = existing.dndResponseDelayMinutes;
    }
    return preserveAutonomousScheduleControls(merged, existing);
  };

  const newSchedules = { ...existingSchedules };
  const results = {};

  for (const charId of characterIds) {
    if (signal?.aborted) return { results, schedules: newSchedules, aborted: true };
    const charData = args.cards?.[charId];
    if (!charData) {
      results[charId] = { status: "not_found" };
      continue;
    }

    const existing = existingSchedules[charId];
    if (args.automatic === true && (!existing || charData.extensions?.conversationScheduleAutoRenew !== true)) {
      results[charId] = { status: "renewal_disabled" };
      continue;
    }
    if (existing && !forceRefresh && charData.extensions?.conversationScheduleAutoRenew !== true) {
      newSchedules[charId] = existing;
      results[charId] = { status: "renewal_disabled" };
      continue;
    }
    if (existing && !forceRefresh && !scheduleNeedsRefresh(existing, scheduleNow)) {
      newSchedules[charId] = existing;
      results[charId] = { status: "fresh" };
      continue;
    }

    try {
      const recentContinuityContext = existing
        ? buildScheduleContinuityContext({ meta, charData, existingSchedule: existing })
        : undefined;
      const { schedule } = await generateCharacterSchedule(
        provider,
        model,
        charData.name,
        charData.description ?? "",
        charData.personality ?? "",
        userSchedulePreferences,
        recentContinuityContext,
        { timeZone: scheduleTimeZone, signal },
      );
      signal?.throwIfAborted();

      const fullSchedule = preserveTimingSettings(
        {
          ...schedule,
          weekStart: mondayStr,
        },
        existing,
      );
      newSchedules[charId] = fullSchedule;
      results[charId] = { status: "generated", schedule: fullSchedule };
    } catch (err) {
      if (signal?.aborted) return { results, schedules: newSchedules, aborted: true };
      const msg = err instanceof Error ? err.message : "Schedule generation failed";
      results[charId] = { status: `error: ${msg}` };
    }
  }

  return { results, schedules: newSchedules };
}
