// 스크린타임: what the phone's owner does with it, day by day. The model writes their usual (who they really are) and each
// day's use from what happened (life.health.usual.screen, life.health.days[].screen); a day it left out is worked out
// here from their usual, that day's texts, calls and photos, and how they slept. The screens read screenView() only.

const KINDS = ['chat', 'social', 'game', 'video', 'music', 'work', 'reading', 'shopping', 'other'];
export const KIND_KO = { chat: '메신저', social: '소셜', game: '게임', video: '동영상', music: '음악', work: '업무', reading: '읽기', shopping: '쇼핑', other: '기타' };
// the apps the phone knows (each has its icon): [id, the name the screen shows, kind, other names people write for it].
// The fill picks from these; a name written another way ("인스타", "카톡") is this app
const CATALOG = [
    ['kakaotalk', 'KakaoTalk', 'chat', '카카오톡 카톡 kakao'], ['whatsapp', 'WhatsApp', 'chat', '왓츠앱 왓츠앱'], ['line', 'LINE', 'chat', '라인'], ['telegram', 'Telegram', 'chat', '텔레그램'],
    ['signal', 'Signal', 'chat', '시그널'], ['messenger', 'Messenger', 'chat', 'facebookmessenger 메신저 페북메신저'], ['discord', 'Discord', 'chat', '디스코드'],
    ['messages', '메시지', 'chat', 'messages message imessage sms 문자 메세지 nachrichten'], ['wechat', 'WeChat', 'chat', '微信 위챗'],
    ['instagram', 'Instagram', 'social', 'insta 인스타 인스타그램'], ['x', 'X', 'social', 'twitter 트위터 엑스'], ['threads', 'Threads', 'social', '스레드 쓰레드'], ['tiktok', 'TikTok', 'social', '틱톡 抖音'],
    ['facebook', 'Facebook', 'social', '페이스북 페북'], ['snapchat', 'Snapchat', 'social', '스냅챗'], ['reddit', 'Reddit', 'social', '레딧'], ['pinterest', 'Pinterest', 'social', '핀터레스트'], ['bereal', 'BeReal.', 'social', '비리얼'],
    ['youtube', 'YouTube', 'video', '유튜브 유툽'], ['netflix', 'Netflix', 'video', '넷플릭스 넷플'], ['disney', 'Disney+', 'video', 'disneyplus 디즈니 디즈니플러스'], ['primevideo', 'Prime Video', 'video', 'amazonprime amazonprimevideo 프라임비디오'],
    ['twitch', 'Twitch', 'video', '트위치'], ['tving', 'TVING', 'video', '티빙'], ['coupangplay', '쿠팡플레이', 'video', 'coupangplay 쿠플'],
    ['spotify', 'Spotify', 'music', '스포티파이'], ['applemusic', 'Apple Music', 'music', '애플뮤직'], ['youtubemusic', 'YouTube Music', 'music', '유튜브뮤직 유튭뮤직'], ['melon', 'Melon', 'music', '멜론'], ['soundcloud', 'SoundCloud', 'music', '사운드클라우드'],
    ['brawlstars', 'Brawl Stars', 'game', '브롤스타즈 브롤'], ['clashroyale', 'Clash Royale', 'game', '클래시로얄 클래시로열'], ['candycrush', 'Candy Crush', 'game', 'candycrushsaga 캔디크러시 캔디크러쉬'],
    ['minecraft', 'Minecraft', 'game', '마인크래프트 마크'], ['roblox', 'Roblox', 'game', '로블록스'], ['pokemongo', 'Pokémon GO', 'game', '포켓몬고'], ['genshin', 'Genshin Impact', 'game', 'genshin 원신'],
    ['lol', 'League of Legends', 'game', 'lol 롤 리그오브레전드 leagueoflegendswildrift wildrift 와일드리프트'], ['pubg', 'PUBG', 'game', 'pubgmobile 배그 배틀그라운드 배그모바일'],
    ['chrome', 'Chrome', 'other', 'googlechrome 크롬'], ['safari', 'Safari', 'other', '사파리'], ['google', 'Google', 'other', '구글'], ['dbnavigator', 'DB Navigator', 'other', 'db'],
    ['phone', '전화', 'other', 'phone 전화 통화 telefon'], ['camera', '카메라', 'other', 'camera kamera'],
    ['naver', 'NAVER', 'reading', '네이버'], ['kindle', 'Kindle', 'reading', '킨들'], ['webtoon', 'WEBTOON', 'reading', '웹툰 네이버웹툰 naverwebtoon linewebtoon'], ['kakaopage', '카카오페이지', 'reading', 'kakaopage 카카페'],
    ['ridi', 'RIDI', 'reading', 'ridibooks 리디 리디북스'], ['spiegel', 'SPIEGEL', 'reading', 'derspiegel spiegelonline 슈피겔'],
    ['gmail', 'Gmail', 'work', '지메일'], ['notion', 'Notion', 'work', '노션'], ['slack', 'Slack', 'work', '슬랙'], ['zoom', 'Zoom', 'work', '줌'], ['teams', 'Teams', 'work', 'microsoftteams 팀즈'], ['excel', 'Excel', 'work', 'microsoftexcel 엑셀'],
    ['github', 'GitHub', 'work', '깃허브 깃헙'], ['chatgpt', 'ChatGPT', 'work', 'gpt 챗gpt 챗지피티'], ['claude', 'Claude', 'work', '클로드'], ['gemini', 'Gemini', 'work', '제미나이 제미니'],
    ['coupang', 'Coupang', 'shopping', '쿠팡'], ['amazon', 'Amazon', 'shopping', '아마존'], ['zalando', 'Zalando', 'shopping', '잘란도'], ['musinsa', '무신사', 'shopping', 'musinsa'],
    ['baemin', '배달의민족', 'shopping', 'baemin 배민 배달의민족'], ['ubereats', 'Uber Eats', 'shopping', '우버이츠'], ['temu', 'Temu', 'shopping', '테무'], ['aliexpress', 'AliExpress', 'shopping', '알리 알리익스프레스'],
];
const norm = s => String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const BY_NAME = new Map();
for (const [id, name, kind, also] of CATALOG) for (const k of [name, id, ...also.split(' ')]) if (!BY_NAME.has(norm(k))) BY_NAME.set(norm(k), { id, name, kind });
// the app a name is ({ id for its icon, the name to show, kind }), or null for one the phone doesn't know
export const appOf = name => BY_NAME.get(norm(name)) || null;
// the list the fill picks from, a line for each kind (phone and camera come from the phone itself)
export const SCREEN_LIST = KINDS.map(k => [k, CATALOG.filter(a => a[2] === k && a[0] !== 'phone' && a[0] !== 'camera').map(a => a[1])]).filter(([, xs]) => xs.length).map(([k, xs]) => `${k}: ${xs.join(', ')}`).join('\n');
// an app the catalog doesn't know: its kind from its name
const GUESS = [
    ['chat', /kakao|카카오톡|카톡|whatsapp|line\b|telegram|signal|messenger|wechat|imessage|메시지|문자|discord|slack/i],
    ['social', /instagram|인스타|tiktok|틱톡|twitter|\bx\b|트위터|facebook|페이스북|threads|snapchat|reddit|bereal|weibo|小红书/i],
    ['video', /youtube|유튜브|netflix|넷플릭스|twitch|disney|tving|티빙|wavve|watcha|왓챠|prime video|bilibili/i],
    ['music', /spotify|멜론|melon|genie|지니|apple music|youtube music|flo\b|soundcloud/i],
    ['game', /game|게임|원신|genshin|롤|league|pubg|배그|brawl|clash|pokemon|포켓몬|candy|maple|메이플|blue archive|블루 ?아카|honkai|붕괴|starrail|fifa|valorant|minecraft|roblox/i],
    ['work', /slack|notion|노션|teams|outlook|gmail|메일|mail|zoom|calendar|캘린더|excel|word|docs|sheets|jira|figma/i],
    ['reading', /webtoon|웹툰|kindle|리디|ridi|밀리|millie|kakaopage|카카오페이지|news|뉴스|naver|네이버|medium/i],
    ['shopping', /coupang|쿠팡|amazon|zalando|무신사|musinsa|29cm|ably|에이블리|11번가|g마켓|taobao|aliexpress|배민|baemin|uber ?eats|요기요/i],
];
export const kindOfApp = (name, usual = []) => usual.find(a => a.app === name)?.kind || appOf(name)?.kind || GUESS.find(([, re]) => re.test(name))?.[0] || 'other';

const md = s => { const mt = String(s || '').match(/^(\d{2})-(\d{2})/); return mt ? { mo: Number(mt[1]), d: Number(mt[2]) } : null; };
const gap = (a, b) => { const A = md(a), B = md(b); if (!A || !B) return 0; let g = (Date.UTC(2001, B.mo - 1, B.d) - Date.UTC(2001, A.mo - 1, A.d)) / 864e5; if (g < -180) g += 365; if (g > 180) g -= 365; return g; };
const seeded = seed => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return (h % 10000) / 10000; }; };
const toMin = t => { const mt = String(t || '').match(/(\d{1,2}):(\d{2})/); return mt ? Number(mt[1]) * 60 + Number(mt[2]) : null; };
const hm = n => `${String(Math.floor(((n % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((n % 60) + 60) % 60).padStart(2, '0')}`;

// what the phone holds on a day: texts the owner wrote, minutes on calls, photos taken
function records(p, day) {
    const on = t => String(t || '').slice(0, 5) === day;
    const texts = (p.threads || []).reduce((n, t) => n + (t.messages || []).filter(x => on(x.time)).length, 0);
    const calls = (p.calls || []).filter(c => on(c.time)).reduce((n, c) => n + (Number(c.min) || 0), 0);
    const photos = (p.photos || []).filter(x => on(x.time)).length;
    return { texts, calls, photos };
}
// a day the model left out: their usual, a little more or less as days go, with what that day holds on top
function workedOut(p, day, usual, sleepDay) {
    const r = seeded(`${p.owner}:${day}:screen`), rec = records(p, day), apps = {};
    const wd = (() => { const x = md(day); return x ? new Date(Date.UTC(2001, x.mo - 1, x.d)).getUTCDay() : 3; })(), weekend = wd === 0 || wd === 6;
    for (const a of usual.apps || []) {
        const f = (0.7 + r() * 0.6) * (weekend && ['game', 'video', 'social'].includes(a.kind) ? 1.25 : weekend && a.kind === 'work' ? 0.3 : 1);
        const m = Math.round(a.min * f);
        if (m > 0) apps[a.app] = m;
    }
    const chat = (usual.apps || []).find(a => a.kind === 'chat')?.app;
    if (chat && rec.texts) apps[chat] = (apps[chat] || 0) + rec.texts * 2;
    if (rec.calls) apps['전화'] = (apps['전화'] || 0) + rec.calls;
    if (rec.photos) apps['카메라'] = (apps['카메라'] || 0) + rec.photos * 2;
    // a short night: they were up with the phone
    const slept = sleepDay ? ((toMin(sleepDay.wake) ?? 0) - (toMin(sleepDay.sleep) ?? 0) + 1440) % 1440 : null, short = slept !== null && slept < 6 * 60;
    const lateBase = toMin(usual.late) ?? 23 * 60 + 30, late = hm(lateBase + Math.round((r() - 0.4) * 50) + (short ? 70 : 0));
    const pickups = usual.pickups ? Math.round(usual.pickups * (0.8 + r() * 0.4) + rec.texts * 0.5) : null;
    return { apps, ...(pickups !== null ? { pickups } : {}), late, worked: true };
}
// the days to show: every health day up to today (today only counted so far, like steps), oldest first
export function screenView(p, today) {
    const h = p?.life?.health, usual = h?.usual?.screen;
    if (!h || (!usual && !(h.days || []).some(d => d.screen))) return null;
    const u = usual || { apps: [] }, rows = (h.days || []).filter(d => md(d.date) && (!today || gap(d.date, today) >= 0)).sort((a, b) => gap(b.date, a.date));
    const nowMin = toMin(String(today || '').slice(6)) ?? null, day0 = String(today || '').slice(0, 5);
    const days = rows.map(d => {
        const s = d.screen ? { ...d.screen, apps: { ...(d.screen.apps || {}) } } : workedOut(p, d.date, u, d);
        // today so far: the day's hours up to now
        if (d.date === day0 && nowMin !== null && !d.screen) { const f = Math.max(0.05, Math.min(1, nowMin / (22 * 60))); for (const k of Object.keys(s.apps)) s.apps[k] = Math.round(s.apps[k] * f); if (s.pickups) s.pickups = Math.round(s.pickups * f); delete s.late; }
        const byKind = Object.fromEntries(KINDS.map(k => [k, 0]));
        for (const [app, m] of Object.entries(s.apps || {})) byKind[app === '전화' || app === '카메라' ? 'other' : kindOfApp(app, u.apps)] += m;
        const total = Object.values(s.apps || {}).reduce((a, b) => a + b, 0);
        return { date: d.date, total, byKind, apps: Object.entries(s.apps || {}).sort((a, b) => b[1] - a[1]), pickups: s.pickups ?? null, late: s.late || '', from: d.screen ? 'story' : 'worked', today: d.date === day0 };
    });
    const done = days.filter(d => !d.today), week = done.slice(-7), before = done.slice(-14, -7);
    const avg = xs => (xs.length ? Math.round(xs.reduce((n, d) => n + d.total, 0) / xs.length) : null);
    const a = avg(week), b = avg(before), pct = a !== null && b ? Math.round((a - b) / b * 100) : null;
    const apps = {};
    for (const d of week) for (const [k, m] of d.apps) apps[k] = (apps[k] || 0) + m;
    const top = Object.entries(apps).sort((x, y) => y[1] - x[1]).map(([app, m]) => ({ app, icon: appOf(app)?.id || '', kind: kindOfApp(app, u.apps), avg: Math.round(m / Math.max(1, week.length)) }));
    const dur = n => `${Math.floor(n / 60) ? `${Math.floor(n / 60)}시간 ` : ''}${n % 60}분`.trim();
    const lines = [];
    if (a !== null) lines.push(`일평균 ${dur(a)}${pct !== null && Math.abs(pct) >= 5 ? `, 지난주보다 ${Math.abs(pct)}% ${pct > 0 ? '늘었어요' : '줄었어요'}` : ''}`);
    const y = done.at(-1);
    if (y?.late && toMin(y.late) < 5 * 60) lines.push(`어제 새벽 ${y.late}까지 폰을 봤어요`);
    if (top[0]) lines.push(`가장 많이 쓴 앱은 ${top[0].app}, 하루 ${dur(top[0].avg)}`);
    const pk = week.filter(d => d.pickups !== null), pickupsAvg = pk.length ? Math.round(pk.reduce((n, d) => n + d.pickups, 0) / pk.length) : null;
    return { days, avg: a, prevAvg: b, pct, top, pickupsAvg, lines, usual: u };
}
