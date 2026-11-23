// 실리가 initMacros 밖에서 등록하는 매크로(작가 노트 · 추론 · 요약 · 그림 생성 · 표정)와 {{hasExtension}}을 서버(plugin/st)가 실리 브라우저와 같게 푸는지.
// 기대값은 tools/st/oracle-macros.mjs가 진짜 실리 1.19.1 브라우저 자신의 substituteParams에서 받은 것이에요(tests/fixtures/stmacros2-expected.json). 지어낸 값이 아니에요.
// 그리고 서버에서 풀 수 없는 매크로의 실리 창 한 줄(plugin/st/naleft.js) · 확장 찾기(plugin/st/namacros.js naDiscover).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runVariant, bridgeOf } from './stmacros2.run.mjs';
import { VARIANTS } from './stmacros2.cases.mjs';
import { naLoad, naMacrosJob, naDiscover } from '../plugin/st/naload.js';
import { __naDiscoverReset, __naMacrosReset } from '../plugin/st/namacros.js';
import { __naLeftReset } from '../plugin/st/naleft.js';
import * as SCRIPT from '../plugin/st/public/script.js';
import * as G from '../plugin/st/public/scripts/group-chats.js';
import { extensionNames } from '../plugin/st/public/scripts/extensions.js';
import { __naSetFetch, naFetchFailures } from '../plugin/st/public/naFetch.js';
import * as EXPR from '../plugin/st/public/scripts/extensions/expressions/index.js';

const FX = JSON.parse(fs.readFileSync(new URL('./fixtures/stmacros2-expected.json', import.meta.url), 'utf8'));

// (SillyTavern's window: the lines the server writes there)
async function lines(fn) {
    const got = [], warn = console.warn;
    console.warn = (...a) => { if (a[0] === '[narrative-archive plugin]') got.push(a.slice(1).join(' ')); };
    try { await fn(); } finally { console.warn = warn; }
    return got;
}
const LEFT = name => `[macros] 서버에서 풀 수 없는 매크로가 있습니다: {{${name}}}`;
const variant = id => VARIANTS.find(v => v.id === id);
const run = v => runVariant(v, { ext: FX.variants[v.id].ext, send: bridgeOf(v, FX.variants[v.id].answers) });

test('기대값 파일이 경우와 맞아요 (variant마다 브라우저의 값)', () => {
    assert.deepEqual(Object.keys(FX.variants), VARIANTS.map(v => v.id));
});

// (one process, the variants one after another: the server registers again whenever the engine flag or the enabled extensions change — as the page reloaded)
for (const v of VARIANTS) {
    test(`${v.id}: 실리 브라우저와 같아요`, async () => {
        __naMacrosReset();
        const mine = await run(v);
        const want = FX.variants[v.id].out;
        for (const k of Object.keys(want)) assert.equal(mine[k], want[k], `${v.id} ${k}`);
        assert.deepEqual(Object.keys(mine), Object.keys(want));
        // ({{hasExtension}}: SillyTavern's extensionNames — the extensions it found with a manifest; none when extensions are off)
        assert.deepEqual(extensionNames, FX.variants[v.id].browserNames);
    });
}

test('다시 등록: 엔진을 바꾸고 다시 돌려도 같아요 (앞 등록이 남지 않아요)', async () => {
    for (const id of ['legacy', 'new', 'nomem', 'legacy-noexp', 'new', 'config-off', 'legacy']) {
        __naMacrosReset();
        const mine = await run(variant(id));
        assert.deepEqual(mine, FX.variants[id].out, id);
    }
});

test('서버에서 풀 수 없는 매크로: 글은 그대로, 실리 창에 이름마다 한 번 (두 엔진 모두)', async () => {
    __naLeftReset();
    const v = variant('new');
    const got = await lines(async () => {
        naLoad(structuredClone(v.settings), undefined, FX.variants.new.ext);
        SCRIPT.__naSet({ name1: 'Mara', name2: 'Ren', characters: [{ name: 'Ren', avatar: 'Ren.png', data: { extensions: {} } }], this_chid: 0, chat: [], chat_metadata: {} });
        G.__naSet({ groups: [], selected_group: null });
        await naMacrosJob();
        assert.equal(SCRIPT.substituteParams('a {{thirdPartyThing}} b {{other::x}} {{user}}', {}), 'a {{thirdPartyThing}} b {{other::x}} Mara');
        assert.equal(SCRIPT.substituteParams('{{THIRDPARTYTHING}} {{summary}} {{char}}', {}), '{{THIRDPARTYTHING}}  Ren');
        // (dynamic macros of the call and the macros SillyTavern leaves as they are — a registered one that came out of another's value — are not reported)
        assert.equal(SCRIPT.substituteParams('{{mine}} {{reasoningPrefix}}', { dynamicMacros: { mine: 'M' } }), 'M <r>');
        const legacy = structuredClone(v.settings);
        legacy.power_user.experimental_macro_engine = false;
        naLoad(legacy, undefined, FX.variants.new.ext);
        await naMacrosJob();
        assert.equal(SCRIPT.substituteParams('{{legacyThirdParty}} {{thirdPartyThing}} {{reasoningPrefix}} {{user}}', {}), '{{legacyThirdParty}} {{thirdPartyThing}} {{reasoningPrefix}} Mara');
        assert.equal(SCRIPT.substituteParamsLegacy('{{extra}} {{Extra}}', undefined, undefined, undefined, undefined, true, { extra: 'E' }), 'E E');
    });
    assert.deepEqual(got, [LEFT('thirdPartyThing'), LEFT('other'), LEFT('legacyThirdParty')]);
});

test('등록돼 있지만 서버가 모르는 값: 분류가 있는 표정 API의 {{lastExpression}} · Extras의 {{availableExpressions}} — 한 번씩. none이면 없어요', async () => {
    for (const [id, want] of [['new', []], ['emoji', []], ['raw', []], ['llm', ['lastExpression']], ['local', ['lastExpression']], ['extras', ['lastExpression', 'availableExpressions']], ['nomem', []]]) {
        __naLeftReset(); __naMacrosReset();
        const got = await lines(() => run(variant(id)));
        assert.deepEqual(got.filter(x => /lastExpression|availableExpressions/.test(x)), want.map(LEFT), id);
    }
    // (twice: once per worker)
    __naLeftReset(); __naMacrosReset();
    const got = await lines(async () => { await run(variant('llm')); await run(variant('llm')); });
    assert.deepEqual(got.filter(x => /Expression/.test(x)), [LEFT('lastExpression')]);
});

test('꺼진 기본 확장의 매크로는 실리 페이지에도 없어서 글 그대로: 실리 창에 적지 않아요 (요약을 끔 · 표정과 그림 생성을 끔 · config에서 확장을 끔)', async () => {
    for (const [id, names] of [['nomem', ['summary']], ['legacy-noexp', ['defaultExpression', 'lastExpression', 'availableExpressions', 'charPrefix', 'charNegativePrefix']], ['config-off', ['summary', 'defaultExpression', 'charPrefix']]]) {
        __naLeftReset(); __naMacrosReset();
        const got = await lines(() => run(variant(id)));
        for (const name of names) assert.ok(!got.includes(LEFT(name)), `${id} ${name}: ${got}`);
        // (the page has them, so it does tell them when they are on)
        __naLeftReset(); __naMacrosReset();
        const on = await lines(async () => {
            await runVariant(variant('new'), { ext: FX.variants.new.ext, send: bridgeOf(variant('new')) });
            SCRIPT.substituteParams('{{thirdOn}}', {});
        });
        assert.ok(on.includes(LEFT('thirdOn')), String(on));
    }
});

// (one job as plugin/work.mjs withWorld runs it: settings, this chat, then naMacrosJob with the bridge)
async function job(settings, ext, more = {}, { chat = [], chid = 0, group = null } = {}) {
    naLoad(structuredClone(settings), undefined, ext);
    SCRIPT.__naSet({ name1: 'Mara', name2: group ? '' : 'Ren', characters: [{ name: 'Ren', avatar: 'Ren.png', description: 'Ren is a courier.', data: { extensions: {} } }], this_chid: group ? undefined : chid, chat, chat_metadata: {} });
    G.__naSet(group ? { groups: [group], selected_group: group.id } : { groups: [], selected_group: null });
    await naMacrosJob(more);
}
const LABELS_LINE = { old: '[macros] 실리 서버의 /api/extra/classify/labels를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.', down: '[macros] 실리 서버에 연결할 수 없습니다: /api/extra/classify/labels' };
const DEFAULT_LIST = FX.variants['local-old-bridge'].out['note:all'].split('][')[7];

test('로컬 표정 목록: 옛 다리(표시 없는 404)면 실리가 그 요청에 실패했을 때처럼 기본 목록이고, 모델 요청을 막지 않아요(naFetchFailures에 안 남아요). 실리 창에 한 번, 다시 묻지 않아요', async () => {
    __naLeftReset(); __naMacrosReset({ told: true });
    const v = variant('local-old-bridge');
    const asked = [];
    const send = async (url, init) => { asked.push(url); return bridgeOf(v)(url, init); };
    const got = await lines(async () => {
        for (let i = 0; i < 2; i++) {
            await job(v.settings, FX.variants[v.id].ext, { send });
            __naSetFetch(send);
            assert.deepEqual(naFetchFailures, []);
            assert.equal(SCRIPT.substituteParams('{{availableExpressions}}', {}), DEFAULT_LIST);
        }
    });
    assert.deepEqual(got.filter(x => x.includes('classify')), [LABELS_LINE.old]);
    assert.deepEqual(asked, ['/api/extra/classify/labels']);
    // (the list as the bridge gave it: asked again only when the expression API or the registration changes)
    asked.length = 0;
    const v2 = variant('local');
    const send2 = async (url, init) => { asked.push(url); return bridgeOf(v2, FX.variants.local.answers)(url, init); };
    __naMacrosReset();
    for (let i = 0; i < 3; i++) await job(v2.settings, FX.variants.local.ext, { send: send2 });
    assert.deepEqual(asked, ['/api/extra/classify/labels']);
    assert.equal(SCRIPT.substituteParams('{{availableExpressions}}', {}), 'calm, tense, joy, smug');
    // (SillyTavern's own error — the bridge's mark —: the page gets it too and keeps the default list. Kept, no line)
    __naMacrosReset({ told: true });
    asked.length = 0;
    const st500 = async (url) => { asked.push(url); return new Response('Internal Server Error', { status: 500, headers: { 'x-na-bridge': '1' } }); };
    const quiet = await lines(async () => { for (let i = 0; i < 2; i++) await job(v2.settings, FX.variants.local.ext, { send: st500 }); });
    assert.equal(SCRIPT.substituteParams('{{availableExpressions}}', {}), DEFAULT_LIST);
    assert.deepEqual([asked.length, quiet.filter(x => x.includes('classify'))], [1, []]);
    __naSetFetch(null);
});

test('로컬 표정 목록은 일을 막지 않아요: 15초(여기서는 짧게)까지만 기다리고, 그동안은 실리 페이지가 목록을 받기 전처럼(빈 글자 · 한 줄). 늦은 답은 다음 일부터. 다리에 닿지 못하면 두지 않고 1분 뒤 다시', async () => {
    const v = variant('local');
    const ext = FX.variants.local.ext;
    __naLeftReset(); __naMacrosReset({ told: true });
    let answer, asked = 0;
    const slow = () => { asked += 1; return new Promise(ok => { answer = ok; }); };
    const got = await lines(async () => {
        const t0 = Date.now();
        await job(v.settings, ext, { send: slow, timeoutMs: 30 });
        assert.ok(Date.now() - t0 < 2000);
        assert.equal(SCRIPT.substituteParams('[{{availableExpressions}}]', {}), '[]');
        // (still coming: not asked again, not waited for)
        const t1 = Date.now();
        await job(v.settings, ext, { send: slow, timeoutMs: 5000 });
        assert.ok(Date.now() - t1 < 2000);
        assert.equal(asked, 1);
        answer(new Response(JSON.stringify({ labels: ['calm', 'joy'] }), { status: 200, headers: { 'x-na-bridge': '1' } }));
        await new Promise(r => setTimeout(r, 20));
        await job(v.settings, ext, { send: slow, timeoutMs: 30 });
        assert.equal(SCRIPT.substituteParams('{{availableExpressions}}', {}), 'calm, joy, smug');
        assert.equal(asked, 1);
    });
    assert.deepEqual([got.filter(x => x === LEFT('availableExpressions')).length, got.filter(x => x.includes('classify'))], [1, []]);
    // (the bridge cannot be reached: nothing kept, the line says so — not "update the plugin" —, asked again a minute later)
    __naLeftReset(); __naMacrosReset({ told: true });
    let t = 1000, calls = 0, up = false;
    const flaky = async () => { calls += 1; if (!up) throw new Error('connect ECONNREFUSED'); return new Response('{"labels":["tense"]}', { status: 200, headers: { 'x-na-bridge': '1' } }); };
    const down = await lines(async () => {
        await job(v.settings, ext, { send: flaky, now: () => t });
        assert.equal(SCRIPT.substituteParams('[{{availableExpressions}}]', {}), '[]');
        t += 30_000;
        await job(v.settings, ext, { send: flaky, now: () => t });
        assert.equal(calls, 1);
        // (a minute later: asked again, still down — no second line —, then two minutes)
        t += 31_000;
        await job(v.settings, ext, { send: flaky, now: () => t });
        assert.equal(calls, 2);
        up = true;
        t += 121_000;
        await job(v.settings, ext, { send: flaky, now: () => t });
        assert.equal(calls, 3);
        assert.equal(SCRIPT.substituteParams('{{availableExpressions}}', {}), 'tense, smug');
    });
    assert.deepEqual(down.filter(x => x.includes('classify')), [LABELS_LINE.down]);
    // (a world that does not use SillyTavern's connection: never asked)
    __naMacrosReset();
    let never = 0;
    await lines(() => job(v.settings, ext, { send: async () => { never += 1; return new Response('{}'); }, skip: true }));
    assert.deepEqual([never, SCRIPT.substituteParams('[{{availableExpressions}}]', {})], [0, '[]']);
});

test('settings.json의 표정 · 요약 · 그림 생성 설정이 객체가 아니면(null · 글 · 수): 실리 init처럼 그 확장의 매크로 없이(글 그대로), 실리 창에 한 번, 일은 계속', async () => {
    const v = variant('new');
    for (const [key, bad, names] of [['expressions', null, ['defaultExpression', 'availableExpressions']], ['expressions', 'x', ['defaultExpression']], ['expressions', 5, ['lastExpression']], ['memory', null, ['summary']], ['sd', null, ['charPrefix']]]) {
        __naLeftReset(); __naMacrosReset();
        const s = structuredClone(v.settings);
        s.extension_settings[key] = bad;
        const got = await lines(async () => {
            await job(s, FX.variants.new.ext, {});
            for (const name of names) assert.equal(SCRIPT.substituteParams(`{{${name}}}`, {}), `{{${name}}}`, `${key} ${bad} ${name}`);
            assert.equal(SCRIPT.substituteParams('{{authorsNote}}|{{user}}', {}), 'Default for {{char}}|Mara');
            // (twice: one line)
            await job(s, FX.variants.new.ext, {});
        });
        const ext = key === 'sd' ? 'stable-diffusion' : key;
        const failed = got.filter(x => x.startsWith('[macros] 확장을 활성화할 수 없습니다: '));
        assert.equal(failed.length, 1, `${key} ${bad}: ${got}`);
        assert.ok(failed[0].startsWith(`[macros] 확장을 활성화할 수 없습니다: ${ext} `), failed[0]);
        // (and the names are not reported: the page has none of them either)
        for (const name of names) assert.ok(!got.includes(LEFT(name)), name);
    }
    // (the others still on)
    const s = structuredClone(v.settings);
    s.extension_settings.expressions = null;
    await lines(() => job(s, FX.variants.new.ext, {}, { chat: [{ name: 'Ren', mes: 'a', extra: { memory: 'M1' } }, { name: 'Mara', is_user: true, mes: 'b' }] }));
    assert.equal(SCRIPT.substituteParams('[{{summary}}][{{charPrefix}}]', {}), '[M1][ren from settings]');
});

test('{{if 이름}} · {{if !이름}}: 서버에 없는 이름 · 서버가 모르는 값이면 실리 창에 한 줄. 이스케이프 · 등록된 이름은 없어요', async () => {
    __naLeftReset(); __naMacrosReset();
    const got = await lines(async () => {
        await job(variant('llm').settings, FX.variants.llm.ext, {});
        assert.equal(SCRIPT.substituteParams('{{if thirdIf}}A{{else}}B{{/if}}', {}), 'A');
        assert.equal(SCRIPT.substituteParams('{{if !thirdNot}}A{{else}}B{{/if}}', {}), 'B');
        assert.equal(SCRIPT.substituteParams('{{if lastExpression}}A{{else}}B{{/if}}', {}), 'B');
        SCRIPT.substituteParams('{{if char}}A{{/if}} {{if mine}}x{{/if}} \\{\\{if thirdEscaped\\}\\}', { dynamicMacros: { mine: 'M' } });
    });
    assert.deepEqual(got.filter(x => x.includes('{{')), [LEFT('thirdIf'), LEFT('thirdNot'), LEFT('lastExpression')]);
});

test('화면 · 브라우저에만 있는 값: {{input}} · {{firstDisplayedMessageId}} · {{lastGenerationType}} · {{outlet}}은 지금처럼 내고 한 줄. {{isMobile}}은 브라우저가 적은 값(device.isMobile), 없으면 false와 한 줄', async () => {
    const v = variant('new');
    __naLeftReset(); __naMacrosReset();
    const s = structuredClone(v.settings);
    s.extension_settings.narrative_archive = { device: { timeZone: 'UTC', locale: 'en', intl: 'en-US', isMobile: true } };
    const errors = console.error;
    console.error = () => {};
    let got;
    try {
        got = await lines(async () => {
            await job(s, FX.variants.new.ext, {});
            assert.equal(SCRIPT.substituteParams('[{{isMobile}}][{{lastGenerationType}}][{{outlet::x}}]', {}), '[true][][]');
            SCRIPT.substituteParams('{{input}} {{firstDisplayedMessageId}}', {});
            const legacy = structuredClone(s);
            legacy.power_user.experimental_macro_engine = false;
            await job(legacy, FX.variants.new.ext, {});
            assert.equal(SCRIPT.substituteParams('[{{isMobile}}]', {}), '[true]');
            await job(v.settings, FX.variants.new.ext, {});
            assert.equal(SCRIPT.substituteParams('[{{isMobile}}]', {}), '[false]');
        });
    } finally { console.error = errors; }
    assert.deepEqual(got.filter(x => x.includes('{{')), ['lastGenerationType', 'outlet', 'input', 'firstDisplayedMessageId', 'isMobile'].map(LEFT));
});

test('실리 페이지도 글 그대로 두는 것은 적지 않아요: 이스케이프 · 매크로가 낸 값 안의 {{이름}}(새 엔진) · 옛 엔진이 미리 푼 카드 칸 중 글이 쓰지 않는 것. 이름은 64자까지', async () => {
    const v = variant('new');
    for (const legacy of [false, true]) {
        __naLeftReset(); __naMacrosReset();
        const s = structuredClone(v.settings);
        s.power_user.experimental_macro_engine = !legacy;
        s.extension_settings.note.default = 'N {{thirdInNote}}';
        const got = await lines(async () => {
            naLoad(s, undefined, FX.variants.new.ext);
            SCRIPT.__naSet({ name1: 'Mara', name2: 'Ren', characters: [{ name: 'Ren', avatar: 'Ren.png', description: 'desc {{thirdInCard}} {{lastExpression}}', data: { extensions: {} } }], this_chid: 0, chat: [], chat_metadata: {} });
            G.__naSet({ groups: [], selected_group: null });
            await naMacrosJob();
            assert.equal(SCRIPT.substituteParams('{{user}} \\{\\{thirdEscaped\\}\\}', {}), legacy ? 'Mara \\{\\{thirdEscaped\\}\\}' : 'Mara {{thirdEscaped}}');
            if (!legacy) assert.equal(SCRIPT.substituteParams('{{authorsNote}}', {}), 'N {{thirdInNote}}');
        });
        assert.deepEqual(got.filter(x => x.includes('{{')), [], `${legacy ? 'legacy' : 'new'}: ${got}`);
        // (a card field the text does use: its leftover is told)
        const used = await lines(async () => { SCRIPT.substituteParams('{{description}}', {}); });
        assert.deepEqual(used.filter(x => x.includes('{{')), [LEFT('thirdInCard')], legacy ? 'legacy' : 'new');
    }
    // (the old engine, still on: a value the text does not use is not looked into — a dynamic macro's —, one it uses is)
    __naLeftReset();
    const dyn = await lines(async () => { SCRIPT.substituteParamsLegacy('{{user}}', undefined, undefined, undefined, undefined, true, { extra: '[{{input}}]' }); });
    assert.deepEqual(dyn.filter(x => x.includes('{{')), []);
    const dyn2 = await lines(async () => { SCRIPT.substituteParamsLegacy('{{extra}}', undefined, undefined, undefined, undefined, true, { extra: '[{{input}}]' }); });
    assert.deepEqual(dyn2.filter(x => x.includes('{{')), [LEFT('input')]);
    __naLeftReset();
    const long = await lines(async () => { SCRIPT.substituteParams(`{{${'a'.repeat(100)}}}`, {}); });
    assert.deepEqual(long.filter(x => x.includes('{{')), [LEFT('a'.repeat(64))]);
});

test('표정 none: 마지막 캐릭터 메시지가 빈 글 · "..."이고 기본 표정이 있고 스프라이트가 있거나 showDefault면 실리 페이지는 2초 뒤 기본 표정을 넣어요: 서버는 빈 글자 · 한 줄', async t => {
    const v = variant('new');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'na-sprites-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const say = mes => [{ name: 'Mara', is_user: true, mes: 'hi' }, { name: 'Ren', mes }];
    const one = async (settings, chat, more = {}) => {
        __naLeftReset(); __naMacrosReset();
        const got = await lines(async () => { await job(settings, FX.variants.new.ext, { root, ...more }, { chat }); SCRIPT.substituteParams('[{{lastExpression}}]', {}); });
        return got.includes(LEFT('lastExpression'));
    };
    // (showDefault: migrateSettings turns it off when there is a fallback — and without one the value is '' —: sprites then)
    assert.equal(await one(v.settings, say('')), false);
    fs.mkdirSync(path.join(root, 'characters', 'Ren'), { recursive: true });
    fs.writeFileSync(path.join(root, 'characters', 'Ren', 'notes.txt'), 'x');
    assert.equal(await one(v.settings, say('')), false);
    fs.writeFileSync(path.join(root, 'characters', 'Ren', 'nolabel.png'), 'x');
    assert.equal(await one(v.settings, say('')), false);
    fs.writeFileSync(path.join(root, 'characters', 'Ren', 'joy-2.png'), 'x');
    assert.equal(await one(v.settings, say('')), true);
    assert.equal(await one(v.settings, say('...')), true);
    assert.equal(await one(v.settings, say('Rain again.')), false);
    assert.equal(await one(v.settings, []), true);
    const noFallback = structuredClone(v.settings);
    noFallback.extension_settings.expressions.fallback_expression = '';
    assert.equal(await one(noFallback, say('')), false);
    // ("..." needs the fallback in the list: a custom one is not)
    const custom = structuredClone(v.settings);
    custom.extension_settings.expressions.fallback_expression = 'smug';
    fs.writeFileSync(path.join(root, 'characters', 'Ren', 'smug.png'), 'x');
    assert.equal(await one(custom, say('...')), false);
    assert.equal(await one(custom, say('')), true);
});

// ---- 확장 찾기 (실리 extensions.js loadExtensionSettings 1783~1803 · 실리 서버 /api/extensions/discover)
function fakeFolders() {
    const st = fs.mkdtempSync(path.join(os.tmpdir(), 'na-ext-st-')), user = fs.mkdtempSync(path.join(os.tmpdir(), 'na-ext-user-'));
    const put = (f, text) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
    const man = (o) => JSON.stringify({ display_name: 'X', loading_order: 1, js: 'index.js', ...o });
    put(path.join(st, 'package.json'), '{"version":"1.19.1"}');
    put(path.join(st, 'public/scripts/extensions/memory/manifest.json'), man({ display_name: 'Summarize', loading_order: 9 }));
    put(path.join(st, 'public/scripts/extensions/expressions/manifest.json'), '﻿' + man({ display_name: 'Character Expressions', loading_order: 6 }));
    put(path.join(st, 'public/scripts/extensions/broken/manifest.json'), '{ not json');
    fs.mkdirSync(path.join(st, 'public/scripts/extensions/leftover'), { recursive: true });
    put(path.join(st, 'public/scripts/extensions/third-party/Lio-Global/manifest.json'), man({}));
    put(path.join(st, 'public/scripts/extensions/third-party/Ivo-Both/manifest.json'), man({}));
    put(path.join(user, 'extensions/Ivo-Both/manifest.json'), man({}));
    put(path.join(user, 'extensions/Ren-Local/manifest.json'), man({}));
    return { st, user, done: () => { fs.rmSync(st, { recursive: true, force: true }); fs.rmSync(user, { recursive: true, force: true }); } };
}
const sorted = a => [...a].sort();

test('확장 찾기: 실리의 /discover(다리) → manifest를 읽을 수 있는 것만. 꺼짐(실리의 404) · 옛 다리(표시 없는 404: 폴더를 직접, 한 번 적어요) · 폴더가 그대로면 다시 안 물어요', async t => {
    const F = fakeFolders();
    t.after(F.done);
    __naDiscoverReset();
    // (folders read directly — an older bridge —: SillyTavern's /discover rules — built-in ones with a manifest, then the user's, then the global third-party ones the user has not)
    const own = await naDiscover({ root: F.user, stRoot: F.st });
    assert.deepEqual(sorted(own.names), sorted(['memory', 'expressions', 'third-party/Ivo-Both', 'third-party/Ren-Local', 'third-party/Lio-Global']));
    assert.equal(own.enabled, true);
    assert.equal(own.manifests.expressions.display_name, 'Character Expressions');
    assert.equal(own.version, '1.19.1');
    // (SillyTavern answers through the bridge: its list, the ones whose manifest the page cannot read left out)
    __naDiscoverReset();
    const asked = [];
    const list = [{ type: 'system', name: 'memory' }, { type: 'system', name: 'broken' }, { type: 'system', name: 'gone' }, { type: 'local', name: 'third-party/Ivo-Both' }];
    const ok = async (url, init) => { asked.push([url, init.method]); return new Response(JSON.stringify(list), { status: 200, headers: { 'x-na-bridge': '1' } }); };
    const a = await naDiscover({ root: F.user, stRoot: F.st, send: ok });
    assert.deepEqual(a.names, ['memory', 'third-party/Ivo-Both']);
    await naDiscover({ root: F.user, stRoot: F.st, send: ok });
    assert.deepEqual(asked, [['/api/extensions/discover', 'GET']]);
    fs.mkdirSync(path.join(F.user, 'extensions', 'Varo-New'));
    fs.writeFileSync(path.join(F.user, 'extensions', 'Varo-New', 'manifest.json'), '{}');
    await naDiscover({ root: F.user, stRoot: F.st, send: ok });
    assert.equal(asked.length, 2);
    // (extensions off in SillyTavern's config.yaml: its router answers 404 — the bridge's mark is on it)
    __naDiscoverReset();
    const off = await naDiscover({ root: F.user, stRoot: F.st, send: async () => new Response('Not Found', { status: 404, headers: { 'x-na-bridge': '1' } }) });
    assert.deepEqual([off.enabled, off.names], [false, []]);
    // (an older bridge: 404 with no mark — the folders, and one line for the worker)
    __naDiscoverReset();
    const old = () => naDiscover({ root: F.user, stRoot: F.st, send: async () => new Response('Not Found', { status: 404 }) });
    const got = await lines(async () => {
        const o1 = await old();
        assert.equal(o1.enabled, true);
        assert.ok(o1.names.includes('third-party/Varo-New'));
        fs.mkdirSync(path.join(F.user, 'extensions', 'Mara-Late'));
        fs.writeFileSync(path.join(F.user, 'extensions', 'Mara-Late', 'manifest.json'), '{}');
        assert.ok((await old()).names.includes('third-party/Mara-Late'));
    });
    assert.deepEqual(got, ['[macros] 실리 서버의 /api/extensions/discover를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.']);
});

test('확장 찾기: 실리의 답(2xx · 실리의 404)만 둬요. 실리의 500 · 다리 오류 · 옛 다리는 둔 값으로 하고 1분 · 2분 … 뒤 다시 물어요. 실리 창에는 길마다 많아야 한 줄, 이유대로', async t => {
    const F = fakeFolders();
    t.after(F.done);
    let now = 1000, mode = 'fail';
    const asked = [];
    const send = async (url) => {
        asked.push(url);
        if (mode === 'fail') return new Response('x', { status: 500, headers: { 'x-na-bridge': '1' } });
        if (mode === 'throw') throw new Error('connect ECONNREFUSED');
        return new Response(JSON.stringify([{ type: 'system', name: 'memory' }]), { status: 200, headers: { 'x-na-bridge': '1' } });
    };
    const ask = () => naDiscover({ root: F.user, stRoot: F.st, send, now: () => now });
    __naDiscoverReset();
    const got = await lines(async () => {
        // (SillyTavern's own 500: the page finds nothing — discoverExtensions gives [] —, kept only until asked again)
        assert.deepEqual((await ask()).names, []);
        now += 30_000;
        assert.deepEqual((await ask()).names, []);
        assert.equal(asked.length, 1);
        // (a minute later: asked again, failing again — no second line —, then two minutes)
        now += 31_000;
        assert.deepEqual((await ask()).names, []);
        assert.equal(asked.length, 2);
        mode = 'ok';
        now += 100_000;
        await ask();
        assert.equal(asked.length, 2);
        now += 21_000;
        assert.deepEqual((await ask()).names, ['memory']);
        assert.equal(asked.length, 3);
        // (an answer of SillyTavern's own is kept until the folders change)
        now += 10 * 60_000;
        await ask();
        assert.equal(asked.length, 3);
    });
    assert.deepEqual(got, ['[macros] 실리 서버 요청에 실패했습니다: /api/extensions/discover (500)']);
    // (the bridge cannot be reached: the folders read directly, asked again later, the line says so)
    __naDiscoverReset();
    mode = 'throw';
    asked.length = 0;
    const down = await lines(async () => {
        const o = await ask();
        assert.ok(o.names.includes('memory') && o.names.includes('third-party/Ren-Local'));
        now += 61_000;
        mode = 'ok';
        assert.deepEqual((await ask()).names, ['memory']);
    });
    assert.deepEqual(down, ['[macros] 실리 서버에 연결할 수 없습니다: /api/extensions/discover']);
    assert.equal(asked.length, 2);
});

test('확장 찾기를 폴더로 할 때(옛 다리 · 다리 없음)도 실리 config의 extensions.enabled: 환경 변수 SILLYTAVERN_EXTENSIONS_ENABLED가 먼저, 없으면 config.yaml, 없으면 켜짐', async t => {
    const F = fakeFolders();
    const had = process.env.SILLYTAVERN_EXTENSIONS_ENABLED;
    t.after(() => { F.done(); if (had === undefined) delete process.env.SILLYTAVERN_EXTENSIONS_ENABLED; else process.env.SILLYTAVERN_EXTENSIONS_ENABLED = had; });
    delete process.env.SILLYTAVERN_EXTENSIONS_ENABLED;
    // (SillyTavern's yaml package, from its own node_modules: a stand-in that reads JSON — YAML holds JSON)
    fs.mkdirSync(path.join(F.st, 'node_modules', 'yaml'), { recursive: true });
    fs.writeFileSync(path.join(F.st, 'node_modules', 'yaml', 'package.json'), '{"name":"yaml","main":"index.js"}');
    fs.writeFileSync(path.join(F.st, 'node_modules', 'yaml', 'index.js'), 'exports.parse = text => JSON.parse(text);\n');
    const config = c => fs.writeFileSync(path.join(F.st, 'config.yaml'), JSON.stringify(c));
    const old = async () => { __naDiscoverReset(); return lines(() => naDiscover({ root: F.user, stRoot: F.st, send: async () => new Response('Not Found', { status: 404 }) })); };
    const own = () => { __naDiscoverReset(); return naDiscover({ root: F.user, stRoot: F.st }); };
    const state = async () => { const o = await own(); return [o.enabled, o.names.length > 0]; };
    assert.deepEqual(await state(), [true, true]);
    config({ extensions: { enabled: false } });
    assert.deepEqual(await state(), [false, false]);
    config({ extensions: { enabled: 'FALSE ' } });
    assert.deepEqual(await state(), [false, false]);
    config({ extensions: { enabled: null } });
    assert.deepEqual(await state(), [false, false]);
    config({ extensions: {} });
    assert.deepEqual(await state(), [true, true]);
    config({ extensions: { enabled: true } });
    process.env.SILLYTAVERN_EXTENSIONS_ENABLED = 'false';
    assert.deepEqual(await state(), [false, false]);
    config({ extensions: { enabled: false } });
    process.env.SILLYTAVERN_EXTENSIONS_ENABLED = 'true';
    assert.deepEqual(await state(), [true, true]);
    delete process.env.SILLYTAVERN_EXTENSIONS_ENABLED;
    // (an older bridge reads the same way, with its one line)
    let o;
    const got = await old().then(async l => { o = await naDiscover({ root: F.user, stRoot: F.st, send: async () => new Response('Not Found', { status: 404 }) }); return l; });
    assert.equal(o.enabled, false);
    assert.deepEqual(got, ['[macros] 실리 서버의 /api/extensions/discover를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.']);
});

test('켜지는 확장: 꺼진 확장 · 없는 확장(manifest 없음) · 꺼진 config는 매크로가 없어요. {{hasExtension}}은 찾은 것과 꺼진 목록으로', async () => {
    const v = variant('new');
    const ext = FX.variants.new.ext;
    const one = async (settings, e) => {
        naLoad(structuredClone(settings), undefined, e);
        SCRIPT.__naSet({ name1: 'Mara', name2: 'Ren', characters: [{ name: 'Ren', avatar: 'Ren.png', data: { extensions: {} } }], this_chid: 0, chat: [{ name: 'Ren', mes: 'a', extra: { memory: 'M1' } }, { name: 'Mara', is_user: true, mes: 'b' }], chat_metadata: {} });
        G.__naSet({ groups: [], selected_group: null });
        await naMacrosJob();
        return SCRIPT.substituteParams('[{{summary}}][{{charPrefix}}][{{defaultExpression}}] {{hasExtension::memory}} {{hasExtension::expressions}}', {});
    };
    await lines(async () => {
        assert.equal(await one(v.settings, ext), '[M1][ren from settings][joy] true true');
        const s = structuredClone(v.settings);
        s.extension_settings.disabledExtensions = ['memory', 'stable-diffusion'];
        assert.equal(await one(s, ext), '[{{summary}}][{{charPrefix}}][joy] false true');
        const noMem = { ...ext, names: ext.names.filter(n => n !== 'memory'), manifests: Object.fromEntries(Object.entries(ext.manifests).filter(([n]) => n !== 'memory')) };
        assert.equal(await one(v.settings, noMem), '[{{summary}}][ren from settings][joy] false true');
        assert.equal(await one(v.settings, { ...ext, enabled: false }), '[{{summary}}][{{charPrefix}}][{{defaultExpression}}] false false');
        // (a manifest that asks for an Extras module: the server never connects to Extras — modules stays empty —, so it does not turn on, as in the page)
        const needs = { ...ext, manifests: { ...ext.manifests, memory: { ...ext.manifests.memory, requires: ['summarize'] } } };
        assert.equal(await one(v.settings, needs), '[{{summary}}][ren from settings][joy] true true');
        // (no ext at all: no extension found — the author's note and reasoning only)
        assert.equal(await one(v.settings, undefined), '[{{summary}}][{{charPrefix}}][{{defaultExpression}}] false false');
    });
});

test('채팅을 열 때처럼: 일마다 {{lastExpression}}은 빈 것에서 (앞 일의 표정이 남지 않아요)', async () => {
    const v = variant('new');
    naLoad(structuredClone(v.settings), undefined, FX.variants.new.ext);
    SCRIPT.__naSet({ name1: 'Mara', name2: 'Ren', characters: [{ name: 'Ren', avatar: 'Ren.png', data: { extensions: {} } }], this_chid: 0, chat: [{ name: 'Ren', mes: 'hi' }], chat_metadata: {} });
    G.__naSet({ groups: [], selected_group: null });
    EXPR.__naSet({ lastExpression: { Ren: 'joy' } });
    assert.equal(SCRIPT.substituteParams('[{{lastExpression}}]', {}), '[joy]');
    await naMacrosJob();
    assert.equal(SCRIPT.substituteParams('[{{lastExpression}}]', {}), '[]');
});
