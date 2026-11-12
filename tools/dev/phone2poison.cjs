// 폰 2 함정 (실제 폰): 폰 1 모든 칸에 POISON1을 넣고 실시간으로 모든 화면 · 버튼을 돌려요. 화면에 POISON1이 나오면 실패, 폰 1 칸이 바뀌면 실패. 끝나면 테스트 채팅을 되돌려요.
// node tools/dev/phone2poison.cjs <사진 폴더>
const { open, SAMPLE_MONEY } = require('./probe.cjs');
const fs = require('fs'), CHAT = require('path').join(require('os').homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl'), reset = () => fs.copyFileSync(require('path').join(__dirname, 'na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const VIEWS = 'lock home home2 acct alarm bank bankmore banknote banksend call callmiss callwho calone cam clock contact contacts dcart diary diaryone ditem dorder dpay draft drate dshop file fixed folder groupinfo hcmp health invest ivactivity ivschedule ivnotes ivhistory stock ivwatch ivstakes ivcash ivprices mail mailone map mapq noteone note order pass photo photoone search cal set setdate setlore setplace setprofile settheme setvoice setvoiceadd setwho shop sns snspost stime stmt thread tx txdoc voice voiceone wallet card track weather wlist wcity msg page tabs marks history files delivery dorders'.split(' ');
(async () => { const o = process.argv[2]; const s = await open('light', { out: o });
  await s.run(SAMPLE_MONEY);
  // 2) a 폰 2 world from a clean copy of Mara's phone (before any poison), 3) 폰 1 poisoned everywhere
  await s.run(async ({ m, arg }) => {
    const st = await import(arg + 'phone2store.js');
    const clean = structuredClone(m.phones.mara);
    const skip = /^(date|time|now|at|id|kind|currency|last4|status|account|until|asOf|fxDate|owner|from|to|app|key|type|country|lives|city|tz|zone|icon|color|theme|v|order|sync)$/i;
    const walk = (o, d = 0) => { if (!o || typeof o !== 'object' || d > 12) return; for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && v && !skip.test(k)) o[k] = v + ' POISON1'; else walk(v, d + 1); } };
    for (const p of Object.values(m.phones)) walk(p);
    m.finance = m.finance || {}; walk(m.finance); m.finance.poison = 'POISON1';
    m.phoneProfiles = { ...(m.phoneProfiles || {}), mara: { label: 'POISON1 profile', type: 'lore' } }; walk(m.phoneProfiles);
    m.phonePre = { ...(m.phonePre || {}), mara: { owner: 'Mara', note: 'POISON1 pre' } };
    m.phoneLore = ['POISON1 Book']; m.phoneLoreOff = { 'POISON1 Book': ['POISON1 entry'] };
    m.text = (m.text || '') + '\n\n## POISON1 장\n- POISON1 Kim이 POISON1 시에 왔어요.';
    m.phoneScreenHolder = 'POISON1';
    st.startFresh(m, { persona: 'Ren' });
    clean.owner = 'Lena'; st.putLivePhone(m, clean);
    await arg.saveMeta?.();
  }, B);
  await s.run(async ({ core }) => core.saveMeta());
  const snap = () => s.run(async ({ m }) => { const { live, ...rest } = m; return JSON.stringify(rest); });
  const base = await snap();
  await s.to('set'); await s.p.click('.na_ph_pmode[data-v=live]'); await s.p.waitForTimeout(600);
  const hits = []; const seen = async v => { const t = await s.p.evaluate(() => document.querySelector('.na_phone')?.innerText + ' ' + (document.querySelector('.na_phone')?.innerHTML || '')); if (/POISON1/.test(t)) hits.push(v); };
  for (const v of VIEWS) { for (const i of [undefined, '0', '1']) { await s.to(v, i); await seen(v + (i ? ':' + i : '')); } }
  await s.to('set'); await s.shot('pz_set'); await s.to('setlore'); await s.shot('pz_lore'); await s.to('bank'); await s.shot('pz_bank'); await s.to('cal'); await s.shot('pz_cal'); await s.to('map'); await s.p.waitForTimeout(800); await s.shot('pz_map');
  // 4) tap every button on the settings screens (and the 인물 sheet), coming back to the screen each time
  let taps = 0, reopened = 0;
  const go = async v => { if (!await s.p.$('.na_ph_frame .na_ph_scr')) { reopened++; await s.p.evaluate(B => import(B + 'phone.js').then(x => { x.openPhone(); }), B); await s.p.waitForSelector('.na_ph_frame .na_ph_scr', { timeout: 15000 }); await s.p.waitForTimeout(400); } await s.to(v); };
  for (const v of ['set', 'setdate', 'setplace', 'setlore', 'setwho', 'setprofile', 'settheme', 'setvoice', 'home', 'bank', 'wallet', 'cal', 'map', 'weather', 'contacts', 'msg']) {
    await go(v); const n = await s.p.evaluate(() => document.querySelectorAll('.na_ph_frame :is(button, [role=button], label, .ax_sw):not(.na_ph_quit):not([data-v=story])').length);
    for (let k = 0; k < Math.min(n, 40); k++) {
      await go(v);
      await s.p.evaluate(k => { const b = [...document.querySelectorAll('.na_ph_frame :is(button, [role=button], label, .ax_sw):not(.na_ph_quit):not([data-v=story])')][k]; b?.click(); }, k);
      await s.p.waitForTimeout(250); taps++;
      await seen('tap ' + v + '#' + k);
      for (let e = 0; e < 2; e++) { if (await s.p.$('.pcf_ok, .na_ask, dialog[open] .na_sheet')) await s.p.keyboard.press('Escape'); }
    }
  }
  await go('setwho'); await s.p.evaluate(() => document.querySelector('.na_ph_pick, .ax_whopick')?.click()); await s.p.waitForTimeout(300);
  const after = await snap();
  const live = await s.run(async ({ m }) => ({ mode: m.live.mode, world: JSON.stringify(m.live.world).includes('POISON1') }));
  console.log(JSON.stringify({ hits: [...new Set(hits)].slice(0, 30), nHits: hits.length, taps, reopened, same: base === after, live }));
  if (base !== after) { const a = JSON.parse(base), b = JSON.parse(after); for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log('diff', k, JSON.stringify(a[k])?.slice(0, 200), '→', JSON.stringify(b[k])?.slice(0, 200)); }
  // 5) back to 타임라인
  await go('set'); await s.p.click('.na_ph_pmode[data-v=story]'); await s.p.waitForTimeout(500); await s.shot('pz_back_set'); await s.to('bank'); await s.shot('pz_back_bank'); await s.to('home'); await s.shot('pz_back_home');
  const back = await s.p.evaluate(() => document.querySelector('.na_phone').innerText.includes('POISON1'));
  console.log('timeline shows its own (POISON1) again:', back, s.errors().slice(0, 5));
  await s.close(); reset(); })().catch(e => { console.error(e); reset(); process.exit(1); });
