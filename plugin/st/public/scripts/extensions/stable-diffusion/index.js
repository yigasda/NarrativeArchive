// 실리 1.19.1 public/scripts/extensions/stable-diffusion/index.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { this_chid } from '../../../script.js';
import { extension_settings, getContext } from '../../extensions.js';
import { selected_group } from '../../group-chats.js';
import { getCharaFilename } from '../../utils.js';
import { power_user } from '../../power-user.js';
import { t } from '../../i18n.js';
import { macros, MacroCategory } from '../../macros/macro-system.js';
import { MacrosParser } from '../../macros.js';

// 우리 것: 실리 loadSettings(462~580, init 5952에서 불러요) 중 매크로가 읽는 칸의 값 부분. 그 밖의 줄은 다른 칸 · 화면이에요
export function __naLoadSettings() {
// 실리 public/scripts/extensions/stable-diffusion/index.js 486~492
    if (extension_settings.sd.character_prompts === undefined) {
        extension_settings.sd.character_prompts = {};
    }

    if (extension_settings.sd.character_negative_prompts === undefined) {
        extension_settings.sd.character_negative_prompts = {};
    }
}

// 우리 것: 실리 init(5487~5998, 확장을 켤 때 activate) 중 loadSettings 뒤의 매크로 등록만
export function __naRegister() {
// 실리 public/scripts/extensions/stable-diffusion/index.js 5955~5997
    const getMacroValue = ({ isNegative }) => {
        if (selected_group || this_chid === undefined) {
            return '';
        }

        const key = getCharaFilename(this_chid);
        let characterPrompt = key ? (extension_settings.sd.character_prompts[key] || '') : '';
        let negativePrompt = key ? (extension_settings.sd.character_negative_prompts[key] || '') : '';

        const context = getContext();
        const sharedPromptData = context?.characters[this_chid]?.data?.extensions?.sd_character_prompt;

        if (typeof sharedPromptData?.positive === 'string' && !characterPrompt && sharedPromptData.positive) {
            characterPrompt = sharedPromptData.positive || '';
        }
        if (typeof sharedPromptData?.negative === 'string' && !negativePrompt && sharedPromptData.negative) {
            negativePrompt = sharedPromptData.negative || '';
        }

        return isNegative ? negativePrompt : characterPrompt;
    };

    if (power_user.experimental_macro_engine) {
        macros.register('charPrefix', {
            category: MacroCategory.PROMPTS,
            description: t`Character's positive Image Generation prompt prefix`,
            handler: () => getMacroValue({ isNegative: false }),
        });
        macros.register('charNegativePrefix', {
            category: MacroCategory.PROMPTS,
            description: t`Character's negative Image Generation prompt prefix`,
            handler: () => getMacroValue({ isNegative: true }),
        });
    } else {
        MacrosParser.registerMacro('charPrefix',
            () => getMacroValue({ isNegative: false }),
            t`Character's positive Image Generation prompt prefix`,
        );
        MacrosParser.registerMacro('charNegativePrefix',
            () => getMacroValue({ isNegative: true }),
            t`Character's negative Image Generation prompt prefix`,
        );
    }
}
