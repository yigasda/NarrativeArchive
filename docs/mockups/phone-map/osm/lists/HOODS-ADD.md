# 반영 세션에 보낼 것: 지도 표에 새로 더한 곳 (11-12)

지도 표(HINT · PLACE)에 받을 목록의 곳을 더했어요(`tocity.py`). 반영 쪽 표(`HOODS`)에 더할지는 반영 세션이 정해요.
- **새 동네**: 이미 있는 도시 안의 곳이에요. 그 도시 줄에 동네로 더하면 돼요.
- **새 도시 · 곳**: 표에 없던 도시 · 마을 · 산 · 섬이에요. 시간대가 여럿인 나라(미국 · 캐나다 · 호주)는 곳마다 적었어요.
- 지금도 테스트(`tests/placehoods.test.mjs`)는 다 통과해요. 시간대가 하나인 나라는 지도 표만으로도 반영 쪽이 시간대를 알아요.

## 독일

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 베를린 | 그로피우스슈타트 · Gropiusstadt | Europe/Berlin |
| 베를린 | Zehlendorf | Europe/Berlin |
| 베를린 | 슈판다우 · Altstadt Spandau | Europe/Berlin |
| 베를린 | 템펠호프 · Tempelhofer Feld | Europe/Berlin |
| 베를린 | Flughafen Berlin Brandenburg | Europe/Berlin |
| 뮌헨 | 노이페를라흐 · Neuperlach | Europe/Berlin |
| 뮌헨 | Flughafen Munchen · Flughafen München | Europe/Berlin |
| 뮌헨 | 알리안츠 아레나 · Allianz Arena | Europe/Berlin |
| 함부르크 | 빌헬름스부르크 · Wilhelmsburg | Europe/Berlin |
| 함부르크 | 컨테이너 · Waltershof | Europe/Berlin |
| 쾰른 | 린덴탈 · Lindenthal | Europe/Berlin |
| 슈투트가르트 | 킬레스베르크 · Killesberg | Europe/Berlin |
| 라이프치히 | 그뤼나우 · Grunau · Grünau | Europe/Berlin |
| 드레스덴 | 블라제비츠 · Blasewitz | Europe/Berlin |
| 포츠담 | 바벨스베르크 · Babelsberg | Europe/Berlin |
| 하노버 | 박람회장 · Messegelande Hannover · Messegelände Hannover | Europe/Berlin |
| 뒤셀도르프 | Flughafen Dusseldorf · Flughafen Düsseldorf | Europe/Berlin |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 브레머하펜 | Havenwelten | Europe/Berlin |
| 볼프스부르크 자동차 | Autostadt | Europe/Berlin |
| 루트비히스하펜 화학 | BASF | Europe/Berlin |
| 뒤스부르크 강 | Ruhrort | Europe/Berlin |
| 에센 촐페라인 탄광 | Zeche Zollverein | Europe/Berlin |
| 아헨 | Aachener Dom | Europe/Berlin |
| 가르힝 대학 캠퍼스 | Forschungszentrum Garching | Europe/Berlin |
| 카를스루에 성 | Schloss Karlsruhe | Europe/Berlin |
| 쾨니히스제 | Schonau am Konigssee · Schönau am Königssee | Europe/Berlin |
| 오버스트도르프 | Oberstdorf | Europe/Berlin |
| 미텐발트 | Mittenwald | Europe/Berlin |
| 오버아머가우 | Oberammergau | Europe/Berlin |
| 노이슈반슈타인 마을 | Hohenschwangau | Europe/Berlin |
| 테게른제 | Tegernsee | Europe/Berlin |
| 슐리어제 | Schliersee | Europe/Berlin |
| 킴제 프린 | Prien am Chiemsee | Europe/Berlin |
| 린다우 섬 |  | Europe/Berlin |
| 메어스부르크 | Meersburg | Europe/Berlin |
| 슈타른베르크 | Starnberg | Europe/Berlin |
| 뮈리츠 호숫가 바렌 |  | Europe/Berlin |
| 뤼겐섬 빈츠 | Binz | Europe/Berlin |
| 바르네뮌데 | Warnemunde · Warnemünde | Europe/Berlin |
| 하일리겐담 | Heiligendamm | Europe/Berlin |
| 헬골란트 섬 | Helgoland | Europe/Berlin |
| 장크트 페터오르딩 | Sankt Peter-Ording | Europe/Berlin |
| 티멘도르퍼 | Timmendorfer Strand | Europe/Berlin |
| 질트섬 리스트 | List auf Sylt | Europe/Berlin |
| 그레트질 | Greetsiel | Europe/Berlin |
| 우제돔섬 알베크 | Ahlbeck | Europe/Berlin |
| 페마른섬 부르크 | Burg auf Fehmarn | Europe/Berlin |
| 모젤 강 코헴 | Cochem | Europe/Berlin |
| 모젤 강 베른카스텔 | Bernkastel-Kues | Europe/Berlin |
| 라인 골짜기 바하라흐 | Bacharach | Europe/Berlin |
| 로렐라이 마을 | Sankt Goarshausen | Europe/Berlin |
| 다이데스하임 | Deidesheim | Europe/Berlin |
| 마인 강 폴카흐 | Volkach | Europe/Berlin |
| 딩켈스뷜 | Dinkelsbuhl · Dinkelsbühl | Europe/Berlin |
| 베르니게로데 | Wernigerode | Europe/Berlin |
| 몬샤우 골짜기 마을 | Monschau | Europe/Berlin |
| 엘츠 성 숲 | Burg Eltz | Europe/Berlin |
| 바트 키싱엔 | Bad Kissingen | Europe/Berlin |
| 바트 라이헨할 | Bad Reichenhall | Europe/Berlin |
| 하르츠 시르케 | Schierke | Europe/Berlin |
| 슈바르츠발트 트리베르크 | Triberg im Schwarzwald | Europe/Berlin |
| 티티제 | Titisee-Neustadt | Europe/Berlin |
| 뤼네부르크 황야 운델로 | Undeloh | Europe/Berlin |
| 슈프레발트 물길 마을 |  | Europe/Berlin |
| 보릅스베데 | Worpswede | Europe/Berlin |
| 알고이 프론텐 | Pfronten | Europe/Berlin |
| 작센 스위스 라텐 | Kurort Rathen | Europe/Berlin |
| 바이에른 숲 보덴마이스 | Bodenmais | Europe/Berlin |

## 한국

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 경주 | 양동마을 · Yangdong Village | Asia/Seoul |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 설악산 소공원 | Seoraksan Sogongwon | Asia/Seoul |
| 평창 대관령 목장 | Daegwallyeong Sheep Farm | Asia/Seoul |
| 지리산 화엄사 | Hwaeomsa | Asia/Seoul |
| 북한산 우이동 | Ui-dong | Asia/Seoul |
| 가야산 해인사 마을 | Haeinsa | Asia/Seoul |
| 양양 죽도 | Jukdo Beach | Asia/Seoul |
| 동해 묵호 | Mukho | Asia/Seoul |
| 포항 구룡포 | Guryongpo | Asia/Seoul |
| 울릉도 도동항 | Dodong | Asia/Seoul |
| 거제 장승포 | Jangseungpo | Asia/Seoul |
| 남해 독일마을 | German Village | Asia/Seoul |
| 여수 엑스포 | Yeosu Expo | Asia/Seoul |
| 보성 녹차밭 | Daehan Dawon | Asia/Seoul |
| 신안 증도 염전 | Jeungdo | Asia/Seoul |
| 태안 안면도 꽃지 | Kkotji Beach | Asia/Seoul |
| 보령 대천 해수욕장 | Daecheon Beach | Asia/Seoul |
| 강화도 읍내 | Ganghwa-eup | Asia/Seoul |
| 제주 우도 | Udo | Asia/Seoul |
| 제주 선흘 중산간 마을 | Seonheul-ri | Asia/Seoul |
| 한라산 어리목 | Eorimok | Asia/Seoul |
| 안동 하회마을 | Hahoe Village | Asia/Seoul |
| 고창 청보리밭 | Gochang Dolmen Site | Asia/Seoul |
| 이천 논 | Icheon Ceramic Village | Asia/Seoul |
| 김제 | Byeokgolje | Asia/Seoul |
| 하동 화개 | Hwagae Market | Asia/Seoul |
| 담양 대나무숲 | Juknokwon | Asia/Seoul |
| 순천만 갈대밭 | Suncheonman Bay Wetland | Asia/Seoul |
| 남이섬 | Nami Island | Asia/Seoul |
| 가평 청평호 | Cheongpyeong Lake | Asia/Seoul |
| 양평 두물머리 | Dumulmeori | Asia/Seoul |
| 파주 헤이리 마을 | Heyri Art Valley | Asia/Seoul |
| 파주 임진각 | Imjingak | Asia/Seoul |
| 부여 읍내 | Buyeo-eup | Asia/Seoul |
| 용인 에버랜드 | Everland | Asia/Seoul |
| 세종 정부청사 | Government Complex Sejong | Asia/Seoul |
| 울산 조선소 | Hyundai Heavy Industries | Asia/Seoul |
| 창원 상남동 | Sangnam-dong | Asia/Seoul |
| 평택 안정리 | Anjeong-ri | Asia/Seoul |
| 청주 성안길 | Seongan-gil | Asia/Seoul |
| 춘천 명동 | Myeong-dong | Asia/Seoul |
| 진주성 | Jinjuseong Fortress | Asia/Seoul |
| 안동 구시장 | Andong Gu Market | Asia/Seoul |

## 일본

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 도쿄 | Yanaka Ginza | Asia/Tokyo |
| 도쿄 | 오쿠타마 · Okutama | Asia/Tokyo |
| 교토 | 오하라 · Ohara | Asia/Tokyo |
| 오키나와 | 나하 국제거리 · Kokusai Street | Asia/Tokyo |
| 오키나와 | 차탄 아메리칸 빌리지 · American Village | Asia/Tokyo |
| 고베 | 하버랜드 · Kobe Harborland | Asia/Tokyo |
| 고베 | 기타노 언덕 · Kitano-cho | Asia/Tokyo |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 하코네 유모토 | Hakone-Yumoto | Asia/Tokyo |
| 구사쓰 | Kusatsu Onsen Yubatake | Asia/Tokyo |
| 노보리베쓰 | Noboribetsu Onsen | Asia/Tokyo |
| 긴잔 | Ginzan Onsen | Asia/Tokyo |
| 기노사키 | Kinosaki Onsen | Asia/Tokyo |
| 유후인 | Yufuin | Asia/Tokyo |
| 가미코치 | Kamikochi Kappa Bridge | Asia/Tokyo |
| 다카야마 | Sanmachi Suji | Asia/Tokyo |
| 마고메 | Magome-juku | Asia/Tokyo |
| 쓰마고 | Tsumago-juku | Asia/Tokyo |
| 후지 가와구치코 | Kawaguchiko | Asia/Tokyo |
| 미야지마 | Itsukushima Shrine | Asia/Tokyo |
| 나오시마 | Miyanoura | Asia/Tokyo |
| 이시가키섬 | Ishigaki | Asia/Tokyo |
| 쇼도시마 | Tonosho | Asia/Tokyo |
| 오타루 운하 | Otaru Canal | Asia/Tokyo |
| 나가사키 데지마 | Dejima | Asia/Tokyo |
| 이즈 시모다 | Shimoda | Asia/Tokyo |
| 모지코 레트로 | Mojiko | Asia/Tokyo |
| 아소 초원 | Aso | Asia/Tokyo |
| 비에이 언덕 밭 | Biei | Asia/Tokyo |
| 도노 | Tono | Asia/Tokyo |
| 이야 골짜기 | Iya Kazurabashi | Asia/Tokyo |
| 다마 뉴타운 | Tama Center | Asia/Tokyo |
| 무사시코스기 타워 아파트 | Musashi-Kosugi | Asia/Tokyo |
| 도쿄 디즈니 리조트 | Tokyo Disneyland | Asia/Tokyo |
| 도요타 | Toyota City | Asia/Tokyo |
| 쓰쿠바 | Tsukuba | Asia/Tokyo |
| 마쿠하리 신도심 | Makuhari Messe | Asia/Tokyo |
| 센다이 이치반초 | Ichibancho | Asia/Tokyo |
| 히로시마 평화공원 | Hiroshima Peace Memorial Park | Asia/Tokyo |
| 가나자와 히가시차야 | Higashi Chaya | Asia/Tokyo |
| 나라 공원 | Nara Park | Asia/Tokyo |
| 가와고에 | Kawagoe Kurazukuri Street | Asia/Tokyo |
| 구라시키 | Kurashiki Bikan Historical Quarter | Asia/Tokyo |
| 마쓰모토성 | Matsumoto Castle | Asia/Tokyo |
| 히메지성 | Himeji Castle | Asia/Tokyo |

## 미국

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 요세미티 계곡 | Yosemite Village | America/Los_Angeles |
| 그랜드캐니언 마을 | Grand Canyon Village | America/Phoenix |
| 옐로스톤 올드 페이스풀 | Old Faithful | America/Denver |
| 자이언 스프링데일 | Springdale | America/Denver |
| 잭슨 홀 | Jackson | America/Denver |
| 개틀린버그 | Gatlinburg | America/New_York |
| 타호 호숫가 | South Lake Tahoe | America/Los_Angeles |
| 호놀룰루 와이키키 | Waikiki Beach | Pacific/Honolulu |
| 마우이 파이아 | Paia | Pacific/Honolulu |
| 마서스 비니어드 에드가타운 | Edgartown | America/New_York |
| 낸터킷 | Nantucket | America/New_York |
| 케이프코드 프로빈스타운 | Provincetown | America/New_York |
| 카멀바이더시 | Carmel-by-the-Sea | America/Los_Angeles |
| 산타바버라 | State Street | America/Los_Angeles |
| 라구나 비치 | Laguna Beach | America/Los_Angeles |
| 갤버스턴 | Galveston | America/Chicago |
| 머틀 비치 | Myrtle Beach Boardwalk | America/New_York |
| 애틀랜틱시티 | Atlantic City Boardwalk | America/New_York |
| 바 하버 | Bar Harbor | America/New_York |
| 아미시 마을 인터코스 | Intercourse | America/New_York |
| 나파 욘트빌 | Yountville | America/Los_Angeles |
| 소노마 | Sonoma Plaza | America/Los_Angeles |
| 스토우 | Stowe | America/New_York |
| 우드스톡 | Woodstock | America/New_York |
| 서배너 | Forsyth Park | America/New_York |
| 찰스턴 | Charleston City Market | America/New_York |
| 뉴올리언스 프렌치 쿼터 | French Quarter | America/Chicago |
| 내슈빌 브로드웨이 | Broadway | America/Chicago |
| 오스틴 6번가 |  | America/Chicago |
| 산타페 플라자 | Santa Fe Plaza | America/Denver |
| 마파 | Marfa | America/Chicago |
| 66번 도로 마을 셀리그먼 | Seligman | America/Phoenix |
| 아이오와 펠라 | Pella | America/Chicago |
| 레빗타운 교외 | Levittown | America/New_York |
| 스탠퍼드 | Stanford University | America/Los_Angeles |
| 마운틴뷰 실리콘밸리 | Googleplex | America/Los_Angeles |
| 디어본 자동차 | Ford Rouge Factory | America/New_York |
| 휴스턴 NASA | Space Center Houston | America/Chicago |
| 올랜도 디즈니월드 | Magic Kingdom | America/New_York |
| 애너하임 디즈니랜드 | Disneyland | America/Los_Angeles |
| 케임브리지 하버드 | Harvard Square | America/New_York |
| 프린스턴 | Princeton University | America/New_York |
| 호보컨 | Hoboken | America/New_York |
| 모뉴먼트 밸리 | Monument Valley | America/Denver |
| 페이지 | Page | America/Phoenix |
| 데스밸리 퍼니스 크리크 | Furnace Creek | America/Los_Angeles |
| 브라이스 캐니언 | Bryce Canyon City | America/Denver |
| 아치스 국립공원 | Arches National Park | America/Denver |
| 화이트샌즈 사막 | White Sands National Park | America/Denver |
| 조슈아 트리 마을 | Joshua Tree | America/Los_Angeles |
| 레이니어산 파라다이스 | Paradise | America/Los_Angeles |
| 레드우드 숲 오릭 | Orick | America/Los_Angeles |
| 글레이셔 국립공원 웨스트글레이셔 | West Glacier | America/Denver |
| 로키산 에스테스 파크 | Estes Park | America/Denver |
| 애디론댁 레이크플래시드 | Lake Placid | America/New_York |
| 나이아가라 폭포 | Niagara Falls State Park | America/New_York |
| 에버글레이즈 | Everglades City | America/New_York |
| 멤피스 빌 스트리트 | Beale Street | America/Chicago |
| 미시시피강 해니벌 | Hannibal | America/Chicago |
| 맥키낙섬 | Mackinac Island | America/New_York |
| 크레이터 호수 | Rim Village | America/Los_Angeles |
| 디날리 공원 마을 | Denali Park | America/Anchorage |
| 하와이 코나 | Kailua-Kona | Pacific/Honolulu |
| 하와이 힐로 | Hilo | Pacific/Honolulu |
| 카우아이 하날레이 | Hanalei | Pacific/Honolulu |
| 호놀룰루 차이나타운 | Chinatown | Pacific/Honolulu |
| 빅서 | Big Sur Village | America/Los_Angeles |
| 오리건 캐넌 비치 | Cannon Beach | America/Los_Angeles |
| 아우터뱅크스 내그스헤드 | Nags Head | America/New_York |
| 산후안 제도 프라이데이 하버 | Friday Harbor | America/Los_Angeles |
| 보디 | Bodie State Historic Park | America/Los_Angeles |
| 로스웰 | Roswell | America/Denver |
| 레븐워스 | Leavenworth | America/Los_Angeles |
| 솔뱅 | Solvang | America/Los_Angeles |
| 타오스 | Taos Plaza | America/Denver |
| 데드우드 | Deadwood | America/Denver |
| 러시모어산 키스톤 | Keystone | America/Denver |
| 후버 댐 | Boulder City | America/Los_Angeles |
| 소살리토 | Sausalito | America/Los_Angeles |
| 케네디 우주센터 | Kennedy Space Center | America/New_York |
| 멤피스 그레이스랜드 | Graceland | America/Chicago |
| 텍사스 힐 컨트리 프레더릭스버그 | Fredericksburg | America/Chicago |
| 텍사스 반데라 | Bandera | America/Chicago |
| 캔자스 린즈버그 | Lindsborg | America/Chicago |
| 루이지애나 브로브리지 | Breaux Bridge | America/Chicago |
| 애팔래치아 분 | Boone | America/New_York |
| 애틀랜타 미드타운 | Midtown Atlanta | America/New_York |
| 샌디에이고 가스램프 | Gaslamp Quarter | America/Los_Angeles |

## 영국

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 런던 | Wimbledon Village | Europe/London |
| 런던 | 웸블리 · Wembley Stadium | Europe/London |
| 런던 | 스트랫퍼드 올림픽 공원 · Queen Elizabeth Olympic Park | Europe/London |
| 런던 | 크로이든 · East Croydon | Europe/London |
| 런던 | 일링 · Ealing Broadway | Europe/London |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 리버풀 앨버트 독 | Royal Albert Dock | Europe/London |
| 브리스틀 | Bristol Harbourside | Europe/London |
| 글래스고 머천트 시티 | Merchant City | Europe/London |
| 카디프 베이 | Cardiff Bay | Europe/London |
| 벨파스트 캐서드럴 쿼터 | Cathedral Quarter | Europe/London |
| 스트랫퍼드어폰에이번 | Shakespeare's Birthplace | Europe/London |
| 윈저 | Windsor Castle | Europe/London |
| 세인트앤드루스 | St Andrews | Europe/London |
| 인버네스 | Inverness Castle | Europe/London |
| 노리치 | Norwich Market | Europe/London |
| 포츠머스 | Portsmouth Historic Dockyard | Europe/London |
| 뉴캐슬 강가 | Newcastle Quayside | Europe/London |
| 캐슬쿰 | Castle Combe | Europe/London |
| 버턴온더워터 | Bourton-on-the-Water | Europe/London |
| 호수 지방 그래스미어 | Grasmere | Europe/London |
| 호수 지방 앰블사이드 | Ambleside | Europe/London |
| 호수 지방 케직 | Keswick | Europe/London |
| 피크 디스트릭트 캐슬턴 | Castleton | Europe/London |
| 요크셔 데일스 호스 | Hawes | Europe/London |
| 하워스 황야 마을 | Haworth | Europe/London |
| 라이 | Rye | Europe/London |
| 래븐엄 | Lavenham | Europe/London |
| 글래스턴베리 | Glastonbury | Europe/London |
| 스톤헨지 | Stonehenge | Europe/London |
| 하드리아누스 방벽 마을 | Haltwhistle | Europe/London |
| 세인트아이브스 | St Ives | Europe/London |
| 패드스토 | Padstow | Europe/London |
| 마우절 | Mousehole | Europe/London |
| 틴타젤 | Tintagel | Europe/London |
| 휘트비 | Whitby | Europe/London |
| 스카버러 | Scarborough | Europe/London |
| 텐비 | Tenby | Europe/London |
| 도버 | Dover | Europe/London |
| 스카이섬 포트리 | Portree | Europe/London |
| 멀섬 토버모리 | Tobermory | Europe/London |
| 오크니 커크월 | Kirkwall | Europe/London |
| 와이트섬 카우스 | Cowes | Europe/London |
| 앵글시 보마리스 | Beaumaris | Europe/London |
| 스노도니아 란베리스 | Llanberis | Europe/London |
| 베투스이코이드 | Betws-y-Coed | Europe/London |
| 벤네비스 포트윌리엄 | Fort William | Europe/London |
| 네스호 드럼나드로킷 | Drumnadrochit | Europe/London |
| 피틀로크리 | Pitlochry | Europe/London |
| 에비모어 | Aviemore | Europe/London |
| 로몬드호 러스 | Luss | Europe/London |
| 뉴 포레스트 린드허스트 | Lyndhurst | Europe/London |
| 다트무어 와이드콤 | Widecombe-in-the-Moor | Europe/London |
| 해러게이트 | Harrogate | Europe/London |
| 밀턴킨스 신도시 | Milton Keynes Central | Europe/London |

## 프랑스

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 파리 | 생마르탱 운하 | Europe/Paris |
| 파리 | 바티뇰 · Batignolles | Europe/Paris |
| 파리 | 몽파르나스 · Montparnasse | Europe/Paris |
| 파리 | 베르시 · Bercy Village | Europe/Paris |
| 파리 | 뇌이쉬르센 · Neuilly-sur-Seine | Europe/Paris |
| 파리 | 생드니 스타드 드 프랑스 · Stade de France | Europe/Paris |
| 파리 | 사르셀 · Sarcelles | Europe/Paris |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 뱅센 숲 | Chateau de Vincennes · Château de Vincennes | Europe/Paris |
| 디즈니랜드 파리 | Disneyland Paris | Europe/Paris |
| 프로뱅 | Provins | Europe/Paris |
| 샤르트르 | Chartres Cathedral | Europe/Paris |
| 스트라스부르 프티트 프랑스 | Petite France | Europe/Paris |
| 툴루즈 카피톨 | Capitole de Toulouse | Europe/Paris |
| 릴 옛 시내 | Vieux-Lille | Europe/Paris |
| 낭트 섬 | Ile de Nantes · Île de Nantes | Europe/Paris |
| 몽펠리에 코메디 광장 | Place de la Comedie · Place de la Comédie | Europe/Paris |
| 루앙 | Rouen Cathedral | Europe/Paris |
| 랭스 | Reims Cathedral | Europe/Paris |
| 루시용 | Roussillon | Europe/Paris |
| 에즈 | Eze · Èze | Europe/Paris |
| 생폴드방스 | Saint-Paul-de-Vence | Europe/Paris |
| 로카마두르 | Rocamadour | Europe/Paris |
| 사를라 | Sarlat-la-Caneda · Sarlat-la-Canéda | Europe/Paris |
| 리크위르 | Riquewihr | Europe/Paris |
| 카르카손 성 | Cite de Carcassonne · Cité de Carcassonne | Europe/Paris |
| 생테밀리옹 | Saint-Emilion · Saint-Émilion | Europe/Paris |
| 발랑솔 라벤더 밭 | Valensole | Europe/Paris |
| 콜롱주라루주 | Collonges-la-Rouge | Europe/Paris |
| 콩크 | Conques | Europe/Paris |
| 앙부아즈 | Chateau d'Amboise · Château d'Amboise | Europe/Paris |
| 슈농소 | Chateau de Chenonceau · Château de Chenonceau | Europe/Paris |
| 베즐레 | Vezelay · Vézelay | Europe/Paris |
| 이부아르 | Yvoire | Europe/Paris |
| 에트르타 | Etretat · Étretat | Europe/Paris |
| 옹플뢰르 | Honfleur | Europe/Paris |
| 도빌 | Deauville | Europe/Paris |
| 생트로페 | Saint-Tropez | Europe/Paris |
| 비아리츠 | Grande Plage | Europe/Paris |
| 레섬 생마르탱 | Saint-Martin-de-Re · Saint-Martin-de-Ré | Europe/Paris |
| 아르카숑 | Arcachon | Europe/Paris |
| 필라 모래 언덕 | Dune du Pilat | Europe/Paris |
| 코르시카 보니파시오 | Bonifacio | Europe/Paris |
| 코르시카 아작시오 | Ajaccio | Europe/Paris |
| 망통 | Menton | Europe/Paris |
| 벨일 르팔레 | Le Palais | Europe/Paris |
| 카시스 | Cassis | Europe/Paris |
| 콜리우르 | Collioure | Europe/Paris |
| 포르크롤섬 | Porquerolles | Europe/Paris |
| 쿠르슈벨 |  | Europe/Paris |
| 발디제르 | Val-d'Isere · Val-d'Isère | Europe/Paris |
| 므제브 | Megeve · Megève | Europe/Paris |
| 루르드 | Sanctuary of Our Lady of Lourdes | Europe/Paris |
| 베르동 협곡 무스티에 | Moustiers-Sainte-Marie | Europe/Paris |
| 에비앙 | Evian-les-Bains · Évian-les-Bains | Europe/Paris |
| 엑스레뱅 | Aix-les-Bains | Europe/Paris |
| 제라르메 | Gerardmer · Gérardmer | Europe/Paris |
| 비시 | Vichy | Europe/Paris |
| 툴루즈 에어버스 | Airbus | Europe/Paris |
| 소피아 앙티폴리스 연구 단지 | Sophia Antipolis | Europe/Paris |
| 르아브르 | Port of Le Havre | Europe/Paris |

## 이탈리아

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 로마 | 피우미치노 공항 · Fiumicino Airport | Europe/Rome |
| 로마 | Lido di Ostia | Europe/Rome |
| 로마 | 치네치타 영화 촬영소 · Cinecitta · Cinecittà | Europe/Rome |
| 밀라노 | Milan Cathedral | Europe/Rome |
| 밀라노 | CityLife | Europe/Rome |
| 밀라노 | 말펜사 공항 · Malpensa Airport | Europe/Rome |
| 베네치아 | Lido di Venezia | Europe/Rome |
| 나폴리 | 보메로 언덕 | Europe/Rome |
| 토리노 | 링고토 · Lingotto | Europe/Rome |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 티볼리 | Villa d'Este | Europe/Rome |
| 제노바 옛 | Porto Antico | Europe/Rome |
| 바리 | Bari Vecchia | Europe/Rome |
| 트리에스테 | Piazza Unita d'Italia · Piazza Unità d'Italia | Europe/Rome |
| 레체 | Lecce | Europe/Rome |
| 파도바 | Prato della Valle | Europe/Rome |
| 베르가모 | Citta Alta · Città Alta | Europe/Rome |
| 만토바 | Mantua | Europe/Rome |
| 라벤나 | Ravenna | Europe/Rome |
| 폼페이 | Pompeii | Europe/Rome |
| 몬테풀차노 | Montepulciano | Europe/Rome |
| 피엔차 | Pienza | Europe/Rome |
| 발도르차 바뇨비뇨니 | Bagno Vignoni | Europe/Rome |
| 키안티 그레베 | Greve in Chianti | Europe/Rome |
| 코르토나 | Cortona | Europe/Rome |
| 아시시 | Basilica of San Francesco | Europe/Rome |
| 오르비에토 | Orvieto | Europe/Rome |
| 치비타 디 바뇨레조 | Civita di Bagnoregio | Europe/Rome |
| 폴리냐노 아 마레 | Polignano a Mare | Europe/Rome |
| 오스투니 | Ostuni | Europe/Rome |
| 랑게 바롤로 포도밭 | Barolo | Europe/Rome |
| 돌로미티 오르티세이 | Ortisei | Europe/Rome |
| 코르티나 담페초 | Cortina d'Ampezzo | Europe/Rome |
| 쿠르마예르 | Courmayeur | Europe/Rome |
| 볼차노 | Bolzano | Europe/Rome |
| 메라노 | Merano | Europe/Rome |
| 코모호 벨라조 | Bellagio | Europe/Rome |
| 코모호 바렌나 | Varenna | Europe/Rome |
| 가르다호 시르미오네 | Sirmione | Europe/Rome |
| 가르다호 리바 | Riva del Garda | Europe/Rome |
| 마조레호 스트레사 | Stresa | Europe/Rome |
| 오르타호 오르타 산 줄리오 | Orta San Giulio | Europe/Rome |
| 소렌토 | Sorrento | Europe/Rome |
| 이스키아섬 | Ischia Porto | Europe/Rome |
| 프로치다섬 | Procida | Europe/Rome |
| 친퀘테레 베르나차 | Vernazza | Europe/Rome |
| 친퀘테레 마나롤라 | Manarola | Europe/Rome |
| 포르토피노 | Portofino | Europe/Rome |
| 산레모 | Sanremo | Europe/Rome |
| 체팔루 | Cefalu · Cefalù | Europe/Rome |
| 시라쿠사 오르티자 | Ortigia | Europe/Rome |
| 사르데냐 칼리아리 | Cagliari | Europe/Rome |
| 코스타 스메랄다 포르토 체르보 | Porto Cervo | Europe/Rome |
| 사르데냐 알게로 | Alghero | Europe/Rome |
| 엘바섬 포르토페라이오 | Portoferraio | Europe/Rome |
| 리미니 | Rimini | Europe/Rome |
| 비아레조 | Viareggio | Europe/Rome |
| 마라넬로 페라리 | Ferrari Museum | Europe/Rome |

## 중국 · 홍콩 · 마카오

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 베이징 | Nanluoguxiang | Asia/Shanghai |
| 베이징 | 798 예술구 | Asia/Shanghai |
| 베이징 | 서우두 공항 · Beijing Capital International Airport | Asia/Shanghai |
| 상하이 | 푸둥 공항 · Shanghai Pudong International Airport | Asia/Shanghai |
| 상하이 | 디즈니랜드 · Shanghai Disneyland | Asia/Shanghai |
| 광저우 | 사몐섬 · Shamian Island | Asia/Shanghai |
| 선전 | 화창베이 전자상가 · Huaqiangbei | Asia/Shanghai |
| 홍콩 | 스탠리 · Stanley | Asia/Shanghai |
| 홍콩 | 리펄스베이 · Repulse Bay | Asia/Shanghai |
| 홍콩 | Sai Kung Town | Asia/Shanghai |
| 홍콩 | Yung Shue Wan | Asia/Shanghai |
| 홍콩 | 청차우섬 | Asia/Shanghai |
| 홍콩 | 타이오 · Tai O | Asia/Shanghai |
| 홍콩 | 삼수이포 · Sham Shui Po | Asia/Shanghai |
| 홍콩 | Hong Kong International Airport | Asia/Shanghai |
| 홍콩 | 샤틴 신도시 · Sha Tin | Asia/Shanghai |
| 마카오 | 콜로안 · Coloane Village | Asia/Shanghai |
| 청두 | 콴자이샹쯔 · Kuanzhai Alley | Asia/Shanghai |
| 청두 | Chunxi Road | Asia/Shanghai |
| 칭다오 | 바다관 · Badaguan | Asia/Shanghai |
| 샤먼 | 구랑위 · Gulangyu | Asia/Shanghai |
| 샤먼 | 쩡춰안 · Zengcuo'an | Asia/Shanghai |
| 싼야 | 야룽만 · Yalong Bay | Asia/Shanghai |
| 싼야 | 다둥하이 · Dadonghai | Asia/Shanghai |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 무톈위 만리장성 | Mutianyu Great Wall | Asia/Shanghai |
| 바다링 만리장성 | Badaling Great Wall | Asia/Shanghai |
| 둥관 쑹산호 단지 | Songshan Lake | Asia/Shanghai |
| 시안 종루 | Bell Tower | Asia/Shanghai |
| 항저우 시후 | West Lake | Asia/Shanghai |
| 쑤저우 핑장루 | Pingjiang Road | Asia/Shanghai |
| 난징 푸쯔먀오 | Fuzimiao | Asia/Shanghai |
| 우한 장한루 | Jianghan Road | Asia/Shanghai |
| 하얼빈 중앙대가 | Central Street | Asia/Shanghai |
| 톈진 이탈리아 거리 | Italian Style Town | Asia/Shanghai |
| 쿤밍 | Cuihu Park | Asia/Shanghai |
| 창사 우이광장 | Wuyi Square | Asia/Shanghai |
| 리장 고성 | Lijiang Old Town | Asia/Shanghai |
| 다리 고성 | Dali Old Town | Asia/Shanghai |
| 핑야오 고성 | Pingyao Ancient City | Asia/Shanghai |
| 저우좡 | Zhouzhuang | Asia/Shanghai |
| 시탕 | Xitang | Asia/Shanghai |
| 훙춘 마을 | Hongcun | Asia/Shanghai |
| 펑황 고성 | Fenghuang Ancient Town | Asia/Shanghai |
| 룽지 다랑논 | Longji Rice Terraces | Asia/Shanghai |
| 샹그릴라 두커쭝 | Dukezong Ancient Town | Asia/Shanghai |
| 푸젠 토루 마을 | Tianluokeng Tulou | Asia/Shanghai |
| 구이린 리강 | Elephant Trunk Hill | Asia/Shanghai |
| 황산 탕커우 | Tangkou | Asia/Shanghai |
| 장자제 우링위안 | Wulingyuan | Asia/Shanghai |
| 주자이거우 | Jiuzhaigou | Asia/Shanghai |
| 어메이산 | Emeishan | Asia/Shanghai |
| 라싸 바코르 | Barkhor | Asia/Shanghai |
| 베이다이허 | Beidaihe | Asia/Shanghai |
| 다롄 싱하이 광장 | Xinghai Square | Asia/Shanghai |
| 저우산 푸퉈산 | Putuoshan | Asia/Shanghai |
| 웨이하이 | Weihai | Asia/Shanghai |

## 호주

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 시드니 | 패딩턴 · Paddington | Australia/Sydney |
| 시드니 | 발메인 · Balmain | Australia/Sydney |
| 시드니 | 쿠지 · Coogee Beach | Australia/Sydney |
| 시드니 | 크로눌라 · Cronulla Beach | Australia/Sydney |
| 시드니 | 패러매타 · Parramatta | Australia/Sydney |
| 시드니 | 채스우드 · Chatswood | Australia/Sydney |
| 시드니 | 블랙타운 교외 · Blacktown | Australia/Sydney |
| 시드니 | 올림픽 공원 · Sydney Olympic Park | Australia/Sydney |
| 시드니 | Sydney Airport | Australia/Sydney |
| 멜버른 | 리치먼드 · Richmond | Australia/Melbourne |
| 멜버른 | 브런즈윅 · Sydney Road | Australia/Melbourne |
| 멜버른 | 브라이턴 비치 오두막 · Brighton Bathing Boxes | Australia/Melbourne |
| 멜버른 | 박스힐 교외 · Box Hill | Australia/Melbourne |
| 멜버른 | Melbourne Airport | Australia/Melbourne |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 프리맨틀 | Fremantle | Australia/Perth |
| 호바트 살라망카 | Salamanca Place | Australia/Hobart |
| 캔버라 시빅 | Civic | Australia/Sydney |
| 골드코스트 서퍼스 파라다이스 | Surfers Paradise | Australia/Brisbane |
| 뉴캐슬 | Newcastle Beach | Australia/Sydney |
| 울런공 | Wollongong | Australia/Sydney |
| 질롱 | Geelong Waterfront | Australia/Melbourne |
| 타운즈빌 | Townsville | Australia/Brisbane |
| 선샤인코스트 물루라바 | Mooloolaba | Australia/Brisbane |
| 블루마운틴 카툼바 | Katoomba | Australia/Sydney |
| 헌터 밸리 포도밭 | Pokolbin | Australia/Sydney |
| 바이런 베이 | Byron Bay | Australia/Sydney |
| 누사 | Noosa Heads | Australia/Brisbane |
| 휫선데이 에얼리 비치 | Airlie Beach | Australia/Brisbane |
| 해밀턴섬 | Hamilton Island | Australia/Brisbane |
| 포트더글러스 | Port Douglas | Australia/Brisbane |
| 데인트리 케이프 트리뷸레이션 | Cape Tribulation | Australia/Brisbane |
| 마그네틱섬 | Horseshoe Bay | Australia/Brisbane |
| 크가리 | Kingfisher Bay | Australia/Brisbane |
| 울루루 율라라 | Yulara | Australia/Darwin |
| 쿠버페디 | Coober Pedy | Australia/Adelaide |
| 캐서린 | Katherine | Australia/Darwin |
| 카카두 자비루 | Jabiru | Australia/Darwin |
| 캥거루섬 킹스코트 | Kingscote | Australia/Adelaide |
| 바로사 밸리 타눈다 | Tanunda | Australia/Adelaide |
| 마거릿 리버 | Margaret River | Australia/Perth |
| 그레이트 오션 로드 론 | Lorne | Australia/Melbourne |
| 아폴로 베이 | Apollo Bay | Australia/Melbourne |
| 12사도 포트캠벨 | Port Campbell | Australia/Melbourne |
| 야라 밸리 힐스빌 | Healesville | Australia/Melbourne |
| 데일스퍼드 | Daylesford | Australia/Melbourne |
| 밸러랫 소버린 힐 | Sovereign Hill | Australia/Melbourne |
| 벤디고 | Bendigo | Australia/Melbourne |
| 브라이트 | Bright | Australia/Melbourne |
| 마운트 불러 | Mount Buller Village | Australia/Melbourne |
| 스레드보 | Thredbo | Australia/Sydney |
| 레이크스 엔트런스 | Lakes Entrance | Australia/Melbourne |
| 론서스턴 | Launceston | Australia/Hobart |
| 프레이시넷 콜스 베이 | Coles Bay | Australia/Hobart |
| 포트아서 | Port Arthur | Australia/Hobart |
| 스트래핸 | Strahan | Australia/Hobart |
| 브룸 케이블 비치 | Cable Beach | Australia/Perth |
| 로트네스트섬 | Rottnest Island | Australia/Perth |
| 엑스머스 | Exmouth | Australia/Perth |
| 몽키 마이어 | Monkey Mia | Australia/Perth |
| 올버니 | Albany | Australia/Perth |
| 에스퍼런스 | Esperance | Australia/Perth |
| 저비스 베이 허스키슨 | Huskisson | Australia/Sydney |
| 카이아마 | Kiama | Australia/Sydney |
| 보럴 | Bowral | Australia/Sydney |
| 머지 | Mudgee | Australia/Sydney |
| 로드하우섬 | Lord Howe Island | Australia/Lord_Howe |
| 포트헤드랜드 | Port Hedland | Australia/Perth |

## 캐나다

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 토론토 | 아일랜드 · Centre Island | America/Toronto |
| 토론토 | 비치스 · The Beaches | America/Toronto |
| 토론토 | 노스욕 · North York | America/Toronto |
| 토론토 | 스카버러 · Scarborough | America/Toronto |
| 토론토 | 미시소가 · Square One | America/Toronto |
| 토론토 | 마컴 · Markham | America/Toronto |
| 토론토 | 오크빌 · Oakville | America/Toronto |
| 토론토 | 피어슨 공항 · Toronto Pearson International Airport | America/Toronto |
| 밴쿠버 | 스탠리 파크 · Stanley Park | America/Vancouver |
| 밴쿠버 | 커머셜 드라이브 · Commercial Drive | America/Vancouver |
| 밴쿠버 | 노스밴쿠버 론즈데일 · Lonsdale Quay | America/Vancouver |
| 밴쿠버 | 버나비 메트로타운 · Metrotown | America/Vancouver |
| 밴쿠버 | 리치먼드 · Richmond | America/Vancouver |
| 밴쿠버 | Vancouver International Airport | America/Vancouver |
| 몬트리올 | 라발 · Laval | America/Toronto |
| 몬트리올 | 트뤼도 공항 | America/Toronto |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 오타와 바이워드 마켓 | ByWard Market | America/Toronto |
| 캘거리 다운타운 | Stephen Avenue | America/Edmonton |
| 에드먼턴 화이트 애비뉴 | Whyte Avenue | America/Edmonton |
| 빅토리아 이너 하버 | Inner Harbour | America/Vancouver |
| 위니펙 익스체인지 | Exchange District | America/Winnipeg |
| 세인트존스 다운타운 | Water Street | America/St_Johns |
| 리자이나 | Regina | America/Regina |
| 새스커툰 | Saskatoon | America/Regina |
| 킹스턴 | Kingston | America/Toronto |
| 나이아가라온더레이크 | Niagara-on-the-Lake | America/Toronto |
| 해밀턴 | Hamilton | America/Toronto |
| 샬럿타운 | Charlottetown | America/Halifax |
| 수세인트마리 | Sault Ste. Marie | America/Toronto |
| 선더베이 | Thunder Bay | America/Toronto |
| 멍크턴 | Moncton | America/Halifax |
| 셔브룩 | Sherbrooke | America/Toronto |
| 트루아리비에르 | Trois-Rivieres · Trois-Rivières | America/Toronto |
| 레이크 루이스 | Lake Louise | America/Edmonton |
| 캔모어 | Canmore | America/Edmonton |
| 레벨스토크 | Revelstoke | America/Vancouver |
| 넬슨 | Nelson | America/Vancouver |
| 토피노 | Tofino | America/Vancouver |
| 유클루렛 | Ucluelet | America/Vancouver |
| 솔트스프링섬 갠지스 | Ganges | America/Vancouver |
| 오카나간 켈로나 | Kelowna | America/Vancouver |
| 펜틱턴 | Penticton | America/Vancouver |
| 드럼헬러 | Drumheller | America/Edmonton |
| 몽트랑블랑 | Mont-Tremblant Village | America/Toronto |
| 머스코카 헌츠빌 | Huntsville | America/Toronto |
| 프린스에드워드카운티 픽턴 | Picton | America/Toronto |
| 페기스 코브 | Peggy's Cove | America/Halifax |
| 루넨버그 | Lunenburg | America/Halifax |
| 케이프브레턴 배덱 | Baddeck | America/Halifax |
| PEI 캐번디시 | Cavendish | America/Halifax |
| 그로스 몬 로키하버 | Rocky Harbour | America/St_Johns |
| 타두사크 | Tadoussac | America/Toronto |
| 베생폴 | Baie-Saint-Paul | America/Toronto |
| 오를레앙섬 | Ile d'Orleans · Île d'Orléans | America/Toronto |
| 처칠 | Churchill | America/Winnipeg |
| 도슨시티 | Dawson City | America/Whitehorse |
| 이칼루이트 | Iqaluit | America/Iqaluit |
| 매니토바 스타인바흐 | Steinbach | America/Winnipeg |
| 서스캐처원 험볼트 | Humboldt | America/Regina |
| 포트맥머리 | Fort McMurray | America/Edmonton |

## 노르웨이

| 도시 | 새 동네 | 시간대 |
|---|---|---|
| 오슬로 | 비요르비카 오페라하우스 · Oslo Opera House | Europe/Oslo |
| 오슬로 | 프로그네르 공원 · Frognerparken | Europe/Oslo |
| 오슬로 | 뷔그되위 · Bygdoy · Bygdøy | Europe/Oslo |
| 오슬로 | 그로루드 · Grorud | Europe/Oslo |
| 오슬로 | 가르데르모엔 공항 · Oslo Airport Gardermoen | Europe/Oslo |
| 베르겐 | Floyen | Europe/Oslo |
| 트론헤임 | 바클란데트 · Bakklandet | Europe/Oslo |
| 트론헤임 | 솔시덴 · Solsiden | Europe/Oslo |
| 스타방에르 | 옛 시가 · Gamle Stavanger | Europe/Oslo |
| 스타방에르 | 석유 · Norwegian Petroleum Museum | Europe/Oslo |
| 트롬쇠 | Telegrafbukta | Europe/Oslo |

| 새 곳 | 다른 이름 | 시간대 |
|---|---|---|
| 크리스티안산 | Kristiansand | Europe/Oslo |
| 보되 | Bodo · Bodø | Europe/Oslo |
| 드람멘 | Drammen | Europe/Oslo |
| 프레드릭스타드 | Gamlebyen | Europe/Oslo |
| 릴레함메르 | Lillehammer | Europe/Oslo |
| 하마르 미에사 호숫가 | Hamar | Europe/Oslo |
| 퇸스베르그 | Tonsberg · Tønsberg | Europe/Oslo |
| 콩스베르그 광산 | Kongsberg | Europe/Oslo |
| 로포텐 헤닝스베르 | Henningsvaer · Henningsvær | Europe/Oslo |
| 로포텐 누스피오르 | Nusfjord | Europe/Oslo |
| 로포텐 오 마을 | A i Lofoten · Å i Lofoten | Europe/Oslo |
| 베스테롤렌 안데네스 | Andenes | Europe/Oslo |
| 구드방엔 피오르 | Gudvangen | Europe/Oslo |
| 아울란 피오르 마을 | Aurlandsvangen | Europe/Oslo |
| 발레스트란 | Balestrand | Europe/Oslo |
| 운드레달 | Undredal | Europe/Oslo |
| 올덴 | Olden | Europe/Oslo |
| 로엔 | Loen | Europe/Oslo |
| 하르당에르 오다 | Odda | Europe/Oslo |
| 하르당에르 로프트후스 과수원 | Lofthus | Europe/Oslo |
| 에이드피오르 | Eidfjord | Europe/Oslo |
| 프레이케스톨렌 | Preikestolen Fjellstue | Europe/Oslo |
| 뤼세피오르 뤼세보튼 | Lysebotn | Europe/Oslo |
| 온달스네스 트롤스티겐 | Andalsnes · Åndalsnes | Europe/Oslo |
| 트롤스티겐 | Trollstigen | Europe/Oslo |
| 대서양 도로 | Atlantic Ocean Road | Europe/Oslo |
| 크리스티안순 | Kristiansund | Europe/Oslo |
| 뢰로스 | Roros · Røros | Europe/Oslo |
| 롬 목조 교회 마을 | Lom | Europe/Oslo |
| 베이토스퇼렌 | Beitostolen · Beitostølen | Europe/Oslo |
| 게일로 | Geilo | Europe/Oslo |
| 헴세달 | Hemsedal | Europe/Oslo |
| 트뤼실 | Trysil | Europe/Oslo |
| 핀세 | Finse | Europe/Oslo |
| 류칸 | Rjukan | Europe/Oslo |
| 텔레마르크 헤달 | Heddal Stave Church | Europe/Oslo |
| 세테스달 발레 | Valle | Europe/Oslo |
| 릴레산 | Lillesand | Europe/Oslo |
| 그림스타드 | Grimstad | Europe/Oslo |
| 리쇠르 | Risor · Risør | Europe/Oslo |
| 만달 | Mandal | Europe/Oslo |
| 린데스네스 등대 | Lindesnes Lighthouse | Europe/Oslo |
| 에게르순 | Egersund | Europe/Oslo |
| 하우게순 | Haugesund | Europe/Oslo |
| 스쿠데네스하운 | Skudeneshavn | Europe/Oslo |
| 함뇌위 | Hamnoy · Hamnøy | Europe/Oslo |
| 센야섬 | Hamn i Senja | Europe/Oslo |
| 알타 | Alta | Europe/Oslo |
| 사미 마을 카라쇼크 | Karasjok | Europe/Oslo |
| 사미 마을 카우토케이노 | Kautokeino | Europe/Oslo |
| 함메르페스트 | Hammerfest | Europe/Oslo |
| 노르카프 호닝스보그 | Honningsvag · Honningsvåg | Europe/Oslo |
| 키르케네스 | Kirkenes | Europe/Oslo |
| 나르비크 | Narvik | Europe/Oslo |
| 모이라나 | Mo i Rana | Europe/Oslo |
| 스발바르 롱위에아르뷔엔 | Longyearbyen | Europe/Oslo |
