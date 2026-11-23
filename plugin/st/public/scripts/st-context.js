// 실리 1.19.1 public/scripts/st-context.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { chat, characters, name1, name2, this_chid } from '../script.js';
import { groups, selected_group } from './group-chats.js';
import { accountStorage } from './util/AccountStorage.js';

// 실리 public/scripts/st-context.js 106~106
import { addGlobalVariable, addLocalVariable, decrementGlobalVariable, decrementLocalVariable, deleteGlobalVariable, deleteLocalVariable, existsGlobalVariable, existsLocalVariable, getGlobalVariable, getLocalVariable, incrementGlobalVariable, incrementLocalVariable, setGlobalVariable, setLocalVariable } from './variables.js';

// (실리 getContext()의 앞 칸들만: 옮긴 코드(utils.js getCharaFilename · 요약 · 그림 생성 · 표정 매크로)가 묻는 것은 이것뿐이에요.
//  그 밖의 칸(실리 128~306)은 없어요. 일꾼이 주는 문맥은 plugin/work.mjs contextOf예요)
// 실리 public/scripts/st-context.js 115~127
export function getContext() {
    return {
        accountStorage,
        chat,
        characters,
        groups,
        name1,
        name2,
        characterId: this_chid,
        groupId: selected_group,
        chatId: selected_group
            ? groups.find(x => x.id == selected_group)?.chat_id
            : (characters[this_chid]?.chat),
    };
}

// 실리 getContext()가 돌려주는 객체 중 variables만. 일꾼이 globalThis.SillyTavern.getContext()에 넣어요.
const __naContext = {
// 실리 public/scripts/st-context.js 258~277
        variables: {
            local: {
                get: getLocalVariable,
                set: setLocalVariable,
                del: deleteLocalVariable,
                add: addLocalVariable,
                inc: incrementLocalVariable,
                dec: decrementLocalVariable,
                has: existsLocalVariable,
            },
            global: {
                get: getGlobalVariable,
                set: setGlobalVariable,
                del: deleteGlobalVariable,
                add: addGlobalVariable,
                inc: incrementGlobalVariable,
                dec: decrementGlobalVariable,
                has: existsGlobalVariable,
            },
        },
};

export const variables = __naContext.variables;
