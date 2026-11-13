import { HINT, PLACE } from './phonemapcity.js';

// 동네 → 도시: a neighbourhood a status line names ("시부야 사거리", "Shibuya Crossing", "Kreuzberg") as the city it is in,
// for sceneZone (phonedata.js) to find that city among the ones the phone knows. Imports nothing. Not the map's HINT
// (phonemapcity.js: which drawing suits a place, generated, never edited by hand); this one is edited by hand.
// The map's HINT words are read here too (only read, never changed), so a neighbourhood the map knows is known here as well.
// Each row: [the city's names, its time zone, then its neighbourhoods, each "name|other name|…"] (Korean, English, local).
export const HOODS = [
    // 한국
    ['서울|Seoul', 'Asia/Seoul', '강남|Gangnam', '서초|Seocho', '역삼|Yeoksam', '삼성동|Samseong', '선릉|Seolleung', '압구정|Apgujeong', '청담|Cheongdam', '신사|가로수길|Sinsa|Garosu-gil', '잠실|Jamsil', '송파|Songpa', '여의도|Yeouido', '영등포|Yeongdeungpo', '마포|Mapo', '홍대|홍익대|Hongdae', '연남|Yeonnam', '망원|Mangwon', '합정|Hapjeong', '상수|Sangsu', '신촌|Sinchon', '이대|Ewha', '이태원|Itaewon', '한남|Hannam', '용산|Yongsan', '명동|Myeongdong', '을지로|Euljiro', '종로|Jongno', '광화문|Gwanghwamun', '인사동|Insadong', '삼청동|Samcheong', '북촌|Bukchon', '성수|Seongsu', '건대|건국대|Kondae', '왕십리|Wangsimni', '동대문|Dongdaemun', '대학로|Daehangno', '혜화|Hyehwa', '노원|Nowon', '강서구|Gangseo', '마곡|Magok', '목동|Mokdong', '구로|Guro', '가산|Gasan', '관악|Gwanak', '신림|Sillim', '서울대입구|Seoul National University', '사당|Sadang', '노량진|Noryangjin', '은평|Eunpyeong', '강북|Gangbuk', '성북|Seongbuk', '수유|Suyu', '도봉|Dobong', '중랑|Jungnang', '강동|Gangdong', '천호|Cheonho', '서울역|Seoul Station', '남산|Namsan', '청계천|Cheonggyecheon', '경복궁|Gyeongbokgung'],
    ['부산|Busan', 'Asia/Seoul', '해운대|Haeundae', '광안리|Gwangalli', '서면|Seomyeon', '남포동|Nampo', '센텀|Centum', '기장|Gijang', '송정|Songjeong', '영도|Yeongdo', '감천|Gamcheon', '전포|Jeonpo', '부산역|Busan Station'],
    ['인천|Incheon', 'Asia/Seoul', '송도|Songdo', '영종도|Yeongjong', '인천공항|인천국제공항|Incheon Airport', '부평|Bupyeong', '월미도|Wolmido'],
    ['대구|Daegu', 'Asia/Seoul', '동성로|Dongseong-ro', '수성구|Suseong', '김광석길'],
    ['대전|Daejeon', 'Asia/Seoul', '둔산|Dunsan', '유성|Yuseong', '은행동|Eunhaeng'],
    ['광주|Gwangju', 'Asia/Seoul', '충장로|Chungjang-ro', '상무지구|Sangmu'],
    ['제주|Jeju', 'Asia/Seoul', '서귀포|Seogwipo', '애월|Aewol', '함덕|Hamdeok', '성산|Seongsan', '중문|Jungmun', '협재|Hyeopjae', '제주공항|Jeju Airport'],
    ['수원|Suwon', 'Asia/Seoul', '광교|Gwanggyo', '행궁동|Haenggung', '인계동|Ingye'],
    ['성남|Seongnam', 'Asia/Seoul', '판교|Pangyo', '분당|Bundang', '정자동|Jeongja', '서현|Seohyeon'],
    ['고양|Goyang', 'Asia/Seoul', '일산|Ilsan', '킨텍스|KINTEX'],
    ['강릉|Gangneung', 'Asia/Seoul', '경포|Gyeongpo', '안목|Anmok', '주문진|Jumunjin'],
    ['경주|Gyeongju', 'Asia/Seoul', '황리단길|Hwangnidan-gil', '보문|Bomun'],
    ['전주|Jeonju', 'Asia/Seoul', '한옥마을|Hanok Village'],
    // 일본
    ['도쿄|Tokyo|東京', 'Asia/Tokyo', '시부야|Shibuya|渋谷', '신주쿠|Shinjuku|新宿', '하라주쿠|Harajuku|原宿', '오모테산도|Omotesando|表参道', '아오야마|Aoyama|青山', '롯폰기|Roppongi|六本木', '아자부|Azabu|麻布', '긴자|Ginza|銀座', '유라쿠초|Yurakucho|有楽町', '마루노우치|Marunouchi|丸の内', '도쿄역|Tokyo Station|東京駅', '니혼바시|Nihonbashi|日本橋', '아키하바라|Akihabara|秋葉原', '우에노|Ueno|上野', '아사쿠사|Asakusa|浅草', '스카이트리|Skytree', '오다이바|Odaiba|お台場', '시나가와|Shinagawa|品川', '에비스|Ebisu|恵比寿', '나카메구로|Nakameguro|中目黒', '다이칸야마|Daikanyama|代官山', '시모키타자와|Shimokitazawa|下北沢', '기치조지|Kichijoji|吉祥寺', '이케부쿠로|Ikebukuro|池袋', '신바시|Shinbashi|新橋', '하네다|Haneda|羽田', '나리타|Narita|成田', '고엔지|Koenji|高円寺', '쓰키지|Tsukiji|築地', '도요스|Toyosu|豊洲'],
    ['요코하마|Yokohama|横浜', 'Asia/Tokyo', '미나토미라이|Minato Mirai|みなとみらい', '요코하마 중화거리|Yokohama Chinatown|中華街', '모토마치|Motomachi|元町'],
    ['오사카|Osaka|大阪', 'Asia/Tokyo', '난바|Namba|難波', '도톤보리|Dotonbori|道頓堀', '신사이바시|Shinsaibashi|心斎橋', '우메다|Umeda|梅田', '덴노지|Tennoji|天王寺', '신세카이|Shinsekai|新世界', '유니버설 스튜디오|Universal Studios Japan|USJ', '간사이공항|Kansai Airport|関西空港'],
    ['교토|Kyoto|京都', 'Asia/Tokyo', '기온|Gion|祇園', '아라시야마|Arashiyama|嵐山', '가와라마치|Kawaramachi|河原町', '후시미|Fushimi|伏見', '기요미즈|Kiyomizu|清水'],
    ['후쿠오카|Fukuoka|福岡', 'Asia/Tokyo', '하카타|Hakata|博多', '덴진|Tenjin|天神', '나카스|Nakasu|中洲'],
    ['삿포로|Sapporo|札幌', 'Asia/Tokyo', '스스키노|Susukino|すすきの', '오도리|Odori|大通'],
    ['나고야|Nagoya|名古屋', 'Asia/Tokyo', '사카에|Sakae|栄', '메이에키|Meieki|名駅'],
    // 중국 · 대만 · 홍콩 · 마카오
    ['베이징|Beijing|北京', 'Asia/Shanghai', '왕푸징|Wangfujing|王府井', '싼리툰|Sanlitun|三里屯', '차오양|Chaoyang|朝阳', '하이뎬|Haidian|海淀', '첸먼|Qianmen|前门', '톈안먼|Tiananmen|天安门', '궈마오|Guomao|国贸'],
    ['상하이|Shanghai|上海', 'Asia/Shanghai', '와이탄|The Bund|外滩', '푸둥|Pudong|浦东', '루자쭈이|Lujiazui|陆家嘴', '난징루|Nanjing Road|南京路', '신톈디|Xintiandi|新天地', '징안|Jing\'an|静安', '쉬자후이|Xujiahui|徐家汇', '훙차오|Hongqiao|虹桥'],
    ['광저우|Guangzhou|广州', 'Asia/Shanghai', '톈허|Tianhe|天河', '주장신청|Zhujiang New Town|珠江新城'],
    ['선전|Shenzhen|深圳', 'Asia/Shanghai', '난산|Nanshan|南山', '푸톈|Futian|福田', '뤄후|Luohu|罗湖'],
    ['타이베이|Taipei|台北|臺北', 'Asia/Taipei', '시먼딩|Ximending|西門町', '신이|Xinyi|信義', '중산|Zhongshan|中山', '다안|Da\'an|大安', '융캉제|Yongkang Street|永康街', '스린|Shilin|士林', '단수이|Tamsui|淡水', '베이터우|Beitou|北投', '타이베이역|Taipei Main Station|台北車站'],
    ['홍콩|Hong Kong|香港', 'Asia/Hong_Kong', '中環|Central Hong Kong', '침사추이|Tsim Sha Tsui|尖沙咀', '몽콕|Mong Kok|旺角', '코즈웨이베이|Causeway Bay|銅鑼灣', '완차이|Wan Chai|灣仔', '란콰이퐁|Lan Kwai Fong|蘭桂坊', '셩완|Sheung Wan|上環', '빅토리아 피크|Victoria Peak|山頂', '란타우|Lantau|大嶼山'],
    ['마카오|Macau|澳門', 'Asia/Macau', '세나도 광장|Senado Square', '코타이|Cotai|路氹', '타이파|Taipa|氹仔'],
    // 동남아 · 남아시아
    ['싱가포르|Singapore', 'Asia/Singapore', '마리나 베이|Marina Bay', '오차드|Orchard', '센토사|Sentosa', '클락 키|Clarke Quay', '부기스|Bugis', '리틀 인디아|Little India', '창이|Changi', '티옹바루|Tiong Bahru'],
    ['방콕|Bangkok|กรุงเทพ', 'Asia/Bangkok', '수쿰빗|Sukhumvit', '시암|Siam', '실롬|Silom', '카오산|Khao San', '아속|Asok', '통로|Thong Lo', '에까마이|Ekkamai', '짜뚜짝|Chatuchak', '수완나품|Suvarnabhumi'],
    ['하노이|Hanoi|Hà Nội', 'Asia/Ho_Chi_Minh', '호안끼엠|Hoan Kiem', 'Hanoi Old Quarter', '떠이호|Tay Ho', '바딘|Ba Dinh'],
    ['호치민|Ho Chi Minh City|Saigon|사이공', 'Asia/Ho_Chi_Minh', '1군|District 1', '부이비엔|Bui Vien', '벤탄|Ben Thanh', '타오디엔|Thao Dien', '2군|District 2'],
    ['다낭|Da Nang|Đà Nẵng', 'Asia/Ho_Chi_Minh', '미케|My Khe', '호이안|Hoi An'],
    ['마닐라|Manila', 'Asia/Manila', '마카티|Makati', 'BGC|Bonifacio Global City', '말라테|Malate', '인트라무로스|Intramuros', '파사이|Pasay'],
    ['자카르타|Jakarta', 'Asia/Jakarta', '수디르만|Sudirman', '스나얀|Senayan', '끄망|Kemang'],
    ['발리|Bali', 'Asia/Makassar', '꾸따|Kuta', '스미냑|Seminyak', '우붓|Ubud', '짱구|Canggu', '누사두아|Nusa Dua', '짐바란|Jimbaran'],
    ['쿠알라룸푸르|Kuala Lumpur', 'Asia/Kuala_Lumpur', '부킷 빈탕|Bukit Bintang', 'KLCC', '방사|Bangsar', '몽키아라|Mont Kiara', '차이나타운|Petaling Street'],
    ['뭄바이|Mumbai|Bombay', 'Asia/Kolkata', '반드라|Bandra', '콜라바|Colaba', '주후|Juhu', '안데리|Andheri', '로워 파렐|Lower Parel'],
    ['델리|Delhi|New Delhi|뉴델리', 'Asia/Kolkata', '코넛 플레이스|Connaught Place', '하우즈 카스|Hauz Khas', '찬드니 초크|Chandni Chowk', '파하르간지|Paharganj', '사켓|Saket'],
    ['벵갈루루|Bengaluru|Bangalore', 'Asia/Kolkata', '코라망갈라|Koramangala', '인디라나가르|Indiranagar', 'MG 로드|MG Road', '화이트필드|Whitefield'],
    // 중동 · 튀르키예
    ['두바이|Dubai', 'Asia/Dubai', '다운타운 두바이|Downtown Dubai', '두바이 마리나|Dubai Marina', 'JBR|Jumeirah Beach Residence', '주메이라|Jumeirah', '데이라|Deira', '부르 두바이|Bur Dubai', '비즈니스 베이|Business Bay', '팜 주메이라|Palm Jumeirah'],
    ['이스탄불|Istanbul|İstanbul', 'Europe/Istanbul', '탁심|Taksim', '베이오울루|Beyoğlu|Beyoglu', '술탄아흐메트|Sultanahmet', '카라쾨이|Karaköy|Karakoy', '베식타시|Beşiktaş|Besiktas', '카드쾨이|Kadıköy|Kadikoy', '니샨타시|Nişantaşı|Nisantasi', '갈라타|Galata'],
    // 유럽
    ['런던|London', 'Europe/London', '소호|Soho', '코벤트 가든|Covent Garden', '웨스트민스터|Westminster', '캠든|Camden', '쇼디치|Shoreditch', '브릭 레인|Brick Lane', '노팅힐|Notting Hill', '켄싱턴|Kensington', '첼시|Chelsea', '메이페어|Mayfair', '피카딜리|Piccadilly', '옥스퍼드 스트리트|Oxford Street', '킹스크로스|King\'s Cross', '웨스트엔드|West End', '캐너리 워프|Canary Wharf', '시티 오브 런던|City of London', '사우스뱅크|South Bank', '그리니치|Greenwich', '브릭스턴|Brixton', '해크니|Hackney', '이즐링턴|Islington', '히스로|Heathrow', '개트윅|Gatwick'],
    ['맨체스터|Manchester', 'Europe/London', '노던 쿼터|Northern Quarter', '딘스게이트|Deansgate', '샐퍼드|Salford'],
    ['에든버러|Edinburgh', 'Europe/London', 'Edinburgh Old Town', '로열 마일|Royal Mile', '리스|Leith'],
    ['더블린|Dublin', 'Europe/Dublin', '템플 바|Temple Bar', '그래프턴 스트리트|Grafton Street', '포르토벨로|Portobello'],
    ['파리|Paris', 'Europe/Paris', '마레|Le Marais|Marais', '몽마르트르|Montmartre', '샹젤리제|Champs-Élysées|Champs-Elysees', '생제르맹|Saint-Germain', '라탱 지구|Latin Quarter|Quartier Latin', '바스티유|Bastille', '벨빌|Belleville', '피갈|Pigalle', '라데팡스|La Défense|La Defense', '에펠탑|Eiffel Tower', '루브르|Louvre', '샤를드골|Charles de Gaulle|CDG', '오를리|Orly'],
    ['리옹|Lyon', 'Europe/Paris', '비유 리옹|Vieux Lyon', '프레스킬|Presqu\'île', '크루아루스|Croix-Rousse', '테로|Terreaux', '파르디외|Part-Dieu', '벨쿠르|Bellecour', '콩플뤼앙스|Confluence'],
    ['니스|Nice', 'Europe/Paris', '프롬나드 데 장글레|Promenade des Anglais', '비유 니스|Vieux Nice'],
    ['베를린|Berlin', 'Europe/Berlin', '미테|Mitte', '크로이츠베르크|Kreuzberg', '노이쾰른|Neukölln|Neukoelln', '프렌츨라우어 베르크|Prenzlauer Berg', '프리드리히스하인|Friedrichshain', '샤를로텐부르크|Charlottenburg', '쇠네베르크|Schöneberg', '알렉산더플라츠|Alexanderplatz', '포츠담 광장|Potsdamer Platz', '브란덴부르크 문|Brandenburger Tor', '쿠담|Kurfürstendamm|Ku\'damm'],
    ['뮌헨|München|Munich', 'Europe/Berlin', '슈바빙|Schwabing', '마리엔플라츠|Marienplatz', '막스포어슈타트|Maxvorstadt', '글로켄바흐|Glockenbach', '하이트하우젠|Haidhausen', '보겐하우젠|Bogenhausen'],
    ['프랑크푸르트|Frankfurt|Frankfurt am Main', 'Europe/Berlin', '베스트엔트|Westend', '작센하우젠|Sachsenhausen', '보켄하임|Bockenheim', '노르트엔트|Nordend', '반호프스피어텔|Bahnhofsviertel', '차일|Zeil', '뢰머|Römer|Roemer', '반켄피어텔|Bankenviertel', '오스트엔트|Ostend', '프랑크푸르트공항|Frankfurt Airport|Flughafen Frankfurt'],
    ['함부르크|Hamburg', 'Europe/Berlin', '장크트 파울리|St. Pauli|Sankt Pauli', '알토나|Altona', '하펜시티|HafenCity', '슈테른샨체|Sternschanze', '아임스뷔텔|Eimsbüttel|Eimsbuettel', '블랑케네제|Blankenese'],
    ['쾰른|Köln|Cologne', 'Europe/Berlin', '에렌펠트|Ehrenfeld', '벨기에 지구|Belgisches Viertel', '도이츠|Deutz'],
    ['빈|Wien|Vienna|비엔나', 'Europe/Vienna', '인네레 슈타트|Innere Stadt', '노이바우|Neubau', '레오폴트슈타트|Leopoldstadt', '나슈마르크트|Naschmarkt', '쇤브룬|Schönbrunn'],
    ['취리히|Zürich|Zurich', 'Europe/Zurich', '알트슈타트|Altstadt', '니더도르프|Niederdorf', '반호프슈트라세|Bahnhofstrasse', '취리히 베스트|Zürich-West'],
    ['로마|Roma|Rome', 'Europe/Rome', '트라스테베레|Trastevere', '몬티|Monti', '테스타치오|Testaccio', '바티칸|Vatican', '트레비|Trevi', '스페인 광장|Piazza di Spagna', '나보나|Navona', '테르미니|Termini'],
    ['밀라노|Milano|Milan', 'Europe/Rome', '브레라|Brera', '나빌리|Navigli', '포르타 누오바|Porta Nuova', '이솔라|Isola'],
    ['베네치아|Venezia|Venice', 'Europe/Rome', '산 마르코|San Marco', '리알토|Rialto', '도르소두로|Dorsoduro', '무라노|Murano'],
    ['피렌체|Firenze|Florence', 'Europe/Rome', '산타 크로체|Santa Croce', '올트라르노|Oltrarno', '산 로렌초|San Lorenzo'],
    ['마드리드|Madrid', 'Europe/Madrid', 'Puerta del Sol', '그란 비아|Gran Vía|Gran Via', '말라사냐|Malasaña|Malasana', '추에카|Chueca', '라바피에스|Lavapiés|Lavapies', '살라망카|Salamanca', '라 라티나|La Latina'],
    ['바르셀로나|Barcelona', 'Europe/Madrid', '고딕 지구|Barri Gòtic|Gothic Quarter', '엘 보른|El Born', '그라시아|Gràcia|Gracia', '에이샴플레|Eixample', '라발|El Raval|Raval', '바르셀로네타|Barceloneta', '람블라스|Las Ramblas|La Rambla', '사그라다 파밀리아|Sagrada Família'],
    ['리스본|Lisboa|Lisbon', 'Europe/Lisbon', '바이후 알투|Bairro Alto', '알파마|Alfama', '시아두|Chiado', '바이샤|Baixa', '벨렝|Belém|Belem', '프린시프 헤알|Príncipe Real'],
    ['포르투|Porto', 'Europe/Lisbon', '히베이라|Ribeira', '보아비스타|Boavista'],
    ['암스테르담|Amsterdam', 'Europe/Amsterdam', '요르단|Jordaan', '데 피프|De Pijp', '담 광장|Dam Square', '레이체플레인|Leidseplein', '박물관 광장|Museumplein', '노르트|Noord', '스키폴|Schiphol'],
    ['브뤼셀|Bruxelles|Brussels', 'Europe/Brussels', '그랑 플라스|Grand-Place|Grote Markt', '익셀|Ixelles', '생질|Saint-Gilles', '사블롱|Sablon'],
    ['프라하|Praha|Prague', 'Europe/Prague', '구시가지 광장|Old Town Square', '말라 스트라나|Malá Strana', '바츨라프 광장|Wenceslas Square', '지슈코프|Žižkov|Zizkov', '비노흐라디|Vinohrady'],
    ['부다페스트|Budapest', 'Europe/Budapest', '유대인 지구|Jewish Quarter', '언드라시|Andrássy'],
    ['바르샤바|Warszawa|Warsaw', 'Europe/Warsaw', 'Stare Miasto', '프라가|Praga', '모코투프|Mokotów'],
    ['코펜하겐|København|Copenhagen', 'Europe/Copenhagen', '뉘하운|Nyhavn', '뇌레브로|Nørrebro|Norrebro', '베스터브로|Vesterbro', '크리스티아니아|Christiania', '스트뢰에|Strøget'],
    ['스톡홀름|Stockholm', 'Europe/Stockholm', '감라스탄|Gamla Stan', '쇠데르말름|Södermalm|Sodermalm', '외스테르말름|Östermalm', '노르말름|Norrmalm'],
    ['오슬로|Oslo', 'Europe/Oslo', '그뤼네르뢰카|Grünerløkka', '아케르 브뤼게|Aker Brygge', '마요르스투엔|Majorstuen'],
    ['헬싱키|Helsinki', 'Europe/Helsinki', '칼리오|Kallio', '카우파토리|Kauppatori', '푸날라티|Punavuori'],
    ['아테네|Athens|Αθήνα', 'Europe/Athens', '플라카|Plaka', '모나스티라키|Monastiraki', '콜로나키|Kolonaki', '엑사르히아|Exarchia'],
    ['모스크바|Moscow|Москва', 'Europe/Moscow', '아르바트|Arbat', '붉은 광장|Red Square', '키타이고로드|Kitay-gorod', '트베르스카야|Tverskaya'],
    // 북미
    ['뉴욕|New York|NYC', 'America/New_York', '맨해튼|Manhattan', '브루클린|Brooklyn', '퀸스|Queens', '브롱크스|Bronx', '스태튼 아일랜드|Staten Island', '타임스스퀘어|Times Square', '소호|SoHo', '트라이베카|Tribeca', '첼시|Chelsea', '그리니치 빌리지|Greenwich Village', '이스트 빌리지|East Village', '로어 이스트 사이드|Lower East Side', '어퍼 이스트 사이드|Upper East Side', '어퍼 웨스트 사이드|Upper West Side', '할렘|Harlem', '미드타운|Midtown', '월스트리트|Wall Street', '첼시 마켓|Chelsea Market', '덤보|DUMBO', '윌리엄스버그|Williamsburg', '부시윅|Bushwick', '플러싱|Flushing', '코리아타운|Koreatown', '센트럴파크|Central Park', 'JFK', '라과디아|LaGuardia'],
    ['로스앤젤레스|Los Angeles|LA|엘에이', 'America/Los_Angeles', '할리우드|Hollywood', '비버리힐스|Beverly Hills', '산타모니카|Santa Monica', '베니스 비치|Venice Beach', '다운타운 LA|DTLA|Downtown LA', '실버레이크|Silver Lake', '웨스트 할리우드|West Hollywood', '코리아타운|Koreatown|K-Town', '패서디나|Pasadena', '말리부|Malibu', 'LAX'],
    ['샌프란시스코|San Francisco|SF', 'America/Los_Angeles', 'Mission District', 'SoMa', '헤이트 애시버리|Haight-Ashbury', '카스트로|Castro', '노스비치|North Beach', '피셔맨스 워프|Fisherman\'s Wharf', '유니언 스퀘어|Union Square', 'Marina District'],
    ['시애틀|Seattle', 'America/Los_Angeles', '캐피톨 힐|Capitol Hill', '밸러드|Ballard', '프리몬트|Fremont', '파이크 플레이스|Pike Place'],
    ['시카고|Chicago', 'America/Chicago', 'The Loop', '리버 노스|River North', '링컨 파크|Lincoln Park', '위커 파크|Wicker Park', '골드 코스트|Gold Coast', '오헤어|O\'Hare'],
    ['보스턴|Boston', 'America/New_York', '백베이|Back Bay', '비컨힐|Beacon Hill', '노스엔드|North End', '사우스엔드|South End'],
    ['워싱턴|Washington|Washington DC|DC', 'America/New_York', '조지타운|Georgetown', '듀폰 서클|Dupont Circle', '캐피톨 힐|Capitol Hill', '내셔널 몰|National Mall'],
    ['마이애미|Miami', 'America/New_York', '사우스비치|South Beach', '윈우드|Wynwood', '브리켈|Brickell', '리틀 하바나|Little Havana'],
    ['라스베이거스|Las Vegas', 'America/Los_Angeles', 'Las Vegas Strip', '프리몬트 스트리트|Fremont Street'],
    ['토론토|Toronto', 'America/Toronto', 'Downtown Toronto', '켄싱턴 마켓|Kensington Market', '요크빌|Yorkville', '퀸 웨스트|Queen West', '디스틸러리|Distillery District'],
    ['밴쿠버|Vancouver', 'America/Vancouver', '개스타운|Gastown', '예일타운|Yaletown', '키칠라노|Kitsilano', '그랜빌 아일랜드|Granville Island', '롭슨 스트리트|Robson Street'],
    ['몬트리올|Montréal|Montreal', 'America/Toronto', '올드 몬트리올|Vieux-Montréal|Old Montreal', '플라토|Plateau Mont-Royal', '마일엔드|Mile End'],
    ['멕시코시티|Ciudad de México|Mexico City|CDMX', 'America/Mexico_City', 'Roma Norte|Colonia Roma', '콘데사|Condesa', '폴랑코|Polanco', '코요아칸|Coyoacán|Coyoacan', 'Centro Histórico'],
    // 남미
    ['상파울루|São Paulo|Sao Paulo', 'America/Sao_Paulo', '파울리스타|Avenida Paulista|Paulista', '빌라 마달레나|Vila Madalena', '자르딘스|Jardins', '리베르다지|Liberdade'],
    ['리우데자네이루|Rio de Janeiro|Rio', 'America/Sao_Paulo', '코파카바나|Copacabana', '이파네마|Ipanema', '레블론|Leblon', '라파|Lapa', '산타 테레사|Santa Teresa'],
    ['부에노스아이레스|Buenos Aires', 'America/Argentina/Buenos_Aires', '팔레르모|Palermo', '산텔모|San Telmo', '레콜레타|Recoleta', '라 보카|La Boca', '푸에르토 마데로|Puerto Madero'],
    // 오세아니아
    ['시드니|Sydney', 'Australia/Sydney', '서큘러 키|Circular Quay', '더 록스|The Rocks', '본다이|Bondi', '서리 힐스|Surry Hills', '뉴타운|Newtown', '달링 하버|Darling Harbour', '맨리|Manly'],
    ['멜버른|Melbourne', 'Australia/Melbourne', '피츠로이|Fitzroy', '세인트킬다|St Kilda', '사우스뱅크|Southbank', '칼턴|Carlton'],
    ['오클랜드|Auckland', 'Pacific/Auckland', '폰손비|Ponsonby', '파넬|Parnell', '바이어덕트|Viaduct Harbour'],
    // 아프리카
    ['카이로|Cairo|القاهرة', 'Africa/Cairo', '자말렉|Zamalek', '기자|Giza', '타흐리르|Tahrir', '마아디|Maadi'],
    ['케이프타운|Cape Town', 'Africa/Johannesburg', '워터프런트|V&A Waterfront|Waterfront', '캠프스 베이|Camps Bay', '보캅|Bo-Kaap', '그린포인트|Green Point'],
    ['요하네스버그|Johannesburg|Joburg', 'Africa/Johannesburg', '샌튼|Sandton', '로즈뱅크|Rosebank', '마보넹|Maboneng', '소웨토|Soweto'],
    ['라고스|Lagos', 'Africa/Lagos', '빅토리아 아일랜드|Victoria Island', '이코이|Ikoyi', '레키|Lekki'],
    ['나이로비|Nairobi', 'Africa/Nairobi', '웨스트랜즈|Westlands', '킬리마니|Kilimani'],
    ['마라케시|Marrakech|Marrakesh', 'Africa/Casablanca', '제마 엘프나|Jemaa el-Fnaa', '겔리즈|Gueliz'],
    // 휴대폰 지도(HINT)에 있는 도시: 동네 이름은 지도 표에서 읽어요
    ['화성|Hwaseong', 'Asia/Seoul'],
    ['서귀포|Seogwipo', 'Asia/Seoul'],
    ['안동|Andong', 'Asia/Seoul'],
    ['청두|Chengdu|成都', 'Asia/Shanghai'],
    ['충칭|Chongqing|重庆|重慶', 'Asia/Shanghai'],
    ['뒤셀도르프|Düsseldorf|Dusseldorf', 'Europe/Berlin'],
    ['라이프치히|Leipzig', 'Europe/Berlin'],
    ['드레스덴|Dresden', 'Europe/Berlin'],
    ['리버풀|Liverpool', 'Europe/London'],
    ['글래스고|Glasgow', 'Europe/London'],
    ['마르세유|Marseille', 'Europe/Paris'],
    ['나폴리|Napoli|Naples', 'Europe/Rome'],
    ['베르겐|Bergen', 'Europe/Oslo'],
    ['트롬쇠|Tromsø|Tromso', 'Europe/Oslo'],
    ['로포텐|Lofoten', 'Europe/Oslo'],
];

const key = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
// what follows a neighbourhood's name and keeps it the neighbourhood ("시부야 사거리", "Shibuya Crossing", "시부야역"): never
// a shop's word ("Shibuya Coffee" is a shop that may be anywhere)
const AROUND = ['사거리', '삼거리', '오거리', '교차로', '역', '역앞', '역 앞', '거리', '길', '시장', '골목', '근처', '일대', '부근', '쪽', '광장', '공원', '입구', '출구', '동', '구', '지구', '시내', '중심가', '번화가', '해변', '해수욕장', '항', '공항',
    'crossing', 'intersection', 'station', 'street', 'st', 'road', 'rd', 'avenue', 'ave', 'square', 'plaza', 'park', 'area', 'district', 'ward', 'quarter', 'neighborhood', 'neighbourhood', 'downtown', 'centre', 'center', 'beach', 'harbour', 'harbor', 'port', 'airport', 'market', 'side', 'exit', 'gate',
    '駅', '交差点', '通り', '広場', '公園'].map(key);
// the map's HINT words that are no one neighbourhood (an airport, a suburb, "the City", "Central", a cathedral's name)
const NOT_HOOD = ['공항', '교외', '방리유', 'banlieue', '달동네', '산동네', '시티', '뱅크', '은행가', '시청', '오페라', 'opéra', '센트럴', 'central', '피크', 'the peak',
    '기타', '미션', 'mission', '루프', 'loop', '다마', 'tama', '101', '798', 'cbd', '수향', 'water town', '오로라', '8구', '16구', 'dom', '두오모', 'duomo', '구룡', 'kowloon'].map(key);
// names many cities have (a Chinatown, a Downtown, an Old Town, a Hyde Park, a Soho): on their own they say no city. The
// city this table lists one under comes back marked shared: true, and is taken only when it is the owner's own (their
// Westend), never as a move to someone else's city ("Downtown Toronto" is Toronto's alone and is not marked)
const SHARED = ['차이나타운', 'chinatown', '코리아타운', 'koreatown', '리틀 인디아', 'little india', '리틀 이탈리아', 'little italy', 
    '다운타운', 'downtown', '미드타운', 'midtown', 'uptown', '업타운', '올드타운', 'old town', '구시가지', 'old city', 'old quarter', '뉴타운', 'new town', 'newtown', '신시가지',
    'centro', 'centrum', 'centro storico', 'centro histórico', 'city centre', 'city center', 'west', 'gardens', '가든스',
    'west end', 'westend', 'east end', 'north end', 'south end', 'north beach', 'south beach', 'long beach', 'gold coast', 'south bank', 'southbank',
    '워터프런트', 'waterfront', 'harbourfront', 'hyde park', 'green park', 'lincoln park', 'garden city', 'capitol hill',
    '소호', 'soho', '첼시', 'chelsea', '조지타운', 'georgetown', '케임브리지', 'cambridge', 'newton', '퀸스타운', 'queenstown', 'kensington', 'richmond',
    'woodstock', '우드스톡', 'clifton', '클리프턴', 'portobello', 'the beaches', 'university', '대학가'].map(key);
// the map's towns ("청두 · 충칭": each), as { names, tz }: this table's row of that city (every town has one, with its zone)
function mapCities(town, rows) {
    const out = [];
    for (const t of String(town || '').split(' · ').map(x => x.trim()).filter(Boolean)) {
        // (the row of the same city under any of its names: 호찌민 is this table's 호치민 by "saigon", 방갈로르 its 벵갈루루)
        const pl = PLACE.find(x => x[0] === t), ks = new Set([t, ...(pl?.[1] || [])].map(key).filter(Boolean));
        const row = rows.find(c => c.names.some(n => ks.has(key(n))));
        if (row) out.push({ names: [...new Set([t, ...row.names, ...(pl?.[1] || [])])], tz: row.tz });
    }
    return out;
}
let index = null;
function hoodIndex() {
    if (index) return index;
    index = new Map();
    const rows = [], put = (n, city) => { const k = key(n); if (!k) return; const at = index.get(k) || index.set(k, []).get(k), same = at.find(c => c.tz === city.tz && c.names.some(x => city.names.includes(x)));
        // (the same city met again under its map name: one city, knowing both names, 호치민 and 호찌민)
        if (same) { for (const x of city.names) if (!same.names.includes(x)) same.names.push(x); } else at.push(city); };
    for (const [cities, tz, ...hoods] of HOODS) {
        const city = { names: cities.split('|'), tz };
        rows.push(city);
        for (const h of hoods) for (const n of h.split('|')) put(n, city);
    }
    for (const [town, words] of HINT) {
        const cs = mapCities(town, rows);
        for (const w of words || []) if (!NOT_HOOD.includes(key(w))) for (const c of cs) put(w, c);
    }
    return index;
}
// the cities a place's neighbourhood may be ("시부야 사거리" → Tokyo), each { names, tz } (shared: true for a name many
// cities have); [] when the place names none.
// the place is the whole name, or a neighbourhood and words that keep it one ("…역", "… Crossing")
export function hoodCities(place) {
    const p = String(place || '').trim(), whole = key(p);
    if (!whole) return [];
    const idx = hoodIndex(), out = new Map(), add = k => { for (const c of idx.get(k) || []) out.set(c.names[0], SHARED.includes(k) ? { ...c, shared: true } : c); };
    add(whole);
    const w = p.split(/\s+/).filter(Boolean);
    for (let k = w.length - 1; k >= 1; k--) {
        const head = key(w.slice(0, k).join(' ')), rest = w.slice(k).map(key);
        if (idx.has(head) && rest.every(r => AROUND.includes(r))) add(head);
    }
    // (written together, Korean or Japanese: "시부야사거리", "渋谷駅")
    if (!out.size) for (const a of AROUND) if (a && whole.endsWith(a) && whole.length > a.length) add(whole.slice(0, -a.length));
    return [...out.values()];
}
