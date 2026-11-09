// A fake OpenAI-style model on :5555 for the phone: it answers 폰 만들기 · 채우기 · 반영 · 검색 with fixed German/Korean data
// (Mara in Varo). Run: node tools/dev/fakeph.mjs
import http from 'node:http';
const FIRST = {
  country: 'DE', wallpaper: 'dusk', accent: 'blue', now: '10-25 17:42', clock: { finalViewpoint: 'Mara', sceneTime: '10-25 17:42', elapsedTime: null },
  contacts: [{ name: 'Ren', saved: 'Ren ♥' }, { name: 'Ivo', saved: 'Ivo (Werkstatt)' }],
  threads: [
    { with: 'Ivo', messages: [
      { from: 'Ivo', text: 'Hast du den Schlüssel noch?', ko: '열쇠 아직 갖고 있어?', time: '10-24 09:12' },
      { from: 'me', text: 'Ja. Bring ich Samstag vorbei.', ko: '응. 토요일에 갖다줄게.', time: '10-24 09:20' },
      { from: 'Ivo', text: 'Ruf mich zurück. Wichtig.', ko: '다시 전화해. 중요해.', time: '10-25 17:30' } ] },
    { with: 'Ren', messages: [
      { from: 'Ren', text: 'Tut mir leid wegen vorhin', ko: '아까 일은 미안', time: '10-25 17:31' },
      { from: 'me', text: 'Schon gut. Ist mir egal.', ko: '됐어. 신경 안 써.', time: '10-25 17:33' },
      { from: 'Ren', text: 'Lügnerin', ko: '거짓말', time: '10-25 17:34' },
      { from: 'Ren', text: 'Ich steh vor der Garage. Komm raus.', ko: '창고 앞이야. 나와.', time: '10-25 17:38' },
      { from: 'me', text: 'Fünf Minuten.', ko: '5분만.', time: '10-25 17:40' } ] } ],
  calls: [
    { with: 'Ren', type: 'out', time: '10-24 22:10', min: 14 },
    { with: 'Ivo', type: 'missed', time: '10-25 17:24', min: 0 },
    { with: 'Ivo', type: 'missed', time: '10-25 17:28', min: 0 } ],
  photos: [
    { caption: 'Die Bank am Fluss in Varo, wo wir saßen', ko: 'Varo 강가, 둘이 앉았던 벤치', time: '10-19 16:03', mood: 'green' },
    { caption: 'Regentropfen am Busfenster', ko: '버스 창문에 맺힌 빗물', time: '10-22 08:40', mood: 'cool' },
    { caption: 'Sonnenuntergang hinter der Garage, verwackelt', ko: '창고 뒤 노을, 흔들림', time: '10-24 18:12', mood: 'warm' } ],
  notes: [ { title: 'Nicht vergessen', kt: '잊지 말 것', text: '- Schlüssel an Ivo (Samstag)\n- Ren nicht anrufen', ko: '- 열쇠 Ivo한테 (토요일)\n- Ren한테 전화하지 말기', time: '10-23 23:51' } ],
  searches: [ { q: 'Hochwasser Eastgate Straße gesperrt', ko: 'Eastgate 홍수 도로 통제', time: '10-25 13:02', tab: true }, { q: 'Bus Varo Eastgate Fahrplan', ko: 'Varo Eastgate 버스 시간표', time: '10-25 12:40', tab: true, mark: true } ],
  events: [ { title: 'Schlüssel zurückgeben', ko: '열쇠 돌려주기', date: '10-25', time: '' }, { title: 'Werkstatt – Ivo', ko: '정비소 – Ivo', date: '10-27', time: '10:00' } ],
  profile: { handle: 'mara.varo', bio: 'Fluss, Regen, Kaffee.', ko: '강, 비, 커피.', followers: 318, following: 201 },
  posts: [ { text: 'Endlich wieder am Fluss.', ko: '드디어 다시 강가에.', photo: 'Die Bank am Fluss, Herbstlaub', pko: '강가 벤치, 가을 낙엽', time: '10-19 16:10', likes: 24, comments: [ { from: 'Ren', text: 'Schön.', ko: '예쁘다.' }, { from: 'Anja', text: 'Vermisse dich!', ko: '보고 싶어!' } ] },
           { text: 'Straße gesperrt. Natürlich.', ko: '도로 통제. 역시나.', photo: '', pko: '', time: '10-25 13:10', likes: 7, comments: [ { from: 'Ivo', text: 'Fahr vorsichtig.', ko: '조심히 와.' } ] } ],
  mails: [ { from: 'Stadtwerke Varo', subject: 'Ihre Rechnung Oktober', ks: '10월 청구서', text: 'Sehr geehrte Frau Mara, anbei Ihre Rechnung.', ko: '마라 님, 청구서를 보내드립니다.', time: '10-21 09:00', unread: false },
           { from: 'Ivo', subject: 'Schlüssel', ks: '열쇠', text: 'Brauche ihn bis Samstag. Danke.', ko: '토요일까지 필요해. 고마워.', time: '10-24 08:12', unread: true } ],
  diary: [ { date: '10-24', title: 'Die Garage', kt: '창고', text: 'Ren war da. Wir haben gestritten. Ich hab nichts gesagt.', ko: 'Ren이 와 있었다. 우리는 싸웠다. 나는 아무 말도 안 했다.' } ],
};
const UPD = { now: '10-25 19:05', clock: { finalViewpoint: 'Mara', sceneTime: '10-25 19:05', elapsedTime: null }, threads: [ { with: 'Ren', messages: [ { from: 'Ren', text: 'Danke, dass du gekommen bist.', ko: '와 줘서 고마워.', time: '10-25 19:02' } ] } ], calls: [], photos: [ { caption: 'Zwei Kaffeebecher auf dem Garagendach', ko: '창고 지붕 위 커피잔 두 개', time: '10-25 18:20', mood: 'warm' } ], notes: [], searches: [], events: [] };
let last = '';

const SERP = {
  answer: { label: 'Linie 42 · Varo → Eastgate', text: 'Heute nur bis Westend', ko: '오늘은 웨스트엔드까지만', site: 'Varo Verkehr', steps: [{ time: '20:40', place: 'Varo' }, { time: '20:58', place: 'Westend' }, { time: '', place: 'Eastgate', off: true }] },
  results: [
    { site: 'Varo Verkehr', url: 'varo-verkehr.de/linie-42', path: 'varo-verkehr.de › linie-42', color: '#1f6b45', kind: 'transit', title: 'Linie 42: Fahrplan ab Varo', kt: '42번 버스: 바로 출발 시간표', date: '10-25', text: 'Wegen Hochwasser fahren die Busse nur bis Westend. Letzte Abfahrt 21:10.', ko: '홍수로 버스는 웨스트엔드까지만. 막차 21:10.', bold: ['Hochwasser', 'Busse'], links: ['Abfahrten', 'Störungen', 'Tickets'] },
    { site: 'Varoer Tagblatt', url: 'tagblatt-varo.de/lokales/hochwasser', path: 'tagblatt-varo.de › lokales', color: '#a8231b', kind: 'news', title: 'Straße nach Eastgate bis Montag gesperrt', kt: '이스트게이트 가는 도로 월요일까지 통제', date: '10-25', text: 'Nach dem Starkregen steht die Landstraße unter Wasser.', ko: '폭우로 국도가 물에 잠겼다.', bold: ['Eastgate'], links: [] },
    { site: 'varo-forum', url: 'varo-forum.de/westend/werkstatt', path: 'varo-forum.de › v/Westend', color: '#e8590c', kind: 'forum', title: 'Gute Werkstatt in Westend? Mein Schlüssel ist weg', kt: '웨스트엔드 괜찮은 정비소? 열쇠가 없어요', date: '10-25', text: 'Kennt jemand einen Schlüsseldienst, der samstags offen hat?', ko: '토요일에 여는 열쇠집 아는 사람?', bold: [], links: [] },
    { site: 'Wikipedia', url: 'de.wikipedia.org/wiki/Eastgate', path: 'de.wikipedia.org › wiki › Eastgate', color: '#54595d', kind: 'wiki', title: 'Eastgate – Wikipedia', kt: '이스트게이트 – 위키백과', date: '', text: 'Eastgate ist eine Kleinstadt östlich von Varo.', ko: '이스트게이트는 바로 동쪽의 작은 도시다.', bold: ['Eastgate'], links: [] },
    { site: 'markt.', url: 'markt.de/wollschal-grau', path: 'markt.de › Schals', color: '#2f7d74', kind: 'shop', title: 'Wollschal, Grau — Merino', kt: '울 목도리, 회색', date: '', text: '39,90 € · Morgen geliefert', ko: '39.90유로 · 내일 도착', bold: [], links: [] },
    { site: 'kleine notizen', url: 'anja-notizen.de/garage', path: 'anja-notizen.de', color: '#9a6b3f', kind: 'blog', title: 'Die alte Garage am Fluss', kt: '강가의 오래된 차고', date: '10-24', text: 'Abends, wenn das Licht hinter der Garage untergeht…', ko: '저녁, 차고 뒤로 해가 지면…', bold: [], links: [] },
  ],
  news: [{ site: 'Varoer Tagblatt', color: '#a8231b', title: 'Straße nach Eastgate bis Montag gesperrt', kt: '이스트게이트 도로 월요일까지 통제', ago: '2시간 전' }, { site: 'Wetter Varo', color: '#3d6fb4', title: 'Pegel sinkt langsam', kt: '수위 천천히 내려가', ago: '5시간 전' }],
  questions: [{ q: 'Fährt der 42er am Sonntag?', ko: '42번 일요일에 다녀요?' }, { q: 'Wo hält der Ersatzbus in Westend?', ko: '웨스트엔드 대체 버스 정류장은?' }],
  related: ['Hochwasser Varo', 'Ersatzbus Westend', 'Nordbahn Eastgate'],
};
const BODY = [{ text: 'Die Feuerwehr hat die Strecke zwischen Varo und Eastgate am Samstag gesperrt.', ko: '소방 당국은 토요일 바로와 이스트게이트 사이 구간을 막았다.' }, { text: 'Die Linie 42 endet bis auf Weiteres in Westend.', ko: '42번은 당분간 웨스트엔드에서 끝난다.' }];
const PAGE = {
  news: { kind: 'news', nav: ['Lokales', 'Politik', 'Wetter', 'Sport', 'Kultur'], title: 'Straße nach Eastgate bis Montag gesperrt', kt: '이스트게이트 가는 도로 월요일까지 통제', lede: { text: 'Nach dem Starkregen steht die Landstraße unter Wasser.', ko: '폭우로 국도가 물에 잠겼다.' }, body: BODY,
    news: { section: 'Hochwasser', ticker: 'Pegel Varo: 4,82 m · sinkend', author: 'Sela Brandt', date: '10-25 11:48', minutes: '3', photo: 'Die Landstraße bei Eastgate am Morgen', credit: 'Foto: Tagblatt', quote: { text: 'Vor Montag fährt da keiner durch.', ko: '월요일 전엔 아무도 못 지나가요.', who: 'Einsatzleiter' } } },
  transit: { kind: 'transit', nav: ['Abfahrten', 'Verbindung', 'Störungen', 'Tickets'], title: 'Linie 42: Varo → Eastgate', kt: '42번: 바로 → 이스트게이트', lede: null, body: [BODY[1]],
    transit: { stop: 'Varo, Rathaus', alert: { title: 'Störung · Hochwasser', text: 'Linie 42 fährt nur bis Westend.', ko: '42번은 웨스트엔드까지만.' }, departures: [{ line: '42', to: 'Westend', note: 'statt Eastgate', time: '20:40', delay: 5, off: false }, { line: 'E42', to: 'Eastgate, Bahnhof', note: 'Ersatzbus ab Westend', time: '20:55', delay: 0, off: false }, { line: '42', to: 'Eastgate, Bahnhof', note: 'fällt aus', time: '21:40', delay: 0, off: true }],
      route: [{ stop: 'Varo, Rathaus', time: '20:40' }, { stop: 'Brückenstraße', time: '20:49' }, { stop: 'Westend, Platz', time: '20:58', off: true }, { stop: 'Eastgate, Bahnhof', time: '', off: true }] } },
  forum: { kind: 'forum', nav: [], title: 'Gute Werkstatt in Westend? Mein Schlüssel ist weg', kt: '웨스트엔드 괜찮은 정비소? 열쇠가 없어요', lede: null, body: [{ text: 'Hab meinen Werkstattschlüssel verliehen und warte seit Tagen.', ko: '정비소 열쇠를 빌려줬는데 며칠째 기다리는 중.' }],
    forum: { board: 'v/Westend', members: '4.812', online: '38', author: 'schraube_ivo', ago: 'vor 3 Std.', flair: 'Frage', votes: '24', comments: [{ who: 'anja_w', ago: 'vor 2 Std.', text: 'Schlüsseldienst Kramer am Westend-Platz, Sa bis 14 Uhr.', ko: '웨스트엔드 광장 크라머 열쇠집, 토 2시까지.', votes: '11' }, { who: 'schraube_ivo', ago: 'vor 1 Std.', text: 'Danke!', ko: '고마워!', votes: '3', reply: true, op: true }, { who: 'renn3r', ago: 'vor 40 Min.', text: 'Wer hat ihn denn?', ko: '누가 갖고 있는데?', votes: '5' }] } },
  wiki: { kind: 'wiki', nav: ['Artikel', 'Diskussion'], title: 'Eastgate', kt: '이스트게이트', lede: null, body: [{ text: 'Eastgate ist eine Kleinstadt östlich von Varo, bekannt für ihre alte Flussbrücke.', ko: '이스트게이트는 바로 동쪽의 작은 도시로, 오래된 강 다리로 알려져 있다.' }],
    wiki: { note: 'Dieser Artikel behandelt die Stadt.', photo: 'Die alte Flussbrücke', facts: [{ k: 'Region', v: 'Varo-Tal' }, { k: 'Einwohner', v: '8.412' }, { k: 'Verkehr', v: 'Linie 42, Nordbahn' }], langs: 12, sections: [{ h: 'Hochwasser', text: 'Die Landstraße wird bei Hochwasser regelmäßig gesperrt.', ko: '홍수 때마다 국도가 통제된다.' }] } },
  shop: { kind: 'shop', nav: [], title: 'Wollschal, Grau — Merino', kt: '울 목도리, 회색 — 메리노', lede: null, body: [{ text: 'Weicher Merino, 180 × 30 cm.', ko: '부드러운 메리노, 180 × 30cm.' }],
    shop: { crumbs: ['Damen', 'Accessoires', 'Schals'], brand: 'Wollwerk Varo', price: 39.9, old: 49.9, currency: 'EUR', rating: 4.6, reviews: '128 Bewertungen', colors: ['#868c93', '#b0563f', '#2c4a80', '#e6dccd'], ship: 'Morgen geliefert · Kostenloser Versand' } },
  blog: { kind: 'blog', nav: [], title: 'Die alte Garage am Fluss', kt: '강가의 오래된 차고', lede: null, body: [{ text: 'Abends, wenn das Licht hinter der Garage untergeht, ist Varo still.', ko: '저녁, 차고 뒤로 해가 지면 바로는 조용해진다.' }],
    blog: { blog: 'kleine notizen', category: 'Varo · Herbst', author: 'Anja W.', date: '24. Oktober', minutes: '4', photo: 'Garage im Abendlicht', tags: ['varo', 'herbst'] } },
  other: { kind: 'other', nav: ['Start'], title: 'Seite', kt: '', lede: null, body: BODY },
};

const LIFE = {
  clock: { alarms: [
    { time: '06:10', label: 'Mara aufstehen', ko: 'Mara 일어나', days: ['mon','tue','wed','thu','fri'], on: true, wake: true, then: ['06:20','06:25','06:30'], snooze: 5, snoozeCount: 3, sound: 'Radar', made: '09-02' },
    { time: '06:15', label: 'Diesmal wirklich', ko: '이번엔 진짜', days: ['mon','tue','wed','thu','fri'], on: true, wake: true, then: [], snooze: 5, snoozeCount: 5, sound: 'Sirene', made: '09-02' },
    { time: '21:00', label: 'Tabletten', ko: '약', days: ['mon','tue','wed','thu','fri','sat','sun'], on: true, wake: false, then: [], snooze: 0, sound: 'Glocke', made: '08-14' },
    { time: '04:30', label: 'Flughafen · VA231', ko: '공항', days: [], date: '10-20', on: false, wake: false, then: [], snooze: 0, sound: 'Radar', made: '10-18', ev: 'berlin-flight' } ],
    timers: [ { label: 'Pasta', ko: '파스타', sec: 480, last: '10-24' }, { label: 'Tee ziehen lassen', ko: '차 우리기', sec: 240, last: '10-22' } ],
    running: { label: 'Pasta', ko: '파스타', sec: 480, left: 192 } },
  health: { usual: { bed: '23:10', sleep: '23:30', wake: '06:40', steps: 6200, workouts: 3, rest: 61, water: 1.6, coffee: 2, coffeeKind: 'Cappuccino', coffeeKo: '카푸치노', weight: 61.5, height: 168 },
    days: Array.from({ length: 14 }, (_, k) => { const d = 12 + k; const story = d === 24; return { date: `10-${String(d).padStart(2,'0')}`, bed: story ? '01:55' : '23:05', sleep: story ? '02:40' : (k % 3 ? '23:40' : '00:20'), wake: story ? '04:54' : '06:35', woke: story ? 2 : k % 2, steps: story ? 18412 : 5200 + (k * 913) % 3000, km: story ? 12.9 : 4.1, floors: story ? 14 : 6, workout: k < 6 && k % 2 === 0 ? { kind: 'Laufen', time: '06:50', min: 32, km: 5.2 } : null, hr: [58 + k % 5, story ? 131 : 104], from: story ? 'story' : 'pattern', ...(story ? { ev: 'garage-night' } : {}) }; }) },
  files: { folders: [ { name: 'Arbeit', ko: '일', count: 23, fav: true }, { name: 'Reisen', ko: '여행', count: 9, fav: false }, { name: 'Neuer Ordner (3)', count: 1, fav: true } ],
    items: [
      { name: 'Bordkarte_VA231.pdf', kind: 'pdf', folder: 'Downloads', size: 212, time: '10-19 20:14', from: 'Mail · Varo Air', pages: 1, opened: '10-25 08:10', tag: 'orange', ev: 'berlin-flight' },
      { name: 'Mietvertrag_final_FINAL(2).pdf', kind: 'pdf', folder: 'Downloads', size: 1430, time: '10-22 10:02', from: 'Mail', pages: 6, preview: 'Mietvertrag · Wohnung Brückenstraße 4, 2. OG', ko: '임대 계약서 · 브뤼켄 거리 4', opened: '10-22 10:05' },
      { name: 'Mietvertrag_final_FINAL.pdf', kind: 'pdf', folder: 'Downloads', size: 1430, time: '10-22 10:01', from: 'Mail', pages: 6, preview: 'Mietvertrag · Wohnung Brückenstraße 4', ko: '임대 계약서' },
      { name: 'archiv_alt.zip', kind: 'zip', folder: 'Downloads', size: 90112, time: '10-20 23:40', from: 'Chat' },
      { name: 'clip_0193.mp4', kind: 'video', folder: 'Downloads', size: 421888, time: '10-18 01:12', private: true, length: '2:41' },
      { name: 'Neue Aufnahme 7.m4a', kind: 'audio', folder: 'Downloads', size: 2150, time: '10-16 19:20', length: '3:12', opened: '10-23 22:00' },
      { name: 'Schichtplan_Okt.xlsx', kind: 'sheet', folder: 'Arbeit', size: 48, time: '10-02 09:00', tag: 'red', preview: 'Schichtplan Oktober · Werkstatt Ivo', ko: '10월 근무표' },
      { name: 'IMG_4021 (1).jpg', kind: 'image', folder: 'Reisen', size: 3100, time: '10-24 18:40', opened: '10-24 18:41' },
      { name: 'Lisboa_Tram.mp4', kind: 'video', folder: 'Reisen', size: 62000, time: '09-12 14:00', length: '0:42' },
      { name: 'Lebenslauf_Mara_2025.docx', kind: 'doc', folder: 'Arbeit', size: 96, time: '09-29 21:00', preview: 'Lebenslauf · Mara K. · Mechanikerin', ko: '이력서', trashed: '10-21' } ],
    cloud: { used: 4.2, total: 5 } },
  weather: { here: { place: 'Varo', date: '10-25', time: '17:40', from: 'archive', cond: 'rain', temp: 11, hi: 13, lo: 8, line: 'Gegen 22 Uhr hört der Regen auf. Morgen früh bewölkt.', ko: '22시쯤 비가 그쳐요. 내일 아침은 흐려요.',
      hours: [ { time: '17:00', cond: 'rain', temp: 11, rain: 90 }, { time: '18:00', cond: 'rain', temp: 10, rain: 80 }, { time: '19:00', cond: 'rain', temp: 10, rain: 70 }, { time: '20:00', cond: 'cloudy', temp: 9, rain: 40 }, { time: '21:00', cond: 'cloudy', temp: 9, rain: 10 }, { time: '22:00', cond: 'clear', temp: 8, rain: 0 } ],
      days: [ { day: '10-25', cond: 'rain', lo: 8, hi: 13, rain: 90 }, { day: '10-26', cond: 'cloudy', lo: 7, hi: 14, rain: 20 }, { day: '10-27', cond: 'clear', lo: 6, hi: 16, rain: 0 }, { day: '10-28', cond: 'clear', lo: 7, hi: 17, rain: 0 }, { day: '10-29', cond: 'rain', lo: 8, hi: 12, rain: 70 } ],
      tiles: { rain24: 4, rainNext: 1, feels: 9, wind: 14, gust: 31, dir: 'SW', humidity: 93, dew: 10, sunrise: '07:21', sunset: '17:58', visibility: 6 } },
    cities: [ { name: 'Westend', tz: 'Europe/Berlin', cond: 'clear', temp: 19, hi: 21, lo: 12, sunrise: '07:20', sunset: '18:51', rainNext: 0, wind: 9, gust: 18, dir: 'W', feels: 18, humidity: 54, dew: 9 }, { name: 'Eastgate', tz: 'Europe/Berlin', cond: 'cloudy', temp: 10, hi: 12, lo: 7, sunrise: '07:18', sunset: '17:55', rainNext: 6, wind: 22, gust: 41, dir: 'NW', feels: 7, humidity: 88, dew: 8, note: 'Straße gesperrt', noteKo: '도로 통제' }, { name: 'Lisboa', ko: '리스본', tz: 'Europe/Lisbon', cond: 'clear', temp: 17, hi: 22, lo: 15, sunrise: '07:52', sunset: '18:42', rainNext: 0, wind: 14, gust: 25, dir: 'N', feels: 17, humidity: 61, dew: 9, note: 'letzte Reise', noteKo: '지난 여행' } ] },
};
const DLV = {
  shops: [ { name: 'Pasta Nostra', cuisine: 'Italienisch', rating: 4.8, reviews: 512, fee: 1.99, minOrder: 12, eta: '25–35', fav: true, menu: [ { name: 'Tagliatelle al ragù', desc: 'Hausgemacht', price: 13.9, top: true, pic: { base: 'pasta-tomato', with: [], size: 'regular', set: [] } }, { name: 'Penne arrabbiata', desc: 'scharf', price: 11.5, pic: { base: 'pasta-tomato', with: ['chili'], size: 'regular', set: [] } }, { name: 'Tiramisu', price: 5.5 } ] },
    { name: 'Suppenküche Westend', ko: '웨스트엔드 수프집', cuisine: 'Suppen', rating: 4.6, reviews: 203, fee: 2.49, minOrder: 10, eta: '20–30', fav: false, menu: [ { name: 'Linsensuppe', ko: '렌틸 수프', price: 7.9, top: true }, { name: 'Hühnersuppe', price: 8.4 } ] },
    { name: 'Kumo Sushi', cuisine: 'Sushi', rating: 4.5, reviews: 340, fee: 2.9, minOrder: 15, eta: '35–45', menu: [ { name: 'Maki Mix', price: 15.2, top: true, pic: { base: 'maki', with: [], size: 'regular', set: ['miso'] } }, { name: 'Lachs Nigiri groß', price: 19.8, pic: { base: 'sushi', with: ['salmon'], size: 'large', set: [] } } ] } ],
  orders: [
    { shop: 'Kumo Sushi', items: [ { name: 'Maki Mix', qty: 1, price: 15.2 } ], fee: 0, tip: 0, discount: 0, mode: 'delivery', time: '10-09 21:10', arrived: '', to: 'home', address: 'Brückenstr. 4', status: 'cancelled', account: '4821', for: 1 },
    { shop: 'Pasta Nostra', items: [ { name: 'Penne arrabbiata', qty: 1, price: 11.5 } ], fee: 1.99, tip: 0, discount: 1.09, mode: 'delivery', time: '10-18 13:02', arrived: '10-18 13:35', to: 'work', address: 'Werkstatt Ivo, Eastgate', status: 'delivered', account: '7710', for: 1, reviewed: true },
    { shop: 'Suppenküche Westend', items: [ { name: 'Linsensuppe', ko: '렌틸 수프', qty: 1, price: 7.9 } ], fee: 2.49, tip: 0, discount: 0, mode: 'delivery', time: '10-22 19:40', arrived: '10-22 20:10', to: 'Ren', address: 'Westend, Platz 2', status: 'delivered', account: '4821', gift: 'Ren', for: 1, noteRider: 'Bitte klingeln, er schläft vielleicht.', noteRiderKo: '벨 눌러 주세요, 자고 있을지도.' },
    { shop: 'Pasta Nostra', items: [ { name: 'Tagliatelle al ragù', qty: 1, price: 13.9 }, { name: 'Penne arrabbiata', qty: 1, price: 11.5 } ], fee: 1.99, tip: 0, discount: 2.59, mode: 'delivery', time: '10-25 20:14', arrived: '10-25 20:51', to: 'home', address: 'Brückenstr. 4', left: 'Vor der Tür abgelegt', noteRider: 'Bitte vor die Tür stellen. Nicht klingeln.', noteRiderKo: '문 앞에 놓아 주세요. 벨 누르지 마세요.', noCutlery: true, status: 'delivered', account: '7710', for: 2, ev: 'garage-dinner' },
    { shop: 'Kumo Sushi', items: [ { name: 'Lachs Nigiri groß', qty: 1, price: 19.8 } ], fee: 2.9, tip: 1, discount: 0, mode: 'delivery', time: '10-25 17:20', arrived: '', to: 'home', address: 'Brückenstr. 4', status: 'on the way', account: '7710', for: 1 } ],
  cart: { shop: 'Pasta Nostra', items: [ { name: 'Tiramisu', qty: 2, price: 5.5 } ], noteShop: '', noteRider: '' },
};
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    last = b;
    const upd = b.includes('[UPDATE]');
    // 말투 뽑기 (phonetr.js askVoices): the story's people with the words that show it; anyone else in WHO comes back missing
    const VOICES = { people: [{ who: 'Ren', style: '늘 반말, 장난스럽게, 말끝을 길게 늘임', evidence: ['Why so cold? Come on, smile a little~'] }, { who: 'Anja', style: '반말, 다정하게, 걱정 많음', evidence: ['Did you eat? Don\'t skip dinner again'] }, { who: 'Ivo', style: '존댓말, 딱딱하고 짧게', evidence: ['Bitte. Der Schlüssel liegt unter der Matte.'] }] };
    const content = b.includes('[WHO]') ? JSON.stringify(VOICES) : b.includes('Fill the money side') ? JSON.stringify({"currency": "EUR", "bank": {"name": "Varo Bank", "accounts": [{"kind": "checking", "name": "Girokonto", "last4": "4821", "balance": 1284.17}, {"kind": "savings", "name": "Sparkonto", "last4": "0932", "balance": 6410}, {"kind": "credit", "name": "Kreditkarte", "last4": "7710", "balance": -312.4}]}, "cards": [{"account": "4821", "exp": "11/28"}, {"account": "7710", "exp": "03/27"}], "tx": [{"account": "4821", "who": "Gehalt", "ko": "\uae09\uc5ec", "amount": 2150, "time": "10-15 08:00", "kind": "deposit"}, {"account": "4821", "who": "Varo Air", "amount": -129, "time": "10-20 19:02", "kind": "card", "ev": "berlin-flight"}, {"account": "4821", "who": "Caf\u00e9 am Fluss", "amount": -7.4, "time": "10-24 16:10", "kind": "card"}, {"account": "4821", "who": "Wollwerk Varo", "amount": -39.9, "time": "10-24 21:10", "kind": "card", "ev": "scarf-gift"}, {"account": "4821", "who": "Ivo Becker", "amount": -50, "time": "10-25 18:00", "kind": "transfer", "memo": "Schl\u00fcssel, danke", "pending": true}, {"account": "7710", "who": "Buchladen Varo", "amount": -14.99, "time": "10-18 12:20", "kind": "card"}], "passes": [{"kind": "flight", "by": "Varo Air", "from": "VAR", "to": "BER", "date": "10-30", "time": "07:45", "status": "\uc608\uc57d \ud655\uc815", "ev": "berlin-flight"}, {"kind": "hotel", "by": "Hotel an der Spree", "to": "Berlin", "date": "10-30", "no": "", "status": "\ud655\uc815"}, {"kind": "train", "by": "Nordbahn", "from": "Varo", "to": "Eastgate", "date": "11-02", "time": "09:10"}], "orders": [{"shop": "Wollwerk Varo", "item": "Wollschal, Grau", "ko": "\uc6b8 \ubaa9\ub3c4\ub9ac, \ud68c\uc0c9", "option": "Grau", "qty": 1, "price": 39.9, "time": "10-24 21:10", "status": "on the way", "eta": "10-26", "gift": "Anja", "ev": "scarf-gift"}, {"shop": "Buchladen Varo", "item": "Reisef\u00fchrer Berlin", "qty": 1, "price": 14.99, "time": "10-18 12:20", "status": "delivered", "arrived": "10-21"}, {"shop": "Schl\u00fcsseldienst", "item": "Ersatzschl\u00fcssel-Rohling", "qty": 2, "price": null, "time": "10-12 10:00", "status": "unknown"}]}) : b.includes('Fill the voice memo app') ? JSON.stringify({"memos": [{"title": "Brücke, nachts", "kt": "밤, 다리", "text": "Okay. Ich steh auf der Brücke. Es ist kalt… Er hat gesagt, es ist ihm egal. Ist es nicht.", "ko": "좋아. 다리 위야. 추워… 걔가 상관없다고 했어. 아니야.", "time": "10-24 23:48", "sec": 72, "place": "Varo"}, {"title": "Einkaufsliste", "text": "Milch, Brot, … und den Schal für Anja nicht vergessen.", "ko": "우유, 빵, … 그리고 Anja 목도리 잊지 말기.", "time": "10-22 18:02", "sec": 18, "place": ""}]}) : b.includes('records a short voice memo') ? JSON.stringify({"title": "Neue Aufnahme", "text": "Fünf Minuten, hab ich gesagt. Jetzt steh ich hier und geh nicht rein.", "ko": "5분이라고 했지. 지금 여기 서서 안 들어가고 있어.", "sec": 34, "place": "Garage"}) : b.includes('[TO]') ? JSON.stringify({ text: 'Es tut mir auch leid. Ich hab gelogen, es ist mir nicht egal.', ko: '나도 미안해. 거짓말했어, 상관없지 않아.' })
    : b.includes('Fill four everyday apps') ? JSON.stringify(LIFE)
    : b.includes('Fill the food delivery app') ? JSON.stringify(DLV)
    : b.includes('[RESULT]') ? JSON.stringify(PAGE[(b.match(/\\"kind\\":\\"(\w+)\\"/) || [])[1]] || PAGE.other)
    : b.includes('[QUERY]') ? JSON.stringify(SERP)
    : b.includes('[QUERY_OLD]') ? JSON.stringify({ results: [ { site: 'Varo Verkehr', url: 'varo-verkehr.de/bus42', title: 'Bus 42: Fahrplan ab Varo', kt: '42번 버스: Varo 출발 시간표', text: 'Wegen Hochwasser fahren die Busse nur bis Westend. Letzte Abfahrt 21:10.', ko: '홍수로 버스는 Westend까지만 운행. 막차 21:10.' }, { site: 'Deutsche Bahn', url: 'bahn.de', title: 'Verbindungen Varo – Eastgate', kt: 'Varo – Eastgate 연결편', text: 'Ersatzverkehr eingerichtet.', ko: '대체 운행 중.' } ] })
    : b.includes('takes one photo right now') ? JSON.stringify({ caption: 'Ren lehnt am Garagentor, Abendlicht', ko: '창고 문에 기댄 Ren, 저녁 빛', mood: 'warm' }) : b.includes('[PHOTO]') ? 'PHOTO: 1girl 1boy, riverside, bench, autumn, afternoon, soft light, candid, from side\n[Mara]: smiling, sitting, holding phone, cardigan\n[Ren]: looking at another, leaning on railing, hoodie\nAVOID: text, watermark' : '```json\n' + JSON.stringify(upd ? UPD : FIRST, null, 1) + '\n```';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
    require_log(b);
  });
}).listen(5555);
import fs from 'node:fs';
import os from 'node:os';
// the last request the phone sent, for reading its prompt
function require_log(b) { fs.writeFileSync(`${os.tmpdir()}/na_fakeph_last_req.json`, b); }
