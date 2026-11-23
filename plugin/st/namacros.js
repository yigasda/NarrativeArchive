// 우리 것: 실리 브라우저가 initMacros 밖에서 등록하는 매크로를 서버에서도 실리 페이지처럼 (plugin/st/public의 옮긴 실리 코드로).
//   작가 노트 · 추론 앞뒤 글(실리 코어), 요약(memory) · 그림 생성(stable-diffusion) · 표정(expressions)(기본 확장).
// 실리 페이지는 열 때 한 번 등록해요(script.js getSettings 8019 initMacros → 8021~8023 loadExtensionSettings → activateExtensions → firstLoadInit
// 763 initAuthorsNote · 777 initReasoning). 서버는 그 열쇠(엔진 플래그 · 켜진 확장)가 바뀔 때마다 지우고 같은 차례로 다시 등록해요: 실리 페이지를
// 새로 연 것과 같아요. 확장의 설정 값 줄(표정 migrateSettings · 그림 생성 loadSettings)은 일마다(extension_settings를 일마다 새로 읽어서).
// 채팅을 열 때 하는 것(작가 노트 loadSettings · 표정 lastExpression = {} · 표정 목록)은 naMacrosJob.
// 줄 번호는 실리 1.19.1이에요.
import fs from 'node:fs';
import path from 'node:path';
import { power_user } from './public/scripts/power-user.js';
import * as EXT from './public/scripts/extensions.js';
import { MacrosParser } from './public/scripts/macros.js';
import { macros } from './public/scripts/macros/macro-system.js';
import { eventSource, event_types } from './public/scripts/events.js';
import { isMobile } from './public/scripts/RossAscends-mods.js';
import { isSubsetOf, versionCompare } from './public/scripts/utils.js';
import * as AN from './public/scripts/authors-note.js';
import * as REA from './public/scripts/reasoning.js';
import * as MEM from './public/scripts/extensions/memory/index.js';
import * as SD from './public/scripts/extensions/stable-diffusion/index.js';
import * as EXPR from './public/scripts/extensions/expressions/index.js';
import { naFetchFailures } from './public/naFetch.js';
import { __naSetCannot } from './naleft.js';

const TAG = '[narrative-archive plugin]';
const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
// (an extension's init that throws: SillyTavern's page writes it to the console and goes on with the others — extensions.js 646~649.
//  The same here, once for the same text)
const toldErr = new Set();
function oops(text, err) {
    const line = `${text}: ${String(err?.message || err).split('\n')[0]}`;
    if (toldErr.has(line)) return;
    if (toldErr.size >= 100) toldErr.clear();
    toldErr.add(line);
    console.warn(TAG, `[macros] ${line}`);
}

// ---------- 확장 찾기 (실리 extensions.js loadExtensionSettings 1783~1803) ----------
// 실리 서버 src/constants.js 5~6 PUBLIC_DIRECTORIES.extensions · globalExtensions (실리 폴더 기준)
const EXT_DIR = path.join('public', 'scripts', 'extensions');
const GLOBAL_DIR = path.join('public', 'scripts', 'extensions', 'third-party');
const DISCOVER = '/api/extensions/discover';

const listDir = (dir) => { try { return fs.readdirSync(dir); } catch { return []; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

/**
 * 실리 서버 src/endpoints/extensions.js /discover 484~535의 값 부분 (옛 다리 · 다리 없음일 때만). 실리는 없는 폴더를 만들고(486~492)
 * manifest.json이 없는 폴더마다 경고를 써요(504~510). 서버는 만들지도 쓰지도 않아요.
 * @returns {{type: string, name: string}[]}
 */
export function __naDiscoverOwn(stRoot, userRoot) {
    const ext = path.join(stRoot, EXT_DIR), glob = path.join(stRoot, GLOBAL_DIR), user = path.join(userRoot, 'extensions');
    const hasManifest = (parentDirectory, folder) => fs.existsSync(path.join(parentDirectory, folder, 'manifest.json'));
    const builtInExtensions = listDir(ext)
        .filter(f => isDir(path.join(ext, f)))
        .filter(f => f !== 'third-party')
        .filter(f => hasManifest(ext, f))
        .map(f => ({ type: 'system', name: f }));
    const userExtensions = listDir(user)
        .filter(f => isDir(path.join(user, f)))
        .filter(f => hasManifest(user, f))
        .map(f => ({ type: 'local', name: `third-party/${f}` }));
    const globalExtensions = listDir(glob)
        .filter(f => isDir(path.join(glob, f)))
        .filter(f => hasManifest(glob, f))
        .map(f => ({ type: 'global', name: `third-party/${f}` }))
        .filter(f => !userExtensions.some(e => e.name === f.name));
    return [...builtInExtensions, ...userExtensions, ...globalExtensions];
}

// 실리 extensions.js getManifests 537~566: 브라우저는 /scripts/extensions/<이름>/manifest.json을 받아 JSON으로 읽어요. 그 길은 기본 확장은 실리 public/의 파일,
// 써드파티는 사용자 폴더의 extensions/<이름> → 없으면 public/scripts/extensions/third-party/<이름>(실리 src/users.js 1092~1120 · 1219). 못 읽으면 없는 것.
function readManifest(stRoot, userRoot, name) {
    const rest = name.startsWith('third-party/') ? name.slice('third-party/'.length) : null;
    const files = rest === null ? [path.join(stRoot, EXT_DIR, name, 'manifest.json')] : [path.join(userRoot, 'extensions', rest, 'manifest.json'), path.join(stRoot, GLOBAL_DIR, rest, 'manifest.json')];
    for (const f of files) {
        if (!fs.existsSync(f)) continue;
        // (fetch의 response.json(): UTF-8, 맨 앞 BOM은 빼고)
        try { return { ok: true, manifest: JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')) }; } catch { return { ok: false }; }
    }
    return { ok: false };
}

// (folders and manifests as they are now: SillyTavern's /discover is asked again only when they changed — it writes a warning line for every folder
//  without a manifest each time it is asked, and the scheduler runs many jobs a minute)
function folderSig(stRoot, userRoot) {
    const parts = [];
    for (const dir of [path.join(stRoot, EXT_DIR), path.join(userRoot, 'extensions'), path.join(stRoot, GLOBAL_DIR)]) {
        for (const name of listDir(dir).sort()) {
            let m = '-';
            try { const s = fs.statSync(path.join(dir, name, 'manifest.json')); m = `${s.ino}:${s.mtimeMs}:${s.size}`; } catch { /* no manifest */ }
            parts.push(`${dir}/${name}:${m}`);
        }
    }
    return parts.join('|');
}
const clientVersion = (stRoot) => { try { return String(JSON.parse(fs.readFileSync(path.join(stRoot, 'package.json'), 'utf8')).version ?? 'UNKNOWN'); } catch { return 'UNKNOWN'; } };

let found = null, toldDiscover = false;
/** 테스트용: 찾은 것 · 적은 줄을 잊어요 */
export function __naDiscoverReset() { found = null; toldDiscover = false; }

/**
 * 실리 페이지가 찾는 확장 → { enabled, names, manifests, version } (naLoad의 세 번째 인자).
 *  - enabled: 실리 config.yaml extensions.enabled (실리 script.js 8021 data.enable_extensions). 다리가 실리 자신의 /api/extensions/discover로 알려 줘요:
 *    꺼져 있으면 실리의 그 길이 404예요(src/endpoints/extensions.js 72~81). 옛 다리(그 길이 없음: 다리 표시 x-na-bridge 없는 404)는 실리 폴더를 직접 읽고
 *    켜진 것(실리의 기본값)으로 봐요. 한 번 적어요.
 *  - names: 실리 extensionNames (1793~1803: 찾은 것 중 manifest.json을 읽을 수 있는 것)
 *  - manifests: { 이름: manifest } · version: 실리 package.json의 version (CLIENT_VERSION의 둘째 칸: minimum_client_version 확인)
 * @param {{ root: string, stRoot?: string, send?: ((url: string, init: object) => Promise<Response>)|null }} o
 */
export async function naDiscover({ root, stRoot = process.cwd(), send = null } = {}) {
    const sig = `${send ? 'st' : 'own'}|${stRoot}|${root}|${folderSig(stRoot, root)}`;
    if (found && found.sig === sig) return found.out;
    let enabled = true, list = null;
    if (send) {
        try {
            const r = await send(DISCOVER, { method: 'GET' });
            if (r.ok) {
                const json = await r.json();
                list = Array.isArray(json) ? json : [];
            } else if (r.headers?.get?.('x-na-bridge')) {
                // (SillyTavern itself answered: 404 is its "extensions are off" guard — the page then loads none —, any other failure leaves the
                //  page with no extensions too: discoverExtensions 298~312 gives [])
                enabled = r.status !== 404;
                list = [];
            }
        } catch { list = null; }
    }
    if (!list) {
        if (send && !toldDiscover) { toldDiscover = true; console.warn(TAG, `[macros] 실리 서버의 ${DISCOVER}를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.`); }
        list = __naDiscoverOwn(stRoot, root);
    }
    let names = list.map(x => x?.name).filter(x => typeof x === 'string');
    const manifests = {};
    for (const name of names) {
        const m = readManifest(stRoot, root, name);
        if (m.ok) manifests[name] = m.manifest;
    }
    names = names.filter(name => Object.hasOwn(manifests, name));
    const out = { enabled, names, manifests, version: clientVersion(stRoot) };
    found = { sig, out };
    return out;
}

// ---------- 켜지는 확장 (실리 extensions.js activateExtensions 568~665의 값 부분) ----------
// 매크로를 옮긴 기본 확장 (실리 manifest.json의 hooks.activate = init)
const EXTENSIONS = { expressions: EXPR, memory: MEM, 'stable-diffusion': SD };

// manifest 차례(loading_order, 그다음 display_name)로, requires(Extras 모듈: 서버는 Extras에 연결하지 않아요) · dependencies · minimum_client_version ·
// 꺼진 확장(extension_settings.disabledExtensions)을 실리처럼 봐요. 실리는 하나씩 기다리며 켜요: 등록 차례가 이 차례예요.
function activeOf(ext) {
    if (!ext.enabled) return [];
    const disabled = EXT.extension_settings.disabledExtensions;
    const extensions = Object.entries(ext.manifests).filter(([, m]) => obj(m)).sort((a, b) => EXT.sortManifestsByOrder(a[1], b[1]));
    const extensionNames = extensions.map(x => x[0]);
    const out = [];
    for (const [name, manifest] of extensions) {
        const extrasRequirements = manifest.requires, extensionDependencies = manifest.dependencies, minClientVersion = manifest.minimum_client_version;
        let meetsClientMinimumVersion = true;
        if (minClientVersion !== undefined) meetsClientMinimumVersion = versionCompare(ext.version, minClientVersion);
        let meetsModuleRequirements = true;
        if (extrasRequirements !== undefined && Array.isArray(extrasRequirements)) meetsModuleRequirements = isSubsetOf(EXT.modules, extrasRequirements);
        let meetsExtensionDeps = true;
        if (extensionDependencies !== undefined && Array.isArray(extensionDependencies)) {
            meetsExtensionDeps = isSubsetOf(extensionNames, extensionDependencies);
            if (meetsExtensionDeps && extensionDependencies.filter(dep => disabled.includes(dep)).length > 0) meetsExtensionDeps = false;
        }
        const isDisabled = disabled.includes(name);
        if (meetsModuleRequirements && meetsExtensionDeps && meetsClientMinimumVersion && !isDisabled) out.push(name);
    }
    return out;
}

// ---------- 등록 ----------
// (initMacros 안: 옛 엔진일 때만 옛 매크로 둘. 서버는 naInit에서 initMacros를 새 엔진으로 불러 이것을 건너뛰고, 열쇠가 바뀔 때마다 여기서 해요)
function legacyPair() {
// 실리 public/scripts/macros.js 719~743
    if (!power_user.experimental_macro_engine) {
        function initLastGenerationType() {
            let lastGenerationType = '';

            MacrosParser.registerMacro('lastGenerationType',
                () => lastGenerationType,
                'Returns the type of the last generation (e.g., "normal", "swipe", "continue", "impersonate", "quiet").',
            );

            eventSource.on(event_types.GENERATION_STARTED, (type, _params, isDryRun) => {
                if (isDryRun) return;
                lastGenerationType = type || 'normal';
            });

            eventSource.on(event_types.CHAT_CHANGED, () => {
                lastGenerationType = '';
            });
        }

        MacrosParser.registerMacro('isMobile',
            () => String(isMobile()),
            'Returns "true" if the user is on a mobile device, "false" otherwise.',
        );
        initLastGenerationType();
    }
}

const NAMES = {
    pair: ['isMobile', 'lastGenerationType'],
    expressions: ['defaultExpression', 'lastExpression', 'availableExpressions'],
    memory: ['summary'],
    'stable-diffusion': ['charPrefix', 'charNegativePrefix'],
    note: ['authorsNote', 'charAuthorsNote', 'defaultAuthorsNote'],
    reasoning: ['reasoningPrefix', 'reasoningSuffix', 'reasoningSeparator'],
};
// (SillyTavern's MacrosParser writes a "[DEPRECATED]" line for every registerMacro · unregisterMacro: the page writes them once into its console;
//  the server registers again whenever the key changes. Those lines only are left out of SillyTavern's window)
function quietly(fn) {
    const warn = console.warn;
    console.warn = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('[DEPRECATED] MacrosParser.')) return; warn.apply(console, a); };
    try { return fn(); } finally { console.warn = warn; }
}

let had = null, active = [];
function register(names) {
    const flag = !!power_user.experimental_macro_engine;
    const key = JSON.stringify([flag, names]);
    if (had?.key === key) return;
    quietly(() => {
        if (had) {
            for (const name of had.fresh) macros.registry.unregisterMacro(name);
            // (MacrosParser.unregisterMacro takes them out of its own map only with the engine flag off: macros.js 239~244)
            const was = power_user.experimental_macro_engine;
            power_user.experimental_macro_engine = false;
            try { for (const name of had.legacy) MacrosParser.unregisterMacro(name); } finally { power_user.experimental_macro_engine = was; }
        }
        const fresh = [], legacy = [];
        const put = list => (flag ? fresh : legacy).push(...list);
        // 1. getSettings 8019 initMacros의 옛 매크로 둘
        legacyPair();
        if (!flag) legacy.push(...NAMES.pair);
        // 2. 8023 loadExtensionSettings → activateExtensions: 켜진 확장마다 그 init (표정 2653~2720 · 요약 1110~1130 · 그림 생성 5955~5997)
        for (const name of names) {
            try { EXTENSIONS[name].__naRegister(); } catch (err) { oops(`확장을 활성화할 수 없습니다 (${name})`, err); }
            put(NAMES[name]);
        }
        // 3. firstLoadInit 763 initAuthorsNote → 584 registerAuthorsNoteMacros
        AN.registerAuthorsNoteMacros();
        put(NAMES.note);
        // 4. 777 initReasoning → 1700 registerReasoningMacros (늘 새 엔진의 레지스트리)
        REA.registerReasoningMacros();
        fresh.push(...NAMES.reasoning);
        had = { key, fresh, legacy };
    });
}

/**
 * naLoad가 settings.json을 채운 뒤에 불러요(power_user · extension_settings가 이 일의 것).
 * @param {{enabled?: boolean, names?: string[], manifests?: object, version?: string}} [ext] naDiscover가 돌려준 것. 없으면 확장 없이(켜져 있지만 찾은 것 없음).
 */
export function naMacros(ext) {
    ext = obj(ext) ? ext : {};
    const e = { enabled: ext.enabled !== false, names: Array.isArray(ext.names) ? ext.names : [], manifests: obj(ext.manifests) ? ext.manifests : {}, version: String(ext.version ?? 'UNKNOWN') };
    // (실리 1793~1803 extensionNames: {{hasExtension}} · findExtension. 확장이 꺼져 있으면 실리는 찾지 않아요: 빈 목록)
    EXT.__naSet({ extensionNames: e.enabled ? [...e.names] : [] });
    active = activeOf(e).filter(name => Object.hasOwn(EXTENSIONS, name));
    register(active);
    // 켜진 확장의 설정 값 줄 (실리는 켤 때 한 번 하고 settings.json에 저장해요. 서버는 일마다 settings.json에서 새로 읽어서 일마다)
    for (const name of active) {
        try {
            // 표정 init 2338
            if (name === 'expressions') EXPR.migrateSettings();
            // 그림 생성 init 5952 loadSettings
            if (name === 'stable-diffusion') SD.__naLoadSettings();
        } catch (err) { oops(`확장을 활성화할 수 없습니다 (${name})`, err); }
    }
}

// 표정 목록: 실리 페이지는 열 때 받아 두고(init 2339 addSettings → renderFallbackExpressionPicker → getExpressionsList) 표정 API를 바꿀 때 다시 받아요(1835).
// 서버는 열쇠 · 표정 API가 바뀔 때 다시 받아요. 로컬 분류는 다리의 /api/extra/classify/labels(실리 자신의 처리기)로. 옛 다리(404)면 실리가 그 요청에
// 실패했을 때처럼 기본 목록이에요(1519~1521). 그 실패는 모델 요청을 막지 않아요(naFetchFailures에서 빼요). 한 번 적어요.
let listFor = null, toldLabels = false;
async function expressionsList() {
    const key = JSON.stringify([had?.key ?? null, EXT.extension_settings.expressions.api]);
    if (listFor === key) return;
    EXPR.__naSet({ expressionsList: null });
    const before = naFetchFailures.length;
    try { await EXPR.getExpressionsList(); } finally {
        const failed = naFetchFailures.splice(before);
        const old = failed.find(f => String(f.url).startsWith('/api/extra/classify/labels') && (f.status === 404 || !f.status));
        if (old && !toldLabels) { toldLabels = true; console.warn(TAG, '[macros] 실리 서버의 /api/extra/classify/labels를 쓸 수 없습니다. 서버 플러그인을 업데이트하고 실리를 다시 시작하세요.'); }
    }
    listFor = key;
}
/** 테스트용: 표정 목록을 잊어요(페이지를 새로 연 것과 같아요). told: 적은 줄도(일꾼을 새로 띄운 것과 같아요) */
export function __naMacrosReset({ told = false } = {}) { listFor = null; if (told) toldLabels = false; }

/**
 * 일마다, 이 채팅을 실리 전역 값에 넣은 뒤(chat_metadata는 이 일의 복사본)와 다리(__naSetFetch)를 준 뒤에 불러요: 실리 페이지가 채팅을 열 때 하는 것.
 */
export async function naMacrosJob() {
    // 작가 노트: CHAT_CHANGED → onChatChanged 442 loadSettings (노트가 없는 채팅은 기본 노트 · 기본 칸 값. 이 일의 복사본에만: 저장하지 않아요)
    // (실리 이벤트의 처리기가 던지면 실리는 콘솔에 적고 계속해요. 서버도 적고 계속해요)
    try { AN.loadSettings(); } catch (err) { oops('작가 노트를 불러올 수 없습니다', err); }
    // 표정: CHAT_CHANGED → 2349 lastExpression = {} (실리는 그 뒤 2초마다 마지막 캐릭터 메시지를 분류해 채워요: 서버는 분류하지 않아요)
    EXPR.__naSet({ lastExpression: {} });
    const cannot = [];
    if (active.includes('expressions')) {
        try { await expressionsList(); } catch (err) { oops('표정 목록을 불러올 수 없습니다', err); }
        const api = EXT.extension_settings.expressions.api;
        // (분류가 있는 API: 실리 페이지의 {{lastExpression}}은 분류한 표정이에요. 서버는 분류하지 않아서 알 수 없어요(none은 분류하면 빈 글자예요: 1188~1191. 마지막 캐릭터 메시지가 빈 채팅의 기본 표정(1093~1095)은 서버가 따라 하지 않아요))
        if (api != EXPR.EXPRESSION_API.none) cannot.push('lastExpression');
        // (Extras: 연결되면 Extras가 주는 목록이에요(1486~1500). 서버는 Extras에 연결하지 않아요)
        if (api == EXPR.EXPRESSION_API.extras) cannot.push('availableExpressions');
    }
    __naSetCannot(cannot);
}
