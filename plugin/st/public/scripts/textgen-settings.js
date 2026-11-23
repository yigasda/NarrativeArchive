// 실리 1.19.1 public/scripts/textgen-settings.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 매크로 계산에 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
// 실리 public/scripts/textgen-settings.js 243~243
export let textgenerationwebui_banned_in_macros = [];

/**
 * @param {{textgenerationwebui_banned_in_macros?: string[]}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'textgenerationwebui_banned_in_macros')) textgenerationwebui_banned_in_macros = v.textgenerationwebui_banned_in_macros;
}
