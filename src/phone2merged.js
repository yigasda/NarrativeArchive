// Merged 단체방 요청에 쓰는 마리나라의 지시문 (src/marinara/merged-conversation.js)을 답장 돌리는 파일에 건네요.
// **이 지시문은 우리 것(phone2reply.js)으로 바꿔야 해요** (docs/MARINARA-PORT.md "꼭 할 것", 소망 2026-11-21): 지금은 마리나라 것을 그대로 써요.
export { buildMergedConversationSystemPrompt, formatConversationGroupOutputFormat, mergedRespondersLine, mergedMentionLine } from './marinara/merged-conversation.js';
// 답장에 남기는 마리나라의 값: 모델 생각(extra.thinking) · 보낸 요청 그대로(extra.cachedPrompt) · 생성 정보(extra.generationInfo)
export { extractLeadingThinkingBlocks } from './marinara/thinking-tags.js';
export { buildGenerationInfoExtra, sanitizeBranchedMessageExtra } from './marinara/saved-message-extra.js';
