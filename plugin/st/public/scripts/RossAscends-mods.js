// 실리 1.19.1 public/scripts/RossAscends-mods.js 대역 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 통째로 대역. 실리 isMobile(143~147줄)은 브라우저 UA를 봐요. 서버에서는 늘 false.
export function isMobile() {
    return false;
}
