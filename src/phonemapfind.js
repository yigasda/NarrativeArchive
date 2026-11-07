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
    return { ko, lat: lat ? lat.replace(/(^|[\s\-.])(\p{Ll})/gu, (x, a, c) => a + c.toUpperCase()) : '', cjk: cjk || '', all: [ko, ...al] };
}
// the neighbourhoods of a place: the HINT rows whose town is it (or its row's town)
export const placeHoods = i => { const ko = norm(PLACE[i][0]); return HINT.map((h, k) => [h, k]).filter(([h]) => h[0].split(' · ').includes(ko)).map(([, k]) => k); };
const hoodTown = k => { const t = HINT[k][0].split(' · ')[0]; return PLACE.findIndex(x => norm(x[0]) === t); };
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
