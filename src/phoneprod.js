// 쇼핑 (v3.150): a product's picture, one flat silhouette on light grey, chosen from its own words (no model field);
// its colour only when the item names one (Grau, black, 네이비 …), else a quiet grey
const P = {
    scarf: (c, l) => `<path d="M12 14q18 14 36 0l2 8q-8 8-14 9v19h-9V31q-9-2-17-9z" fill="${c}"/><path d="M27 31v19h-9V34q4-1 9-3z" fill="${c}" opacity=".8"/><path d="M27 50v5M30 50v5M33 50v5M18 50v5M21 50v5M24 50v5" stroke="${c}" stroke-width="1.4"/><path d="M14 18q16 12 32 0" stroke="${l}" stroke-width="1.4" fill="none"/>`,
    sweater: (c, l) => `<path d="M20 12l-12 8 4 12 6-3v21h24V29l6 3 4-12-12-8q-4 5-10 5t-10-5z" fill="${c}"/><path d="M18 48h24" stroke="${l}" stroke-width="2"/><path d="M24 13q6 4 12 0" stroke="${l}" stroke-width="1.6" fill="none"/>`,
    tshirt: (c, l) => `<path d="M21 12l-13 7 5 9 5-3v25h24V25l5 3 5-9-13-7q-3 4-9 4t-9-4z" fill="${c}"/>`,
    jacket: (c, l) => `<path d="M20 12l-12 8 2 30h8V30v20h24V30v20h8l2-30-12-8-10 8z" fill="${c}"/><path d="M30 20v30" stroke="${l}" stroke-width="1.6"/><circle cx="33" cy="28" r="1.2" fill="${l}"/><circle cx="33" cy="36" r="1.2" fill="${l}"/>`,
    pants: (c, l) => `<path d="M18 10h24l3 42h-9l-6-28-6 28h-9z" fill="${c}"/><path d="M18 15h24" stroke="${l}" stroke-width="1.6"/>`,
    dress: (c, l) => `<path d="M24 10h12l-2 10 12 32H14l12-32z" fill="${c}"/><path d="M22 26h16" stroke="${l}" stroke-width="1.6"/>`,
    shoes: (c, l) => `<path d="M6 40q0-12 8-14l8 4q6 2 12 2l12 2q8 2 8 8v2H6z" fill="${c}"/><path d="M6 44h48" stroke="${l}" stroke-width="3"/><path d="M18 30l3 4M22 29l3 4" stroke="${l}" stroke-width="1.4"/>`,
    boots: (c, l) => `<path d="M16 8h14v24l14 6q6 2 6 8v4H16z" fill="${c}"/><path d="M16 46h34" stroke="${l}" stroke-width="3"/>`,
    bag: (c, l) => `<path d="M22 20q0-10 8-10t8 10" stroke="${c}" stroke-width="3" fill="none"/><path d="M12 20h36l-3 32H15z" fill="${c}"/><path d="M14 28h32" stroke="${l}" stroke-width="1.4"/>`,
    backpack: (c, l) => `<rect x="16" y="12" width="28" height="40" rx="9" fill="${c}"/><rect x="21" y="32" width="18" height="14" rx="3" fill="${l}" opacity=".6"/><path d="M24 12q0-6 6-6t6 6" stroke="${c}" stroke-width="3" fill="none"/>`,
    hat: (c, l) => `<path d="M14 36q0-20 16-20t16 20z" fill="${c}"/><ellipse cx="30" cy="38" rx="22" ry="5" fill="${c}"/><path d="M15 32h30" stroke="${l}" stroke-width="2"/>`,
    socks: (c, l) => `<path d="M16 8h11v26l-4 10q-2 6-8 4t-4-8l5-9z" fill="${c}"/><path d="M33 12h11v26l-4 10q-2 6-8 4t-4-8l5-9z" fill="${c}" opacity=".75"/><path d="M16 14h11M33 18h11" stroke="${l}" stroke-width="2"/>`,
    book: (c, l) => `<path d="M14 10h28a4 4 0 0 1 4 4v38H18a4 4 0 0 1-4-4z" fill="${c}"/><path d="M18 46h28" stroke="${l}" stroke-width="3"/><path d="M22 18h16M22 23h12" stroke="${l}" stroke-width="1.8"/>`,
    key: (c, l) => `<circle cx="20" cy="22" r="10" fill="none" stroke="${c}" stroke-width="5"/><path d="M27 29l18 18M38 40l4-4M43 45l4-4" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
    earphones: (c, l) => `<rect x="12" y="20" width="36" height="26" rx="13" fill="${c}"/><path d="M14 33h32" stroke="${l}" stroke-width="1.4"/><circle cx="30" cy="40" r="1.6" fill="${l}"/>`,
    phonecase: (c, l) => `<rect x="18" y="6" width="24" height="48" rx="6" fill="${c}"/><rect x="21" y="10" width="9" height="11" rx="3" fill="${l}" opacity=".7"/><circle cx="25.5" cy="15.5" r="2" fill="${c}"/>`,
    laptop: (c, l) => `<rect x="12" y="14" width="36" height="24" rx="2" fill="${c}"/><rect x="15" y="17" width="30" height="18" fill="${l}" opacity=".5"/><path d="M6 42h48l-4 6H10z" fill="${c}"/>`,
    cable: (c, l) => `<rect x="14" y="10" width="14" height="18" rx="3" fill="${c}"/><path d="M18 10V5M24 10V5" stroke="${c}" stroke-width="2.4"/><path d="M21 28q0 12 10 14t10 10" stroke="${c}" stroke-width="3" fill="none"/><rect x="38" y="48" width="8" height="8" rx="2" fill="${c}"/>`,
    watch: (c, l) => `<rect x="22" y="4" width="16" height="52" rx="5" fill="${c}" opacity=".55"/><circle cx="30" cy="30" r="13" fill="${c}"/><circle cx="30" cy="30" r="9.5" fill="${l}"/><path d="M30 24v6l4 3" stroke="${c}" stroke-width="1.8" fill="none"/>`,
    glasses: (c, l) => `<circle cx="19" cy="32" r="9" fill="none" stroke="${c}" stroke-width="3.4"/><circle cx="41" cy="32" r="9" fill="none" stroke="${c}" stroke-width="3.4"/><path d="M28 31q2-3 4 0M10 30L5 24M50 30l5-6" stroke="${c}" stroke-width="3"/>`,
    cosmetics: (c, l) => `<rect x="14" y="22" width="14" height="30" rx="3" fill="${c}"/><rect x="17" y="12" width="8" height="10" rx="2" fill="${c}" opacity=".7"/><rect x="34" y="30" width="14" height="22" rx="7" fill="${c}" opacity=".8"/><rect x="37" y="24" width="8" height="7" rx="2" fill="${c}"/>`,
    perfume: (c, l) => `<rect x="16" y="22" width="28" height="30" rx="5" fill="${c}"/><rect x="25" y="12" width="10" height="10" rx="2" fill="${c}" opacity=".7"/><rect x="21" y="30" width="18" height="10" rx="2" fill="${l}" opacity=".6"/>`,
    mug: (c, l) => `<path d="M14 18h26v24a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z" fill="${c}"/><path d="M40 24h4a6 6 0 0 1 0 12h-4" stroke="${c}" stroke-width="3.4" fill="none"/>`,
    plant: (c, l) => `<path d="M20 36h20l-3 18H23z" fill="${c}"/><path d="M30 36V20M30 28q-10 0-12-10q10 0 12 10M30 24q8-2 12-12q-10 2-12 12" fill="${c}" stroke="${c}" stroke-width="2" opacity=".75"/>`,
    candle: (c, l) => `<rect x="18" y="24" width="24" height="28" rx="4" fill="${c}"/><path d="M30 24v-5" stroke="${c}" stroke-width="1.6"/><path d="M30 8q4 5 0 10q-4-5 0-10z" fill="${c}" opacity=".6"/><path d="M18 34h24" stroke="${l}" stroke-width="2"/>`,
    toy: (c, l) => `<circle cx="30" cy="38" r="14" fill="${c}"/><circle cx="30" cy="20" r="10" fill="${c}"/><circle cx="22" cy="12" r="4.5" fill="${c}"/><circle cx="38" cy="12" r="4.5" fill="${c}"/><circle cx="30" cy="22" r="3" fill="${l}" opacity=".7"/>`,
    tool: (c, l) => `<path d="M14 46l18-18" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M30 14a10 10 0 0 0 12 14l-4-4 3-6 6-3 4 4a10 10 0 0 0-14-12z" fill="${c}"/>`,
    lamp: (c, l) => `<path d="M18 26h24l-5-16H23z" fill="${c}"/><path d="M30 26v22M20 50h20" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`,
    umbrella: (c, l) => `<path d="M6 30q0-20 24-20t24 20q-4-4-8 0q-4-4-8 0q-4-4-8 0q-4-4-8 0q-4-4-8 0q-4-4-8 0z" fill="${c}"/><path d="M30 30v18q0 4-4 4t-4-4" stroke="${c}" stroke-width="2.6" fill="none"/>`,
    bottle: (c, l) => `<path d="M26 6h8v12q6 4 6 12v22H20V30q0-8 6-12z" fill="${c}"/><rect x="21" y="32" width="18" height="12" fill="${l}" opacity=".6"/>`,
    giftbox: (c, l) => `<rect x="12" y="24" width="36" height="28" rx="2" fill="${c}"/><rect x="10" y="18" width="40" height="8" rx="2" fill="${c}"/><path d="M30 18v34" stroke="${l}" stroke-width="3"/><path d="M30 18q-10-10-12-4t12 4q10-10 12-4t-12 4" fill="none" stroke="${c}" stroke-width="2.4"/>`,
    box: (c, l) => `<path d="M10 20l20-10 20 10v24L30 54 10 44z" fill="${c}"/><path d="M10 20l20 10 20-10M30 30v24" stroke="${l}" stroke-width="1.6" fill="none"/>`,
};
// the item's words → a kind; first match wins, the narrower words first
const KIND = [['phonecase', /handyhülle|phone ?case|폰 ?케이스|휴대폰 ?케이스|coque|スマホケース|携帯ケース|手机壳|핸드폰 ?케이스|아이폰 ?케이스|갤럭시 ?케이스|스마트톡/i], ['earphones', /kopfhörer|earbud|earphone|headphone|airpods|이어폰|헤드폰|écouteurs|イヤホン|ヘッドホン|耳机|에어팟|버즈|헤드셋/i], ['cable', /kabel|cable|charger|ladegerät|adapter|usb|충전기|케이블|어댑터|充電器|ケーブル|充电器|数据线|充电线|보조 ?배터리|멀티탭|충전/i],
    ['laptop', /laptop|notebook|macbook|tablet|ipad|노트북|태블릿|ノートパソコン|パソコン|タブレット|笔记本电脑|平板|아이패드|맥북|모니터|키보드|마우스/i], ['watch', /uhr\b|watch|armbanduhr|시계|워치|腕時計|スマートウォッチ|手表|智能手表|손목시계|애플 ?워치/i], ['glasses', /brille|glasses|sunglass|안경|선글라스|lunettes|メガネ|眼鏡|サングラス|眼镜|墨镜|렌즈/i],
    ['scarf', /schal|scarf|tuch|목도리|스카프|머플러|écharpe|マフラー|スカーフ|围巾|넥워머/i], ['sweater', /pullover|sweater|strick|cardigan|hoodie|니트|스웨터|가디건|후드|pull\b|セーター|ニット|カーディガン|パーカー|毛衣|针织|卫衣|맨투맨|후리스/i], ['jacket', /jacke|mantel|coat|jacket|blazer|parka|코트|재킷|자켓|패딩|점퍼|コート|ジャケット|ダウン|外套|夹克|大衣|羽绒服|바람막이|트렌치|블레이저|야상/i],
    ['dress', /kleid|dress|robe|원피스|드레스|ワンピース|ドレス|连衣裙|裙子|치마|스커트/i], ['pants', /hose|jeans|pants|trousers|slacks|바지|청바지|슬랙스|pantalon|パンツ|ズボン|ジーンズ|裤子|牛仔裤|레깅스|반바지|조거|트레이닝/i], ['tshirt', /t-?shirt|shirt|bluse|top\b|tee\b|티셔츠|셔츠|블라우스|Tシャツ|シャツ|ブラウス|T恤|衬衫|반팔|긴팔|민소매|잠옷|파자마|속옷/i],
    ['boots', /stiefel|boots|부츠|ブーツ|靴子|长靴|장화|워커/i], ['shoes', /schuh|sneaker|shoe|turnschuh|운동화|신발|스니커즈|구두|chaussure|スニーカー|靴|シューズ|鞋|运动鞋|로퍼|슬리퍼|샌들|러닝화/i], ['socks', /socken|socks|strümpfe|양말|靴下|ソックス|袜子|스타킹/i], ['hat', /mütze|hut\b|cap\b|hat\b|beanie|모자|비니|帽子|キャップ|ニット帽|버킷햇|베레모/i],
    ['backpack', /rucksack|backpack|백팩|배낭|リュック|バックパック|背包|双肩包|책가방/i], ['bag', /tasche|bag|handtasche|tote|가방|토트|파우치|sac\b|バッグ|トート|鞄|かばん|包包|钱包|手提包|托特包|지갑|에코백|크로스백|숄더백|클러치|캐리어/i], ['umbrella', /schirm|umbrella|우산|傘|かさ|雨伞|伞|양산|우비/i],
    ['book', /buch|book|roman|reiseführer|novel|comic|manga|책|소설|만화|가이드북|livre|libro|本\b|書籍|小説|漫画|ガイドブック|书|小说|漫画书|잡지|매거진|악보|교재|문제집|에세이|시집|다이어리|수첩|플래너|달력|앨범|노트/i], ['key', /schlüssel|(?<![a-z])keys?\b|열쇠|키링|鍵|合鍵|キー|钥匙|자물쇠|도어락/i], ['tool', /werkzeug|schrauben|zange|bohr|tool|wrench|hammer|공구|드라이버|렌치|工具|ドライバー|レンチ|扳手|螺丝刀|schraub|망치|드릴|펜치|줄자/i],
    ['perfume', /parfum|perfume|eau de|향수|香水|parfüm|바디 ?미스트|디퓨저/i], ['cosmetics', /creme|cream|serum|lotion|shampoo|lipstick|makeup|kosmetik|skincare|화장품|크림|세럼|로션|샴푸|립스틱|스킨케어|化粧品|クリーム|美容液|化妆品|面霜|精华|口红|선크림|토너|마스크팩|쿠션|파운데이션|틴트|바디워시|핸드크림/i],
    ['candle', /kerze|candle|향초|캔들|キャンドル|ろうそく|蜡烛|香薰|양초/i], ['mug', /tasse|becher|mug|cup\b|머그|텀블러|マグ|カップ|コップ|杯子|马克杯|머그컵|유리컵|텀블러|물병|보온병|그릇|접시|냄비|프라이팬/i], ['plant', /pflanze|plant|blumentopf|kaktus|화분|식물|다육|観葉植物|植物|鉢|盆栽|绿植|多肉|꽃다발|꽃|씨앗/i], ['lamp', /lampe|lamp|leuchte|조명|스탠드|램프|ランプ|照明|スタンド|台灯|灯|무드등|전구/i],
    ['toy', /teddy|plüsch|spielzeug|toy|puppe|인형|장난감|ぬいぐるみ|おもちゃ|玩具|玩偶|毛绒|퍼즐|보드게임|레고|피규어/i], ['bottle', /wein|wine|sekt|whisky|gin\b|bottle|flasche|와인|위스키|술|ワイン|酒|葡萄酒|红酒|위스키|맥주|소주|샴페인|보드카/i], ['giftbox', /geschenk|gift|선물|ギフト|プレゼント|礼物|礼盒|선물 ?세트|기프트/i]];
const COL = [[/グレー|灰色|grau|grey|gray|회색|그레이|gris/i, '#8a9099', '#cfd3d8'], [/ブラック|黒|黑色|schwarz|black|검정|블랙|noir/i, '#3a3d42', '#7a7e86'], [/ホワイト|白色|weiß|weiss|white|흰|화이트|blanc/i, '#d9dcdf', '#f4f5f6'],
    [/ネイビー|紺|藏青|海军蓝|navy|dunkelblau|네이비|남색/i, '#3f4f72', '#9aa6c0'], [/ブルー|青|蓝色|blau|blue|파랑|파란|블루|bleu/i, '#6a8ac8', '#c8d6ef'], [/レッド|赤|红色|rot\b|rote|red|빨간|빨강|레드|rouge/i, '#c86a6a', '#ecc4c4'],
    [/ピンク|粉色|rosa|pink|분홍|핑크|rose\b/i, '#dca0b0', '#f4dbe2'], [/グリーン|緑|绿色|grün|green|초록|녹색|그린|vert/i, '#6f9a74', '#cfe2d0'], [/ベージュ|米色|beige|creme|ivory|베이지|아이보리/i, '#cdb894', '#efe4d0'],
    [/ブラウン|茶色|棕色|braun|brown|갈색|브라운|marron/i, '#94704e', '#d8c4ae'], [/イエロー|黄色|gelb|yellow|노랑|노란|옐로|jaune/i, '#d8b84a', '#f2e4b0']];
// read from the item's own words; the Korean line ("ko", always there off a Korean phone) is the one most worth knowing
export const prodKind = x => { const w = `${x?.item || ''} ${x?.ko || ''} ${x?.option || ''}`; return (KIND.find(([, re]) => re.test(w)) || [])[0] || ''; };
export function prodSvg(x) {
    const k = prodKind(x);
    if (!k) return '';
    const w = `${x?.item || ''} ${x?.ko || ''} ${x?.option || ''}`, c = COL.find(([re]) => re.test(w)) || [null, '#9aa3ae', '#d9dde3'];
    return `<svg viewBox="0 0 60 60" class="ax_psvg">${P[k](c[1], c[2])}</svg>`;
}
