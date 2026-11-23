// 우리 것 (실리 파일 아님): 서버에서 풀 수 없는 매크로가 실리 쪽 글에 있으면 실리 창에 한 줄 적어요. 글은 그대로 보내요(소망 결정, 2026-11-23: 답장을 막지 않아요).
// 옮긴 실리 매크로 엔진(public/script.js의 substituteParams · substituteParamsLegacy)이 매번 불러요: naMacroLeft(들어간 글, 나온 글, { env | dynamicMacros }).
//  - 모르는 매크로: 서버에 등록되지 않은 이름(새 엔진의 MacroRegistry, 그 부름의 dynamicMacros, 옛 엔진의 env).
//    다른 확장(써드파티)이 브라우저에서 등록하는 매크로가 여기에 걸려요. 실리 엔진도 모르는 매크로는 글 그대로 둬요(MacroEngine.js 216~218).
//    - 새 엔진: 들어간 글의 {{이름 (다른 매크로의 인자로 들어가 먹힌 것도) · {{if 이름}}의 이름(등록 안 된 이름은 글자로 봐서 늘 참이에요: core-macros.js 183~188).
//      매크로가 낸 값 안의 {{이름은 실리 페이지도 다시 풀지 않아서 보지 않아요.
//    - 옛 엔진: 맨 바깥 부름이 돌려준 글에 남은 {{이름. 옛 엔진은 카드 칸을 미리 풀어요(substituteParamsLegacy → getCharacterCardFields): 그 안쪽 부름은 보지 않아요
//      (바깥 글이 그 칸을 쓰면 남은 이름이 바깥 결과에 나와요).
//  - 등록돼 있지만 서버가 값을 모르는 매크로(plugin/st/namacros.js가 일마다 정해요: 표정의 {{lastExpression}} · {{availableExpressions}}, 화면 것 {{input}} …):
//    들어간 글(옛 엔진은 그 글이 쓰는 env의 글 값까지)에 그 이름이 있으면.
//  - 적지 않는 것: 이스케이프한 \{\{이름\}\}, 꺼진 기본 확장의 매크로(실리 페이지에도 없어서 글 그대로예요: namacros.js가 알려 줘요).
// 같은 이름은 일꾼 하나에 한 번만 적어요.
import { MacroRegistry } from './public/scripts/macros/engine/MacroRegistry.js';

const TAG = '[narrative-archive plugin]';
const NAME_MAX = 64;
const told = new Set();
let cannot = [], quiet = new Set();

/**
 * 이 일에서 등록돼 있지만 서버가 값을 모르는 매크로 이름들 · 적지 않을 이름들(꺼진 기본 확장의 매크로) (plugin/st/namacros.js)
 * @param {string[]} names
 * @param {string[]} [off]
 */
export function __naSetCannot(names, off = []) {
    cannot = Array.isArray(names) ? names.map(String) : [];
    quiet = new Set(Array.isArray(off) ? off.map(x => String(x).toLowerCase()) : []);
}
/** 테스트용: 적은 이름을 잊어요 (일꾼을 새로 띄운 것과 같아요) */
export function __naLeftReset() {
    told.clear();
}

const tell = (name) => {
    name = String(name).slice(0, NAME_MAX);
    const key = name.toLowerCase();
    if (told.has(key)) return;
    if (told.size >= 200) told.delete(told.values().next().value);
    told.add(key);
    console.warn(TAG, `[macros] 서버에서 풀 수 없는 매크로가 있습니다: {{${name}}}`);
};

// (실리 MacroLexer.js 8 IDENTIFIER_LEXER_PATTERN 앞에 매크로 표시(63 Flags 중 닫는 '/'는 빼고, 68 '>')와 빈칸이 올 수 있어요. 앞에 \가 있으면 이스케이프)
const LEFT = /(?<!\\)\{\{\s*[!?~#>]*\s*([a-zA-Z][\w-]*)/g;
// ({{if 이름}} · {{if !이름}}: 실리 core-macros.js 166~188)
const IF = /(?<!\\)\{\{\s*[!?~#>]*\s*if\s+!?\s*([a-zA-Z][\w-]*)\s*\}\}/gi;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const uses = (text, name, withIf) => typeof text === 'string' && new RegExp(`(?<!\\\\)\\{\\{\\s*[!?~#>]*\\s*${withIf ? '(?:if\\s+!?\\s*)?' : ''}${esc(name)}(?![\\w-])`, 'i').test(text);

// 옛 엔진의 부름이 다른 옛 엔진 부름 안에서 불렸나 (카드 칸을 미리 푸는 안쪽 부름)
function inner() {
    const limit = Error.stackTraceLimit;
    Error.stackTraceLimit = Infinity;
    try { return (String(new Error().stack).match(/\bat (?:\S+\.)?substituteParamsLegacy \(/g) || []).length > 1; } finally { Error.stackTraceLimit = limit; }
}

/**
 * @param {string} input 엔진에 넣은 글
 * @param {string} output 엔진이 돌려준 글
 * @param {{ env?: object, dynamicMacros?: object }} [o] 옛 엔진: env(실리 evaluateMacros가 populateEnv로 등록된 매크로까지 채운 것) · 새 엔진: dynamicMacros(이름은 소문자)
 */
export function naMacroLeft(input, output, { env = null, dynamicMacros = null } = {}) {
    try {
        const legacy = !!env && typeof env === 'object';
        if (legacy && inner()) return;
        const known = (name) => {
            const lower = name.toLowerCase();
            if (quiet.has(lower) || MacroRegistry.hasMacro(name)) return true;
            if (dynamicMacros && typeof dynamicMacros === 'object' && Object.hasOwn(dynamicMacros, lower)) return true;
            return legacy && Object.keys(env).some(k => k.toLowerCase() === lower);
        };
        if (cannot.length) {
            // (옛 엔진: 그 글이 쓰는 env의 글 값까지 — 옛 엔진은 값을 넣은 뒤 다음 매크로를 그 안에서도 바꿔요)
            const texts = [input, ...(legacy ? Object.entries(env).filter(([k, v]) => typeof v === 'string' && uses(input, k, false)).map(([, v]) => v) : [])];
            for (const name of cannot) if (texts.some(t => uses(t, name, !legacy))) tell(name);
        }
        if (legacy) {
            if (typeof output !== 'string' || !output.includes('{{')) return;
            for (const m of output.matchAll(LEFT)) if (!known(m[1])) tell(m[1]);
            return;
        }
        if (typeof input !== 'string' || !input.includes('{{')) return;
        for (const m of input.matchAll(LEFT)) if (!known(m[1])) tell(m[1]);
        for (const m of input.matchAll(IF)) if (!known(m[1])) tell(m[1]);
    } catch {
        // (a line for the window only: never in the way of the text)
    }
}
