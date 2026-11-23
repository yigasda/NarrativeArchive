// 실리 1.19.1 public/scripts/util/AccountStorage.js 대역 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 통째로 대역. 실리 것은 브라우저 계정 저장소예요. 서버에서는 아무것도 없는 것으로 봐요(getItem은 늘 null, 쓰기는 안 함).
export const accountStorage = {
    init() {},
    getItem() { return null; },
    setItem() {},
    removeItem() {},
    getState() { return {}; },
};
