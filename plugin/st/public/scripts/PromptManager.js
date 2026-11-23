// 실리 1.19.1 public/scripts/PromptManager.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
// 실리 public/scripts/PromptManager.js 2001~2081
const chatCompletionDefaultPrompts = {
    'prompts': [
        {
            'name': 'Main Prompt',
            'system_prompt': true,
            'role': 'system',
            'content': 'Write {{char}}\'s next reply in a fictional chat between {{charIfNotGroup}} and {{user}}.',
            'identifier': 'main',
        },
        {
            'name': 'Auxiliary Prompt',
            'system_prompt': true,
            'role': 'system',
            'content': '',
            'identifier': 'nsfw',
        },
        {
            'identifier': 'dialogueExamples',
            'name': 'Chat Examples',
            'system_prompt': true,
            'marker': true,
        },
        {
            'name': 'Post-History Instructions',
            'system_prompt': true,
            'role': 'system',
            'content': '',
            'identifier': 'jailbreak',
        },
        {
            'identifier': 'chatHistory',
            'name': 'Chat History',
            'system_prompt': true,
            'marker': true,
        },
        {
            'identifier': 'worldInfoAfter',
            'name': 'World Info (after)',
            'system_prompt': true,
            'marker': true,
        },
        {
            'identifier': 'worldInfoBefore',
            'name': 'World Info (before)',
            'system_prompt': true,
            'marker': true,
        },
        {
            'identifier': 'enhanceDefinitions',
            'role': 'system',
            'name': 'Enhance Definitions',
            'content': 'If you have more knowledge of {{char}}, add to the character\'s lore and personality to enhance them but keep the Character Sheet\'s definitions absolute.',
            'system_prompt': true,
            'marker': false,
        },
        {
            'identifier': 'charDescription',
            'name': 'Char Description',
            'system_prompt': true,
            'marker': true,
        },
        {
            'identifier': 'charPersonality',
            'name': 'Char Personality',
            'system_prompt': true,
            'marker': true,
        },
        {
            'identifier': 'scenario',
            'name': 'Scenario',
            'system_prompt': true,
            'marker': true,
        },
        {
            'identifier': 'personaDescription',
            'name': 'Persona Description',
            'system_prompt': true,
            'marker': true,
        },
    ],
};

// 실리 public/scripts/PromptManager.js 2083~2085
const promptManagerDefaultPromptOrders = {
    'prompt_order': [],
};

export { chatCompletionDefaultPrompts, promptManagerDefaultPromptOrders };
