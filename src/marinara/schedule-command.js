// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at fc0333c:
//   packages/server/src/services/generation/conversation-schedule-command-runtime.ts (the status command: its limits,
//   parseDuration and applyCharacterStatusCommand) and packages/server/src/services/generation/conversation-command-runtime.ts
//   (the prompt line that tells the character about the command), and parseDuration from
//   packages/server/src/services/conversation/character-commands.ts.
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - parseDuration and the limits are as they are, TypeScript types removed;
//   - applyCharacterStatusCommand takes the character's current override and schedule as arguments instead of reading
//     the Marinara database, and returns the new override instead of saving it on the character card;
//   - SCHEDULE_UPDATE_PROMPT_LINE is the prompt line as it is.
import { getActiveStatusOverride, getEffectiveCurrentStatus } from "./conversation-presence.js";

/** Used when the model leaves out the duration or writes one we cannot read. */
const DEFAULT_STATUS_MINUTES = 60;
/** Keeps a runaway duration from pinning a status for weeks (or overflowing the date). */
const MAX_STATUS_MINUTES = 7 * 24 * 60;


/** The line Marinara puts in the prompt for this command. */
export const SCHEDULE_UPDATE_PROMPT_LINE = `- [schedule_update: status="online|idle|dnd|offline", activity="activity name", duration="number of hours (e.g., 1h)"] - only if you change your own status/activity, for example, if the user asks you to stop what you're doing or if you decide to change them yourself.`;

/**
 * The command sets a temporary status override and lets it expire after the duration.
 *   command: { status?, activity?, duration? }; current: the character's override now; schedule: its week;
 *   now: the instant; scheduleNow: now on the character's wall clock  → the new override, or null (nothing changes)
 */
export function applyCharacterStatusCommand({ command, current, schedule, now = new Date(), scheduleNow = now }) {
  if (!command.status && !command.activity) return null;
  // A status the user set by hand has no end time, and it stays in charge.
  if (getActiveStatusOverride(current, now) && !current?.expiresAt) return null;

  let status = command.status;
  if (!status) {
    status = getEffectiveCurrentStatus(schedule, current, now, "free time", scheduleNow).status;
  }
  const parsedMinutes = command.duration ? parseDuration(command.duration) : null;
  const minutes = Math.min(parsedMinutes ?? DEFAULT_STATUS_MINUTES, MAX_STATUS_MINUTES);
  return {
    status,
    activity: command.activity?.trim() || null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + minutes * 60_000).toISOString(),
  };
}

function parseDuration(duration) {
  const bareHours = duration.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  // A unit must end at a non-letter, so "months" is not minutes and "1h30m" still splits.
  const hourMatch = bareHours ?? duration.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)(?![a-z])/i);
  const minMatch = bareHours ? null : duration.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)(?![a-z])/i);

  let total = 0;
  if (hourMatch) total += Number(hourMatch[1]) * 60;
  if (minMatch) total += Number(minMatch[1]);

  total = Math.round(total);
  return total > 0 ? total : null;
}
