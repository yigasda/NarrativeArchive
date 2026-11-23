// 실리 1.19.1 public/scripts/RossAscends-mods.js 대역 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 통째로 대역. 실리 isMobile(143~147줄)은 브라우저 UA를 봐요. 서버에서는 브라우저가 확장 설정에 적은 값(src/phone2keepon.js keepDevice의 device.isMobile:
// 실리 getContext().isMobile())을 일꾼이 `__naSet`으로 채워요(plugin/st/namacros.js). 아직 안 적었으면 false.
let mobile = false;
export function isMobile() {
    return mobile;
}
/** @param {{isMobile?: boolean}} v */
export function __naSet(v) {
    if (Object.hasOwn(v, 'isMobile')) mobile = v.isMobile === true;
}
