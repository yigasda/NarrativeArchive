// 실리 1.19.1 public/scripts/popup.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 매크로 계산에 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역(Popup).
// 실리 public/scripts/popup.js 24~37
export const POPUP_RESULT = {
    AFFIRMATIVE: 1,
    NEGATIVE: 0,
    CANCELLED: null,
    CUSTOM1: 1001,
    CUSTOM2: 1002,
    CUSTOM3: 1003,
    CUSTOM4: 1004,
    CUSTOM5: 1005,
    CUSTOM6: 1006,
    CUSTOM7: 1007,
    CUSTOM8: 1008,
    CUSTOM9: 1009,
};

// 대역: 실리 Popup(149줄~)은 브라우저 창이에요. 서버에서는 띄우지 않고 '취소'로 끝나요.
export class Popup {
    static show = {
        input: async () => null,
        confirm: async () => POPUP_RESULT.CANCELLED,
        text: async () => POPUP_RESULT.CANCELLED,
    };
}
