// 우리 것 (실리 파일 아님): 서버에서 풀 수 없는 매크로가 실리 쪽 글에 있으면 실리 창에 한 줄 적어요. 글은 그대로 보내요(소망 결정, 2026-11-23: 답장을 막지 않아요).
// 옮긴 실리 매크로 엔진(public/script.js의 substituteParams · substituteParamsLegacy)이 매번 불러요: naMacroLeft(들어간 글, 나온 글, { env | dynamicMacros }).
//  - 모르는 매크로: 매크로를 푼 뒤에도 남은 {{이름 중 서버에 등록되지 않은 것(새 엔진의 MacroRegistry, 그 부름의 dynamicMacros, 옛 엔진의 env).
//    다른 확장(써드파티)이 브라우저에서 등록하는 매크로가 여기에 걸려요. 실리 엔진도 모르는 매크로는 글 그대로 둬요(MacroEngine.js 216~218).
//  - 등록돼 있지만 서버가 값을 모르는 매크로(plugin/st/namacros.js가 일마다 정해요: 표정 분류가 LLM · WebLLM · Extras · 로컬일 때의 {{lastExpression}},
//    Extras일 때의 {{availableExpressions}}): 들어간 글(옛 엔진은 env의 글 값까지)에 그 이름이 있으면.
// 같은 이름은 일꾼 하나에 한 번만 적어요.
import { MacroRegistry } from './public/scripts/macros/engine/MacroRegistry.js';

const TAG = '[narrative-archive plugin]';
const told = new Set();
let cannot = [];

/** 이 일에서 등록돼 있지만 서버가 값을 모르는 매크로 이름들 (plugin/st/namacros.js) */
export function __naSetCannot(names) {
    cannot = Array.isArray(names) ? names.map(String) : [];
}
/** 테스트용: 적은 이름을 잊어요 (일꾼을 새로 띄운 것과 같아요) */
export function __naLeftReset() {
    told.clear();
}

const tell = (name) => {
    const key = name.toLowerCase();
    if (told.has(key)) return;
    if (told.size >= 200) told.delete(told.values().next().value);
    told.add(key);
    console.warn(TAG, `[macros] 서버에서 풀 수 없는 매크로가 있습니다: {{${name}}}`);
};

// (실리 MacroLexer.js 8 IDENTIFIER_LEXER_PATTERN 앞에 매크로 표시(63 Flags 중 닫는 '/'는 빼고, 68 '>')와 빈칸이 올 수 있어요)
const LEFT = /\{\{\s*[!?~#>]*\s*([a-zA-Z][\w-]*)/g;
const uses = (text, name) => typeof text === 'string' && new RegExp(`\\{\\{\\s*[!?~#>]*\\s*${name}(?![\\w-])`, 'i').test(text);

/**
 * @param {string} input 엔진에 넣은 글
 * @param {string} output 엔진이 돌려준 글
 * @param {{ env?: object, dynamicMacros?: object }} [o] 옛 엔진: env(실리 evaluateMacros가 populateEnv로 등록된 매크로까지 채운 것) · 새 엔진: dynamicMacros(이름은 소문자)
 */
export function naMacroLeft(input, output, { env = null, dynamicMacros = null } = {}) {
    try {
        if (cannot.length) {
            const texts = [input, ...(env && typeof env === 'object' ? Object.values(env).filter(v => typeof v === 'string') : [])];
            for (const name of cannot) if (texts.some(t => uses(t, name))) tell(name);
        }
        if (typeof output !== 'string' || !output.includes('{{')) return;
        const envKeys = env && typeof env === 'object' ? new Set(Object.keys(env).map(k => k.toLowerCase())) : null;
        for (const m of output.matchAll(LEFT)) {
            const name = m[1], lower = name.toLowerCase();
            if (MacroRegistry.hasMacro(name)) continue;
            if (dynamicMacros && typeof dynamicMacros === 'object' && Object.hasOwn(dynamicMacros, lower)) continue;
            if (envKeys?.has(lower)) continue;
            tell(name);
        }
    } catch {
        // (a line for the window only: never in the way of the text)
    }
}
