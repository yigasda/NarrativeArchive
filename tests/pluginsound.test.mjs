// 사용자 지정 알림음 (plugin/sound.mjs: 마리나라 notification-sound.routes.ts) — 임시 폴더에서 그대로 돌려요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { Writable } from 'node:stream';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { soundStore, detectNotificationSoundFormat, MAX_NOTIFICATION_SOUND_BYTES, SoundError } from '../plugin/sound.mjs';
import * as plugin from '../plugin/index.mjs';

const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(20, 1)]);
const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(20, 2)]);
const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(20, 3)]);
const MP3_FRAME = Buffer.from([0xff, 0xfb, 0x90, 0x00, 1, 2, 3]);
const M4A = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.from('M4A '), Buffer.alloc(8)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(8)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);

async function rig(t) {
    const root = await mkdtemp(path.join(tmpdir(), 'na-sound-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const uploads = path.join(root, '_uploads');
    await writeFile(path.join(root, '.keep'), '');
    let n = 0;
    // (what SillyTavern's multer leaves: a temp file, its name and size)
    const tmp = async buf => { const { mkdir } = await import('node:fs/promises'); await mkdir(uploads, { recursive: true }); const f = path.join(uploads, `up${++n}`); await writeFile(f, buf); return f; };
    return { root, uploads, tmp, s: soundStore(root) };
}
const dir = root => path.join(root, 'NarrativeArchive', 'notification-sounds');

test('알림음: 파일 머리로 형식을 알아봐요 (마리나라 detectNotificationSoundFormat 그대로)', () => {
    assert.deepEqual(detectNotificationSoundFormat(WAV), { extension: '.wav', mimeType: 'audio/wav' });
    assert.equal(detectNotificationSoundFormat(WEBP), null);
    // (a WebP picture whose size bytes happen to read "ftyp": still a picture, not an m4a)
    assert.equal(detectNotificationSoundFormat(Buffer.concat([Buffer.from('RIFFftypWEBP'), Buffer.alloc(8)])), null);
    assert.deepEqual(detectNotificationSoundFormat(OGG), { extension: '.ogg', mimeType: 'audio/ogg' });
    assert.deepEqual(detectNotificationSoundFormat(MP3), { extension: '.mp3', mimeType: 'audio/mpeg' });
    assert.deepEqual(detectNotificationSoundFormat(MP3_FRAME), { extension: '.mp3', mimeType: 'audio/mpeg' });
    assert.deepEqual(detectNotificationSoundFormat(M4A), { extension: '.m4a', mimeType: 'audio/mp4' });
    assert.deepEqual(detectNotificationSoundFormat(WEBM), { extension: '.webm', mimeType: 'audio/webm' });
    assert.equal(detectNotificationSoundFormat(Buffer.from('hello world!')), null);
    assert.equal(MAX_NOTIFICATION_SOUND_BYTES, 10 * 1024 * 1024);
});

test('알림음: 올리면 사용자 폴더에 하나만, 상태 · 주소가 생겨요. 임시 파일은 지워요. 바꾸면 옛것이 없어지고, 지우면 기본으로', async t => {
    const R = await rig(t);
    assert.deepEqual(await R.s.status(), { configured: false, url: null, updatedAt: null });
    const up = await R.tmp(WAV);
    const st = await R.s.upload({ name: 'ding.WAV', tmp: up, size: WAV.length });
    assert.equal(st.configured, true);
    assert.match(st.url, /^\/api\/plugins\/narrative-archive\/sound\/file\?v=/);
    assert.equal(decodeURIComponent(st.url.split('?v=')[1]), st.updatedAt);
    assert.deepEqual(await R.s.status(), st);
    assert.deepEqual(await readdir(dir(R.root)), ['notification.wav']);
    assert.deepEqual(await readdir(R.uploads), []);
    // 파일 주기
    const f = await R.s.file();
    assert.deepEqual([f.mimeType, f.size], ['audio/wav', WAV.length]);
    await f.handle.close();
    // .oga는 .ogg로. 옛것은 없어져요
    await R.s.upload({ name: 'x.oga', tmp: await R.tmp(OGG), size: OGG.length });
    assert.deepEqual(await readdir(dir(R.root)), ['notification.ogg']);
    // .mp4 이름에 m4a 머리: 받아요 (마리나라: mp4 · m4a는 서로 받아요)
    await R.s.upload({ name: 'x.mp4', tmp: await R.tmp(M4A), size: M4A.length });
    assert.deepEqual(await readdir(dir(R.root)), ['notification.mp4']);
    assert.equal((await R.s.file()).mimeType, 'audio/mp4');
    // 지우기
    await R.s.remove();
    assert.deepEqual(await R.s.status(), { configured: false, url: null, updatedAt: null });
    assert.equal(await R.s.file(), null);
    await R.s.remove();
});

test('알림음: 안 받는 것 — 10MB 넘음(413) · 받지 않는 확장자 · 이름과 머리가 다름 · 소리가 아님 · 파일 없음(400). 임시 파일은 늘 지워요', async t => {
    const R = await rig(t);
    const tryUp = async (name, buf, size = buf.length) => { try { await R.s.upload({ name, tmp: await R.tmp(buf), size }); return null; } catch (e) { assert.ok(e instanceof SoundError); return [e.code, e.message]; } };
    assert.deepEqual(await tryUp('a.wav', WAV, MAX_NOTIFICATION_SOUND_BYTES + 1), [413, '알림음은 10MB 이하여야 합니다.']);
    assert.equal((await tryUp('a.wav', Buffer.concat([WAV, Buffer.alloc(MAX_NOTIFICATION_SOUND_BYTES)]), 10)) [0], 413);
    assert.deepEqual(await tryUp('a.flac', WAV), [400, 'MP3, WAV, OGG, M4A, MP4 또는 WebM 오디오 파일을 사용하세요.']);
    assert.deepEqual(await tryUp('a.mp3', WAV), [400, '업로드한 파일은 지원되는 오디오 형식이 아닙니다.']);
    assert.deepEqual(await tryUp('a.wav', WEBP), [400, '업로드한 파일은 지원되는 오디오 형식이 아닙니다.']);
    assert.deepEqual(await tryUp('noext', WAV), [400, 'MP3, WAV, OGG, M4A, MP4 또는 WebM 오디오 파일을 사용하세요.']);
    await assert.rejects(R.s.upload({ name: 'a.wav', tmp: '', size: 0 }), e => e.code === 400);
    assert.deepEqual(await readdir(R.uploads), []);
    assert.deepEqual(await R.s.status(), { configured: false, url: null, updatedAt: null });
});

test('알림음: 여럿이 같이 올려도 늘 하나만 남아요 — 서로 지우지 않아요 (마리나라의 한 줄 세우기)', async t => {
    const R = await rig(t);
    for (let round = 0; round < 25; round++) {
        const files = await Promise.all([[WAV, 'a.wav'], [OGG, 'b.ogg'], [MP3, 'c.mp3'], [WEBM, 'd.webm']].map(async ([buf, name]) => ({ name, tmp: await R.tmp(buf), size: buf.length })));
        await Promise.all(files.map(f => R.s.upload(f)));
        const left = await readdir(dir(R.root));
        assert.equal(left.length, 1, `round ${round}: ${left}`);
        assert.equal((await R.s.status()).configured, true);
    }
    // (지우기가 끼어도 둘 중 하나가 끝까지: 남은 파일과 상태가 서로 맞아요. 올리기는 파일을 다 읽은 뒤에 줄을 서요)
    const f = { name: 'a.wav', tmp: await R.tmp(WAV), size: WAV.length };
    await Promise.all([R.s.upload(f), R.s.remove()]);
    const left = await readdir(dir(R.root));
    assert.ok(left.length <= 1, String(left));
    assert.equal((await R.s.status()).configured, left.length === 1);
});

test('알림음 길: 실리가 받아 둔 avatar 파일로 올리고 · 상태 · 소리 주기 · 지우기. 다른 사용자의 것은 안 보여요', async t => {
    const A = await rig(t), B = await rig(t);
    const routes = {}, router = { get: (p, h) => { routes[`GET ${p}`] = h; }, post: (p, h) => { routes[`POST ${p}`] = h; } };
    const log = console.log; console.log = () => {};
    try { await plugin.init(router); } finally { console.log = log; }
    const call = async (route, root, { body = {}, file } = {}) => {
        const chunks = [];
        const res = Object.assign(new Writable({ write(c, _e, cb) { chunks.push(c); cb(); } }), { code: 200, headers: {}, status(c) { this.code = c; return this; }, json(v) { this.body = v; this.end(); return this; }, set(h) { Object.assign(this.headers, h); return this; } });
        const done = new Promise(r => res.on('finish', r));
        await routes[route]({ body, file, user: root ? { directories: { root } } : undefined }, res);
        await done;
        return Object.assign(res, { bytes: Buffer.concat(chunks) });
    };
    assert.deepEqual((await call('GET /sound', A.root)).body, { configured: false, url: null, updatedAt: null });
    const up = await A.tmp(OGG);
    const r = await call('POST /sound/upload', A.root, { file: { originalname: 'ding.ogg', destination: path.dirname(up), filename: path.basename(up), size: OGG.length } });
    assert.equal(r.body.configured, true);
    assert.deepEqual((await call('GET /sound', A.root)).body, r.body);
    assert.deepEqual((await call('GET /sound', B.root)).body, { configured: false, url: null, updatedAt: null });
    const f = await call('GET /sound/file', A.root);
    assert.equal(f.headers['Content-Type'], 'audio/ogg'); assert.equal(f.headers['Content-Length'], String(OGG.length)); assert.equal(f.headers['X-Content-Type-Options'], 'nosniff');
    assert.ok(f.bytes.equals(OGG));
    assert.equal((await call('GET /sound/file', B.root)).code, 404);
    // 안 받는 것: 그 이유로
    const bad = await call('POST /sound/upload', A.root, { file: { originalname: 'x.flac', destination: path.dirname(up), filename: path.basename(await A.tmp(WAV)), size: 1 } });
    assert.deepEqual([bad.code, bad.body.error], [400, 'MP3, WAV, OGG, M4A, MP4 또는 WebM 오디오 파일을 사용하세요.']);
    assert.equal((await call('POST /sound/upload', A.root, {})).code, 400);
    assert.equal((await call('GET /sound', null)).code, 401);
    // 지우기
    assert.deepEqual((await call('POST /sound/delete', A.root)).body, { configured: false, url: null, updatedAt: null });
    assert.deepEqual((await call('GET /sound', A.root)).body, { configured: false, url: null, updatedAt: null });
    void stat;
});
