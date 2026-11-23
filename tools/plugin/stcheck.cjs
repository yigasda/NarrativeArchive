// real SillyTavern 1.19.1 + real browser + the plugin: what the server reads from SillyTavern, in the cases that break easily.
//   1. a chat with a persona connected to its character, opened again: SillyTavern switches the persona while it opens the
//      chat (PERSONA_CHANGED inside its CHAT_CHANGED). The Orbit stays one store; this chat remembers the persona; a chat
//      with no Orbit is not written; the server answers as that persona, with the card as just edited and the message just sent
//   1b. a branch of that chat, made with the default persona: SillyTavern opens the branch and switches to Ren while opening it.
//      The branch takes its own copy of the Orbit — one copy, not two
//   2. a group chat with a persona connected to the group: the server answers in it, as that persona
//   3. the chat's own card deleted (its chats kept, SillyTavern's default): the server does not answer there
// --lazy: the same with SillyTavern's performance.lazyLoadCharacters on (the card list comes shallow)
// Usage: node tools/plugin/stcheck.cjs <SillyTavern folder> [--lazy]   (about 2 minutes; puts back settings.json, config.yaml,
// the Seraphina card, her chats, groups, group chats and the persona pictures as they were)
const http = require('node:http'), { spawn } = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const [,, ST, flag] = process.argv;
const lazy = flag === '--lazy';
const log = (...a) => console.log(...a);
const snapDir = dir => (fs.existsSync(dir) ? new Map(fs.readdirSync(dir).filter(n => fs.statSync(path.join(dir, n)).isFile()).map(n => [n, fs.readFileSync(path.join(dir, n))])) : null);
const putDir = (dir, had) => { if (!fs.existsSync(dir)) { if (had) fs.mkdirSync(dir, { recursive: true }); else return; } for (const n of fs.readdirSync(dir)) if (!had?.has(n)) fs.rmSync(path.join(dir, n), { recursive: true, force: true }); for (const [n, b] of had || []) fs.writeFileSync(path.join(dir, n), b); };
(async () => {
    const user = path.join(ST, 'data', 'default-user');
    const files = { settings: path.join(user, 'settings.json'), card: path.join(user, 'characters', 'default_Seraphina.png'), config: path.join(ST, 'config.yaml') };
    const kept = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, fs.readFileSync(f)]));
    const dirs = { chats: path.join(user, 'chats', 'default_Seraphina'), groups: path.join(user, 'groups'), groupChats: path.join(user, 'group chats'), avatars: path.join(user, 'User Avatars') };
    const keptDirs = Object.fromEntries(Object.entries(dirs).map(([k, d]) => [k, snapDir(d)]));
    const orbit = path.join(user, 'NarrativeArchive', 'orbit');
    // (a second persona, Ren: a picture and its name and description)
    fs.copyFileSync(path.join(dirs.avatars, 'user-default.png'), path.join(dirs.avatars, 'ren.png'));
    const s = JSON.parse(kept.settings.toString());
    s.power_user.personas['ren.png'] = 'Ren';
    s.power_user.persona_descriptions['ren.png'] = { description: 'Ren is a student.', position: 0 };
    s.user_avatar = 'user-default.png';
    fs.writeFileSync(files.settings, JSON.stringify(s, null, 4));
    if (lazy) fs.writeFileSync(files.config, kept.config.toString().replace(/lazyLoadCharacters: false/, 'lazyLoadCharacters: true'));
    const asked = [];
    const model = http.createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { let body = null; try { body = JSON.parse(b); } catch { body = b; } asked.push({ url: req.url, body }); res.setHeader('content-type', 'application/json'); if (req.url.endsWith('/models')) { res.end(JSON.stringify({ data: [{ id: 'fake-model' }] })); return; } res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: ['on it'], status: '' }) }, finish_reason: 'stop' }] })); }); });
    await new Promise(r => model.listen(0, '127.0.0.1', r));
    const custom_url = `http://127.0.0.1:${model.address().port}/v1`, PORT = 8128, base = `http://127.0.0.1:${PORT}`;
    const st = spawn(process.execPath, ['server.js', '--port', String(PORT)], { cwd: ST });
    let out = ''; st.stdout.on('data', d => (out += d)); st.stderr.on('data', d => (out += d));
    for (let i = 0; i < 120; i++) { try { const r = await fetch(`${base}/csrf-token`); if (r.ok) break; } catch { /* not up */ } await new Promise(r => setTimeout(r, 500)); }
    let fail = 0; const ok = (name, cond, more = '') => { log(cond ? 'OK  ' : 'FAIL', name, more); if (!cond) fail++; };
    const browser = await chromium.launch(), page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error' && /narrative|phone2|Orbit/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
    const completions = () => asked.filter(a => a.url.endsWith('/chat/completions'));
    const textOf = body => (body?.messages || []).map(x => (typeof x.content === 'string' ? x.content : '')).join('\n');
    const stores = () => (fs.existsSync(orbit) ? fs.readdirSync(orbit).length : 0);
    const header = file => JSON.parse(fs.readFileSync(file, 'utf8').split('\n')[0]);
    // (an Orbit begun from the story in the open chat, kept in the plugin: one phone, one room, a snapshot)
    const begin = url => page.evaluate(async url => {
        const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
        const core = await import(B + 'core.js'), S = await import(B + 'phone2store.js'), G = await import(B + 'phone2go.js'), KO = await import(B + 'phone2keepon.js'), O = await import('/scripts/openai.js');
        const c = SillyTavern.getContext();
        O.oai_settings.custom_url = url;
        (c.extensionSettings.narrative_archive ||= {}).draftConn = { mode: 'source', source: 'custom', stModel: 'fake-model' };
        c.saveSettingsDebounced();
        await KO.liveReady();
        const m = core.getMeta(), upto = Math.max(0, c.chat.length - 1);
        S.startFromStory(m, { persona: c.name1, upto, now: Date.now() - 10 * 3600_000 });
        const w = S.liveWorld(m);
        w.snap = { v: 1, at: 1, upto, text: '## #0–#0 — start\n- they met in the glade\n', recent: [], made: { from: 0, to: upto, count: 1, parts: 1 } };
        S.putLivePhone(m, { owner: 'Seraphina' });
        const room = S.ensureRoom(m, ['Seraphina']), at = Date.now() - 3600_000;
        S.sendLive(m, room.id, 'hey', at); room.messages.push({ id: 't2', n: upto + 2, from: 'Seraphina', text: 'hi', at: at + 60_000 });
        w.presence = { on: false, schedules: {}, overrides: {}, meta: {}, user: {} };
        await core.saveMeta();
        await KO.keepBeat();
        await G.liveKitRefresh(m); await core.saveMeta();
        return { state: KO.keepState(), id: m.liveRef?.id || '', kit: m.live.kit };
    }, url);
    // (the tab hidden, a reply for later in 2 s in the open chat's Orbit: the server sends it) → its request's text
    const serverReply = async () => {
        const n = completions().length;
        await page.evaluate(async () => {
            const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
            const core = await import(B + 'core.js'), S = await import(B + 'phone2store.js'), KO = await import(B + 'phone2keepon.js');
            await KO.liveReady();
            const m = core.getMeta(), w = S.liveWorld(m), room = Object.values(w.messenger.rooms)[0];
            S.sendLive(m, room.id, 'you there?');
            const job = S.enqueueJob(m, { kind: 'reply', owner: 'Seraphina', room: room.id });
            Object.assign(job, { timed: true, notBefore: Date.now() + 2000 });
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            await core.saveMeta();
        });
        for (let i = 0; i < 60 && completions().length === n; i++) await page.waitForTimeout(500);
        await page.evaluate(() => { delete document.hidden; });
        return completions().length > n ? textOf(completions().at(-1).body) : '';
    };
    try {
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof window.SillyTavern?.getContext === 'function' && window.SillyTavern.getContext().characters?.length > 0, null, { timeout: 90000 });
        await page.waitForTimeout(4000);
        await page.evaluate(async () => { await SillyTavern.getContext().executeSlashCommandsWithOptions('/go Seraphina'); });
        await page.waitForFunction(() => !!SillyTavern.getContext().chatId, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        log(lazy ? '— lazyLoadCharacters: on' : '— lazyLoadCharacters: off');
        // ---- 1. a persona connected to the character, the chat opened again
        const r1 = await begin(custom_url);
        ok('1. Orbit kept in the plugin', r1.state === 'ok' && !!r1.id, r1.state);
        await page.waitForTimeout(2500);
        ok('1. one Orbit store', stores() === 1, String(stores()));
        const own = await page.evaluate(() => { const c = SillyTavern.getContext(); return { avatar: c.characters[c.characterId].avatar, chat: c.chatId }; });
        const r2 = await page.evaluate(async own => {
            const P = await import('/scripts/personas.js'), SC = await import('/script.js');
            const c = SillyTavern.getContext();
            c.powerUserSettings.persona_descriptions['ren.png'].connections = [{ type: 'character', id: own.avatar }];
            c.saveSettingsDebounced();
            // (another chat with her: SillyTavern picks Ren there; then the default persona by hand; then back to the Orbit's chat,
            //  where SillyTavern switches to Ren while it opens it)
            await SC.doNewChat();
            await new Promise(r => setTimeout(r, 1500));
            const other = SillyTavern.getContext().chatId;
            await P.setUserAvatar('user-default.png');
            await new Promise(r => setTimeout(r, 1500));
            await SC.openCharacterChat(own.chat);
            await new Promise(r => setTimeout(r, 4000));
            return { other, name1: SillyTavern.getContext().name1, chat: SillyTavern.getContext().chatId };
        }, own);
        ok('1. back in the Orbit\'s chat, SillyTavern picked Ren while opening it', r2.chat === own.chat && r2.name1 === 'Ren', JSON.stringify(r2));
        ok('1. still one Orbit store (the open during the persona switch did not make a second)', stores() === 1, String(stores()));
        const f = r1.kit.chat.file, mine = path.join(dirs.chats, `${f.id}.jsonl`), other = path.join(dirs.chats, `${r2.other}.jsonl`);
        ok('1. this chat remembers Ren', header(mine).chat_metadata?.narrative_archive?.stPersona === 'ren.png', JSON.stringify(header(mine).chat_metadata?.narrative_archive?.stPersona));
        ok('1. the chat with no Orbit was not written our persona note', !fs.existsSync(other) || header(other).chat_metadata?.narrative_archive?.stPersona === undefined);
        await page.evaluate(async () => {
            $('#description_textarea').val('Seraphina is a pilot now.').trigger('input');
            await SillyTavern.getContext().executeSlashCommandsWithOptions('/send at the door now');
        });
        await page.waitForTimeout(3500);
        const t1 = await serverReply();
        ok('1. the server answered', !!t1, out.split('\n').filter(l => /narrative-archive/i.test(l)).slice(-4).join(' | '));
        ok('1. … as Ren', /\[PERSONA — Ren\]\nRen is a student\./.test(t1) && /Ren is texting you/.test(t1), (t1.match(/\[PERSONA[^\n]*\n[^\n]*/) || [''])[0]);
        ok('1. … with the card as just edited', /Seraphina is a pilot now\./.test(t1), (t1.match(/\[Seraphina's card\]\n[^\n]*\n[^\n]*/) || [''])[0]);
        ok('1. … and the role-play message just sent', /\[LAST MESSAGES\][\s\S]*Ren: at the door now/.test(t1));
        // ---- 1b. a branch, opened with the persona switching while it opens
        const r6 = await page.evaluate(async () => {
            const P = await import('/scripts/personas.js'), BM = await import('/scripts/bookmarks.js');
            await P.setUserAvatar('user-default.png');
            await new Promise(r => setTimeout(r, 1500));
            const name = await BM.branchChat(SillyTavern.getContext().chat.length - 1);
            await new Promise(r => setTimeout(r, 5000));
            return { name, chat: SillyTavern.getContext().chatId, name1: SillyTavern.getContext().name1 };
        });
        ok('1b. the branch is open, SillyTavern picked Ren while opening it', !!r6.name && r6.chat === r6.name && r6.name1 === 'Ren', JSON.stringify(r6));
        ok('1b. the branch took one copy of the Orbit (two stores: the chat\'s and the branch\'s)', stores() === 2, String(stores()));
        const branchFile = path.join(dirs.chats, `${r6.name}.jsonl`), parentRef = header(mine).chat_metadata?.narrative_archive?.liveRef?.id, branchRef = fs.existsSync(branchFile) ? header(branchFile).chat_metadata?.narrative_archive?.liveRef?.id : '';
        ok('1b. the branch points to its own copy, the chat to its own', !!branchRef && branchRef !== parentRef && parentRef === r1.id && fs.existsSync(path.join(orbit, branchRef)), JSON.stringify({ parentRef, branchRef }));
        ok('1b. the branch remembers Ren', fs.existsSync(branchFile) && header(branchFile).chat_metadata?.narrative_archive?.stPersona === 'ren.png');
        // ---- 2. a group chat, a persona connected to the group
        const r3 = await page.evaluate(async own => {
            const P = await import('/scripts/personas.js'), SC = await import('/script.js'), GC = await import('/scripts/group-chats.js');
            const c = SillyTavern.getContext(), h = c.getRequestHeaders();
            const g = await (await fetch('/api/groups/create', { method: 'POST', headers: h, body: JSON.stringify({ name: 'Check group', members: [own.avatar], avatar_url: '', allow_self_responses: false, activation_strategy: 0, generation_mode: 0, disabled_members: [], fav: false, chat_id: 'grp-check', chats: ['grp-check'] }) })).json();
            c.powerUserSettings.persona_descriptions['ren.png'].connections = [{ type: 'group', id: g.id }];
            c.saveSettingsDebounced();
            await P.setUserAvatar('user-default.png');
            await SC.getCharacters();
            await GC.openGroupById(g.id);
            await new Promise(r => setTimeout(r, 3000));
            return { id: g.id, group: SillyTavern.getContext().groupId, name1: SillyTavern.getContext().name1 };
        }, own);
        ok('2. the group chat is open, SillyTavern picked Ren for it', r3.group === r3.id && r3.name1 === 'Ren', JSON.stringify(r3));
        const r4 = await begin(custom_url);
        ok('2. the group\'s Orbit kept, its kit names the group', r4.state === 'ok' && r4.kit.chat.group?.id === r3.id && r4.kit.chat.file?.group === true, JSON.stringify(r4.kit.chat));
        await page.waitForTimeout(2500);
        ok('2. three Orbit stores now (one per chat)', stores() === 3, String(stores()));
        const t2 = await serverReply();
        ok('2. the server answered in the group', !!t2);
        ok('2. … as Ren, with her card', /\[PERSONA — Ren\]\nRen is a student\./.test(t2) && /\[Seraphina's card\]\n\[description\]\nSeraphina is a pilot now\./.test(t2), (t2.match(/\[PERSONA[^\n]*\n[^\n]*/) || [''])[0]);
        // ---- 3. her card deleted, her chats kept (SillyTavern's default)
        const r5 = await page.evaluate(async ({ own, id }) => {
            const h = SillyTavern.getContext().getRequestHeaders();
            const del = await fetch('/api/characters/delete', { method: 'POST', headers: h, body: JSON.stringify({ avatar_url: own.avatar, delete_chats: false }) });
            const st = await (await fetch('/api/plugins/narrative-archive/auto/status', { method: 'POST', headers: h, body: JSON.stringify({ id }) })).json();
            return { del: del.status, st };
        }, { own, id: r1.id });
        ok('3. her chat with its Orbit is refused: no card', r5.del === 200 && r5.st.rooms?.[0]?.can === false && r5.st.rooms[0].why === '이 채팅의 캐릭터를 더 이상 사용할 수 없습니다.', JSON.stringify(r5));
        ok('no errors from the extension on the page', errors.filter(e => !/Internal S/.test(e)).length === 0, errors.join(' || '));
    } catch (e) { fail++; log('THREW', String(e?.stack || e).slice(0, 600)); log(errors.join(' || ')); }
    finally {
        await browser.close(); st.kill('SIGTERM'); model.close(); await new Promise(r => setTimeout(r, 1500));
        for (const [k, f] of Object.entries(files)) fs.writeFileSync(f, kept[k]);
        for (const [k, d] of Object.entries(dirs)) putDir(d, keptDirs[k]);
        fs.rmSync(orbit, { recursive: true, force: true });
        log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
    }
})();
