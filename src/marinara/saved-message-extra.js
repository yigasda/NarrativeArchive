// Ported from Marinara Engine (https://github.com/Pasta-Devs/Marinara-Engine), at fc0333c:
//   packages/server/src/routes/generate/saved-message-extra.ts (the whole file),
//   packages/server/src/services/generation/generation-text-utils.ts (getHiddenCompletionTokens, getVisibleCompletionTokens),
//   packages/server/src/services/game/game-market.service.ts (the GAME_MARKET_PLACE_EXTRA name),
//   packages/server/src/routes/chats.routes.ts (the message extras a branch or an export leaves behind).
// Copyright (C) 2025-2026 Spicy Marinara. Licensed under the GNU Affero General Public License v3.0 (see /LICENSE).
// Changes for NarrativeArchive:
//   - TypeScript types removed; the imports are the two things they brought, written here.
export const GAME_MARKET_PLACE_EXTRA = "gameMarketPlace";

export function getHiddenCompletionTokens(usage) {
  if (!usage) return undefined;
  const hiddenParts = [
    usage.completionReasoningTokens,
    usage.completionAudioTokens,
    usage.rejectedPredictionTokens,
  ].filter((value) => typeof value === "number");
  if (hiddenParts.length === 0) return undefined;
  return hiddenParts.reduce((sum, value) => sum + value, 0);
}

export function getVisibleCompletionTokens(usage) {
  if (!usage || typeof usage.completionTokens !== "number") return undefined;
  return Math.max(0, usage.completionTokens - (getHiddenCompletionTokens(usage) ?? 0));
}

/**
 * Builds the extra a saved reply gets after generation: game flags, the game tool-planning
 * connection, generationInfo and the per-swipe reasoning/injection fields. An absent value is
 * stored as null, not left out, so a regenerated swipe clears what the previous swipe saved.
 */
export function buildGenerationInfoExtra(o

) {
  const {
    chatMode,
    gameOutcomeNarrationFailed,
    marketWorldPlace,
    gameToolPlan,
    gameToolConnection,
    generationProviderOrigin,
    continuedFallback,
    temperature,
    effectiveMaxTokensForSend,
    suppressModelParameters,
    effectiveMaxContext,
    connectionMaxContext,
    showThoughts,
    resolvedEffort,
    reasoningEffort,
    verbosity,
    serviceTier,
    assistantPrefill,
    assistantReasoningPrefill,
    customParameters,
    usage,
    tokensContext,
    tokensLastRequestInput,
    requestCount,
    durationMs,
    reasoningDurationMs,
    finishReason,
    lastContextFit,
    fullThinking,
    geminiResponseParts,
    chatCompletionsReasoning,
    encryptedReasoningItems,
    contextInjections,
  } = o;
  const fallback = generationProviderOrigin.fallback ?? continuedFallback;
  const extraUpdate = {
    ...(chatMode === "game" ? { gameOutcomeNarrationFailed } : {}),
    // Set, or cleared on a regeneration at a place a tag named.
    ...(chatMode === "game" ? { [GAME_MARKET_PLACE_EXTRA]: marketWorldPlace ?? null } : {}),
    ...(gameToolPlan && gameToolConnection
      ? {
          gameToolPlanning: {
            connectionId: gameToolConnection.id,
            model: gameToolConnection.model,
            provider: gameToolConnection.provider,
            usage: gameToolPlan.usage ?? null,
          },
        }
      : {}),
    generationInfo: {
      model: generationProviderOrigin.model,
      provider: generationProviderOrigin.provider,
      temperature: temperature ?? null,
      maxTokens: effectiveMaxTokensForSend ?? null,
      maxContext: suppressModelParameters ? null : (effectiveMaxContext ?? connectionMaxContext ?? null),
      showThoughts: showThoughts ?? null,
      reasoningEffort: resolvedEffort ?? reasoningEffort ?? null,
      verbosity: verbosity ?? null,
      serviceTier,
      assistantPrefill: assistantPrefill || null,
      assistantReasoningPrefill: assistantReasoningPrefill || null,
      customParameters: Object.keys(customParameters).length > 0 ? customParameters : null,
      tokensPrompt: usage?.promptTokens ?? null,
      tokensContext,
      tokensLastRequestInput,
      requestCount,
      tokensCompletion: usage?.completionTokens ?? null,
      tokensVisibleCompletion: getVisibleCompletionTokens(usage) ?? null,
      tokensReasoning: usage?.completionReasoningTokens ?? null,
      tokensCompletionAudio: usage?.completionAudioTokens ?? null,
      tokensRejectedPrediction: usage?.rejectedPredictionTokens ?? null,
      tokensAcceptedPrediction: usage?.acceptedPredictionTokens ?? null,
      tokensCachedPrompt: usage?.cachedPromptTokens ?? null,
      tokensCacheWritePrompt: usage?.cacheWritePromptTokens ?? null,
      durationMs,
      reasoningDurationMs,
      finishReason: finishReason ?? null,
      contextFit: lastContextFit ?? null,
      // A fresh reply clears the prior swipe's notice; a continuation keeps it with the retained text.
      ...(fallback ? { fallback } : {}),
    },
  };
  if (fullThinking) extraUpdate.thinking = fullThinking;
  else extraUpdate.thinking = null;
  // Store Gemini response parts (thought signatures + summaries) for multi-turn continuity
  if (geminiResponseParts) extraUpdate.geminiParts = geminiResponseParts;
  else extraUpdate.geminiParts = null;
  // Store Chat Completions reasoning fields for providers that require replay (DeepSeek/OpenRouter)
  if (chatCompletionsReasoning) extraUpdate.chatCompletionsReasoning = chatCompletionsReasoning;
  else extraUpdate.chatCompletionsReasoning = null;
  // Store OpenAI Responses API encrypted reasoning items for multi-turn continuity
  if (encryptedReasoningItems?.length) extraUpdate.encryptedReasoning = encryptedReasoningItems;
  else extraUpdate.encryptedReasoning = null;
  // Cache the exact prompt injections used for this swipe so future
  // regenerations and swipe switches replay the same guidance.
  extraUpdate.contextInjections = contextInjections.length > 0 ? contextInjections : null;
  return extraUpdate;
}


export const INTERNAL_EXPORT_EXTRA_KEYS = new Set([
  "advancedMemoryReceipt",
  "cachedPrompt",
  "chatCompletionsReasoning",
  "chatSummaryFingerprint",
  "contextInjections",
  "conversationCommandContent",
  "encryptedReasoning",
  "geminiParts",
  "generationInfo",
  "generationReplay",
  "lorebookGenerationTriggers",
  "lorebookScan",
]);

export const sanitizeExportExtra = (extra) => {
  const sanitized = { ...extra };
  for (const key of INTERNAL_EXPORT_EXTRA_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
};

export const sanitizeBranchedMessageExtra = (extra) => {
  const sanitized = sanitizeExportExtra(extra);
  delete sanitized.summaryCandidate;
  delete sanitized.summaryDebug;
  return sanitized;
};
