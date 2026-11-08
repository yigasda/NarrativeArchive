// 스크린타임: what the phone's owner does with it, day by day. The model writes their usual (who they really are) and each
// day's use from what happened (life.health.usual.screen, life.health.days[].screen); a day it left out is worked out
// here from their usual, that day's texts, calls and photos, and how they slept. The screens read screenView() only.

const KINDS = ['chat', 'social', 'game', 'video', 'music', 'work', 'reading', 'shopping', 'money', 'maps', 'health', 'other'];
export const KIND_KO = { chat: '메신저', social: '소셜', game: '게임', video: '동영상', music: '음악', work: '업무', reading: '읽기', shopping: '쇼핑', money: '금융', maps: '지도 · 교통', health: '건강', other: '기타' };
// the apps the phone knows (each has its icon): [id, the name the screen shows, kind, other names people write for it].
// The fill picks from these; a name written another way ("인스타", "카톡") is this app
const CATALOG = [
    ['kakaotalk', 'KakaoTalk', 'chat', '카카오톡 카톡 kakao'], ['whatsapp', 'WhatsApp', 'chat', '왓츠앱 왓츠앱'], ['line', 'LINE', 'chat', '라인'], ['telegram', 'Telegram', 'chat', '텔레그램'],
    ['signal', 'Signal', 'chat', '시그널'], ['messenger', 'Messenger', 'chat', 'facebookmessenger 메신저 페북메신저'], ['discord', 'Discord', 'chat', '디스코드'],
    ['messages', '메시지', 'chat', 'messages message imessage sms 문자 메세지 nachrichten'], ['wechat', 'WeChat', 'chat', '微信 위챗'],
    ['instagram', 'Instagram', 'social', 'insta 인스타 인스타그램'], ['x', 'X', 'social', 'twitter 트위터 엑스'], ['threads', 'Threads', 'social', '스레드 쓰레드'], ['tiktok', 'TikTok', 'social', '틱톡'],
    ['facebook', 'Facebook', 'social', '페이스북 페북'], ['snapchat', 'Snapchat', 'social', '스냅챗'], ['reddit', 'Reddit', 'social', '레딧'], ['pinterest', 'Pinterest', 'social', '핀터레스트'], ['bereal', 'BeReal.', 'social', '비리얼'],
    ['youtube', 'YouTube', 'video', '유튜브 유툽'], ['netflix', 'Netflix', 'video', '넷플릭스 넷플'], ['disney', 'Disney+', 'video', 'disneyplus 디즈니 디즈니플러스'], ['primevideo', 'Prime Video', 'video', 'amazonprime amazonprimevideo 프라임비디오'],
    ['twitch', 'Twitch', 'video', '트위치'], ['tving', 'TVING', 'video', '티빙'], ['coupangplay', '쿠팡플레이', 'video', 'coupangplay 쿠플'],
    ['spotify', 'Spotify', 'music', '스포티파이'], ['applemusic', 'Apple Music', 'music', '애플뮤직'], ['youtubemusic', 'YouTube Music', 'music', '유튜브뮤직 유튭뮤직'], ['melon', 'Melon', 'music', '멜론'], ['soundcloud', 'SoundCloud', 'music', '사운드클라우드'],
    ['brawlstars', 'Brawl Stars', 'game', '브롤스타즈 브롤'], ['clashroyale', 'Clash Royale', 'game', '클래시로얄 클래시로열'], ['candycrush', 'Candy Crush', 'game', 'candycrushsaga 캔디크러시 캔디크러쉬'],
    ['minecraft', 'Minecraft', 'game', '마인크래프트 마크'], ['roblox', 'Roblox', 'game', '로블록스'], ['pokemongo', 'Pokémon GO', 'game', '포켓몬고'], ['genshin', 'Genshin Impact', 'game', 'genshin 원신'],
    ['lol', 'League of Legends', 'game', 'lol 롤 리그오브레전드 leagueoflegendswildrift wildrift 와일드리프트'], ['pubg', 'PUBG', 'game', 'pubgmobile 배그 배틀그라운드 배그모바일'],
    ['chrome', 'Chrome', 'other', 'googlechrome 크롬'], ['safari', 'Safari', 'other', '사파리'], ['google', 'Google', 'other', '구글'], ['dbnavigator', 'DB Navigator', 'maps', 'db'],
    ['phone', '전화', 'other', 'phone 전화 통화 telefon'], ['camera', '카메라', 'other', 'camera kamera'],
    ['naver', 'NAVER', 'reading', '네이버'], ['kindle', 'Kindle', 'reading', '킨들'], ['webtoon', 'WEBTOON', 'reading', '웹툰 네이버웹툰 naverwebtoon linewebtoon'], ['kakaopage', '카카오페이지', 'reading', 'kakaopage 카카페'],
    ['ridi', 'RIDI', 'reading', 'ridibooks 리디 리디북스'], ['spiegel', 'SPIEGEL', 'reading', 'derspiegel spiegelonline 슈피겔'],
    ['gmail', 'Gmail', 'work', '지메일'], ['notion', 'Notion', 'work', '노션'], ['slack', 'Slack', 'work', '슬랙'], ['zoom', 'Zoom', 'work', '줌'], ['teams', 'Teams', 'work', 'microsoftteams 팀즈'], ['excel', 'Excel', 'work', 'microsoftexcel 엑셀'],
    ['github', 'GitHub', 'work', '깃허브 깃헙'], ['chatgpt', 'ChatGPT', 'work', 'gpt 챗gpt 챗지피티'], ['claude', 'Claude', 'work', '클로드'], ['gemini', 'Gemini', 'work', '제미나이 제미니'],
    ['coupang', 'Coupang', 'shopping', '쿠팡'], ['amazon', 'Amazon', 'shopping', '아마존'], ['zalando', 'Zalando', 'shopping', '잘란도'], ['musinsa', '무신사', 'shopping', 'musinsa'],
    ['baemin', '배달의민족', 'shopping', 'baemin 배민 배달의민족'], ['ubereats', 'Uber Eats', 'shopping', '우버이츠'], ['temu', 'Temu', 'shopping', '테무'], ['aliexpress', 'AliExpress', 'shopping', '알리 알리익스프레스'],
];
// the apps the phone knows by name and icon but the fill isn't offered (its list stays short): the phone's own apps, and
// ones a day calls for (a trip, a payment, a date). A bank's app goes by any name (see appOf)
const MORE = [
    ['notes', '메모', 'other', 'notes memo memos notizen 노트'], ['maps', '지도', 'maps', 'maps map karten'], ['calendar', '캘린더', 'work', 'calendar kalender 달력'],
    ['photos', '사진', 'other', 'photos gallery 갤러리 fotos'], ['clock', '시계', 'other', 'clock uhr 알람'], ['weather', '날씨', 'other', 'weather wetter'],
    ['health', '건강', 'health', 'health 헬스 gesundheit'], ['files', '파일', 'other', 'files dateien'], ['wallet', '지갑', 'money', 'wallet 월렛'],
    ['bank', '은행', 'money', 'bank banking'], ['voicememo', '음성 메모', 'other', 'voicememos voicememo 녹음 음성메모 sprachmemos'], ['settings', '설정', 'other', 'settings einstellungen'],
    ['googlemaps', 'Google Maps', 'maps', '구글맵 구글지도'], ['applemaps', 'Apple 지도', 'maps', 'applemaps 애플지도'], ['navermap', '네이버 지도', 'maps', 'navermap navermaps 네이버맵'], ['kakaomap', '카카오맵', 'maps', 'kakaomap 카카오지도'],
    ['papago', 'Papago', 'other', '파파고'], ['googletranslate', 'Google 번역', 'other', 'googletranslate 구글번역 translate 번역'], ['deepl', 'DeepL', 'other', '딥엘'], ['duolingo', 'Duolingo', 'reading', '듀오링고'],
    ['kakaot', '카카오 T', 'maps', 'kakaot 카카오택시 카카오t'], ['uber', 'Uber', 'maps', '우버'], ['grab', 'Grab', 'maps', '그랩'], ['didi', 'DiDi', 'maps', '滴滴 디디'], ['korail', '코레일톡', 'maps', 'korail korailtalk 코레일'],
    ['trainline', 'Trainline', 'maps', ''], ['flixbus', 'FlixBus', 'maps', '플릭스버스'], ['bvg', 'BVG', 'maps', 'bvgfahrinfo'], ['tfl', 'TfL Go', 'maps', 'tfl tflgo'],
    ['airbnb', 'Airbnb', 'other', '에어비앤비'], ['booking', 'Booking.com', 'other', 'booking 부킹닷컴'], ['agoda', 'Agoda', 'other', '아고다'], ['expedia', 'Expedia', 'other', '익스피디아'],
    ['skyscanner', 'Skyscanner', 'other', '스카이스캐너'], ['lufthansa', 'Lufthansa', 'other', '루프트한자'], ['koreanair', '대한항공', 'other', 'koreanair'],
    ['toss', '토스', 'money', 'toss'], ['kakaopay', '카카오페이', 'money', 'kakaopay'], ['paypal', 'PayPal', 'money', '페이팔'], ['venmo', 'Venmo', 'money', ''], ['alipay', 'Alipay', 'money', '支付宝 알리페이'],
    ['paypay', 'PayPay', 'money', '페이페이'], ['applepay', 'Apple Wallet', 'money', 'applepay 애플페이 애플월렛'],
    ['robinhood', 'Robinhood', 'money', '로빈후드'], ['upbit', '업비트', 'money', 'upbit'], ['binance', 'Binance', 'money', '바이낸스'],
    ['doordash', 'DoorDash', 'shopping', '도어대시'], ['deliveroo', 'Deliveroo', 'shopping', ''], ['lieferando', 'Lieferando', 'shopping', ''], ['meituan', '美团', 'shopping', 'meituan 메이퇀'],
    ['starbucks', 'Starbucks', 'shopping', '스타벅스 스벅'], ['mcdonalds', "McDonald's", 'shopping', '맥도날드 맥날'],
    ['ebay', 'eBay', 'shopping', '이베이'], ['shein', 'SHEIN', 'shopping', '쉬인'], ['ikea', 'IKEA', 'shopping', '이케아'], ['oliveyoung', '올리브영', 'shopping', 'oliveyoung 올영'], ['kurly', '컬리', 'shopping', 'kurly 마켓컬리'],
    ['danggeun', '당근', 'shopping', 'danggeun karrot 당근마켓'], ['vinted', 'Vinted', 'shopping', ''], ['taobao', '淘宝', 'shopping', 'taobao 타오바오'], ['rakuten', '楽天', 'shopping', 'rakuten 라쿠텐'], ['mercari', 'メルカリ', 'shopping', 'mercari 메루카리'], ['asos', 'ASOS', 'shopping', ''],
    ['linkedin', 'LinkedIn', 'social', '링크드인'], ['weibo', '微博', 'social', 'weibo 웨이보'], ['xiaohongshu', '小红书', 'social', 'xiaohongshu rednote 샤오홍슈'], ['douyin', '抖音', 'social', 'douyin 더우인'],
    ['everytime', '에브리타임', 'social', 'everytime 에타'], ['blind', '블라인드', 'social', 'blind'],
    ['tinder', 'Tinder', 'social', '틴더'], ['hinge', 'Hinge', 'social', '힌지'], ['grindr', 'Grindr', 'social', '그라인더'],
    ['hbomax', 'Max', 'video', 'hbomax hbo 맥스'], ['hulu', 'Hulu', 'video', '훌루'], ['crunchyroll', 'Crunchyroll', 'video', '크런치롤'], ['chzzk', '치지직', 'video', 'chzzk'], ['bilibili', 'bilibili', 'video', '哔哩哔哩 빌리빌리'], ['appletv', 'Apple TV', 'video', 'appletv 애플tv'],
    ['podcasts', '팟캐스트', 'music', 'podcasts podcast applepodcasts'],
    ['kakaowebtoon', '카카오웹툰', 'reading', 'kakaowebtoon'], ['millie', '밀리의 서재', 'reading', 'millie 밀리'], ['wattpad', 'Wattpad', 'reading', '왓패드'], ['nytimes', 'NYT', 'reading', 'nytimes newyorktimes'],
    ['bbc', 'BBC News', 'reading', 'bbc bbcnews'], ['yahoo', 'Yahoo! ニュース', 'reading', 'yahoo yahoonews yahoojapan 야후'], ['daum', 'Daum', 'reading', '다음'],
    ['myfitnesspal', 'MyFitnessPal', 'health', '마이피트니스팔'], ['flo_health', 'Flo', 'health', 'flohealth flo생리 플로'],
    ['outlook', 'Outlook', 'work', '아웃룩'], ['googledrive', 'Google Drive', 'work', 'drive 구글드라이브'], ['word', 'Word', 'work', 'microsoftword 워드'], ['powerpoint', 'PowerPoint', 'work', 'ppt 파워포인트'],
    ['lightroom', 'Lightroom', 'other', '라이트룸'], ['capcut', 'CapCut', 'other', '캡컷'],
    ['amongus', 'Among Us', 'game', '어몽어스'], ['umamusume', '우마무스메', 'game', 'umamusume ウマ娘 우마'], ['fgo', 'Fate/GO', 'game', 'fgo fategrandorder 페그오'], ['cookierun', '쿠키런', 'game', 'cookierun 쿠키런킹덤 cookierunkingdom'],
    ['honkaistarrail', '붕괴: 스타레일', 'game', 'honkaistarrail starrail 스타레일 붕스'], ['zzz', '젠레스 존 제로', 'game', 'zenlesszonezero 젠존제 zzz'],
    ['facetime', 'FaceTime', 'chat', '페이스타임'],
];
const norm = s => String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const BY_NAME = new Map();
for (const [id, name, kind, also] of [...CATALOG, ...MORE]) for (const k of [name, id, ...also.split(' ').filter(Boolean)]) if (!BY_NAME.has(norm(k))) BY_NAME.set(norm(k), { id, name, kind });
// the app a name is ({ id for its icon, the name to show, kind }), or null for one the phone doesn't know
// a bank's own app ("Sparkasse", "신한 SOL", "Chase") is the bank icon under its own name
const BANK = /bank|banking|뱅크|은행|뱅킹|sparkasse|volksbank|commerzbank|deutschebank|\bing\b|chase|barclays|santander|hsbc|wellsfargo|wells fargo|citi\b|monzo|revolut|n26|신한|국민|우리|하나|농협|\bsol\b|쏠/i;
export const appOf = name => BY_NAME.get(norm(name)) || (BANK.test(String(name || '')) ? { id: 'bank', name: String(name).trim(), kind: 'money' } : null);
// the list the screen time fill picks from, a line for each kind (the phone's own apps come from the phone itself)
const OWN = new Set(['phone', 'camera', 'messages', 'notes', 'maps', 'calendar', 'photos', 'clock', 'weather', 'health', 'files', 'wallet', 'bank', 'voicememo', 'settings']);
export const SCREEN_LIST = KINDS.map(k => [k, [...CATALOG, ...MORE].filter(a => a[2] === k && !OWN.has(a[0])).map(a => a[1])]).filter(([, xs]) => xs.length).map(([k, xs]) => `${k}: ${xs.join(', ')}`).join('\n');
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
    ['money', /bank|banking|뱅크|은행|뱅킹|pay\b|페이|wallet|월렛|toss|토스|n26|revolut|monzo|wise\b|sparkasse|trade republic|scalable|robinhood|upbit|업비트|binance|coinbase|증권|주식/i],
    ['maps', /maps?\b|지도|맵|navi|uber\b|bolt\b|taxi|택시|bahn|db navigator|bvg|mvg|metro|subway|지하철|버스|korail|코레일|trainline|flixbus|citymapper|transit|tfl|grab|lyft/i],
    ['health', /health|헬스|건강|fitness|피트니스|strava|nike run|runtastic|garmin|fitbit|samsung health|myfitnesspal|calm\b|headspace|sleep|수면|flo\b|clue\b|yoga|요가/i],
];
// an app's kind: what the phone was told, unless that is only 'other' and the phone knows better (Google Maps → maps)
export const kindOfApp = (name, usual = []) => { const told = usual.find(a => a.app === name)?.kind; return (told && told !== 'other' ? told : '') || appOf(name)?.kind || GUESS.find(([, re]) => re.test(name))?.[0] || told || 'other'; };

const md = s => { const mt = String(s || '').match(/^(\d{2})-(\d{2})/); return mt ? { mo: Number(mt[1]), d: Number(mt[2]) } : null; };
const gap = (a, b) => { const A = md(a), B = md(b); if (!A || !B) return 0; let g = (Date.UTC(2001, B.mo - 1, B.d) - Date.UTC(2001, A.mo - 1, A.d)) / 864e5; if (g < -180) g += 365; if (g > 180) g -= 365; return g; };
const seeded = seed => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return (h % 10000) / 10000; }; };
const toMin = t => { const mt = String(t || '').match(/(\d{1,2}):(\d{2})/); return mt ? Number(mt[1]) * 60 + Number(mt[2]) : null; };
const hm = n => `${String(Math.floor(((n % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((n % 60) + 60) % 60).padStart(2, '0')}`;

// what the phone holds on a day, as the apps it was done in: texts the owner wrote (their chat app), calls, photos, searches,
// mails, posts, notes, delivery orders. A story the reflection writes into the phone shows in screen time with no word of its own
function recordApps(p, day, usual) {
    const on = t => String(t || '').slice(0, 5) === day, n = xs => (xs || []).filter(x => on(x.time)).length, all = [...(usual.apps || []), ...(usual.sometimes || [])];
    const own = (kind, re, fallback) => all.find(a => a.kind === kind && (!re || re.test(a.app)))?.app || fallback;
    const kr = (p.lives || p.country) === 'KR', texts = (p.threads || []).reduce((k, t) => k + (t.messages || []).filter(x => on(x.time)).length, 0);
    const calls = (p.calls || []).filter(c => on(c.time)).reduce((k, c) => k + (Number(c.min) || 0), 0), apps = {};
    const put = (app, m) => { if (m > 0) apps[app] = (apps[app] || 0) + Math.round(m); };
    put(own('chat', null, '메시지'), texts * 2);
    put('전화', calls);
    put('카메라', n(p.photos) * 2);
    put(own('other', /chrome|safari|google|naver/i, kr ? 'NAVER' : 'Google'), Math.min(30, n(p.searches) * 3));
    put(own('work', /mail|outlook/i, 'Gmail'), Math.min(20, n(p.mails) * 2));
    put(own('social', null, 'Instagram'), n(p.posts) * 10);
    put('메모', n(p.notes) * 3);
    put((p.delivery?.look || (kr ? 'baemin' : 'ubereats')) === 'baemin' ? '배달의민족' : 'Uber Eats', n(p.delivery?.orders) * 8);
    // the small apps a real phone's list trails off with, each from what the phone holds that day: the bank on a day with
    // payments (under the bank's own name), the calendar with an event, files received, a ticket's day (the airline's or
    // the trains' app when the phone knows it, else the wallet, and the map), the clock on a day an alarm rang
    const tx = (p.money?.tx || []).filter(t => on(t.time) && !String(t.id).startsWith('dlv-') && !t.delivery).length;
    put(own('money', /bank|뱅크|은행|sparkasse|toss|토스/i, line(p.money?.bank?.name) || '은행'), tx ? Math.min(10, 2 + tx) : 0);
    put('캘린더', Math.min(6, (p.events || []).filter(e => e.date === day).length * 2));
    put('파일', Math.min(6, n(p.life?.files?.items) * 2));
    const trips = (p.money?.passes || []).filter(x => x.date === day && /flight|train/.test(x.kind));
    for (const t of trips) {
        const rail = { KR: '코레일톡', DE: 'DB Navigator', GB: 'Trainline' }[p.lives || p.country];
        put(t.kind === 'flight' ? appOf(t.by)?.name || '지갑' : rail || '지갑', 5);
        put(own('maps', /maps|지도|맵/i, kr ? '네이버 지도' : 'Google Maps'), 6);
    }
    const wd = weekday(p, day), rang = (p.life?.clock?.alarms || []).some(a => a.on !== false && (a.date === day || (a.days || []).includes(WD[wd])));
    put('시계', rang ? 1 : 0);
    // and what everyone opens a minute here and there (seeded by the day, so it stays put)
    const r = seeded(`${p.owner}:${day}:tail`);
    put('날씨', r() < 0.7 ? 1 : 0); put('설정', r() < 0.35 ? 1 + Math.floor(r() * 3) : 0); put('사진', r() < 0.5 ? 1 + Math.floor(r() * 4) : 0); put('건강', r() < 0.3 ? 1 : 0);
    return { apps, texts };
}
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// the day of the week in the story's year (2001's when the phone doesn't know it)
const weekday = (p, day) => { const x = md(day), y = Number(p?.year) || 2001; return x ? new Date(Date.UTC(y, x.mo - 1, x.d)).getUTCDay() : 3; };
const line = v => String(v || '').trim().slice(0, 40);
// a day the model left out: their usual, a little more or less as days go, with what that day holds on top
function workedOut(p, day, usual, sleepDay) {
    const r = seeded(`${p.owner}:${day}:screen`), rec = recordApps(p, day, usual), apps = {};
    const wd = weekday(p, day), weekend = wd === 0 || wd === 6;
    // no two days alike: an app left alone some days, another binged (two or three times its usual), work all but gone
    // at the weekend while games, videos and feeds get more
    for (const a of usual.apps || []) {
        const x = r(), mood = x < 0.12 ? 0 : x > 0.9 ? 2 + r() : 0.7 + r() * 0.6;
        const f = mood * (weekend && ['game', 'video', 'social'].includes(a.kind) ? 1.25 : weekend && a.kind === 'work' ? 0.15 : 1);
        const m = Math.round(a.min * f);
        if (m > 0) apps[a.app] = m;
    }
    // the apps they open now and then: on some days, for a while
    for (const a of usual.sometimes || []) if (r() < 0.3) apps[a.app] = (apps[a.app] || 0) + Math.max(1, Math.round(a.min * (0.5 + r())));
    for (const [k, m] of Object.entries(rec.apps)) apps[k] = (apps[k] || 0) + m;
    // a short night: they were up with the phone
    // shorter than their own usual night (an owner who always sleeps five hours isn't up late every night)
    const span = d => (d && toMin(d.sleep) !== null && toMin(d.wake) !== null ? ((toMin(d.wake) - toMin(d.sleep)) + 1440) % 1440 : null);
    const slept = span(sleepDay), norm = span(p.life?.health?.usual) ?? 7 * 60, short = slept !== null && slept < norm - 90;
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
    const known = [...(u.apps || []), ...(u.sometimes || [])];
    const days = rows.map(d => {
        const s = d.screen ? { ...d.screen, apps: { ...(d.screen.apps || {}) } } : workedOut(p, d.date, u, d);
        // a told day: what the phone holds that day that the model didn't name (an app it named keeps its own minutes)
        if (d.screen) for (const [k, m] of Object.entries(recordApps(p, d.date, u).apps)) if (!(k in s.apps)) s.apps[k] = m;
        // today so far: the day's hours up to now
        if (d.date === day0 && nowMin !== null && !d.screen) { const f = Math.max(0.05, Math.min(1, nowMin / (22 * 60))); for (const k of Object.keys(s.apps)) s.apps[k] = Math.round(s.apps[k] * f); if (s.pickups) s.pickups = Math.round(s.pickups * f); delete s.late; }
        const byKind = Object.fromEntries(KINDS.map(k => [k, 0]));
        for (const [app, m] of Object.entries(s.apps || {})) byKind[app === '전화' || app === '카메라' ? 'other' : kindOfApp(app, known)] += m;
        const total = Object.values(s.apps || {}).reduce((a, b) => a + b, 0);
        return { date: d.date, total, byKind, apps: Object.entries(s.apps || {}).sort((a, b) => b[1] - a[1]), pickups: s.pickups ?? null, late: s.late || '', from: d.screen ? 'story' : 'worked', today: d.date === day0 };
    });
    const done = days.filter(d => !d.today), week = done.slice(-7), before = done.slice(-14, -7);
    const avg = xs => (xs.length ? Math.round(xs.reduce((n, d) => n + d.total, 0) / xs.length) : null);
    const a = avg(week), b = avg(before), pct = a !== null && b ? Math.round((a - b) / b * 100) : null;
    const apps = {};
    for (const d of week) for (const [k, m] of d.apps) apps[k] = (apps[k] || 0) + m;
    const top = Object.entries(apps).sort((x, y) => y[1] - x[1]).map(([app, m]) => ({ app, icon: appOf(app)?.id || '', kind: kindOfApp(app, known), avg: Math.round(m / Math.max(1, week.length)) }));
    const dur = n => `${Math.floor(n / 60) ? `${Math.floor(n / 60)}시간 ` : ''}${n % 60}분`.trim();
    const lines = [];
    if (a !== null) lines.push(`일평균 ${dur(a)}${pct !== null && Math.abs(pct) >= 5 ? `, 지난주보다 ${Math.abs(pct)}% ${pct > 0 ? '늘었어요' : '줄었어요'}` : ''}`);
    const y = done.at(-1);
    if (y?.late && toMin(y.late) < 5 * 60) lines.push(`어제 새벽 ${y.late}까지 폰을 봤어요`);
    if (top[0]) lines.push(`가장 많이 쓴 앱은 ${top[0].app}, 하루 ${dur(top[0].avg)}`);
    const pk = week.filter(d => d.pickups !== null), pickupsAvg = pk.length ? Math.round(pk.reduce((n, d) => n + d.pickups, 0) / pk.length) : null;
    return { days, avg: a, prevAvg: b, pct, top, pickupsAvg, lines, usual: u };
}
