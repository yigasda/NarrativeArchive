// 실리 1.19.1 public/scripts/extensions/memory/index.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역($(요약 칸)).
import { getContext } from '../../extensions.js';
import { power_user } from '../../power-user.js';
import { macros, MacroCategory } from '../../macros/macro-system.js';
import { MacrosParser } from '../../macros.js';

// 대역: 실리 $('#memory_contents')는 요약 칸(화면)이에요. 실리는 채팅을 열 때 그 칸에 getLatestMemoryFromChat(chat)을 넣어요(onChatChanged 411~415).
// 서버에는 칸이 없어서 늘 빈 글자예요: 매크로는 그때 같은 함수로 채팅에서 찾아요(1116~1117). 그래서 값이 같아요.
const $ = () => ({ val: () => '' });

// 실리 public/scripts/extensions/memory/index.js 357~371
function getLatestMemoryFromChat(chat) {
    if (!Array.isArray(chat) || !chat.length) {
        return '';
    }

    const reversedChat = chat.slice().reverse();
    reversedChat.shift();
    for (let mes of reversedChat) {
        if (mes.extra && mes.extra.memory) {
            return mes.extra.memory;
        }
    }

    return '';
}

// 우리 것: 실리 init(1066~1131, 확장을 켤 때 activate) 중 매크로 등록만
export function __naRegister() {
// 실리 public/scripts/extensions/memory/index.js 1110~1130
    const summaryMacroHandler = () => {
        // Checking content of the UI summary box first
        const uiSummary = $('#memory_contents').val().toString();
        if (uiSummary.trim().length > 0) {
            return uiSummary;
        }
        // Fallback to scanning the chat for the latest summary if the UI summary box is empty
        return getLatestMemoryFromChat(getContext().chat);
    };
    if (power_user.experimental_macro_engine) {
        macros.register('summary', {
            category: MacroCategory.CHAT,
            description: 'Returns the latest memory/summary from the current chat.',
            handler: () => summaryMacroHandler(),
        });
    } else {
        // TODO: Remove this when the experimental macro engine is replacing the old macro engine
        MacrosParser.registerMacro('summary',
            () => summaryMacroHandler(),
            'Returns the latest memory/summary from the current chat.');
    }
}
