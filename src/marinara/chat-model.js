// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at fc0333c:
//   packages/shared/src/schemas/connection-account.schema.ts (a chat's model choice: its schema, the metadata keys,
//   readChatModelOverride, readChatRecentModels), packages/shared/src/schemas/connection.schema.ts (the model id rule),
//   packages/shared/src/types/connection.ts (parsePinnedModels and its limits),
//   packages/server/src/services/generation/connection-resolution.ts (applyChatModelOverride),
//   packages/client/src/hooks/use-model-star.ts (reorderStars), and
//   packages/server/src/routes/chats.routes.ts (PUT /:id/model: how a pick is stored with the two recent choices).
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; "zod" is our small stand-in (zod-lite.js);
//   - applyChatModelPatch is the route's metadata patch as a function: it takes the stored values and returns the new ones.
import { z } from "./zod-lite.js";

export const MAX_MODEL_ID_LENGTH = 512;

export const MAX_PINNED_MODELS = 100;

/** A model ID as the model picker sends it: trimmed, non-empty and bounded. */
export const connectionModelIdSchema = z.string().trim().min(1).max(MAX_MODEL_ID_LENGTH);

/**
 * A chat's model choice. Without `model`: the saved Model `connectionId` as it is. With `model`: a catalog model
 * run on that Model's Connection for this chat only (maintainer decision 25). No row is created; the chat keeps
 * the catalog limits, and every other setting is the neutral default.
 */
export const chatModelChoiceSchema = z.object({
  connectionId: z.string().trim().min(1).max(200),
  model: connectionModelIdSchema.optional(),
  name: z.string().trim().min(1).max(200).optional(),
  maxContext: z.number().int().min(1).optional(),
  maxTokensOverride: z.number().int().min(1).optional(),
});

/** Chat metadata keys: the current per-chat catalog pick, and the chat's last two choices (newest first). */
export const CHAT_MODEL_OVERRIDE_KEY = "modelOverride";
export const CHAT_RECENT_MODELS_KEY = "recentModels";
export const CHAT_RECENT_MODELS_LIMIT = 2;
/** Set when the user chose "Use default": the chat has no Model of its own and answers through Main, silently. */
export const CHAT_FOLLOWS_MAIN_KEY = "followsMainModel";

function chatMetadataRecord(metadata) {
  if (metadata && typeof metadata === "object") return metadata;
  if (typeof metadata !== "string" || !metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" ? (parsed) : {};
  } catch {
    return {};
  }
}

/**
 * The chat's catalog pick, only while it still belongs to the chat's Model: any other way of setting the chat's
 * Model (Chat Settings before decision 26, a preset, an import that changed the id) leaves a stale pick that is
 * ignored.
 */
export function readChatModelOverride(chat

) {
  const parsed = chatModelChoiceSchema.safeParse(chatMetadataRecord(chat.metadata)[CHAT_MODEL_OVERRIDE_KEY]);
  if (!parsed.success || !parsed.data.model || parsed.data.connectionId !== chat.connectionId) return null;
  return parsed.data;
}

/** The chat's last choices, newest first; malformed entries are dropped. */
export function readChatRecentModels(chat) {
  const stored = chatMetadataRecord(chat.metadata)[CHAT_RECENT_MODELS_KEY];
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((entry) => {
    const parsed = chatModelChoiceSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The chat follows the Main default by choice (decision 27), not because its Model was deleted. */
export function readChatFollowsMain(chat) {
  return !chat.connectionId && chatMetadataRecord(chat.metadata)[CHAT_FOLLOWS_MAIN_KEY] === true;
}

export function parsePinnedModels(value) {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const ids = parsed
    .filter((id) => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id && id.length <= MAX_MODEL_ID_LENGTH);
  return [...new Set(ids)].slice(0, MAX_PINNED_MODELS);
}

/** The fields a per-chat pick sets; everything else a saved Model tunes goes back to its neutral default. */
const NEUTRAL_TUNING = {
  defaultParameters: null,
  promptPresetId: null,
  enableCaching: "false",
  anthropicExtendedCacheTtl: "false",
  cachingAtDepth: 5,
  openrouterProvider: null,
  claudeFastMode: "false",
  maxStateTokens: null,
};

/**
 * Run the override's model on the resolved Model's credentials and endpoint. Applies only to the Model the
 * override names, so a fallback Model is never changed. Limits come from the catalog (schema defaults when the
 * catalog has none); tuning is neutral, never taken from the saved Model it borrows the key from.
 */
export function applyChatModelOverride (conn, override) {
  if (!override || conn.id !== override.connectionId) return conn;
  return {
    ...conn,
    ...NEUTRAL_TUNING,
    name: override.name ?? override.model,
    model: override.model,
    maxContext: override.maxContext ?? 128000,
    maxTokensOverride: override.maxTokensOverride ?? null,
  };
}

/** The star list with `model` moved one place up (-1) or down (1); null when it cannot move. */
export function reorderStars(stars, model, by) {
  const at = stars.indexOf(model);
  const to = at + by;
  if (at < 0 || to < 0 || to >= stars.length) return null;
  const next = [...stars];
  [next[at], next[to]] = [next[to], next[at] ];
  return next;
}

/**
 * PUT /:id/model, the metadata half: the pick (null: "Use default") replaces the chat's own, and the choice it
 * replaces joins the two recent ones (newest first, never the new pick itself, never twice).
 *   previous: what the chat ran before (its override, or its connection alone); stored: the recent list as stored
 */
export function applyChatModelPatch({ choice, previous, stored }) {
  const sameChoice = (a, b) => a.connectionId === b.connectionId && (a.model ?? "") === (b.model ?? "");
  const recent = [];
  for (const candidate of [previous, ...(Array.isArray(stored) ? stored : [])]) {
    const parsed = chatModelChoiceSchema.safeParse(candidate);
    if (
      !parsed.success ||
      (choice && sameChoice(parsed.data, choice)) ||
      recent.some((r) => sameChoice(r, parsed.data))
    ) {
      continue;
    }
    recent.push(parsed.data);
  }
  return {
    [CHAT_MODEL_OVERRIDE_KEY]: choice?.model ? choice : null,
    [CHAT_RECENT_MODELS_KEY]: recent.slice(0, CHAT_RECENT_MODELS_LIMIT),
    [CHAT_FOLLOWS_MAIN_KEY]: !choice,
  };
}
