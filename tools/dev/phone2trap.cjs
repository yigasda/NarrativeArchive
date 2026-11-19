// 점검 도구: phonedata.js에 남은 폰 2 갈림(실시간 폰 · 실시간 서랍이 폰 1 함수에 들어왔을 때 타는 줄)에 표시를 달아요.
// 표시가 달린 채로 실제 폰을 돌리면, 그 갈림을 탈 때마다 콘솔에 "[NA-TRAP] 이름"이 찍히고 window.__naTraps 에 쌓여요.
// 하는 일은 안 바뀌어요(표시만 찍고 원래 줄이 그대로 돌아요). 커밋하지 않아요.
//   켜기:  node tools/dev/phone2trap.cjs
//   끄기:  git checkout src/phonedata.js
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', '..', 'src', 'phonedata.js');
let s = fs.readFileSync(file, 'utf8');
if (s.includes('[NA-TRAP]')) { console.log('이미 켜져 있어요. 끄기: git checkout src/phonedata.js'); process.exit(0); }
const T = name => `{ const e = new Error('${name}'); console.error('[NA-TRAP] ${name}', e.stack); (globalThis.__naTraps ||= []).push('${name}: ' + String(e.stack).split('\\n').slice(2, 7).map(x => x.trim()).join(' < ')); }`;
const LIVE = 'if (isLivePhone(p) || Number.isInteger(m?.phoneUpto))';
const edits = [
    ["    if (typeof m?.phoneRecent !== 'function') return recentPhoneText(n, o);", x => `${x}\n    ${T('recentOf')}`],
    ['export const readUpto = (m, p) => (Number.isInteger(m?.phoneUpto) ? m.phoneUpto : phoneAt(p));', () => `export const readUpto = (m, p) => { if (Number.isInteger(m?.phoneUpto)) ${T('readUpto')} return (Number.isInteger(m?.phoneUpto) ? m.phoneUpto : phoneAt(p)); };`],
    ['export const readMark = g => { if (Number.isInteger(g?.mark)) return', x => `export const readMark = g => { if (Number.isInteger(g?.mark)) ${T('readMark')} if (Number.isInteger(g?.mark)) return`],
    [`    ${LIVE} return String(new Date().getFullYear() + (Number(p?.liveYearShift) || 0));`, x => `    ${LIVE} ${T('storyYear')}\n${x}`],
    [`    ${LIVE} { let t = '';`, x => `    ${LIVE} ${T('storyNow')}\n${x}`],
    [`    ${LIVE} return [];`, x => `    ${LIVE} ${T('fillClockRows')}\n${x}`],
    [`export const statusAt = (p, upto = null, m = null) => { ${LIVE} return null;`, x => `export const statusAt = (p, upto = null, m = null) => { ${LIVE} ${T('statusAt')} ${LIVE} return null;`],
];
for (const [old, make] of edits) {
    if (s.split(old).length !== 2) { console.error('줄을 못 찾았어요 (이미 지워졌거나 바뀌었어요):', old.slice(0, 70)); process.exit(1); }
    s = s.replace(old, make(old));
}
fs.writeFileSync(file, s);
console.log(`표시 ${edits.length}개를 달았어요. 실제 폰을 돌린 뒤 콘솔의 [NA-TRAP] 또는 window.__naTraps 를 봐 주세요. 끄기: git checkout src/phonedata.js`);
