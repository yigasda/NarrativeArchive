// 실리 1.19.1 public/scripts/power-user.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 매크로 계산에 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역(document · getComputedStyle).
import { extension_prompt_types, extension_prompt_roles } from '../script.js';
import { names_behavior_types } from './instruct-mode.js';
import { tag_import_setting, tag_sort_mode } from './tags.js';
import { tokenizers } from './tokenizers.js';
import { AUTOCOMPLETE_SELECT_KEY, AUTOCOMPLETE_STATE, AUTOCOMPLETE_WIDTH } from './autocomplete/AutoComplete.js';
import { DEFAULT_REASONING_TEMPLATE } from './reasoning.js';
import { IMAGE_OVERSWIPE, MEDIA_DISPLAY } from './constants.js';
import { persona_description_positions as _persona_description_positions } from './personas.js';

// 대역: power_user의 색 기본값(실리 159~168줄)은 브라우저 CSS 변수를 읽어요. 서버에는 없어서 빈 글자가 돼요.
const document = { documentElement: null };
const getComputedStyle = () => ({ getPropertyValue: () => '' });

// 실리 public/scripts/power-user.js 90~93
const defaultStoryString = '{{#if system}}{{system}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{char}}\'s personality: {{personality}}\n{{/if}}{{#if scenario}}Scenario: {{scenario}}\n{{/if}}{{#if persona}}{{persona}}\n{{/if}}';
const defaultExampleSeparator = '***';
const defaultChatStart = '***';
const defaultToastPosition = 'toast-top-center';

// 실리 public/scripts/power-user.js 95~100
const avatar_styles = {
    ROUND: 0,
    RECTANGULAR: 1,
    SQUARE: 2,
    ROUNDED: 3,
};

// 실리 public/scripts/power-user.js 102~112
export const chat_styles = {
    DEFAULT: 0,
    BUBBLES: 1,
    DOCUMENT: 2,
};

export const send_on_enter_options = {
    DISABLED: -1,
    AUTO: 0,
    ENABLED: 1,
};

// 실리 public/scripts/power-user.js 114~343
export const persona_description_positions = _persona_description_positions;

export const power_user = {
    charListGrid: false,
    tokenizer: tokenizers.BEST_MATCH,
    token_padding: 64,
    collapse_newlines: false,
    pin_examples: false,
    strip_examples: false,
    trim_sentences: false,
    always_force_name2: false,
    user_prompt_bias: '',
    show_user_prompt_bias: true,
    auto_continue: {
        enabled: false,
        allow_chat_completions: false,
        target_length: 400,
    },
    markdown_escape_strings: '',
    chat_truncation: 100,
    streaming_fps: 30,
    smooth_streaming: false,
    smooth_streaming_no_think: false,
    smooth_streaming_speed: 50,
    stream_fade_in: false,

    fast_ui_mode: true,
    avatar_style: avatar_styles.ROUND,
    chat_display: chat_styles.DEFAULT,
    toastr_position: defaultToastPosition,
    chat_width: 50,
    never_resize_avatars: false,
    show_card_avatar_urls: false,
    play_message_sound: false,
    play_sound_unfocused: true,
    auto_save_msg_edits: false,
    confirm_message_delete: true,

    sort_field: 'name',
    sort_order: 'asc',
    sort_rule: null,
    font_scale: 1,
    blur_strength: 10,
    shadow_width: 2,

    main_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBodyColor').trim()}`,
    italics_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeEmColor').trim()}`,
    underline_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeUnderlineColor').trim()}`,
    quote_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim()}`,
    blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBlurTintColor').trim()}`,
    chat_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeChatTintColor').trim()}`,
    user_mes_blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeUserMesBlurTintColor').trim()}`,
    bot_mes_blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBotMesBlurTintColor').trim()}`,
    shadow_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeShadowColor').trim()}`,
    border_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBorderColor').trim()}`,

    custom_css: '',

    waifuMode: false,
    movingUI: false,
    movingUIState: {},
    movingUIPreset: '',
    noShadows: false,
    theme: 'Default (Dark) 1.7.1',

    gestures: true,
    auto_swipe: false,
    auto_swipe_minimum_length: 0,
    auto_swipe_blacklist: [],
    auto_swipe_blacklist_threshold: 2,
    auto_scroll_chat_to_bottom: true,
    auto_fix_generated_markdown: true,
    send_on_enter: send_on_enter_options.AUTO,
    console_log_prompts: false,
    request_token_probabilities: false,
    show_group_chat_queue: false,
    allow_name1_display: false,
    allow_name2_display: false,
    hotswap_enabled: true,
    timer_enabled: true,
    timestamps_enabled: true,
    timestamp_model_icon: false,
    mesIDDisplay_enabled: false,
    hideChatAvatars_enabled: false,
    max_context_unlocked: false,
    message_token_count_enabled: false,
    expand_message_actions: false,
    enableZenSliders: false,
    enableLabMode: false,
    prefer_character_prompt: true,
    prefer_character_jailbreak: true,
    quick_continue: false,
    quick_impersonate: false,
    continue_on_send: false,
    trim_spaces: true,
    relaxed_api_urls: false,
    world_import_dialog: true,
    enable_auto_select_input: false,
    enable_md_hotkeys: false,
    tag_import_setting: tag_import_setting.ASK,
    tag_sort_mode: tag_sort_mode.MANUAL,
    disable_group_trimming: false,
    single_line: false,

    instruct: {
        enabled: false,
        preset: 'Alpaca',
        input_sequence: '### Instruction:',
        input_suffix: '',
        output_sequence: '### Response:',
        output_suffix: '',
        system_sequence: '',
        system_suffix: '',
        last_system_sequence: '',
        first_input_sequence: '',
        first_output_sequence: '',
        last_input_sequence: '',
        last_output_sequence: '',
        story_string_prefix: '',
        story_string_suffix: '',
        stop_sequence: '',
        wrap: true,
        macro: true,
        names_behavior: names_behavior_types.FORCE,
        activation_regex: '',
        bind_to_context: false,
        user_alignment_message: '',
        system_same_as_user: false,
        /** @deprecated Use output_suffix instead */
        separator_sequence: '',
        sequences_as_stop_strings: true,
    },

    context: {
        preset: 'Default',
        story_string: defaultStoryString,
        chat_start: defaultChatStart,
        example_separator: defaultExampleSeparator,
        use_stop_strings: true,
        names_as_stop_strings: true,
        story_string_position: extension_prompt_types.IN_PROMPT,
        story_string_role: extension_prompt_roles.SYSTEM,
        story_string_depth: 1,
    },

    instruct_derived: false,
    context_derived: false,
    context_size_derived: false,
    /** User-defined model identifier / chat template hash to instruct/context template mappings */
    model_templates_mappings: {},
    /** The chat template hash of the currently loaded model, if any; used when deriving mappings */
    chat_template_hash: '',

    sysprompt: {
        enabled: true,
        name: 'Neutral - Chat',
        content: 'Write {{char}}\'s next reply in a fictional chat between {{char}} and {{user}}.',
        post_history: '',
    },

    reasoning: {
        name: DEFAULT_REASONING_TEMPLATE,
        auto_parse: false,
        add_to_prompts: false,
        auto_expand: false,
        show_hidden: false,
        prefix: '<think>',
        suffix: '</think>',
        separator: '\n',
        max_additions: 1,
    },

    personas: {},
    default_persona: null,
    persona_descriptions: {},

    persona_description: '',
    persona_description_position: persona_description_positions.IN_PROMPT,
    persona_description_role: 0,
    persona_description_depth: 2,
    persona_description_lorebook: '',
    persona_show_notifications: true,
    persona_sort_order: 'asc',

    custom_stopping_strings: '',
    custom_stopping_strings_macro: true,
    fuzzy_search: false,
    encode_tags: false,
    experimental_macro_engine: true,
    servers: [],
    bogus_folders: false,
    zoomed_avatar_magnification: false,
    show_tag_filters: false,
    aux_field: 'character_version',
    stscript: {
        matching: 'fuzzy',
        autocomplete: {
            state: AUTOCOMPLETE_STATE.ALWAYS,
            autoHide: false,
            style: 'theme',
            font: {
                scale: 0.8,
            },
            width: {
                left: AUTOCOMPLETE_WIDTH.CHAT,
                right: AUTOCOMPLETE_WIDTH.CHAT,
            },
            select: AUTOCOMPLETE_SELECT_KEY.TAB + AUTOCOMPLETE_SELECT_KEY.ENTER,
            /** Whether to show macro autocomplete in all macro-enabled fields (not just expanded editors) */
            showInAllMacroFields: false,
        },
        parser: {
            /**@type {Object.<PARSER_FLAG,boolean>} */
            flags: {},
        },
    },
    restore_user_input: true,
    reduced_motion: false,
    compact_input_area: true,
    show_swipe_num_all_messages: false,
    auto_connect: false,
    auto_load_chat: false,
    forbid_external_media: true,
    external_media_allowed_overrides: [],
    external_media_forbidden_overrides: [],
    pin_styles: true,
    click_to_edit: false,
    media_display: MEDIA_DISPLAY.LIST,
    image_overswipe: IMAGE_OVERSWIPE.GENERATE,
};

const __naDefault_power_user = structuredClone(power_user);

// 실리 public/scripts/power-user.js 401~410
/**
 * Replaces consecutive newlines with a single newline.
 * @param {string} x String to be processed.
 * @returns {string} Processed string.
 * @example
 * collapseNewlines("\n\n\n"); // "\n"
 */
export function collapseNewlines(x) {
    return x.replaceAll(/\n+/g, '\n');
}

/**
 * 일꾼이 실리 설정의 power_user를 채워요(실리 loadPowerUserSettings처럼 기본값 위에 Object.assign). v에 있는 키만 바꿔요.
 * @param {{power_user?: object}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'power_user')) {
        for (const key of Object.keys(power_user)) delete power_user[key];
        Object.assign(power_user, structuredClone(__naDefault_power_user), v.power_user);
    }
}
