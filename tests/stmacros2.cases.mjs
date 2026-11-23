// 실리가 initMacros 밖에서 등록하는 매크로(작가 노트 · 추론 · 요약 · 그림 생성 · 표정)와 {{hasExtension}}: 경우들.
// 실리 1.19.1 브라우저(tools/st/oracle-macros.mjs)와 서버(tests/stmacros2.run.mjs, plugin/st)가 같은 경우를 돌려요. 기대값은 브라우저에서만 받아요.
//  - variant: 페이지 하나(settings.json 하나 · config). 실리는 페이지를 열 때 매크로를 등록해요: variant마다 페이지를 새로 열어요.
//  - state: 그 페이지에서 연 채팅 하나(이름 · 카드 · 메시지 · chat_metadata). 브라우저는 그 값을 넣고 CHAT_CHANGED를 보내요(실리가 채팅을 열 때처럼).
//  - text: substituteParams에 넣는 글.
// 예시 캐릭터만 써요.
export const NAME1 = 'Mara';

export const CHARACTERS = [
    { name: 'Ren', avatar: 'Ren.png', description: '{{char}} is a courier.', personality: '', scenario: '', mes_example: '', first_mes: '', data: { system_prompt: '', post_history_instructions: '', creator_notes: '', character_version: '', alternate_greetings: [], extensions: { depth_prompt: { prompt: '' }, sd_character_prompt: { positive: 'ren card positive', negative: 'ren card negative' } } } },
    { name: 'Ivo', avatar: 'Ivo.png', description: 'Ivo fixes radios.', personality: '', scenario: '', mes_example: '', first_mes: '', data: { system_prompt: '', post_history_instructions: '', creator_notes: '', character_version: '', alternate_greetings: [], extensions: { depth_prompt: { prompt: '' }, sd_character_prompt: { positive: 'ivo card positive', negative: '' } } } },
    { name: 'Lio', avatar: 'Lio.png', description: 'Lio sleeps.', personality: '', scenario: '', mes_example: '', first_mes: '', data: { system_prompt: '', post_history_instructions: '', creator_notes: '', character_version: '', alternate_greetings: [], extensions: { depth_prompt: { prompt: '' } } } },
];
export const GROUP = { id: 'na-m2-group', name: 'Harbor', members: ['Ren.png', 'Ivo.png'], disabled_members: [], chat_id: 'na-m2-group-chat', generation_mode: 0 };

const msg = (name, mes, more = {}) => ({ name, is_user: name === NAME1, is_system: false, mes, send_date: '2026-11-20T10:00:00.000Z', extra: {}, ...more });
// (extra.memory: the summary the memory extension saved on a message)
const CHAT_MID = [msg('Ren', 'Morning.'), msg(NAME1, 'Hi.', { extra: { memory: 'Ren met {{user}} at the pier.' } }), msg('Ren', 'Rain again.')];
const CHAT_LAST = [msg('Ren', 'Morning.'), msg(NAME1, 'Hi.'), msg('Ren', 'Rain again.', { extra: { memory: 'only on the last one' } })];
const CHAT_NONE = [msg('Ren', 'Morning.'), msg(NAME1, 'Hi.'), msg('Ivo', 'Static on the radio.')];
const CHAT_IVO = [msg('Ivo', 'Static.', { extra: { memory: 'older summary' } }), msg(NAME1, 'Fix it?', { extra: { memory: 'Ivo fixes the radio.' } }), msg('Ivo', 'Done.')];

// character: 카드 번호(this_chid) · group: 그룹 채팅(this_chid 없음, name2 '')
export const STATES = [
    { id: 'note', character: 0, chat: CHAT_MID, meta: { note_prompt: 'AN for {{char}}' } },
    { id: 'nonote', character: 0, chat: CHAT_LAST, meta: {} },
    { id: 'empty-note', character: 0, chat: CHAT_NONE, meta: { note_prompt: '' } },
    { id: 'ivo', character: 1, chat: CHAT_IVO, meta: {} },
    { id: 'lio', character: 2, chat: [], meta: { note_prompt: 'Lio note' } },
    { id: 'group', group: true, chat: CHAT_NONE, meta: { note_prompt: 'Group note' } },
    // (a note whose text holds other macros: the old engine replaces them in the order the macros were registered)
    { id: 'order', character: 0, chat: CHAT_MID, meta: { note_prompt: '[{{defaultExpression}}|{{summary}}|{{charPrefix}}|{{defaultAuthorsNote}}|{{lastMessage}}|{{user}}|{{availableExpressions}}|{{reasoningPrefix}}]' } },
];

export const TEXTS = [
    { id: 'all', text: '[{{authorsNote}}][{{charAuthorsNote}}][{{defaultAuthorsNote}}][{{summary}}][{{charPrefix}}][{{charNegativePrefix}}][{{defaultExpression}}][{{availableExpressions}}][{{lastExpression}}]' },
    { id: 'reasoning', text: '[{{reasoningPrefix}}|{{reasoningSuffix}}|{{reasoningSeparator}}] [{{isMobile}}] [{{lastGenerationType}}]' },
    { id: 'if', text: '{{if authorsNote}}AN: {{authorsNote}}{{else}}no note{{/if}} / {{if summary}}S{{else}}no summary{{/if}}' },
    { id: 'has', text: '{{hasExtension::memory}} {{hasExtension::expressions}} {{hasExtension::stable-diffusion}} {{hasExtension::regex}} {{hasExtension::Summarize}} {{hasExtension::nope}}' },
    { id: 'order', text: '{{defaultAuthorsNote}} / {{authorsNote}}' },
    { id: 'lastexp-arg', text: '[{{lastExpression::Ivo}}][{{lastExpression::{{char}}}}]' },
];

const BASE = {
    firstRun: false,
    currentVersion: '1.19.1',
    username: NAME1,
    main_api: 'openai',
    power_user: { auto_connect: false, reasoning: { name: 'Na test', prefix: '<r>', suffix: '</r>', separator: ' | ', auto_parse: false, add_to_prompts: false, auto_expand: false, show_hidden: false, max_additions: 1 } },
    oai_settings: { chat_completion_source: 'openai' },
};
const EXT = {
    note: { default: 'Default for {{char}}', chara: [{ name: 'Ren', prompt: 'Ren character note', useChara: true, position: 0 }], wiAddition: [] },
    sd: { character_prompts: { Ren: 'ren from settings' }, character_negative_prompts: {} },
    expressions: { api: 99, custom: ['smug'], showDefault: false, fallback_expression: 'joy' },
};
const settings = (more = {}, ext = {}) => ({ ...BASE, ...more, power_user: { ...BASE.power_user, ...(more.power_user || {}) }, extension_settings: { ...EXT, ...ext } });

// bridge: 'new' (이 다리: x-na-bridge 표시) · 'old' (옛 다리: 새 길 둘이 표시 없는 404)
// labels: 브라우저 · 서버가 받는 /api/extra/classify/labels의 답 (Playwright가 그 요청을 대신 받아요. 없으면 실리의 진짜 답)
// config: 'off'면 실리를 config extensions.enabled false로 띄워요(환경 변수 SILLYTAVERN_EXTENSIONS_ENABLED=false)
export const VARIANTS = [
    { id: 'new', settings: settings() },
    { id: 'legacy', settings: settings({ power_user: { experimental_macro_engine: false } }) },
    { id: 'nomem', settings: settings({}, { disabledExtensions: ['memory'] }) },
    { id: 'legacy-noexp', settings: settings({ power_user: { experimental_macro_engine: false } }, { disabledExtensions: ['expressions', 'stable-diffusion'] }) },
    // (no sd block, a note without defaults, expressions that need migrating: showDefault with a fallback, the old `local` flag)
    { id: 'raw', settings: settings({}, { sd: {}, note: { chara: [] }, expressions: { showDefault: true, fallback_expression: 'joy', local: false, custom: [] } }) },
    { id: 'llm', settings: settings({}, { expressions: { api: 2, custom: [], showDefault: false } }) },
    { id: 'emoji', settings: settings({}, { expressions: { api: 99, custom: ['smug', 'joy'], showDefault: true } }) },
    { id: 'local', settings: settings({}, { expressions: { api: 0, custom: ['smug'] } }), labels: { status: 200, body: { labels: ['calm', 'tense', 'joy', 'smug'] } } },
    { id: 'local-old-bridge', settings: settings({}, { expressions: { api: 0, custom: ['smug'] } }), labels: { status: 404, body: 'Not Found' }, bridge: 'old' },
    { id: 'extras', settings: settings({}, { expressions: { api: 1, custom: [] } }) },
    { id: 'config-off', settings: settings(), config: 'off' },
];
