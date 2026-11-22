// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at 32c47a1 (staging, 2026-11-20):
//   packages/server/src/services/conversation/autonomous-candidates.ts (the whole file)
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; nothing else
/**
 * Background-autonomous candidate filter (#4704): conversation chats with
 * autonomous messaging enabled, excluding the Professor Mari home assistant.
 * Mirrors the client-side legacy filter in use-background-autonomous.ts (kept
 * there as the old-server fallback) — the two must stay in sync. Kept as a
 * pure predicate so the /chats/autonomous-candidates route and the regression
 * suite share one definition. Unparseable or missing metadata disqualifies.
 */
/**
 * Roleplay DM threads are garbage-collected when emptied (see
 * cleanupEmptyRoleplayDmChats in chats.routes.ts). The candidates route must
 * exclude EMPTY chats carrying these markers: the legacy poll path ran the
 * cleanup as a GET /chats side effect, and without that an emptied DM thread
 * with stale in-memory activity state could receive an autonomous message —
 * permanently exempting it from cleanup. Same marker expression as the
 * cleanup; keep the two in sync.
 */
export function hasRoleplayDmThreadMarkers(metadata) {
  return metadata.roleplayDmThread === true || typeof metadata.dmOriginChatId === "string";
}

export function isBackgroundAutonomousCandidate(chat) {
  if (chat.mode !== "conversation") return false;
  const raw = chat.metadata;
  if (!raw) return false;
  let meta;
  try {
    meta = typeof raw === "string" ? (JSON.parse(raw)) : (raw);
  } catch {
    return false;
  }
  if (!meta || typeof meta !== "object") return false;
  if (meta.internalAssistant === "professor-mari") return false;
  return !!meta.autonomousMessages;
}
