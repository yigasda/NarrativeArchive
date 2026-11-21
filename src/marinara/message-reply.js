// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at fc0333c:
//   packages/server/src/services/generation/message-reply.ts (the whole file),
//   packages/shared/src/schemas/chat.schema.ts (messageReplySchema),
//   packages/client/src/components/chat/MessageReplyPreview.tsx (what the Reply button puts in the draft).
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; "zod" is our small stand-in (zod-lite.js);
//   - buildMessageReplyDraft is the Reply button's onClick as a function: the message, the name and the selected text are arguments;
//   - canReplyToMessage is the button's "disabled" test.
import { z } from "./zod-lite.js";

export const messageReplySchema = z.object({
  messageId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  content: z.string().min(1).max(16000),
});

/** Stored/imported extras are untrusted. Older turns never repeat their quoted snapshot. */
export function withLatestMessageReply(content, reply, isLatestUserMessage) {
  if (!isLatestUserMessage) return content;
  const parsed = messageReplySchema.safeParse(reply);
  if (!parsed.success) return content;
  const quote = parsed.data.content
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
  return `Replying to ${parsed.data.name}:\n${quote}\n\n${content}`;
}

/** The Reply button is off for a message with no text. */
export const canReplyToMessage = (message) => !!String(message?.content ?? "").trim() && !String(message?.id ?? "").startsWith("__");

/** A quote snapshot retains the selected text even if its source is edited or deleted. */
export function buildMessageReplyDraft(message, name, selected = "") {
  return {
    messageId: message.id,
    name: name.slice(0, 200),
    // ponytail: quote snapshots are capped at 16k characters; longer passages can be selected separately.
    content: (selected || message.content).slice(0, 16000),
  };
}
