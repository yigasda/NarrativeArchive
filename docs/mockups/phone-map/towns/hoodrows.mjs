// (run once, 3.194: node docs/mockups/phone-map/towns/hoodrows.mjs out.json — then its rows went into citytable.md by section)
// HOODS (placehoods.js) neighbourhoods of the cities the map's HINT lacks → 동네 단서 rows for citytable.md, one row a neighbourhood:
// its names as HOODS writes them, and the maps: the ones its kind suits first, then its city's own maps
import { HOODS } from '/home/user/NarrativeArchive/src/placehoods.js';
import { CITY, PLACE } from '/home/user/NarrativeArchive/src/phonemapcity.js';
import { TOWN_KO } from '/home/user/NarrativeArchive/src/phonemaptowns.js';
import fs from 'fs';
const KO = k => (TOWN_KO[k] === '만 · 해안' ? '만 해안' : TOWN_KO[k]);
// a neighbourhood's kind → the maps that suit it, best first
const T = {
  cbd: '도심 업무지구 · 대로 사이 큰 단지 · 역 앞 번화가 · 방사형 광장 · 아파트 단지',
  shop: '역 앞 번화가 · 도심 업무지구 · 골목 주택가 · 방사형 광장 · 대로 사이 큰 단지',
  night: '역 앞 번화가 · 골목 주택가 · 대학가 · 원룸촌 · 도심 업무지구',
  old: '유럽 소도시 광장 · 골목 주택가 · 옛 시내 + 새 시내 · 방사형 광장 · 해자 두른 성 마을 · 언덕 주택가',
  oldasia: '골목 주택가 · 옛 시내 + 새 시내 · 사원 유적 · 역 앞 번화가 · 지방 소도시 시내',
  hip: '골목 주택가 · 테라스 하우스 동네 · 중정 블록 시가지 · 대학가 · 원룸촌 · 언덕 주택가 · 역 앞 번화가',
  rich: '단독주택 주택가 · 언덕 주택가 · 테라스 하우스 동네 · 넓은 교외 · 오스만 블록 시가지',
  beach: '해변 소도시 · 열대 해변 리조트 · 만 해안 · 언덕 주택가',
  port: '계단식 언덕 항구 · 만 해안 · 컨테이너 항구 · 운하 바둑판 · 도심 업무지구',
  island: '섬 · 열대 해변 리조트 · 만 해안 · 다도해',
  airport: '공항 옆 동네 · 신도시 나들목 · 교외 고리길',
  suburb: '넓은 교외 · 교외 고리길 · 큰길 상가 교외 · 아파트 단지 · 교외 역세권',
  newtown: '신도시 나들목 · 아파트 단지 · 대로 사이 큰 단지 · 호숫가 교외 도시 · 도심 업무지구',
  kr: '골목 주택가 · 지방 소도시 시내 · 역 앞 번화가 · 해자 두른 성 마을 · 빌라촌',
  krapt: '아파트 단지 · 신도시 나들목 · 대로 사이 큰 단지 · 도심 업무지구 · 학교 캠퍼스 동네',
  hanok: '골목 주택가 · 지방 소도시 시내 · 해자 두른 성 마을 · 옛 시내 + 새 시내',
  temple: '사원 유적 · 골목 주택가 · 옛 시내 + 새 시내 · 해자 두른 성 마을',
  palace: '해자 두른 성 마을 · 방사형 광장 · 유럽 소도시 광장 · 옛 시내 + 새 시내',
  river: '큰 강 대도시 · 강 가운데 섬 · 운하 바둑판 · 도심 업무지구',
  lake: '호숫가 교외 도시 · 호숫가 휴양지 · 바둑판 + 호수 · 단독주택 주택가',
  canal: '운하 바둑판 · 골목 주택가 · 유럽 소도시 광장 · 테라스 하우스 동네',
  grid: '사선 바둑판 + 바다 · 중정 블록 시가지 · 오스만 블록 시가지 · 도심 업무지구',
  market: '골목 주택가 · 역 앞 번화가 · 지방 소도시 시내 · 유럽 소도시 광장',
  park: '방사형 광장 · 단독주택 주택가 · 학교 캠퍼스 동네 · 큰 강 대도시',
  hill: '언덕 주택가 · 계단식 언덕 항구 · 골목 주택가 · 산 아래 도시',
  rice: '계단식 논 · 논밭 사이 마을 · 사원 유적 · 골목 주택가',
  desert: '사막 오아시스 · 이집트 · 골목 주택가 · 옛 시내 + 새 시내',
  township: '넓은 교외 · 골목 주택가 · 사바나 마을 · 큰길 상가 교외',
  strip: '큰길 상가 교외 · 도심 업무지구 · 사막 오아시스 · 역 앞 번화가',
  campus: '학교 캠퍼스 동네 · 대학가 · 원룸촌 · 골목 주택가 · 단독주택 주택가',
};
// the city (as HOODS writes it) → its neighbourhoods' kinds, in HOODS order; and the map town it is (PLACE's Korean name)
const C = {
  대구: 'shop krapt kr', 대전: 'krapt campus kr', 광주: 'shop newtown', 수원: 'newtown hanok shop', 강릉: 'beach port port', 전주: 'hanok',
  나고야: 'shop cbd', 광저우: 'cbd cbd', 선전: 'newtown cbd shop', 마카오: 'old island island',
  싱가포르: 'cbd shop island night shop market airport hip', 방콕: 'cbd shop cbd night cbd hip hip market airport',
  하노이: 'oldasia oldasia lake palace', 호치민: 'cbd night market rich newtown', 다낭: 'beach oldasia',
  마닐라: 'cbd newtown night palace port', 자카르타: 'cbd park rich', 발리: 'beach beach rice beach beach beach',
  쿠알라룸푸르: 'shop cbd hip rich market', 뭄바이: 'hip old beach suburb cbd', 델리: 'palace hip market market suburb',
  벵갈루루: 'hip hip shop newtown', 두바이: 'cbd port beach beach market oldasia cbd island',
  이스탄불: 'shop hill palace port port port shop hill', 더블린: 'night shop hip', 빈: 'palace hip river market palace',
  취리히: 'old old shop hip', 마드리드: 'palace shop hip hip hip rich old',
  바르셀로나: 'old old hip grid hip beach shop grid', 리스본: 'hill hill old old palace hip', 포르투: 'port rich',
  암스테르담: 'canal hip palace night park newtown airport', 브뤼셀: 'old hip hip rich',
  프라하: 'old hill palace hip hip', 부다페스트: 'hip palace', 바르샤바: 'old hip suburb',
  코펜하겐: 'port hip hip hip shop', 스톡홀름: 'old hill rich cbd', 헬싱키: 'hip port hip', 아테네: 'old market rich hip',
  모스크바: 'old palace old shop', 시애틀: 'hip port hip market', 워싱턴: 'rich rich palace park', 라스베이거스: 'strip strip',
  토론토: 'cbd market rich hip port', 밴쿠버: 'old cbd beach island shop', 몬트리올: 'old hip hip',
  멕시코시티: 'hip hip rich old old', 상파울루: 'cbd hip rich market', 리우데자네이루: 'beach beach rich night hill',
  부에노스아이레스: 'hip old rich port port', 시드니: 'port old beach hip hip port beach', 멜버른: 'hip beach cbd hip',
  오클랜드: 'hip rich port', 카이로: 'river desert palace suburb', 케이프타운: 'port beach hill rich',
  요하네스버그: 'cbd rich hip township', 라고스: 'cbd rich newtown', 나이로비: 'cbd rich', 마라케시: 'market newtown',
};
const TOWN = { 호치민: '호찌민', 벵갈루루: '방갈로르' };
const kindsOf = s => s.split(' · ').map(x => x.trim());
const out = new Map(); // town → rows
for (const [city, tags] of Object.entries(C)) {
  const row = HOODS.find(r => r[0].split('|')[0] === city); const hoods = row.slice(2), tg = tags.split(' ');
  if (tg.length !== hoods.length) throw new Error(`${city}: ${tg.length} kinds for ${hoods.length} hoods`);
  const town = TOWN[city] || city, pl = PLACE.find(x => x[0] === town), own = pl ? CITY[pl[2]][1].map(KO) : [];
  out.set(town, hoods.map((h, k) => {
    const names = h.split('|'), first = kindsOf(T[tg[k]]), maps = [...new Set([...first, ...own])].slice(0, 9);
    return `| ${town} | ${names.join(' · ')} | ${maps.join(' · ')} |`;
  }));
}
fs.writeFileSync(process.argv[2], JSON.stringify(Object.fromEntries(out), null, 1));
console.log([...out.values()].flat().length, 'rows');
