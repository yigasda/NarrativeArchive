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
    assert.deepEqual(got, [LEFT('lastExpression')]);
});

test('요약을 끈 실리: {{summary}}는 실리처럼 글 그대로, 실리 창에 한 번', async () => {
    __naLeftReset(); __naMacrosReset();
    const got = await lines(() => run(variant('nomem')));
    assert.deepEqual(got, [LEFT('summary')]);
});

test('로컬 표정 목록: 옛 다리(404)면 실리가 그 요청에 실패했을 때처럼 기본 목록이고, 모델 요청을 막지 않아요(naFetchFailures에 안 남아요). 실리 창에 한 번', async () => {
    __naLeftReset(); __naMacrosReset({ told: true });
    const v = variant('local-old-bridge');
    const got = await lines(async () => {
        for (let i = 0; i < 2; i++) {
            naLoad(structuredClone(v.settings), undefined, FX.variants[v.id].ext);
            SCRIPT.__naSet({ name1: 'Mara', name2: 'Ren', characters: [{ name: 'Ren', avatar: 'Ren.png', data: { extensions: {} } }], this_chid: 0, chat: [], chat_metadata: {} });
            __naSetFetch(bridgeOf(v));
            await naMacrosJob();
            assert.deepEqual(naFetchFailures, []);
            assert.equal(SCRIPT.substituteParams('{{availableExpressions}}', {}), FX.variants[v.id].out['note:all'].split('][')[7]);
            __naMacrosReset();
        }
    });
    assert.deepEqual(got.filter(x => x.includes('classify')), ['[macros] 실리 서버의 /api/extra/classify/labels를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.']);
    // (the list as the bridge gave it: asked again only when the expression API or the registration changes)
    const asked = [];
    const v2 = variant('local');
    const send = async (url, init) => { asked.push(url); return bridgeOf(v2, FX.variants.local.answers)(url, init); };
    __naMacrosReset();
    for (let i = 0; i < 3; i++) {
        naLoad(structuredClone(v2.settings), undefined, FX.variants.local.ext);
        __naSetFetch(send);
        await naMacrosJob();
    }
    assert.deepEqual(asked, ['/api/extra/classify/labels']);
    assert.equal(SCRIPT.substituteParams('{{availableExpressions}}', {}), 'calm, tense, joy, smug');
    __naSetFetch(null);
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
