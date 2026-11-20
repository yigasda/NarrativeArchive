// 폰 2(실시간)가 앱 요청을 만드는 뼈대. phonedata.js의 windowOf · readMark · sideRequest에서 실시간 쪽만 옮긴 거예요.
//   이야기: 실시간 폰이 가진 요약본의 글 (phone2snap.js). 롤플 채팅은 읽지 않아요.
//   최근 대화: 메신저 대화 (자리가 남으면 그 앞에 요약본에 든 이야기의 마지막 메시지).
//   읽은 자리: 메신저 번호로 적어요 (반영이 읽은 데까지).
//   연도: 실시간 폰의 연도 (phone2year.js).
// 폰 1 파일은 여기서 읽기만 해요.
import { ownerProfileBlock } from './phoneprofile.js';
import { ctx } from './core.js';
import { nameKey } from './people.js';
import { worldText } from './world.js';
import { rememberStory } from './phoneparse.js';
import { phoneAt, nowAt, markAfter, loreFor, archiveFor, blindBlock, namesBlock, ownerClock } from './phonedata.js';
import { isLiveMeta, liveAtYear } from './phone2store.js';
import { liveStoryYear } from './phone2year.js';

export const needLive = m => { if (!isLiveMeta(m)) throw new Error('실시간 폰의 서랍이 아니에요'); return m; };

// 실시간 폰의 이야기 요약본 (phone2snap.js): 이야기에서 시작한 폰이 가진 것. 처음부터 시작한 폰은 없어요(null)
export const liveSnapOf = m => { const s = m?.phoneSnap; return s && typeof s === 'object' ? s : null; };
// 요청을 만들기 전에: 이야기에서 시작한 폰은 요약본이 있어야 움직여요. 없으면(요약본 방식 전에 시작해 둔 폰 · 분기한
// 방에서 저절로 다시 시작한 폰) 지금 만들어 넣고(서랍의 phoneStoryReady), 못 만들면 요청을 보내지 않아요.
export async function liveStoryReady(m) {
    needLive(m);
    if (!(m.phoneUpto >= 0) || liveSnapOf(m)) return;
    if (typeof m.phoneStoryReady === 'function') await m.phoneStoryReady();
    if (!liveSnapOf(m)) throw new Error('이야기 요약본을 만들지 못했어요. 잠시 뒤 다시 해 주세요');
}
// 최근 대화: 메신저 대화, 줄 수와 글자 수가 남으면 그 앞에 요약본에 든 이야기의 마지막 메시지
export function liveRecentText(m, owner, n, o = {}) {
    const talk = typeof m?.phoneRecent === 'function' ? m.phoneRecent(owner, n, o) : '', k = talk ? talk.split('\n').length : 0, room = (o.maxChars ?? Infinity) - talk.length;
    const before = k < n && room > 0 ? liveBefore(m, n - k, room) : '';
    return [before, talk].filter(Boolean).join('\n\n');
}
// 요약본에 든 이야기의 마지막 메시지, 끝에서 n개 · 글자 수 안에서 (통째로만)
export function liveBefore(m, n, maxChars = Infinity) {
    const snap = liveSnapOf(m);
    if (!snap || !(n > 0)) return '';
    const out = [];
    let room = Math.max(0, maxChars);
    for (const t of (Array.isArray(snap.recent) ? snap.recent : []).slice(-n).reverse()) {
        if (out.length) room -= 2;
        if (room <= 0 || t.length > room) break;
        out.unshift(t); room -= t.length;
    }
    return out.join('\n\n');
}
// 요청에 싣는 이야기 글: 요약본의 글 전부(끝의 STATE · OPEN까지). after: 이 번호보다 뒤의 장면만
export const liveArchiveFor = (m, after = -1) => archiveFor(m, after, null);
// 요청이 롤플 채팅에서 읽는 범위: 없어요 (이야기는 요약본에 다 있어요).
// mark: 이 폰이 읽은 자리 (메신저 번호). 아직 반영한 적 없는 폰은 메신저 번호가 시작하는 곳, 채팅에서 가져온 말이
// 있으면(phone2import.js) 그 말 뒤예요: 가져온 말은 이미 읽은 것으로 쳐요
export const liveWindowOf = (m, p = null) => { const base = needLive(m).phoneUpto, from = Number.isInteger(m.phoneReadFrom) ? Math.max(base, m.phoneReadFrom) : base; return { none: true, n: 0, all: true, upto: -1, later: false, mark: Math.max(base, phoneAt(p) ?? from) }; };
// 앱이 읽은 자리로 적을 표시: 메신저 번호 (없으면 폰 1과 같은 방법)
export const liveReadMark = g => { if (Number.isInteger(g?.mark)) return { index: g.mark, user: -1, fp: '', tail: '' }; const i = nowAt(g); return i == null ? null : markAfter(i); };
// 채우기가 쓰는 "폰의 지금": 폰에 저장된 시각 (마지막 반영이 맞춘 것). 롤플 상태창은 안 읽어요
export const liveSavedNow = p => p?.now || '';
// 채우기 요청의 OWNER'S CLOCK: 실시간 폰에는 롤플 상태창도, 시각을 읽을 롤플 메시지도 없어요
// (the block works out weekdays and summer time from p.year: for a time on the running clock that has passed New Year
// since the phone's saved time, the year after)
export const liveFillClock = (m, p, at, opts = {}) => liveAtYear(p, at, () => ownerClock(p, at, m, null, [], opts));
// 모델에게 알려 주는 연도
export const liveYearBlock = (m, p) => { const y = liveStoryYear(m, p); return y ? `[STORY YEAR]\n${y}` : ''; };

// story: 폰 1의 것 (아카이브가 없을 때 채팅을 대신 싣는 양). 실시간에서는 안 써요: 받기만 해요
// read: an object to put what was read in ({ gap }), for a request whose app marks where it read up to
export async function liveSideRequest(m, owner, blocks, { profile, money = false, read = null } = {}) {
    await liveStoryReady(m);
    const world = worldText(m), lore = await loreFor(m, owner, profile?.type === 'lore' ? profile : null);
    const profileText = await ownerProfileBlock(ctx(),profile,owner,{money});
    const ph = m.phones?.[nameKey(owner)] || null, gap = read && 'gap' in read ? read.gap : liveWindowOf(m, ph), upto = nowAt(gap);
    // (폰 2, a request whose app marks where it read: only the talk the reflection has read, so nothing is taken twice)
    // (폰 2, an app being filled: it marks all the reflected talk as known, so it is shown that talk and not six lines of it)
    const fill = !!read && Number.isInteger(gap?.mark), lines = fill ? 150 : 6, chars = fill ? 12000 : 6000;
    const recent = liveRecentText(m, owner, lines, { upto, maxChars: chars, ...(fill ? { seen: gap.mark, summary: true } : {}) });
    if (read) read.gap = gap;
    // (폰 2: the story is its snapshot's text and nothing else; the role-play chat never stands in for it)
    const arch = `[ARCHIVE]\n${liveArchiveFor(m, -1).text || '(empty)'}`;
    const chat = recent ? `[RECENT CHAT]\n${recent}` : '';
    const tales = [arch, world ? `[WORLD]\n${world}` : '', lore ? `[LOREBOOK]\n${lore}` : '', chat];
    const input = [...tales, liveYearBlock(m, ph), `[OWNER]\n${owner}`, profileText, blindBlock(m, owner), ...blocks, namesBlock(m)].filter(Boolean).join('\n\n');
    // (the story part as it went in, for evidence: storyPart)
    return rememberStory(input, [...tales, profileText].filter(Boolean).join('\n\n'));
}
