// 다리(plugin/bridge.mjs)를 진짜로 띄워서: /api/secrets/read는 키마다 [{ id, active }] | null만 주고(키 글 · 가린 글 · 이름표 없음),
// 상태를 바꾸는 길(write · delete · rotate …)은 404예요. 실리 서버 폴더는 가짜예요(임시 폴더):
//   - express: 다리가 쓰는 것만 하는 작은 대역 (use · post · json · listen)
//   - src/endpoints/…의 router: 아무것도 안 하는 대역. secrets.js의 SecretManager는 실리 1.19.1 src/endpoints/secrets.js 113~372와 같은 모양의 답
//     (getSecretState: SECRET_KEYS마다 [{ id, value(가린 글, allowKeysExposure면 그대로), label, active }] | null. 깨진 파일이면 JSON.parse가 던져요)
// 가짜 키 글만 써요.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startBridge } from '../plugin/bridge.mjs';

const EXPRESS = String.raw`
const http = require('node:http');
function helpers(res) {
    res.status = c => { res.statusCode = c; return res; };
    res.sendStatus = c => { res.statusCode = c; res.end(String(c)); return res; };
    res.send = b => { if (b && typeof b === 'object') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)); } else res.end(String(b ?? '')); return res; };
}
function express() {
    const stack = [];
    const app = (req, res) => {
        helpers(res);
        const url0 = req.url;
        let i = 0;
        const next = err => {
            req.url = url0;
            if (err) { res.statusCode = err.status || 500; return res.end(); }
            const layer = stack[i++];
            if (!layer) { res.statusCode = 404; return res.end('Not Found'); }
            const p = url0.split('?')[0];
            if (layer.method) return req.method === layer.method && p === layer.path ? layer.fn(req, res, next) : next();
            if (layer.prefix && !(p === layer.prefix || p.startsWith(layer.prefix + '/'))) return next();
            if (layer.prefix) req.url = url0.slice(layer.prefix.length) || '/';
            return layer.fn(req, res, next);
        };
        next();
    };
    app.disable = () => app;
    app.use = (a, b) => { stack.push(typeof a === 'function' ? { prefix: '', fn: a } : { prefix: a, fn: b }); return app; };
    app.post = (p, fn) => { stack.push({ method: 'POST', path: p, fn }); return app; };
    app.listen = (port, host, cb) => http.createServer(app).listen(port, host, cb);
    return app;
}
express.json = () => (req, res, next) => {
    let b = '';
    req.on('data', c => { b += c; });
    req.on('end', () => { try { req.body = b ? JSON.parse(b) : {}; next(); } catch { next({ status: 400 }); } });
};
module.exports = express;
`;
const NOOP_ROUTER = 'export function router(req, res, next) { next(); }\n';
const SECRETS = String.raw`
import fs from 'node:fs';
import path from 'node:path';
export const SECRET_KEYS = { OPENAI: 'api_key_openai', CLAUDE: 'api_key_claude', LIBRE_URL: 'libre_url' };
const EXPORTABLE_KEYS = [SECRET_KEYS.LIBRE_URL];
export class SecretManager {
    constructor(directories) { this.filePath = path.join(directories.root, 'secrets.json'); }
    _readSecretsFile() {
        if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, '{}');
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    }
    getMaskedValue(value, key) {
        if (globalThis.__naFakeExpose || EXPORTABLE_KEYS.includes(key)) return value;
        if (value.length <= 10) return '*'.repeat(10);
        return '*'.repeat(7) + value.slice(-3);
    }
    getSecretState() {
        const secrets = this._readSecretsFile();
        const state = {};
        for (const key of Object.values(SECRET_KEYS)) {
            const value = secrets[key];
            state[key] = value && Array.isArray(value) && value.length > 0 ? value.map(secret => ({ id: secret.id, value: this.getMaskedValue(secret.value, key), label: secret.label, active: secret.active })) : null;
        }
        return state;
    }
}
// (SillyTavern's own secrets router: the bridge must not use it. If it did, these would write)
export function router(req, res) { fs.writeFileSync(path.join(req.user.directories.root, 'secrets.json'), '{"written":true}'); res.send({ wrote: req.url }); }
`;

function fakeSt() {
    const st = fs.mkdtempSync(path.join(os.tmpdir(), 'na-fake-st-'));
    const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(st, f)), { recursive: true }); fs.writeFileSync(path.join(st, f), text); };
    put('package.json', '{"name":"sillytavern","type":"module"}');
    put('node_modules/express/package.json', '{"name":"express","main":"index.js"}');
    put('node_modules/express/index.js', EXPRESS);
    for (const f of ['endpoints/backends/chat-completions.js', 'endpoints/backends/text-completions.js', 'endpoints/backends/kobold.js', 'endpoints/characters.js', 'endpoints/avatars.js', 'endpoints/worldinfo.js', 'users.js', 'endpoints/tokenizers.js', 'endpoints/nanogpt.js']) put(`src/${f}`, NOOP_ROUTER);
    put('src/endpoints/secrets.js', SECRETS);
    return st;
}

test('다리 /api/secrets/read: 키마다 [{ id, active }] | null만 줘요 — 키 글 · 가린 글 · 이름표 없음(키가 여러 개여도, allowKeysExposure여도, 늘 노출되는 키도). 깨진 파일이면 {}(실리 창에 키 조각 없이). 바꾸는 길은 404', async t => {
    const st = fakeSt();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'na-bridge-user-'));
    t.after(() => { fs.rmSync(st, { recursive: true, force: true }); fs.rmSync(root, { recursive: true, force: true }); delete globalThis.__naFakeExpose; });
    const b = await startBridge({ stRoot: st, userOf: r => (r === root ? { profile: { handle: 'ren' }, directories: { root } } : null) });
    t.after(() => b.close());
    const post = (url, body = {}, headers = { 'x-na-token': b.token, 'x-na-root': encodeURIComponent(root) }) => fetch(b.url + url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const file = path.join(root, 'secrets.json');
    const KEY = 'na-test-SECRETVALUE-1234567890abcdef';
    const saved = JSON.stringify({
        api_key_openai: [{ id: 'id-1', value: KEY, label: 'Ren label', active: true }, { id: 'id-2', value: `${KEY}-B`, label: 'Ren label 2', active: false }],
        libre_url: [{ id: 'l1', value: 'http://SECRETVALUE.libre', label: 'Ren label 3', active: true }],
        api_key_unknown: [{ id: 'u1', value: KEY, label: 'Ren label 4', active: true }],
    });
    fs.writeFileSync(file, saved);
    const want = { api_key_openai: [{ id: 'id-1', active: true }, { id: 'id-2', active: false }], api_key_claude: null, libre_url: [{ id: 'l1', active: true }] };
    for (const expose of [false, true]) {
        globalThis.__naFakeExpose = expose;
        const r = await post('/api/secrets/read');
        assert.equal(r.status, 200);
        const text = await r.text();
        assert.deepEqual(JSON.parse(text), want, `allowKeysExposure ${expose}`);
        for (const bad of ['SECRETVALUE', 'cdef', '***', 'label', 'value']) assert.ok(!text.includes(bad), `${bad}: ${text}`);
    }
    // (a broken secrets.json: JSON.parse's message holds a piece of the file — SillyTavern writes the whole error, the bridge only its name)
    fs.writeFileSync(file, '{ "api_key_openai": [ { "id": "a", "value": na-test-SECRETVALUE-oops }');
    const errs = [];
    const was = console.error;
    console.error = (...a) => errs.push(a.map(x => (x instanceof Error ? `${x.stack}` : String(x))).join(' '));
    let r;
    try { r = await post('/api/secrets/read'); } finally { console.error = was; }
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {});
    assert.deepEqual(errs, ['Error reading secret state: SyntaxError']);
    // (the ways that change or show keys: not open. Nothing written)
    fs.writeFileSync(file, saved);
    for (const u of ['/api/secrets/write', '/api/secrets/delete', '/api/secrets/rotate', '/api/secrets/view', '/api/secrets/find', '/api/secrets/rename', '/api/secrets/settings', '/api/secrets/read/', '/api/secrets//read', '/api/SECRETS/read', '/api/secrets/%72ead', '/api/nanogpt/models']) {
        const x = await post(u, { key: 'api_key_openai', value: 'NEW', id: 'id-1' });
        assert.equal(x.status, 404, u);
    }
    assert.equal(fs.readFileSync(file, 'utf8'), saved);
    assert.equal((await post('/api/secrets/read', {}, {})).status, 403);
    assert.equal((await post('/api/secrets/read', {}, { 'x-na-token': b.token, 'x-na-root': encodeURIComponent(`${root}-other`) })).status, 401);
    assert.equal((await fetch(b.url + '/api/secrets/read', { headers: { 'x-na-token': b.token, 'x-na-root': encodeURIComponent(root) } })).status, 404);
    // (no file: SillyTavern's SecretManager makes an empty one, as its own /read does)
    fs.rmSync(file);
    assert.deepEqual(await (await post('/api/secrets/read')).json(), { api_key_openai: null, api_key_claude: null, libre_url: null });
});

test('다리 · 매크로의 길: GET /api/extensions/discover · POST /api/extra/classify/labels는 실리 자신의 처리기로(x-na-bridge 표시). 나머지 확장 · 분류 길은 404(표시 없음). 실리에 그 처리기가 없으면 표시 없는 404', async t => {
    const st = fakeSt();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'na-bridge-user-'));
    t.after(() => { fs.rmSync(st, { recursive: true, force: true }); fs.rmSync(root, { recursive: true, force: true }); });
    const userOf = r => (r === root ? { profile: { handle: 'ren' }, directories: { root } } : null);
    const headers = b => ({ 'content-type': 'application/json', 'x-na-token': b.token, 'x-na-root': encodeURIComponent(root) });
    const ask = (b, method, url) => fetch(b.url + url, { method, headers: headers(b), body: method === 'GET' ? undefined : '{}' });
    // (SillyTavern without those routers: an older SillyTavern — answered as an older bridge does)
    const b0 = await startBridge({ stRoot: st, userOf });
    t.after(() => b0.close());
    const r0 = await ask(b0, 'GET', '/api/extensions/discover');
    assert.deepEqual([r0.status, r0.headers.get('x-na-bridge')], [404, null]);
    // (SillyTavern's own routers: what they answer, with the bridge's mark)
    fs.writeFileSync(path.join(st, 'src/endpoints/extensions.js'), "export function router(req, res, next) { if (req.method === 'GET' && req.url === '/discover') return res.send([{ type: 'system', name: 'memory' }, { type: 'local', name: 'third-party/Ren-Ext' }]); if (req.url === '/install') return res.send({ installed: true }); next(); }\n");
    fs.writeFileSync(path.join(st, 'src/endpoints/classify.js'), "export function router(req, res, next) { if (req.method === 'POST' && req.url === '/labels') return res.send({ labels: ['calm', 'joy'] }); if (req.url === '/') return res.send({ classification: [] }); next(); }\n");
    const b = await startBridge({ stRoot: st, userOf });
    t.after(() => b.close());
    const d = await ask(b, 'GET', '/api/extensions/discover');
    assert.deepEqual([d.status, d.headers.get('x-na-bridge'), await d.json()], [200, '1', [{ type: 'system', name: 'memory' }, { type: 'local', name: 'third-party/Ren-Ext' }]]);
    const l = await ask(b, 'POST', '/api/extra/classify/labels');
    assert.deepEqual([l.status, l.headers.get('x-na-bridge'), await l.json()], [200, '1', { labels: ['calm', 'joy'] }]);
    for (const [method, url] of [['POST', '/api/extensions/discover'], ['POST', '/api/extensions/install'], ['GET', '/api/extensions/install'], ['POST', '/api/extra/classify'], ['GET', '/api/extra/classify/labels'], ['GET', '/api/extensions/discover/']]) {
        const x = await ask(b, method, url);
        assert.deepEqual([x.status, x.headers.get('x-na-bridge')], [404, null], `${method} ${url}`);
    }
    // (even with an allow list that lets everything through: SillyTavern's extensions router gets GET /discover only — never install · update · delete)
    // (another SillyTavern folder: its modules are loaded afresh)
    const st2 = fakeSt();
    t.after(() => fs.rmSync(st2, { recursive: true, force: true }));
    fs.writeFileSync(path.join(st2, 'src/endpoints/extensions.js'), "export const seen = []; export function router(req, res, next) { seen.push(req.method + ' ' + req.url); if (req.method === 'GET' && req.url === '/discover') return res.send([{ type: 'system', name: 'memory' }]); return res.send({ installed: req.url }); }\n");
    const open = await startBridge({ stRoot: st2, userOf, allow: () => true });
    t.after(() => open.close());
    const { seen } = await import(pathToFileURL(path.join(st2, 'src/endpoints/extensions.js')).href);
    for (const [method, url] of [['POST', '/api/extensions/install'], ['GET', '/api/extensions/install'], ['POST', '/api/extensions/update'], ['POST', '/api/extensions/delete'], ['POST', '/api/extensions/discover'], ['GET', '/api/extensions/discover/x'], ['GET', '/api/extensions/version']]) {
        const x = await ask(open, method, url);
        assert.equal(x.status, 404, `${method} ${url}`);
    }
    assert.deepEqual(seen, []);
    const ok = await ask(open, 'GET', '/api/extensions/discover');
    assert.deepEqual([ok.status, ok.headers.get('x-na-bridge'), await ok.json()], [200, '1', [{ type: 'system', name: 'memory' }]]);
    assert.deepEqual(seen, ['GET /discover']);
});
