// Orbit을 마리나라 콘보 틀로 (소망이 동그라미 친 곳: 위 아이콘 줄 · 머리 알약 + 설정 단추 · 입력 카드(입력칸 + 아래 아이콘 줄)).
// 크기 · 색은 소망 폰 캡처(1080 × 2408, 411px 화면)에서 잰 값.  node docs/mockups/orbit-mari/mock.cjs
//   RA 지금 오로라 그대로 + 새 틀 · RB 옅은 바탕(마리나라처럼) + 말풍선 · RC 옅은 바탕 + 말풍선 없이(마리나라 콘보 그대로)
//   P1 · P2 방 설정 창(마리나라 채팅 설정처럼 접는 줄 목록: 가져올 메뉴 전부) · H 길게 누르기(흰 아이콘 카드) · E 이모지 창
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync('/home/user/NarrativeArchive/tools/dev/na_test.jsonl', CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', OUT = '/home/user/NarrativeArchive/docs/mockups/orbit-mari/';
const P = {
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  chats: '<path d="M5 5h14a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-8.5L6 20v-3.5H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 9.2h8M8 12.6h5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  mask: '<path d="M3.5 7.5c3 0 5.5-1.5 8.5-1.5s5.5 1.5 8.5 1.5c0 6.5-3.5 10-8.5 10S3.5 14 3.5 7.5z"/><path d="M7.8 10.6c.9-.7 1.9-.7 2.8 0M13.4 10.6c.9-.7 1.9-.7 2.8 0M9.6 14c1.5 1 3.3 1 4.8 0"/>',
  mark: '<path d="M7.2 4h9.6A1.2 1.2 0 0 1 18 5.2V20l-6-4.2L6 20V5.2A1.2 1.2 0 0 1 7.2 4z"/>',
  menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>',
  sliders: '<path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9"/><circle cx="15" cy="7.5" r="2"/><circle cx="9" cy="16.5" r="2"/>',
  clip: '<path d="m20 11.5-7.9 7.9a5 5 0 0 1-7.1-7.1l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6"/>',
  up: '<path d="m7 14.5 5-5 5 5"/>', down: '<path d="m7 9.5 5 5 5-5"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.6 14.2a4.6 4.6 0 0 0 6.8 0M9.3 10h.01M14.7 10h.01"/>',
  send: '<path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
  kbd: '<rect x="3.5" y="6.5" width="17" height="11" rx="2"/><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', chev: '<path d="m7 9.5 5 5 5-5"/>', chevu: '<path d="m7 14.5 5-5 5 5"/>',
  q: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 1.9-2.2 3.2M12 16.6h.01"/>',
  pop: '<path d="M13.5 4.5h6v6M19.5 4.5 11 13M17.5 14v4.2a1.3 1.3 0 0 1-1.3 1.3H5.8a1.3 1.3 0 0 1-1.3-1.3V7.8a1.3 1.3 0 0 1 1.3-1.3H10"/>',
  title: '<path d="M4 7V5h9v2M8.5 5v12M6.5 17h4M14 11h6M14 15h4"/>', users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.5-3.2 2.9-5 6-5s5.5 1.8 6 5M16.5 5.7a3 3 0 0 1 0 5.6M18 14.8c1.5.7 2.4 2.3 2.6 4.7"/>',
  plug: '<path d="M9 3.5v4M15 3.5v4M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0zM12 16v4.5"/>', gauge: '<path d="M4.5 16.5a8 8 0 1 1 15 0"/><path d="m12 13 3.5-4"/>',
  card: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 15.5c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 13.5h3"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  wand: '<path d="m4 20 11-11M14 4v3M18.5 5.5l-2 2M20 10h-3M12.5 9.5l2 2"/>', link: '<path d="M9.5 14.5 14.5 9.5M8 11.5 6 13.5a3.5 3.5 0 0 0 5 5l2-2M16 12.5l2-2a3.5 3.5 0 0 0-5-5l-2 2"/>',
  tr: '<path d="M3.5 6.5h9M8 4.5v2M10.8 6.5C10 10 7.6 12.6 4 14.2M6 9.8c1 1.9 2.7 3.3 4.8 4"/><path d="m12.8 20 3.7-8.5 3.7 8.5M14.1 17h4.8"/>',
  book: '<path d="M4 5.5c2.7-.8 5.4-.6 8 1 2.6-1.6 5.3-1.8 8-1v13c-2.7-.8-5.4-.6-8 1-2.6-1.6-5.3-1.8-8-1z"/><path d="M12 6.5v13"/>',
  ctx: '<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 10h8M8 14h5"/>', pin: '<path d="M9 4h6l-.8 6 3.3 3.2V15h-11v-1.8L9.8 10 9 4zM12 15v5.5"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5"/>', vars: '<path d="M8 4.5c-2 0-2.5 1-2.5 3s-.5 3-2 4.5c1.5 1.5 2 2.5 2 4.5s.5 3 2.5 3M16 4.5c2 0 2.5 1 2.5 3s.5 3 2 4.5c-1.5 1.5-2 2.5-2 4.5s-.5 3-2.5 3"/>',
  branch: '<circle cx="7" cy="18" r="2"/><circle cx="7" cy="6" r="2"/><circle cx="17" cy="7" r="2"/><path d="M7 8v8M17 9c0 4-4 4-8.5 7.5"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2 2 0 0 1 18 19.5C10.6 19 5 13.4 4.5 6A2 2 0 0 1 6.5 4z"/>',
  camera: '<path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h2.2L9 5h6l1.3 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.3"/>',
  dice: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V6.2A2.2 2.2 0 0 1 7.2 4H15"/>',
  react: '<circle cx="11" cy="12.5" r="7.5"/><path d="M8 14.6a4 4 0 0 0 6 0M8.6 11h.01M13.4 11h.01M18 3.5v4M16 5.5h4"/>',
  redo: '<path d="M19.5 8A8 8 0 0 0 5 9.5M4.5 4v5.5H10M4.5 16A8 8 0 0 0 19 14.5M19.5 20v-5.5H14"/>', edit: '<path d="M4 20l1.1-4.2L16.6 4.3a2 2 0 0 1 2.9 2.9L8 18.8 4 20z"/><path d="M14.5 6.5l3 3"/>',
  hide: '<path d="M3.5 3.5l17 17M10.3 6.2c.6-.1 1.1-.2 1.7-.2 5 0 8.3 4.1 9.3 6-.5 1-1.5 2.4-3 3.6M6.4 7.9C4.6 9.1 3.3 10.8 2.7 12c1 1.9 4.3 6 9.3 6 1.4 0 2.7-.3 3.9-.9M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  peek: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>', brain: '<path d="M9 5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.3A3.2 3.2 0 0 0 9 18.5h.5V5zM15 5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.3A3.2 3.2 0 0 1 15 18.5h-.5V5z"/><path d="M9.5 9.5H8M14.5 9.5H16M9.5 14H8M14.5 14H16"/>',
};
const ic = (k, s = 22, w = 1.7) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${P[k]}</svg>`;
// 마리나라에서 잰 값(411px 화면 그대로): 위 줄 58 · 아이콘 24/2px 검정 · 머리 알약 41(왼 18 · 오 87) · 설정 단추 34 · 입력 카드 100(좌우 8 · 둥글기 14) · 입력칸 42(둥글기 15, #f5f5f5, 선 #d9d9d9) · 아래 아이콘 22 #777
const CSS = `
.na_ph_frame .ob_ct, .na_ph_frame .ob_inp, .na_ph_frame .ob_chips { display: none !important; } .na_ph_frame .ax_orbitroom .ax_sb { color: #1e1e1e !important; background: #fff; } .na_ph_frame .ax_orbitroom .ax_sb svg { filter: invert(1) brightness(.12); } .na_ph_frame .ax_orbitroom .ax_sb .cg_num { color: #1e1e1e !important; }
.mkT { position: relative; z-index: 3; flex: none; display: flex; align-items: center; height: 56px; padding: 0 9px; background: #fff; border-bottom: 1px solid #e3e3e3; color: #1e1e1e; } .mkT i { width: 37px; height: 40px; display: grid; place-items: center; } .mkT .sp { flex: 1; }
.mkH { position: relative; z-index: 3; flex: none; display: flex; align-items: center; gap: 10px; margin: 9px 9px 0 17px; } .mkH .pill { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 14px 0 6px; border-radius: 21px; background: rgba(244,244,244,.94); box-shadow: 0 1px 2px rgba(0,0,0,.03); }
.mkH .av { position: relative; flex: none; width: 30px; height: 30px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; font: 600 13px/1 sans-serif; color: #fff; background: linear-gradient(135deg,#8fbf8a,#d8c27a); } .mkH .av img { width: 100%; height: 100%; object-fit: cover; } .mkH .dot { position: absolute; left: 21px; top: 21px; width: 11px; height: 11px; border-radius: 50%; background: #8fa889; box-shadow: 0 0 0 2px #fff; }
.mkH .tx { min-width: 0; display: flex; flex-direction: column; } .mkH b { font-size: 15px; font-weight: 600; color: #262626; line-height: 1.15; } .mkH .sb { font-size: 12.5px; color: #8a8a8a !important; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mkH .set { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: #333; background: rgba(255,255,255,.4); }
.mkC { position: absolute; z-index: 5; left: 8px; right: 8px; bottom: calc(8px + var(--nbk, 0px)); padding: 10px 10px 4px; border-radius: 15px; background: #fff; border: 1px solid #e4e4e4; box-shadow: 0 8px 24px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04); }
.mkC .in { height: 42px; display: flex; align-items: center; padding: 0 14px; border-radius: 15px; background: #f5f5f5; border: 1px solid #dadada; font-size: 16px; color: #b0b0b0; }
.mkC .tl { display: flex; align-items: center; height: 42px; color: #777; } .mkC .tl i { width: 40px; height: 40px; display: grid; place-items: center; } .mkC .tl .sp { flex: 1; } .mkC .tl .off { color: #c4c4c4; } .mkC .tl .kb { width: 36px; height: 36px; margin: 0 2px; border-radius: 50%; border: 1px solid #dcdcdc; background: #f6f6f6; color: #555; }
.mkS { position: absolute; z-index: 4; right: 9px; bottom: calc(122px + var(--nbk, 0px)); display: flex; border-radius: 10px; background: rgba(255,255,255,.85); box-shadow: 0 1px 3px rgba(0,0,0,.06); color: #555; } .mkS i { width: 40px; height: 36px; display: grid; place-items: center; }
.na_ph_frame .ob_msgs { -webkit-mask-image: linear-gradient(transparent 0, #000 16px) !important; mask-image: linear-gradient(transparent 0, #000 16px) !important; } .na_ph_frame .ob_mi { padding-bottom: calc(132px + var(--nbk, 0px)) !important; padding-top: 10px !important; }
`;
// 옅은 바탕: 마리나라 채팅 바탕은 거의 흰 분홍 안개(#efe3e6 언저리). 우리는 사람 색을 아주 옅게만 남겨요
const PALE = `.na_ph_frame .ob_bg { background: #f4f1f2; } .na_ph_frame .ob_bg .ob_blob { opacity: .16; }
.na_ph_frame .ob_b.th, .na_ph_frame .ob_b.th.ob_glass { background: #fff !important; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.04) !important; color: #1e1e1e; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
.na_ph_frame .ob_b.me { background: #ececec !important; color: #1e1e1e !important; box-shadow: none !important; } .na_ph_frame .ob_b .ob_ko { color: #8a8a8a; } .na_ph_frame .ob_b.me .ob_tin { color: #9a9a9a; }
.na_ph_frame .ob_day, .na_ph_frame .ob_rd { color: #8a8a8a; } .na_ph_frame .ob_re { border-color: #f4f1f2; }`;
// 말풍선 없이(마리나라 콘보): 얼굴 40 · 이름 굵게 + 시각 회색 한 줄 · 그 밑에 글
const FLAT = `.na_ph_frame .ob_mi { gap: 2px !important; } .na_ph_frame .ob_mi .ob_b, .na_ph_frame .ob_mi .ob_b.th.ob_glass, .na_ph_frame .ob_mi .ob_b.th, .na_ph_frame .ob_mi .ob_b.me { align-self: stretch !important; margin: 0 0 0 52px !important; padding: 0 !important; background: none !important; box-shadow: none !important; border-radius: 0 !important; color: #1e1e1e !important; font-size: 16px; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
.na_ph_frame .ob_b .ob_ko { color: #6f6f6f; font-size: 14px; margin-top: 2px; } .na_ph_frame .ob_av, .na_ph_frame .ob_tin, .na_ph_frame .ob_rd, .na_ph_frame .ob_tl { display: none !important; } .na_ph_frame .ob_re { position: static !important; display: inline-flex !important; margin: 4px 0 0 !important; border: 1px solid #e6e6e6 !important; background: #fff !important; }
.mkn { position: relative; display: flex; align-items: baseline; gap: 8px; margin: 14px 0 1px 52px; } .mkn b { font-size: 15.5px; font-weight: 700; color: #2a2a2a; } .mkn i { font-style: normal; font-size: 12.5px; color: #8a8a8a; } .mkn .fa { position: absolute; left: -52px; top: 0; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 2px #fff; display: grid; place-items: center; font: 600 15px/1 sans-serif; color: #fff; background: linear-gradient(135deg,#8fbf8a,#d8c27a); } .mkn .fa > * { transform: scale(1.18); }`;
const PANEL = `.mkP { position: absolute; z-index: 6; left: 8px; right: 8px; top: var(--pt, 120px); bottom: calc(8px + var(--nbk, 0px)); display: flex; flex-direction: column; border-radius: 16px; background: #fff; border: 1px solid #e6e6e6; box-shadow: 0 12px 34px rgba(0,0,0,.12); overflow: hidden; color: #1e1e1e; }
.mkP .hd { flex: none; display: flex; align-items: center; gap: 10px; height: 54px; padding: 0 12px 0 16px; border-bottom: 1px solid #ededed; } .mkP .hd b { font-size: 16px; font-weight: 700; } .mkP .hd .sp { flex: 1; } .mkP .hd i { width: 34px; height: 34px; display: grid; place-items: center; color: #6a6a6a; } .mkP .hd .ti { color: #444; }
.mkP .ls { flex: 1; overflow: hidden; } .mkP .rw { display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 8px 0 16px; border-bottom: 1px solid #f0f0f0; } .mkP .rw .li { color: #555; display: grid; } .mkP .rw b { flex: 1; font-size: 15px; font-weight: 600; color: #222; } .mkP .rw .n { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; background: #ececec; font-size: 12px; font-weight: 600; color: #555; display: grid; place-items: center; } .mkP .rw .q { color: #b0b0b0; } .mkP .rw .ch { width: 30px; display: grid; place-items: center; color: #777; } .mkP .rw.red b, .mkP .rw.red .li { color: #c4553f; }
.mkP .bd { padding: 2px 16px 16px; border-bottom: 1px solid #f0f0f0; } .mkP .tabs { display: flex; gap: 6px; margin: 4px 0 12px; } .mkP .tabs span { display: flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px; border-radius: 16px; font-size: 13.5px; font-weight: 600; color: #8a8a8a; } .mkP .tabs .on { background: #f0f0f0; color: #222; }
.mkP .fd { display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 14px; border-radius: 21px; border: 1px solid #e6e6e6; font-size: 14px; color: #aaa; } .mkP .hint { margin-top: 9px; font-size: 13px; color: #8a8a8a; } .mkP .lb { margin: 6px 0 7px; font-size: 13px; color: #8a8a8a; }
.mkP .sel { display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 14px 0 8px; border-radius: 14px; background: #f4f4f4; border: 1px solid #e8e8e8; } .mkP .sel .lo { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 1px solid #e6e6e6; color: #222; } .mkP .sel div { flex: 1; } .mkP .sel b { display: block; font-size: 14.5px; font-weight: 600; } .mkP .sel .s { font-size: 12px; color: #8a8a8a !important; }
.mkP .tg { display: flex; align-items: center; gap: 10px; min-height: 52px; } .mkP .tg + .tg { border-top: 1px solid #f3f3f3; } .mkP .tg div { flex: 1; } .mkP .tg b { display: block; font-size: 14.5px; font-weight: 600; } .mkP .tg .s { font-size: 12.5px; color: #8a8a8a !important; } .mkP .sw { width: 44px; height: 26px; border-radius: 13px; background: #d6d6d6; position: relative; } .mkP .sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); } .mkP .sw.on { background: #3a3a3a; } .mkP .sw.on::after { left: 21px; }`;
const HOLD = `.na_ph_frame .ob_pill { display: none !important; } .na_ph_frame .ob_msgs.hold .ob_mi > * { opacity: 1 !important; } .mkM { align-self: flex-start; position: relative; z-index: 4; display: grid; grid-template-columns: repeat(6, 38px); gap: 2px 4px; padding: 7px 8px; margin: 4px 0 4px 44px; border-radius: 12px; background: #fff; border: 1px solid #e6e6e6; box-shadow: 0 10px 28px rgba(0,0,0,.1); color: #8a8a8a; } .mkM i { height: 36px; display: grid; place-items: center; }
.mkQ { position: absolute; z-index: 4; display: flex; gap: 14px; color: #8a8a8a; }`;
const EMO = `.mkE { position: absolute; z-index: 6; left: 0; right: 0; bottom: calc(118px + var(--nbk, 0px)); height: 330px; border-radius: 22px 22px 22px 22px; background: #fff; border: 1px solid #e6e6e6; box-shadow: 0 -6px 26px rgba(0,0,0,.07); overflow: hidden; }
.mkE .tb { display: flex; justify-content: space-around; align-items: center; height: 50px; padding: 0 6px; border-bottom: 1px solid #efefef; } .mkE .tb span { display: grid; place-items: center; height: 34px; padding: 0 16px; border-radius: 17px; font-size: 14px; font-weight: 500; color: #9a9a9a; } .mkE .tb .on { background: #ececec; color: #2a2a2a; box-shadow: inset 0 0 0 1px #e0e0e0; }
.mkE .sr { margin: 10px 12px; height: 38px; border-radius: 19px; background: #f4f4f4; border: 1px solid #e6e6e6; display: flex; align-items: center; gap: 8px; padding: 0 12px; font-size: 14px; color: #a8a8a8; } .mkE .ct { display: flex; gap: 2px; padding: 0 10px 8px; border-bottom: 1px solid #efefef; } .mkE .ct i { width: 36px; height: 34px; display: grid; place-items: center; font-style: normal; font-size: 19px; border-radius: 10px; filter: saturate(.9); } .mkE .ct .on { background: #efefef; }
.mkE h6 { margin: 10px 14px 4px; font-size: 11.5px; font-weight: 600; letter-spacing: .04em; color: #9a9a9a; } .mkE .gr { display: grid; grid-template-columns: repeat(8, 1fr); padding: 0 8px; } .mkE .gr i { height: 42px; display: grid; place-items: center; font-style: normal; font-size: 26px; }`;
(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p;
 try {
  await p.evaluate(() => document.documentElement.style.setProperty('--na-nb', '48px'));
  await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; m.text = String(m.text).replace(/\n# STATE/, `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n\n# STATE`); m.boundary = n; });
  await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
  await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
  const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke. Der hat freitags immer die besten', '모퉁이 빵집 거. 거기 금요일엔 늘 제일 맛있어'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(i === 7 ? { state: 'Werkstatt · Feierabend' } : {}) })); r.messages[2].reacts = [{ by: me, e: '❤️', at: Date.now() - 9000 }]; for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); await core.saveMeta(); return r.id; }, B);
  const me = await p.evaluate(async B => (await import(B + 'phone2store.js')).liveWorld((await import(B + 'core.js')).getMeta()).persona, B);
  await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(900);
  const style = css => p.evaluate(css => { document.getElementById('mk_q')?.remove(); const t = document.createElement('style'); t.id = 'mk_q'; t.textContent = css; document.head.append(t); }, css);
  const shot = async k => { await p.waitForTimeout(350); await p.screenshot({ path: OUT + `${k}.png` }); console.log('shot', k); };
  // 위 줄 · 머리 · 입력 카드
  const chrome = (emo = false) => p.evaluate(([P, emo]) => { const ic = (k, s = 22, w = 1.7) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${P[k]}</svg>`;
    const ct = document.querySelector('.na_ph_frame .ob_ct'), face = ct.querySelector('.ob_face img')?.outerHTML || 'M';
    ct.insertAdjacentHTML('beforebegin', `<div class="mkT"><i>${ic('home', 24, 1.9)}</i><i>${ic('chats', 24, 1.9)}</i><span class="sp"></span><i>${ic('search', 24, 1.9)}</i><i>${ic('mask', 24, 1.9)}</i><i>${ic('mark', 23, 1.9)}</i><i>${ic('menu', 24, 1.9)}</i></div>
      <div class="mkH"><div class="pill"><span class="av">${face}<i class="dot"></i></span><span class="tx"><b>Mara</b><div class="sb">Werkstatt · Feierabend · Varo 13:24</div></span></div><span class="set">${ic('sliders', 20, 1.8)}</span></div>`);
    const host = document.querySelector('.na_ph_frame .ob_msgs').parentElement;
    host.insertAdjacentHTML('beforeend', `<div class="mkC"><div class="in">메시지</div><div class="tl"><i>${ic('clip', 22, 1.7)}</i><i>${ic('up', 22, 1.8)}</i><span class="sp"></span>${emo ? `<i class="kb">${ic('kbd', 20, 1.6)}</i>` : `<i>${ic('smile', 23, 1.6)}</i>`}<i class="off">${ic('send', 22, 1.6)}</i></div></div>`);
  }, [P, emo]);
  const flat = () => p.evaluate(me => { const bs = [...document.querySelectorAll('.na_ph_frame .ob_b[data-id]')];
    for (const b of bs) { if (!b.classList.contains('g1')) continue; const mine = b.classList.contains('me'), t = (b.querySelector('.ob_tin .cg_num, .ob_tl')?.textContent || '').trim();
      const fa = mine ? `<span class="fa" style="background:linear-gradient(135deg,#a99be0,#e7a6c8)">${me[0]}</span>` : `<span class="fa">${document.querySelector('.na_ph_frame .mkH .av').innerHTML.replace(/<i class="dot"><\/i>/, '')}</span>`;
      b.insertAdjacentHTML('beforebegin', `<div class="mkn">${fa}<b>${mine ? me : 'Mara'}</b><i>오늘 ${t}</i></div>`); } }, me);
  const room = async (k, css, f) => { await s.to('orbitroom', rid); await p.waitForTimeout(500); await style(CSS + css); await chrome(); if (f) await flat(); await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = e.scrollHeight; }); await shot(k); };
  await room('RA', '');
  await room('RB', PALE);
  await room('RC', PALE + FLAT, true);
  // 방 설정 창 (마리나라 채팅 설정 = 접는 줄 목록). 가져올 메뉴 전부
  const panel = async (k, open) => { await s.to('orbitroom', rid); await p.waitForTimeout(500); await style(CSS + PALE + PANEL); await chrome();
    await p.evaluate(([P, open]) => { const ic = (k, s = 20, w = 1.7) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${P[k]}</svg>`;
      const top = document.querySelector('.na_ph_frame .mkH').getBoundingClientRect().top - document.querySelector('.na_ph_frame .ob_msgs').parentElement.getBoundingClientRect().top, k = document.querySelector('.na_ph_frame .mkH').getBoundingClientRect().height / document.querySelector('.na_ph_frame .mkH').offsetHeight;
      const R = [['search', '메시지 찾기 · 북마크 · 휴지통'], ['title', '방 이름'], ['users', '사람', 2], ['plug', '연결'], ['gauge', '고급 매개변수'], ['mask', '페르소나'], ['card', '프로필 · 소개글 · 말투'], ['bell', '먼저 말 걸기'], ['cal', '스케줄', 2], ['wand', '캐릭터가 스스로 하는 일'], ['pin', '고정한 말', 1], ['link', '롤플 채팅과 잇기'], ['tr', '번역'], ['book', '로어북'], ['ctx', '지금 들어간 내용'], ['vars', '채팅 변수'], ['branch', '분기', 1], ['phone', '통화'], ['camera', '셀카 · 영상'], ['music', '음악'], ['dice', '게임']];
      const body = { search: `<div class="bd"><div class="tabs"><span class="on">${ic('search', 15, 2)}찾기</span><span>${ic('mark', 15, 2)}북마크</span><span>${ic('trash', 15, 2)}휴지통</span></div><div class="fd">${ic('search', 17, 1.8)}글 또는 #번호로 찾기</div><div class="hint">낱말이나 말 번호(예: #67)를 적어요</div></div>`,
        plug: `<div class="bd"><div class="lb">모델</div><div class="sel"><span class="lo">${ic('plug', 20, 1.8)}</span><div><b>gemini-4-argon</b><div class="s">기본 연결 따라가기 · Google Vertex AI</div></div>${ic('chev', 20, 1.8)}</div><div class="hint">기본 연결을 바꾸면 이 방도 같이 바뀌어요</div></div>`,
        bell: `<div class="bd"><div class="tg"><div><b>먼저 말 걸기</b><div class="s">내가 한동안 조용하면 Mara가 먼저 연락해요</div></div><span class="sw on"></span></div><div class="tg"><div><b>하루 최대</b><div class="s">수다 정도에 맞춰요 · 하루 5번</div></div>${ic('chev', 20, 1.8)}</div></div>` };
      const rows = R.map(([i, l, n]) => `<div class="rw"><span class="li">${ic(i)}</span><b>${l}</b>${n ? `<span class="n">${n}</span>` : ''}<span class="q">${ic('q', 19, 1.6)}</span><span class="ch">${ic(open.includes(i) ? 'chevu' : 'chev', 19, 1.8)}</span></div>${open.includes(i) ? body[i] : ''}`).join('') + `<div class="rw red"><span class="li">${ic('trash')}</span><b>방 지우기</b></div>`;
      const host = document.querySelector('.na_ph_frame .ob_msgs').parentElement;
      host.insertAdjacentHTML('beforeend', `<div class="mkP" style="--pt:${Math.round(top / k)}px"><div class="hd"><span class="ti">${ic('sliders', 20, 1.8)}</span><b>방 설정</b><span class="sp"></span><i>${ic('x', 22, 1.8)}</i></div><div class="ls">${rows}</div></div>`);
      if (open.includes('plug')) document.querySelector('.na_ph_frame .mkP .ls').scrollTop = 0;
    }, [P, open]);
    if (k === 'P2') await p.evaluate(() => { const l = document.querySelector('.na_ph_frame .mkP .ls'); l.style.overflow = 'auto'; l.scrollTop = 120; });
    await shot(k); };
  await panel('P1', ['search']);
  await panel('P2', ['plug', 'bell']);
  // 길게 누르기: 흰 아이콘 카드 (마리나라와 같은 6칸 두 줄, 이름 없이)
  await s.to('orbitroom', rid); await p.waitForTimeout(500); await style(CSS + PALE + HOLD); await chrome();
  await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = e.scrollHeight; });
  { const bx = await p.locator('.na_ph_frame .ob_b.th').nth(3).boundingBox(); await p.mouse.move(bx.x + 30, bx.y + 15); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(400); }
  await style(CSS + PALE + HOLD);
  await p.evaluate(P => { const ic = (k, s = 21, w = 1.6) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${P[k]}</svg>`;
    if (!document.querySelector('.na_ph_frame .mkT')) { /* chrome lost on redraw */ }
    const b = document.querySelector('.na_ph_frame .ob_b.held') || document.querySelectorAll('.na_ph_frame .ob_b.th')[3];
    b.insertAdjacentHTML('beforebegin', `<div class="mkM">${['copy', 'react', 'tr', 'redo', 'edit', 'mark', 'hide', 'peek', 'brain', 'branch', 'trash'].map(k => `<i>${ic(k)}</i>`).join('')}</div>`); }, P);
  if (!(await p.$('.na_ph_frame .mkT'))) await chrome();
  await shot('H');
  // 이모지 창
  await p.mouse.click(380, 300); await s.to('orbitroom', rid); await p.waitForTimeout(500); await style(CSS + PALE + EMO); await chrome(true);
  await p.evaluate(() => { const E = '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🤫 🤔 🫡 🤐'.split(' '), C = '😀 👋 🐾 🍕 🚗 ⚽ 💡 💯 🏁'.split(' ');
    document.querySelector('.na_ph_frame .ob_msgs').parentElement.insertAdjacentHTML('beforeend', `<div class="mkE"><div class="tb"><span class="on">이모지</span><span>카오모지</span><span>GIF</span><span>스티커</span><span>도구</span></div><div class="sr"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>이모지 찾기</div><div class="ct">${C.map((c, i) => `<i class="${i ? '' : 'on'}">${c}</i>`).join('')}</div><h6>표정 · 감정</h6><div class="gr">${E.map(e => `<i>${e}</i>`).join('')}</div></div>`); });
  await shot('E');
 } finally { await s.close(); reset(); } })().catch(e => { console.error(e); reset(); process.exit(1); });
