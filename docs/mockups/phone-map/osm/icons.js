// 다녀간 곳 › 지도 아이콘: 24칸 선 그림(예전 지도와 같은 굵기 · 같은 원 배지). 어느 나라 동네든 쓰게 넉넉히.
// ICON[이름] = 경로, pick(tags) = 데이터 태그 → 아이콘 이름
const ICON = {
  // 믿음
  church: 'M12 2v6M9 5h6M5 22V12l7-4 7 4v10M10 22v-5h4v5',
  cathedral: 'M7 22V9l2-5 2 5v13M13 22V9l2-5 2 5v13M4 22h16M9 14h6',
  chapel: 'M12 3v4M10 5h4M7 21v-9l5-4 5 4v9zM11 21v-4h2v4',
  mosque: 'M6 21v-7a6 6 0 0 1 12 0v7zM12 8V5M4 21V10M20 21V10M3 21h18',
  synagogue: 'M12 3l3.5 6h-7zM12 15l-3.5-6h7zM5 21V13h14v8',
  shrine: 'M3 6h18M5 9h14M7 9v13M17 9v13M4 4l16 0',
  temple: 'M12 2l8 6H4zM6 8v10M18 8v10M3 18h18M9 18v-5h6v5',
  pagoda: 'M12 2v3M6 8h12l-2-3H8zM7 13h10l-2-3H9zM8 18h8l-1.5-3h-5zM10 18v3h4v-3',
  // 문화
  museum: 'M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18',
  gallery: 'M4 5h16v14H4zM4 15l5-5 4 4 2-2 5 5M15 9.5a1 1 0 1 0 0 .1',
  theatre: 'M4 4h7v7a3.5 3.5 0 0 1-7 0zM13 8h7v7a3.5 3.5 0 0 1-7 0zM6 7.5h.5M8.5 7.5H9M15 11.5h.5M17.5 11.5h.5',
  cinema: 'M4 7h12v10H4zM16 10l4-2v8l-4-2M7 4.5a1.5 1.5 0 1 0 0 .1M12 4.5a1.5 1.5 0 1 0 0 .1',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 3 15.5-3.5.9z',
  monument: 'M10 21V8l2-5 2 5v13M7 21h10',
  statue: 'M12 3a2 2 0 1 0 0 .1M9 21v-6l-1-5h8l-1 5v6M7 21h10',
  castle: 'M4 21V8h3v2h3V8h4v2h3V8h3v13zM10 21v-5h4v5',
  palace: 'M3 21V11l3-2 3 2V7l3-3 3 3v4l3-2 3 2v10zM10 21v-4h4v4',
  ruin: 'M4 21V9l2-2 2 2v5M10 21V5h4v8M16 21v-6l2-2 2 2v6M3 21h18',
  tower: 'M12 2l3 20H9zM10 9h4M9.4 14h5.2',
  clock: 'M8 21V7l4-4 4 4v14zM12 10a2.5 2.5 0 1 0 0 .1M12 10v1.5M6 21h12',
  lighthouse: 'M10 21l1-12h2l1 12zM9 9h6M10 9V6h4v3M12 6V3M6 5l3 1M18 5l-3 1',
  windmill: 'M12 9l-5-5M12 9l5-5M12 9l-5 5M12 9l5 5M9.5 21l1.5-9h2l1.5 9zM8 21h8',
  observatory: 'M4 15a8 8 0 0 1 16 0zM12 7l5-3M3 15h18v6H3z',
  // 자연 · 쉼
  park: 'M12 3l5 8h-3l4 6H6l4-6H7zM12 17v4',
  garden: 'M12 21v-8M12 13c-4 0-6-3-6-7 4 0 6 3 6 7zM12 13c4 0 6-3 6-7-4 0-6 3-6 7zM8 21h8',
  forest: 'M8 3l4 7H4zM8 10v3M16 6l5 9H11zM16 15v5M3 21h18',
  mountain: 'M2 20l7-12 4 6 3-4 6 10zM8 10l1.5 2 1-1',
  view: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  beach: 'M4 20h16M6 20c2-6 6-9 12-10M10 12l-4-6M10 12a6 6 0 0 1 8-5',
  lake: 'M3 9c3-2 5 2 9 0s6 2 9 0M3 14c3-2 5 2 9 0s6 2 9 0M3 19c3-2 5 2 9 0s6 2 9 0',
  fountain: 'M12 13V5M12 5c-2 0-4 2-4 5M12 5c2 0 4 2 4 5M5 15h14l-2 5H7z',
  zoo: 'M7 9a2 2 0 1 0 0 .1M17 9a2 2 0 1 0 0 .1M4 13a2 2 0 1 0 0 .1M20 13a2 2 0 1 0 0 .1M8 19c0-4 2-6 4-6s4 2 4 6c-2 1-6 1-8 0z',
  playground: 'M4 21L9 5h6l5 16M7 14h10M12 5v4M10 13l-2 8',
  spring: 'M7 20c-3-3-3-7 0-9h10c3 2 3 6 0 9zM9 8c-1-2 1-3 0-5M12 8c-1-2 1-3 0-5M15 8c-1-2 1-3 0-5',
  camp: 'M3 20l9-15 9 15zM12 5v15M9 20l3-6 3 6',
  // 운동
  stadium: 'M3 9c0-2 4-4 9-4s9 2 9 4v6c0 2-4 4-9 4s-9-2-9-4zM3 9c0 2 4 4 9 4s9-2 9-4',
  sports: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18',
  swim: 'M3 17c2-1.5 3 1.5 5 0s3 1.5 5 0 3 1.5 5 0 3 1.5 3 0M7 13l4-6 4 3M17 7.5a1.5 1.5 0 1 0 0 .1',
  golf: 'M9 21V3l8 3-8 3M5 21h8',
  ski: 'M4 20l16-6M7 4a1.5 1.5 0 1 0 0 .1M8 8l3 4 4-1M11 12l-2 5',
  bike: 'M6 17a3 3 0 1 0 0 .1M18 17a3 3 0 1 0 0 .1M6 17l4-7h6l2 7M10 10l2 7h4M14 7h3',
  // 먹고 사기
  shop: 'M5 8h14l-1.2 12H6.2zM9 8V6a3 3 0 0 1 6 0v2',
  market: 'M3 9l2-5h14l2 5zM3 9c0 2 2 3 3 3s3-1 3-3c0 2 2 3 3 3s3-1 3-3c0 2 2 3 3 3s3-1 3-3M5 12v8h14v-8',
  mall: 'M4 21V7h16v14M4 11h16M9 21v-5h6v5M8 7V4h8v3',
  cafe: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3c-1 2 1 3 0 5M12 3c-1 2 1 3 0 5',
  food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 0-3 3-3 7h3v11',
  bar: 'M6 4h12l-6 8zM12 12v7M8 21h8',
  beer: 'M6 7h9v13H6zM15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 7c0-2 1-3 3-3 1-1 3-1 4 0 2 0 2 2 2 3',
  bakery: 'M4 15c0-5 4-8 8-8s8 3 8 8c-2 2-14 2-16 0zM8 9l1 5M12 8v6M16 9l-1 5',
  wine: 'M8 3h8c0 5-1 8-4 8s-4-3-4-8zM12 11v8M8 21h8',
  // 머무르기 · 생활
  hotel: 'M3 18V7M3 13h18v5M21 18v-3M7 11a2 2 0 1 0 0 .1M10 13V10h8a3 3 0 0 1 3 3',
  hospital: 'M4 4h16v16H4zM12 8v8M8 12h8',
  pharmacy: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  school: 'M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5',
  university: 'M3 9l9-5 9 5M5 9v9M19 9v9M9 12v6M15 12v6M3 20h18M12 6.5h.1',
  townhall: 'M4 21V10h16v11M2 10l10-6 10 6M12 4V2M9 21v-6h6v6M7 13v2M17 13v2',
  police: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM12 9l1 2h2l-1.5 1.5.5 2-2-1-2 1 .5-2L9 11h2z',
  fire: 'M12 21c-4 0-6-3-6-6 0-4 4-6 4-11 3 2 6 5 6 9 1-1 1.5-2 1.5-3 1.5 1.5 2.5 3 2.5 5 0 3-3 6-8 6z',
  post: 'M3 6h18v12H3zM3 6l9 7 9-7',
  bank: 'M3 9l9-5 9 5zM5 9v8M10 9v8M14 9v8M19 9v8M3 19h18',
  // 탈것
  train: 'M7 3h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2zM5 10h14M8 21l1.5-4M16 21l-1.5-4M8.5 14h.1M15.5 14h.1',
  tram: 'M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 12h12M12 6V3M9 3h6M8 21l1-3M16 21l-1-3',
  metro: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM7 16V8l5 6 5-6v8',
  bus: 'M6 4h12a2 2 0 0 1 2 2v11H4V6a2 2 0 0 1 2-2zM4 12h16M7 20v-3M17 20v-3M7.5 15h.1M16.5 15h.1',
  boat: 'M3 15h18l-3 5H6zM12 4v11M12 4l6 8h-6',
  ferry: 'M3 16l2 4h14l2-4zM6 16V11h12v5M9 11V7h6v4M3 22c2-1 3 1 5 0s3 1 5 0 3 1 5 0',
  harbour: 'M12 5a2 2 0 1 0 0 .1M12 7v13M8 11h8M5 15c0 3 3 5 7 5s7-2 7-5',
  airport: 'M21 15l-8-4V5a1 1 0 0 0-2 0v6l-8 4v2l8-2v4l-2 2h6l-2-2v-4l8 2z',
  cable: 'M3 6l18-3M10 5v4M7 9h8v7H7zM7 13h8',
  parking: 'M5 3h14v18H5zM10 17V7h3a3 3 0 0 1 0 6h-3',
  fuel: 'M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 21h12M5 10h10M15 8l3 3v7a1.5 1.5 0 0 0 3 0V9l-3-3',
  bridge: 'M3 16h18M5 16c2-6 12-6 14 0M8 16v-3M16 16v-3',
  // 그 밖
  cemetery: 'M8 21V9a4 4 0 0 1 8 0v12M5 21h14M12 10v5M10 12h4',
  wheel: 'M12 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 3v16M4 11h16M6.3 5.3l11.4 11.4M17.7 5.3L6.3 16.7M8 21l4-2 4 2',
  aquarium: 'M3 12c3-5 8-6 12-3l4-3v12l-4-3c-4 3-9 2-12-3zM8 11h.1',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.1',
};
// data tags → icon name (first match wins); null when nothing fits
function pick(t) {
  const a = t.amenity, to = t.tourism, h = t.historic, l = t.leisure, b = t.building, r = t.religion, m = t.man_made, sh = t.shop;
  if (a === 'place_of_worship' || /^(church|cathedral|chapel|mosque|synagogue|temple|shrine)$/.test(b || '')) {
    if (r === 'muslim' || b === 'mosque') return 'mosque';
    if (r === 'jewish' || b === 'synagogue') return 'synagogue';
    if (r === 'shinto' || b === 'shrine') return 'shrine';
    if (r === 'buddhist' || b === 'temple') return /pagoda/.test(t['building:architecture'] || '') ? 'pagoda' : 'temple';
    if (b === 'cathedral' || t.denomination && /cathedral/.test(t.name || '')) return 'cathedral';
    if (b === 'chapel') return 'chapel';
    return 'church';
  }
  if (b === 'train_station' || t.railway === 'station' && t.station !== 'subway') return 'train';
  if (t.railway === 'station' && t.station === 'subway') return 'metro';
  if (t.railway === 'tram_stop') return 'tram';
  if (to === 'museum' || b === 'museum') return 'museum';
  if (to === 'gallery' || a === 'arts_centre') return 'gallery';
  if (a === 'theatre') return 'theatre'; if (a === 'cinema') return 'cinema'; if (a === 'concert_hall' || a === 'music_venue') return 'music';
  if (a === 'library') return 'library';
  if (h === 'castle' || b === 'castle') return 'castle'; if (b === 'palace' || h === 'palace') return 'palace';
  if (h === 'ruins') return 'ruin'; if (h === 'monument' || h === 'memorial') return 'monument'; if (to === 'artwork' && t.artwork_type === 'statue') return 'statue';
  if (m === 'lighthouse') return 'lighthouse'; if (m === 'windmill' || h === 'windmill') return 'windmill'; if (m === 'observatory') return 'observatory';
  if (m === 'tower' || b === 'tower') return t['tower:type'] === 'bell_tower' ? 'clock' : 'tower';
  if (a === 'fountain') return 'fountain';
  if (to === 'zoo') return 'zoo'; if (to === 'aquarium') return 'aquarium'; if (to === 'theme_park' || a === 'ferris_wheel') return 'wheel';
  if (to === 'viewpoint') return 'view'; if (t.natural === 'peak') return 'mountain'; if (t.natural === 'beach') return 'beach';
  if (to === 'camp_site') return 'camp'; if (a === 'public_bath' || t.natural === 'hot_spring') return 'spring';
  if (l === 'stadium' || b === 'stadium') return 'stadium'; if (l === 'sports_centre' || l === 'sports_hall') return 'sports';
  if (l === 'swimming_pool' || l === 'water_park') return 'swim'; if (l === 'golf_course') return 'golf'; if (l === 'playground') return 'playground';
  if (l === 'park') return 'park'; if (l === 'garden') return 'garden';
  if (a === 'marketplace') return 'market'; if (sh === 'mall' || sh === 'department_store' || b === 'retail' && t.name) return 'mall';
  if (a === 'cafe') return 'cafe'; if (a === 'restaurant' || a === 'fast_food') return 'food'; if (a === 'bar' || a === 'pub') return a === 'pub' ? 'beer' : 'bar'; if (a === 'biergarten') return 'beer';
  if (sh === 'bakery') return 'bakery'; if (sh === 'wine' || l === 'vineyard') return 'wine'; if (sh) return 'shop';
  if (to === 'hotel' || b === 'hotel') return 'hotel';
  if (a === 'hospital' || b === 'hospital') return 'hospital'; if (a === 'pharmacy') return 'pharmacy';
  if (a === 'university' || a === 'college' || b === 'university') return 'university'; if (a === 'school' || b === 'school') return 'school';
  if (a === 'townhall' || b === 'government' && t.name) return 'townhall'; if (a === 'police') return 'police'; if (a === 'fire_station') return 'fire';
  if (a === 'post_office') return 'post'; if (a === 'bank') return 'bank';
  if (a === 'bus_station') return 'bus'; if (a === 'ferry_terminal') return 'ferry'; if (l === 'marina' || t.harbour) return 'harbour';
  if (t.aeroway === 'aerodrome' || t.aeroway === 'terminal') return 'airport'; if (t.aerialway) return 'cable';
  if (a === 'parking' && t.name) return 'parking'; if (a === 'fuel') return 'fuel'; if (a === 'bicycle_rental') return 'bike';
  if (t.landuse === 'cemetery' || a === 'grave_yard') return 'cemetery';
  if (to === 'attraction' || to === 'information' && t.information === 'office') return to === 'attraction' ? 'view' : 'info';
  return null;
}
module.exports = { ICON, pick };
