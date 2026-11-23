// 시각 매크로 · 기본 언어: 진짜 실리 브라우저(tools/st/oracle-tz.mjs)와 서버(tests/sttz.run.mjs)가 같은 것으로 돌려요.
// 브라우저는 Chrome에 시간대 · 언어 · 시계를 고정해 띄운 실리 1.19.1이에요. 기대값은 tests/fixtures/stmacros-tz-expected.json.
export const T = Date.UTC(2026, 2, 8, 6, 30, 15);   // 2026-03-08 06:30:15Z: 뉴욕 01:30, 봄 DST 한 시간 전
export const T2 = Date.UTC(2026, 10, 23, 8, 5, 9);
export const CONFIGS = [
    { id: 'ko-seoul-mar', locale: 'ko-KR', timezoneId: 'Asia/Seoul', at: T },
    { id: 'ko-seoul-nov', locale: 'ko-KR', timezoneId: 'Asia/Seoul', at: T2 },
    { id: 'en-newyork-before', locale: 'en-US', timezoneId: 'America/New_York', at: T },
    { id: 'en-newyork-after', locale: 'en-US', timezoneId: 'America/New_York', at: T + 3600e3 },
    { id: 'de-berlin', locale: 'de-DE', timezoneId: 'Europe/Berlin', at: T2 },
    { id: 'ko-lordhowe', locale: 'ko-KR', timezoneId: 'Australia/Lord_Howe', at: T2 },
    { id: 'en-chatham', locale: 'en-NZ', timezoneId: 'Pacific/Chatham', at: T2 },
    { id: 'pt-saopaulo', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', at: T },
    // (화면 언어를 실리에서 고른 것: localStorage 'language')
    { id: 'ja-ui-kolkata', locale: 'ko-KR', timezoneId: 'Asia/Kolkata', at: T2, language: 'ja-jp' },
];
export const TEXTS = [
    '{{time}}', '{{date}}', '{{weekday}}', '{{isotime}}', '{{isodate}}', '{{datetimeformat::LLLL Z dddd MMMM A}}', '{{datetimeformat::YYYY-MM-DD HH:mm:ss}}',
    '{{time::UTC+2}}', '{{time::UTC-7}}', '{{time_UTC+9}}', '{{time_UTC-3}}',
    '{{timeDiff::2026-03-08 01:00:00::2026-03-08 04:00:00}}', '{{timeDiff::2023-01-01 12:00:00::2023-01-01 15:00:00}}', '{{timeDiff::March 8, 2026 1:00 AM::March 8, 2026 4:00 AM}}',
    '{{idle_duration}}', '{{idleDuration}}',
];
export const LEGACY = ['{{time}}', '{{date}}', '{{weekday}}', '{{isotime}}', '{{isodate}}', '{{datetimeformat LLLL Z}}', '{{time_UTC+9}}', '{{timeDiff::2026-03-08 01:00:00::2026-03-08 04:00:00}}', '{{idle_duration}}'];
// send_date 모양들 (실리가 지금까지 써 온 것: getMessageTimeStamp의 ISO, humanizedDateTime, 옛 오전 · 오후 글, 오프셋 없는 ISO)
export const CHATS = [
    ['iso', '2026-03-07T21:10:00.000Z'],
    ['humanized', '2026-3-7@21h10m00s000ms'],
    ['meridiem', 'March 7, 2026 9:10pm'],
    ['isolocal', '2026-03-07T21:10:00'],
];
export const chatOf = sd => [
    { name: 'Mara', is_user: true, is_system: false, mes: 'a', send_date: sd },
    { name: 'Ren', is_user: false, is_system: false, mes: 'b', send_date: sd },
];
// (매크로 밖: 이 스레드의 로컬 시각 · 기본 언어. 브라우저와 서버가 같은 함수를 불러요)
export function envOf() {
    const d = new Date(), words = ['b', 'a', 'ä', 'z', '가', 'Z', 'ö', 'o', 'é', 'e', '日', 'あ'];
    return {
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone, intl: Intl.DateTimeFormat().resolvedOptions().locale, now: Date.now(), offset: d.getTimezoneOffset(),
        local: [d.getFullYear(), d.getMonth(), d.getDate(), d.getDay(), d.getHours(), d.getMinutes()].join(','), toString: d.toString(),
        toLocaleString: d.toLocaleString(), dateStyle: new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(d),
        collate: [...words].sort((a, b) => a.localeCompare(b)).join(''), number: (1234567.891).toLocaleString(),
    };
}
// (실리 화면 언어 · 매크로: 그 페이지의 substituteParams로. S · PU는 script.js · power-user.js, setChat(chat)은 채팅을 바꿔 끼우는 것)
export function macrosOf({ S, PU, setChat, currentLocale, globalLocale }) {
    const out = { currentLocale, globalLocale };
    for (const [engine, list] of [['new', TEXTS], ['legacy', LEGACY]]) {
        PU.power_user.experimental_macro_engine = engine === 'new';
        for (const [k, sd] of CHATS) {
            setChat(chatOf(sd));
            for (const text of list) {
                if (!/idle/i.test(text) && k !== 'iso') continue;
                try { out[`${engine} ${k} ${text}`] = S.substituteParams(text); } catch (e) { out[`${engine} ${k} ${text}`] = 'THROW ' + e.message; }
            }
        }
    }
    setChat([]);
    return out;
}
