// 마리나라에서 가져온 파일이에요 (글자 그대로, 타입 표기만 뺐어요).
//   원본: packages/client/src/lib/generation-level-label.ts (Marinara Engine v2.5.2, fc0333c)
//   Copyright (C) 2025-2026 Spicy Marinara. AGPL-3.0 (LICENSE · NOTICE.md)
//   바꾼 것: 없어요. t(키)는 부르는 쪽이 줘요 (키: generationParameters.level.low · medium · high · xhigh · max · maximum)
/** Reasoning effort and verbosity levels with their own name in the catalog. */
const NAMED_LEVELS = new Set(["low", "medium", "high", "xhigh", "max", "maximum"]);

/**
 * A reasoning effort or verbosity level as people read it: "Low" for the "low" that is saved and sent. A level
 * without a name of its own (a provider's own label) keeps its text with a capital first letter.
 */
export function generationLevelLabel(level, t) {
  return NAMED_LEVELS.has(level)
    ? t(`generationParameters.level.${level}`)
    : level.charAt(0).toUpperCase() + level.slice(1);
}
