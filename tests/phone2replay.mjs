// 저장해 둔 모델 답을 폰 2 반영(updateLive)에 그대로 다시 넣어 봐요. 모델은 안 불러요.
//   node tests/phone2replay.mjs <case.json>
// case.json (저장소 밖에 둬요):
//   { "owner": "Mara", "persona": "Ren", "tz": "Asia/Seoul",
//     "phone": { …반영 전의 폰… },
//     "messages": [{ "from": "Ren", "text": "…", "at": "2026-11-11T07:50:00+09:00", "state": "…", "does": [{ "app": "Bank", "what": "…" }] }],
//     "core": [ …core 답(구간마다 하나, 글 또는 JSON)… ], "money": [ …money 답… ] }
// 찍는 것: 구간마다 요청에 간 메신저 줄 수 · 반영 결과(syncLast), 끝에 앱마다 들어간 기록.
import { readFile } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import { migrateBank, cash } from '../src/finance.js';
import { R, T } from './phone2reflect.load.mjs';

const file = process.argv[2];
if (!file) { console.error('쓰는 법: node tests/phone2replay.mjs <case.json>'); process.exit(2); }
const c = JSON.parse(await readFile(file, 'utf8'));
const real = { phones: {} };
L.startFresh(real, { persona: c.persona });
const m = L.liveMeta(real);
m.phones = { [L.liveKey(c.owner)]: structuredClone(c.phone) };
const p = m.phones[L.liveKey(c.owner)];
if (p.money) migrateBank(m, p);
const room = L.ensureRoom(real, [c.owner]), w = L.liveWorld(real);
for (const x of c.messages) room.messages.push({ id: `m${room.messages.length + 1}`, n: L.liveNo(w), from: x.from, text: x.text || '', at: typeof x.at === 'number' ? x.at : Date.parse(x.at), ...(x.state ? { state: x.state } : {}), ...(x.does ? { does: x.does } : {}), ...(x.act ? { act: true } : {}) });
T.answers = [...(c.core || [])]; T.moneyAnswers = [...(c.money || [])];
const sizes = () => Object.fromEntries(['contacts', 'threads', 'calls', 'photos', 'notes', 'searches', 'events', 'posts', 'mails', 'diary', 'voice', 'visits'].map(k => [k, (p[k] || []).length]).filter(([, n]) => n));
console.log('반영 전:', JSON.stringify(sizes()));
let round = 0, calls = 0;
while (T.answers.length) {
    T.calls = 0;
    const got = await R.updateLive(real, m, c.owner, { tz: c.tz || 'UTC' });
    if (!got) { console.log('남은 대화가 없어요 (안 쓴 core 답', T.answers.length, '개)'); break; }
    calls += T.calls; round++;
    const last = p.syncLast;
    console.log(`\n구간 ${round}: 메시지 ${last.checked}개 확인 · 남은 ${last.remaining}개 · 폰 시각 ${p.now}`);
    console.log('  넣은 앱:', last.apps.join(' · ') || '(없음)');
    for (const f of last.failed) console.log('  실패:', f.at === null ? '' : `#${f.at}`, f.why);
    for (const n of last.notes) console.log('  알림:', n);
    for (const ch of last.changes) console.log('  돈:', ch.app, ch.what, ch.amount);
}
console.log('\n반영 후:', JSON.stringify(sizes()));
for (const [k, a] of Object.entries(m.finance?.accounts || {})) console.log('  계좌', k, cash(a));
for (const x of p.money?.tx || []) console.log('  거래', x.time, x.who, x.amount);
for (const x of p.notes || []) console.log('  메모', x.title);
for (const x of p.searches || []) console.log('  검색', x.q);
for (const x of p.mails || []) console.log('  메일', x.from, '·', x.subject);
for (const x of p.life?.files?.items || []) console.log('  파일', x.name);
for (const x of p.delivery?.orders || []) console.log('  배달', x.shop, x.total ?? '');
for (const t of p.threads || []) console.log('  문자', t.with, t.messages.length);
console.log('  상황', (p.situations || []).length, '개 · core 요청', calls, '번(모두 저장된 답)');
