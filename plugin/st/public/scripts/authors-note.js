// 실리 1.19.1 public/scripts/authors-note.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { chat_metadata, extension_prompt_roles, this_chid } from '../script.js';
import { extension_settings } from './extensions.js';
import { getCharaFilename } from './utils.js';
import { t } from './i18n.js';
import { macros, MacroCategory } from './macros/macro-system.js';
import { MacrosParser } from './macros.js';
import { power_user } from './power-user.js';

// 실리 public/scripts/authors-note.js 30~36
export const metadata_keys = {
    prompt: 'note_prompt',
    interval: 'note_interval',
    depth: 'note_depth',
    position: 'note_position',
    role: 'note_role',
};

// (실리 onChatChanged 441~가 채팅을 열 때 부르는 loadSettings의 값 부분. 298~321은 화면 칸이라 안 옮겨요)
// 실리 public/scripts/authors-note.js 271~297
function loadSettings() {
    const DEFAULT_DEPTH = 4;
    const DEFAULT_POSITION = 1;
    const DEFAULT_INTERVAL = 1;
    const DEFAULT_ROLE = extension_prompt_roles.SYSTEM;

    if (extension_settings.note.defaultPosition === undefined) {
        extension_settings.note.defaultPosition = DEFAULT_POSITION;
    }

    if (extension_settings.note.defaultDepth === undefined) {
        extension_settings.note.defaultDepth = DEFAULT_DEPTH;
    }

    if (extension_settings.note.defaultInterval === undefined) {
        extension_settings.note.defaultInterval = DEFAULT_INTERVAL;
    }

    if (extension_settings.note.defaultRole === undefined) {
        extension_settings.note.defaultRole = DEFAULT_ROLE;
    }

    chat_metadata[metadata_keys.prompt] = chat_metadata[metadata_keys.prompt] ?? extension_settings.note.default ?? '';
    chat_metadata[metadata_keys.interval] = chat_metadata[metadata_keys.interval] ?? extension_settings.note.defaultInterval ?? DEFAULT_INTERVAL;
    chat_metadata[metadata_keys.position] = chat_metadata[metadata_keys.position] ?? extension_settings.note.defaultPosition ?? DEFAULT_POSITION;
    chat_metadata[metadata_keys.depth] = chat_metadata[metadata_keys.depth] ?? extension_settings.note.defaultDepth ?? DEFAULT_DEPTH;
    chat_metadata[metadata_keys.role] = chat_metadata[metadata_keys.role] ?? extension_settings.note.defaultRole ?? DEFAULT_ROLE;
}

// (실리 initAuthorsNote 476~585가 페이지를 열 때 부르는 매크로 등록)
// 실리 public/scripts/authors-note.js 587~619
function registerAuthorsNoteMacros() {
    if (power_user.experimental_macro_engine) {
        macros.register('authorsNote', {
            category: MacroCategory.PROMPTS,
            description: t`The contents of the Author's Note`,
            handler: () => chat_metadata[metadata_keys.prompt] ?? '',
        });
        macros.register('charAuthorsNote', {
            category: MacroCategory.PROMPTS,
            description: t`The contents of the Character Author's Note`,
            handler: () => this_chid !== undefined ? (extension_settings.note.chara.find((e) => e.name === getCharaFilename())?.prompt ?? '') : '',
        });
        macros.register('defaultAuthorsNote', {
            category: MacroCategory.PROMPTS,
            description: t`The contents of the Default Author's Note`,
            handler: () => extension_settings.note.default ?? '',
        });
    } else {
        // TODO: Remove this when the experimental macro engine is replacing the old macro engine
        MacrosParser.registerMacro('authorsNote',
            () => chat_metadata[metadata_keys.prompt] ?? '',
            t`The contents of the Author's Note`,
        );
        MacrosParser.registerMacro('charAuthorsNote',
            () => this_chid !== undefined ? (extension_settings.note.chara.find((e) => e.name === getCharaFilename())?.prompt ?? '') : '',
            t`The contents of the Character Author's Note`,
        );
        MacrosParser.registerMacro('defaultAuthorsNote',
            () => extension_settings.note.default ?? '',
            t`The contents of the Default Author's Note`,
        );
    }
}

export { loadSettings, registerAuthorsNoteMacros };
