// 실리 1.19.1 public/scripts/sysprompt.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
// 실리 public/scripts/sysprompt.js 15~15
export let system_prompts = [];

/**
 * system_prompts는 실리 loadSystemPrompts 50~53(data.sysprompt, /api/settings/get의 sysprompt 폴더).
 * @param {{system_prompts?: object[]}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'system_prompts')) system_prompts = v.system_prompts;
}
