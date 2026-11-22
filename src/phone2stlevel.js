// 폰 2 Orbit: 실리를 거쳐 가는 요청에서 추론 레벨이 실제로 무엇이 되어 나가는가
//
// 실리는 레벨을 여섯 낱말(auto · min · low · medium · high · max)로 받아서, 연결 종류와 모델에 따라 두 번 바꿔요:
//   1) 브라우저 쪽: public/scripts/openai.js 의 getReasoningEffort · createGenerationParameters
//   2) 서버 쪽:   src/endpoints/backends/chat-completions.js (연결 종류마다의 함수) · src/prompt-converters.js
//                 (calculateClaudeBudgetTokens · calculateGoogleBudgetTokens) · src/constants.js
// 어떤 레벨은 다른 레벨이 되고, 어떤 레벨은 아예 안 나가요. 화면의 칩은 실제로 나가는 것만 보여야 해서(소망, 2026-11-22),
// 그 두 단계를 여기에 그대로 옮겼어요. SillyTavern 1.19.1 기준이에요: 실리가 바뀌면 이 파일을 그 코드와 다시 대 봐야 해요.
//
// 돌려주는 것(실제로 모델에 닿는 것): 'off' (생각이 꺼짐) · 'on' (켜짐, 레벨은 없음) · 'minimal' · 'low' · 'medium' · 'high' ·
//   'xhigh' · 'max' · 'b:min' · 'b:low' · 'b:medium' · 'b:high' · 'b:max' (생각 예산: 레벨마다 다른 크기) · null (아무것도 안 나감)
// 이 파일은 아무것도 불러오지 않아요.

// src/constants.js OPENAI_REASONING_EFFORT_MODELS · OPENAI_FIXED_REASONING_EFFORT · NANOGPT_REASONING_EFFORT_MAP
const OPENAI_REASONING_EFFORT_MODELS = ['o1', 'o3-mini', 'o3-mini-2025-01-31', 'o4-mini', 'o4-mini-2025-04-16', 'o3', 'o3-2025-04-16', 'gpt-5', 'gpt-5-2025-08-07', 'gpt-5-mini', 'gpt-5-mini-2025-08-07', 'gpt-5-nano', 'gpt-5-nano-2025-08-07', 'gpt-5.1', 'gpt-5.1-2025-11-13', 'gpt-5.1-chat-latest', 'gpt-5.2', 'gpt-5.2-2025-12-11', 'gpt-5.2-chat-latest', 'gpt-5.3-chat-latest', 'gpt-5.4', 'gpt-5.4-2026-03-05', 'gpt-5.4-mini', 'gpt-5.4-mini-2026-03-17', 'gpt-5.4-nano', 'gpt-5.4-nano-2026-03-17', 'gpt-5.5', 'gpt-5.5-2026-04-23', 'gpt-5.6', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-6-astra'];
const OPENAI_FIXED_REASONING_EFFORT = { 'gpt-5.3-chat-latest': 'medium' };
const NANOGPT_REASONING_EFFORT_MAP = { min: 'none', low: 'minimal', medium: 'low', high: 'medium', max: 'high' };
// (the provider's own word → what it is)
const named = v => (v === 'none' ? 'off' : v === 'min' ? 'minimal' : v);

// 1) 브라우저 쪽: getReasoningEffort + createGenerationParameters 가 지우는 곳. level: auto · min · low · medium · high · max
//    thoughts: 실리의 "생각 보기"(show_thoughts)가 켜져 있나. → 서버로 가는 reasoning_effort 값 | undefined (안 감)
export function stClientEffort({ source = '', model = '', level = 'auto', thoughts = false } = {}) {
    const m = String(model || '');
    const listed = ['openai', 'azure_openai', 'custom', 'xai', 'aimlapi', 'openrouter', 'pollinations', 'perplexity', 'cometapi', 'electronhub', 'chutes', 'deepseek', 'fireworks'];
    let v;
    if (!listed.includes(source)) v = level;
    else if (source === 'deepseek') v = level === 'auto' ? undefined : level === 'min' || level === 'low' ? 'low' : level === 'max' ? 'max' : 'high';
    else if (source === 'fireworks') v = level === 'auto' ? undefined : level === 'min' ? 'low' : level;
    else if (source === 'custom' && /^koboldcpp\/(.+)$/.test(m)) v = { auto: undefined, min: 'minimal', low: 'low', medium: 'medium', high: 'high', max: 'xhigh' }[level];
    else if (level === 'auto') v = undefined;
    else if (level === 'min') {
        if (source === 'openrouter' && !thoughts) v = 'none';
        else if (['openai', 'azure_openai'].includes(source) && /^gpt-5\.(4|5|6)/.test(m)) v = 'none';
        else if (['openai', 'azure_openai'].includes(source) && /^gpt-5/.test(m)) v = 'min';
        else v = 'low';
    } else if (level === 'max') {
        if (['openai', 'azure_openai'].includes(source) && /^gpt-6-astra/.test(m)) v = 'max';
        else if (['openai', 'azure_openai'].includes(source) && /^gpt-5\.6/.test(m)) v = 'xhigh';
        else v = 'high';
    } else v = level;
    // (createGenerationParameters: what it deletes afterwards)
    if (source === 'azure_openai' && /^gpt-[34]/.test(m)) return undefined;
    if (source === 'xai' && !m.includes('grok-3-mini')) return undefined;
    if (/claude-(fable|opus-5|sonnet-5)/.test(m) && source !== 'claude') return undefined;
    return v;
}

// 2) 서버 쪽. value: 서버가 받은 reasoning_effort (1)의 답, Vertex 방식은 우리가 넣은 낱말 그대로), thoughts: include_reasoning
export function stServerEffort({ source = '', model = '', value, thoughts = false } = {}) {
    const m = String(model || ''), has = value !== undefined && value !== null && value !== '';
    if (source === 'claude') {
        // sendClaudeRequest + calculateClaudeBudgetTokens
        const fable = /claude-fable/.test(m), five = /claude-(opus-5|sonnet-5)/.test(m);
        const useThinking = /^claude-(3-7|opus-4|sonnet-4|haiku-4-5|opus-4-5|opus-4-6|sonnet-4-6|opus-4-7)/.test(m) || fable || five;
        if (!useThinking || !has || value === 'auto') return null;
        const adaptive = /^claude-(opus-4-7|opus-4-8)/.test(m) || fable || five;
        if (adaptive) return { min: 'low', low: 'low', medium: 'medium', high: 'high', max: 'max' }[value] ?? null;
        return { min: 'b:min', low: 'b:low', medium: 'b:medium', high: 'b:high', max: 'b:max' }[value] ?? null;
    }
    if (source === 'makersuite' || source === 'vertexai') {
        // sendMakerSuiteRequest (isThinkingConfigModel) + calculateGoogleBudgetTokens
        const thinks = (/^gemini-2.5-(flash|pro)/.test(m) && !/-image(-preview)?$/.test(m)) || /^gemini-3[.\d]*-(flash|pro)/.test(m);
        if (!thinks || !has || value === 'auto') return null;
        if (/gemini-3[.\d]*-pro/.test(m)) return { min: 'low', low: 'low', medium: 'low', high: 'high', max: 'high' }[value] ?? null;
        if (/gemini-3[.\d]*-flash/.test(m)) return { min: /gemini-3\.7-flash/.test(m) ? 'low' : 'minimal', low: 'low', medium: 'medium', high: 'high', max: 'high' }[value] ?? null;
        if (/flash/.test(m)) return { min: 'off', low: 'b:low', medium: 'b:medium', high: 'b:high', max: 'b:max' }[value] ?? null;
        if (/pro/.test(m)) return { min: 'b:min', low: 'b:low', medium: 'b:medium', high: 'b:high', max: 'b:max' }[value] ?? null;
        return null;
    }
    // sendDeepSeekRequest: thinking is switched by include_reasoning; the level goes only while it is on
    if (source === 'deepseek') return !thoughts ? 'off' : has ? named(value) : 'on';
    // moonshot · zai: thinking is switched by include_reasoning; no level
    if (source === 'moonshot' || source === 'zai') return thoughts ? 'on' : 'off';
    if (!has) return null;
    if (source === 'xai') return value === 'high' ? 'high' : 'low';                                    // sendXaiRequest
    if (source === 'nanogpt') return named(NANOGPT_REASONING_EFFORT_MAP[value]) ?? null;
    if (['aimlapi', 'electronhub', 'chutes', 'fireworks', 'pollinations', 'perplexity', 'cometapi', 'openrouter'].includes(source)) return named(value);
    if (source === 'openai' || source === 'azure_openai' || source === 'custom') {
        if (OPENAI_REASONING_EFFORT_MODELS.includes(m)) return named(OPENAI_FIXED_REASONING_EFFORT[m] ?? (value === 'min' ? 'minimal' : value));
        if (source === 'custom' && /^koboldcpp\/(.+)$/.test(m)) return named(value);
        return null;
    }
    // (mistralai · cohere · groq · ai21 · minimax · siliconflow · workers_ai …: the server sends no level)
    return null;
}

// 우리 레벨(마리나라의 이름: none · low · medium · high · xhigh · max) → 실리의 낱말 (src/ai.js stEffort 와 같아요)
export const stWord = e => ({ '': 'auto', none: 'min', xhigh: 'max', maximum: 'max' }[String(e || '')] ?? String(e));

// 이 길로 이 레벨을 보내면 실제로 무엇이 닿나.
//   via: 'vertex' (우리 Vertex 방식: 브라우저 단계 없이 서버로) | 'source:<종류>' | 'profile:<종류>' (연결 프로필)
//   level: none · low · medium · high · xhigh · max.  끔(none)은 "생각 보기"도 꺼서 보내요 (그래야 꺼지는 연결이 있어요)
export function stReach({ via = '', model = '', level = '' } = {}) {
    const word = stWord(level), thoughts = level !== 'none';
    if (via === 'vertex') return stServerEffort({ source: 'vertexai', model, value: word, thoughts: false });
    const source = via.startsWith('source:') ? via.slice(7) : via.startsWith('profile:') ? via.slice(8) : '';
    if (!source) return null;
    return stServerEffort({ source, model, value: stClientEffort({ source, model, level: word, thoughts }), thoughts });
}
// 닿는 것의 화면 이름
export const REACH_NAME = { off: '끔', on: '켬', minimal: '최소', low: '낮게', medium: '보통', high: '높게', xhigh: '매우 높게', max: '최대', 'b:min': '최소', 'b:low': '낮게', 'b:medium': '보통', 'b:high': '높게', 'b:max': '최대' };
