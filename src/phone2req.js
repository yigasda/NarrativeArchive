// 폰 2(실시간)가 앱 요청을 만드는 뼈대. phonedata.js의 windowOf · readMark · sideRequest에서 실시간 쪽만 옮긴 거예요.
//   읽는 범위: 롤플은 실시간 폰을 시작한 곳(서랍의 phoneUpto)까지만. 그 뒤 롤플은 실시간 폰의 것이 아니에요.
//   최근 대화: 메신저 대화 (자리가 남으면 그 앞에 시작 전 이야기).
//   읽은 자리: 메신저 번호로 적어요 (반영이 읽은 데까지).
//   연도: 실시간 폰의 연도 (phone2year.js).
// 폰 1 파일은 여기서 읽기만 해요.
import { ownerProfileBlock } from './phoneprofile.js';
import { ctx } from './core.js';
import { nameKey } from './people.js';
import { worldText } from './world.js';
import { rememberStory } from './phoneparse.js';
import { recentPhoneText, CHAT_TOKENS, MORE_TOKENS, noArchive, chatAfterArchive, phoneAt, nowAt, markAfter, loreFor, archiveBlock, archiveFor, afterBlock, blindBlock, namesBlock, ownerClock, toldShort } from './phonedata.js';
import { isLiveMeta } from './phone2store.js';
import { liveStoryYear } from './phone2year.js';

export const needLive = m => { if (!isLiveMeta(m)) throw new Error('실시간 폰의 서랍이 아니에요'); return m; };

// 최근 대화: 메신저 대화, 줄 수와 글자 수가 남으면 그 앞에 시작 전 이야기의 마지막 메시지
export function liveRecentText(m, owner, n, o = {}) {
    const talk = typeof m?.phoneRecent === 'function' ? m.phoneRecent(owner, n, o) : '', k = talk ? talk.split('\n').length : 0, room = (o.maxChars ?? Infinity) - talk.length;
    const before = k < n && room > 0 && Number.isInteger(m?.phoneUpto) && m.phoneUpto >= 0 ? recentPhoneText(n - k, { maxChars: room, upto: m.phoneUpto }) : '';
    return [before, talk].filter(Boolean).join('\n\n');
}
// 요청이 롤플에서 읽는 범위: 아카이브 뒤부터 실시간 폰을 시작한 곳까지. 그 뒤는 없어요(later: false).
// mark: 이 폰이 읽은 자리 (메신저 번호; 아직 반영한 적 없으면 시작한 곳)
export const liveWindowOf = (m, p = null, from = null, budget = CHAT_TOKENS.phone, whole = true) => { const upto = needLive(m).phoneUpto; return { ...(noArchive(m) ? { none: true, n: 0, all: true, upto } : chatAfterArchive(m, budget, upto, from, whole)), later: false, mark: Math.max(upto, phoneAt(p) ?? upto) }; };
// 앱이 읽은 자리로 적을 표시: 메신저 번호 (없으면 폰 1과 같은 방법)
export const liveReadMark = g => { if (Number.isInteger(g?.mark)) return { index: g.mark, user: -1, fp: '', tail: '' }; const i = nowAt(g); return i == null ? null : markAfter(i); };
// 채우기가 쓰는 "폰의 지금": 폰에 저장된 시각 (마지막 반영이 맞춘 것). 롤플 상태창은 안 읽어요
export const liveSavedNow = p => p?.now || '';
// 채우기 요청의 OWNER'S CLOCK: 실시간 폰에는 롤플 상태창도, 시각을 읽을 롤플 메시지도 없어요
export const liveFillClock = (m, p, at, opts = {}) => ownerClock(p, at, m, null, [], opts);
// 두 번째 차례의 읽는 범위 (시작 전 이야기가 길 때): 폰 1과 같은 계산, 읽는 범위만 실시간 것
export function liveSecondTurn(m, p, first, whole = true) {
    if (!first || first.all) return null;
    const more = liveWindowOf(m, p, first.to, MORE_TOKENS, whole);
    if (!more?.n) return null;
    const short = more.all ? null : toldShort(p, more.to, more.upto);
    return { more, short, cover: short ? { ...more, all: true } : more };
}
// 모델에게 알려 주는 연도
const liveYearBlock = (m, p) => { const y = liveStoryYear(m, p); return y ? `[STORY YEAR]\n${y}` : ''; };

// story: how many tokens of chat stand in for a missing archive (0: the recent chat only, as with an archive)
// read: an object to put what was read in ({ gap }), for a request whose app marks where it read up to
export async function liveSideRequest(m, owner, blocks, { profile, money = false, story = 0, read = null } = {}) {
    needLive(m);
    const world = worldText(m), lore = await loreFor(m, owner, profile?.type === 'lore' ? profile : null);
    const profileText = await ownerProfileBlock(ctx(),profile,owner,{money});
    const ph = m.phones?.[nameKey(owner)] || null, gap = read && 'gap' in read ? read.gap : liveWindowOf(m, ph), upto = nowAt(gap);
    // (폰 2, a request whose app marks where it read: only the talk the reflection has read, so nothing is taken twice)
    // (폰 2, an app being filled: it marks all the reflected talk as known, so it is shown that talk and not six lines of it)
    const fill = !!read && Number.isInteger(gap?.mark), lines = fill ? 150 : 6, chars = fill ? 12000 : 6000;
    const recent = liveRecentText(m, owner, lines, { upto, maxChars: chars, ...(fill ? { seen: gap.mark, summary: true } : {}) });
    if (read) read.gap = gap;
    const arch = archiveBlock(m, archiveFor(m, -1, upto).text || '(empty)', 'ARCHIVE', story, upto), talk = gap?.n && typeof m?.phoneRecent === 'function' ? m.phoneRecent(owner, lines, { maxChars: chars, ...(fill ? { seen: gap.mark, summary: true } : {}) }) : '';
    // (폰 2: the story after the archive up to where it began, then the messenger's talk, in the one block)
    const chat = (afterBlock(gap) ? `${afterBlock(gap)}${talk ? `\n\n${talk}` : ''}` : '') || (recent && !(story && noArchive(m)) ? `[RECENT CHAT]\n${recent}` : '');
    const tales = [arch, world ? `[WORLD]\n${world}` : '', lore ? `[LOREBOOK]\n${lore}` : '', chat];
    const input = [...tales, liveYearBlock(m, ph), `[OWNER]\n${owner}`, profileText, blindBlock(m, owner), ...blocks, namesBlock(m)].filter(Boolean).join('\n\n');
    // (the story part as it went in, for evidence: storyPart)
    return rememberStory(input, [...tales, profileText].filter(Boolean).join('\n\n'));
}
