// 캐릭터 휴대폰 · 다녀간 곳 › 도시 찾기: find any town in the city table by any of its names (Korean, English, Japanese,
// Chinese, the local spelling), its neighbourhoods and the kinds of map; and what a found town shows (its names, country,
// the maps that suit it, its neighbourhoods). No AI: the table in src/phonemapcity.js.
import { townCandidates } from './phonemapart.js';
import { CITY, HINT, PLACE } from './phonemapcity.js';
import { TOWN_KO } from './phonemaptowns.js';
import { FLAG_NAME } from './phoneflags.js';

const norm = s => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
// how well a name answers a query: 0 the name itself, 1 its start, 2 a word's start, 3 inside it (two letters or more)
const fit = (name, q) => { const n = norm(name); if (n === q) return 0; if (n.startsWith(q)) return 1; if (n.split(/[\s\-'·]+/).some(w => w.startsWith(q))) return 2; return q.length >= 2 && n.includes(q) ? 3 : 9; };
// a place's other names to show beside its Korean one: the English (or local Latin) name, then a Japanese or Chinese one
export function placeNames(i) {
    const [ko, al] = PLACE[i], lat = al.find(n => /^[A-Za-zÀ-ÿ]/.test(n)), cjk = al.find(n => /[぀-ヿ]/.test(n)) || al.find(n => /[一-鿿]/.test(n));
    return { ko, lat: lat ? /[A-Z]/.test(lat) ? lat : lat.replace(/(^|[\s\-.])(\p{Ll})/gu, (x, a, c) => a + c.toUpperCase()) : '', cjk: cjk || '', all: [ko, ...al] };
}
// the neighbourhoods of a place: the HINT rows whose town is it (or its row's town)
export const placeHoods = i => { const ko = norm(PLACE[i][0]); return HINT.map((h, k) => [h, k]).filter(([h]) => h[0].split(' · ').includes(ko)).map(([, k]) => k); };
const hoodTown = k => { const t = HINT[k][0].split(' · ')[0]; return PLACE.findIndex(x => norm(x[0]) === t); };

// a country by any of its names (Korean is FLAG_NAME): English, Japanese, Chinese (simplified, traditional), its own
const COUNTRY = {
    kr: 'Korea|South Korea|韓国|韩国|大韓民国|대한민국|남한', jp: 'Japan|日本|日本国|にほん|にっぽん', cn: 'China|中国|中國|中華人民共和国|中华人民共和国', tw: 'Taiwan|台湾|台灣|臺灣|타이완',
    hk: 'Hong Kong|香港', mo: 'Macau|Macao|澳門|澳门|マカオ', th: 'Thailand|タイ|泰国|泰國|ประเทศไทย|타이', vn: 'Vietnam|Viet Nam|ベトナム|越南|Việt Nam|월남',
    ph: 'Philippines|フィリピン|菲律宾|菲律賓|Pilipinas', sg: 'Singapore|シンガポール|新加坡', my: 'Malaysia|マレーシア|马来西亚|馬來西亞', id: 'Indonesia|インドネシア|印度尼西亚|印尼',
    in: 'India|インド|印度|भारत|Bharat', np: 'Nepal|ネパール|尼泊尔|尼泊爾|नेपाल', mv: 'Maldives|モルディブ|马尔代夫|馬爾地夫', kh: 'Cambodia|カンボジア|柬埔寨|កម្ពុជា',
    mm: 'Myanmar|Burma|ミャンマー|缅甸|緬甸|버마', fj: 'Fiji|フィジー|斐济|斐濟', pf: 'French Polynesia|Tahiti|フランス領ポリネシア|法属波利尼西亚|Polynésie française|타히티',
    ae: 'UAE|United Arab Emirates|Emirates|アラブ首長国連邦|阿联酋|阿聯酋|الإمارات|아랍 에미리트', qa: 'Qatar|カタール|卡塔尔|卡達|قطر', sa: 'Saudi Arabia|Saudi|サウジアラビア|沙特阿拉伯|沙烏地阿拉伯|السعودية|사우디',
    tr: 'Turkey|Türkiye|トルコ|土耳其|터키', jo: 'Jordan|ヨルダン|约旦|約旦|الأردن', il: 'Israel|イスラエル|以色列|ישראל', sy: 'Syria|シリア|叙利亚|敘利亞|سوريا',
    ma: 'Morocco|モロッコ|摩洛哥|المغرب|Maroc', tn: 'Tunisia|チュニジア|突尼斯|تونس|Tunisie', ke: 'Kenya|ケニア|肯尼亚|肯亞', tz: 'Tanzania|タンザニア|坦桑尼亚|坦尚尼亞',
    na: 'Namibia|ナミビア|纳米比亚|納米比亞', mu: 'Mauritius|モーリシャス|毛里求斯|模里西斯|Maurice', sc: 'Seychelles|セーシェル|塞舌尔|塞席爾', za: 'South Africa|南アフリカ|南非|남아공|Suid-Afrika',
    ng: 'Nigeria|ナイジェリア|尼日利亚|奈及利亞', gh: 'Ghana|ガーナ|加纳|迦納', eg: 'Egypt|エジプト|埃及|مصر|Misr',
    de: 'Germany|ドイツ|德国|德國|Deutschland|도이칠란트', gb: 'UK|United Kingdom|Britain|Great Britain|England|Scotland|Wales|イギリス|英国|英國|잉글랜드|스코틀랜드|웨일스|브리튼', ie: 'Ireland|アイルランド|爱尔兰|愛爾蘭|Éire',
    fr: 'France|フランス|法国|法國', mc: 'Monaco|モナコ|摩纳哥|摩納哥', it: 'Italy|イタリア|意大利|義大利|Italia', no: 'Norway|ノルウェー|挪威|Norge|Noreg',
    se: 'Sweden|スウェーデン|瑞典|Sverige', fi: 'Finland|フィンランド|芬兰|芬蘭|Suomi', dk: 'Denmark|デンマーク|丹麦|丹麥|Danmark', is: 'Iceland|アイスランド|冰岛|冰島|Ísland',
    gl: 'Greenland|グリーンランド|格陵兰|格陵蘭|Kalaallit Nunaat|Grønland', es: 'Spain|スペイン|西班牙|España|에스파냐', pt: 'Portugal|ポルトガル|葡萄牙', nl: 'Netherlands|Holland|オランダ|荷兰|荷蘭|Nederland|홀란드',
    be: 'Belgium|ベルギー|比利时|比利時|België|Belgique', ch: 'Switzerland|スイス|瑞士|Schweiz|Suisse|Svizzera', at: 'Austria|オーストリア|奥地利|奧地利|Österreich', cz: 'Czechia|Czech Republic|Czech|チェコ|捷克|Česko',
    pl: 'Poland|ポーランド|波兰|波蘭|Polska', hu: 'Hungary|ハンガリー|匈牙利|Magyarország', ru: 'Russia|ロシア|俄罗斯|俄羅斯|Россия|로씨야', ua: 'Ukraine|ウクライナ|乌克兰|烏克蘭|Україна',
    lv: 'Latvia|ラトビア|拉脱维亚|拉脫維亞|Latvija', ee: 'Estonia|エストニア|爱沙尼亚|愛沙尼亞|Eesti', lt: 'Lithuania|リトアニア|立陶宛|Lietuva', gr: 'Greece|ギリシャ|希腊|希臘|Ελλάδα|Hellas',
    hr: 'Croatia|クロアチア|克罗地亚|克羅埃西亞|Hrvatska', us: 'USA|US|United States|America|アメリカ|米国|美国|美國|아메리카', ca: 'Canada|カナダ|加拿大', au: 'Australia|オーストラリア|豪州|澳大利亚|澳洲|오스트레일리아',
    nz: 'New Zealand|ニュージーランド|新西兰|紐西蘭|Aotearoa', mx: 'Mexico|メキシコ|墨西哥|México', cu: 'Cuba|キューバ|古巴', pr: 'Puerto Rico|プエルトリコ|波多黎各',
    co: 'Colombia|コロンビア|哥伦比亚|哥倫比亞', br: 'Brazil|ブラジル|巴西|Brasil', ar: 'Argentina|アルゼンチン|阿根廷', cl: 'Chile|チリ|智利', pe: 'Peru|ペルー|秘鲁|秘魯|Perú', bo: 'Bolivia|ボリビア|玻利维亚|玻利維亞',
};
const countryNames = cc => [FLAG_NAME[cc], ...(COUNTRY[cc] || '').split('|')].filter(Boolean);
// the countries a query names (its name, its start or a word's start), the closest first
export function findCountries(query) {
    const q = norm(query);
    if (!q) return [];
    return Object.keys(FLAG_NAME).map(cc => [cc, Math.min(...countryNames(cc).map(n => fit(n, q)))]).filter(([, f]) => f <= 2).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([cc, f]) => ({ cc, exact: f === 0 }));
}
// a country's towns (in the table's order: the big ones first) and its neighbourhoods
export const countryTowns = cc => { const seen = new Set(); return PLACE.map((x, i) => i).filter(i => PLACE[i][3] === cc && !seen.has(PLACE[i][2]) && seen.add(PLACE[i][2])); };
export const countryHoods = cc => HINT.map((h, k) => k).filter(k => { const t = hoodTown(k); return t >= 0 && PLACE[t][3] === cc; });
export function findTowns(query) {
    const q = norm(query);
    if (!q) return { towns: [], hoods: [], kinds: [] };
    const towns = PLACE.map((x, i) => [i, Math.min(...[x[0], ...x[1]].map(n => fit(n, q)))]).filter(([, f]) => f < 9).sort((a, b) => a[1] - b[1] || PLACE[a[0]][0].length - PLACE[b[0]][0].length).slice(0, 8).map(([i]) => i);
    const hoods = HINT.map((h, k) => [k, Math.min(...h[1].map(w => fit(w, q)))]).filter(([k, f]) => f < 9 && hoodTown(k) >= 0).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([k]) => k);
    const kinds = Object.keys(TOWN_KO).filter(k => norm(TOWN_KO[k]).includes(q)).slice(0, 6);
    return { towns, hoods, kinds };
}
// the towns a kind of map suits (among the first six of their row, or anywhere in it when few), the best suited first
export function kindTowns(kind) {
    const at = i => CITY[PLACE[i][2]][1].indexOf(kind);
    const pick = most => { const seen = new Set(); return PLACE.map((x, i) => i).filter(i => { const r = PLACE[i][2], k = at(i); if (seen.has(r) || k < 0 || k > most) return false; seen.add(r); return true; }).sort((a, b) => at(a) - at(b)).slice(0, 24); };
    const near = pick(5);
    return near.length >= 6 ? near : pick(99);
}
// a found town: its names, country, the maps that suit it (a neighbourhood's first), its neighbourhoods
export function placeView(i, hood = -1) {
    const [ko, al, , cc] = PLACE[i], hoods = placeHoods(i);
    const words = hood >= 0 ? [HINT[hood][1][0]] : [];
    let maps = townCandidates(ko, words);
    if (hood >= 0) maps = [...new Set([...HINT[hood][2], ...maps])];
    return { ko, names: placeNames(i), cc, country: FLAG_NAME[cc] || '', maps, hoods, hood: hood >= 0 ? { k: hood, label: HINT[hood][3] } : null };
}
export { hoodTown };
