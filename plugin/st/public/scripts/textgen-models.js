// 실리 1.19.1 public/scripts/textgen-models.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { textgenerationwebui_settings as textgen_settings } from './textgen-settings.js';
import { tokenizers } from './tokenizers.js';

// 실리 public/scripts/textgen-models.js 15~15
let dreamGenModels = [];

// 실리 public/scripts/textgen-models.js 21~21
export let openRouterModels = [];

// 실리 public/scripts/textgen-models.js 23~113
/**
 * List of OpenRouter providers.
 * @type {string[]}
 */
const OPENROUTER_PROVIDERS = [
    // Providers endpoint: https://openrouter.ai/api/v1/providers
    // The list should resemble the sidebar from https://openrouter.ai/models
    // Their docs no longer displays the list, which had "super dead" ones at top, thankfully gone from /v1/providers
    'AI21',
    'AionLabs',
    'Alibaba',
    'AkashML',
    'Amazon Bedrock',
    'Amazon Nova',
    'Ambient',
    'Anthropic',
    'Arcee AI',
    'AtlasCloud',
    'Avian',
    'Azure',
    'Baidu',
    'BaseTen',
    'Black Forest Labs',
    'Cerebras',
    'Chutes',
    'Cirrascale',
    'Clarifai',
    'Cloudflare',
    'Cohere',
    'Crucible',
    'Crusoe',
    'DeepInfra',
    'DeepSeek',
    'DekaLLM',
    'FakeProvider',
    'Featherless',
    'Fireworks',
    'Friendli',
    'GMICloud',
    'Google',
    'Google AI Studio',
    'Groq',
    'Hyperbolic',
    'Inception',
    'Inceptron',
    'InferenceNet',
    'Infermatic',
    'Inflection',
    'Io Net',
    'Ionstream',
    'Liquid',
    'Mancer 2',
    'Mara',
    'Minimax',
    'Mistral',
    'ModelRun',
    'Modular',
    'Moonshot AI',
    'Morph',
    'NCompass',
    'Nebius',
    'Nex AGI',
    'NextBit',
    'Novita',
    'Nvidia',
    'OpenAI',
    'OpenInference',
    'Parasail',
    'Perceptron',
    'Perplexity',
    'Phala',
    'Poolside',
    'Recraft',
    'Reka',
    'Relace',
    'SambaNova',
    'Seed',
    'SiliconFlow',
    'Sourceful',
    'Stealth',
    'StepFun',
    'StreamLake',
    'Switchpoint',
    'Together',
    'Upstage',
    'Venice',
    'WandB',
    'xAI',
    'Xiaomi',
    'Z.AI',
];

// 실리 public/scripts/textgen-models.js 115~337
/**
 * List of NanoGPT providers.
 * Providers endpoint: https://nano-gpt.com/api/models/providers
 * @type {{id: string, label: string}[]}
 */
const NANOGPT_PROVIDERS = [
    {
        'id': 'akash',
        'label': 'Akash',
    },
    {
        'id': 'alibaba',
        'label': 'Alibaba',
    },
    {
        'id': 'ambient',
        'label': 'Ambient',
    },
    {
        'id': 'arliai',
        'label': 'ArliAI',
    },
    {
        'id': 'atlascloud',
        'label': 'AtlasCloud',
    },
    {
        'id': 'azure',
        'label': 'Azure',
    },
    {
        'id': 'awsbedrock',
        'label': 'Amazon Bedrock',
    },
    {
        'id': 'baidu',
        'label': 'Baidu',
    },
    {
        'id': 'baseten',
        'label': 'BaseTen',
    },
    {
        'id': 'cerebras',
        'label': 'Cerebras',
    },
    {
        'id': 'chutes',
        'label': 'Chutes',
    },
    {
        'id': 'clarifai',
        'label': 'Clarifai',
    },
    {
        'id': 'cloudflare',
        'label': 'Cloudflare',
    },
    {
        'id': 'crusoe',
        'label': 'Crusoe',
    },
    {
        'id': 'dekallm',
        'label': 'DekaLLM',
    },
    {
        'id': 'deepinfra',
        'label': 'DeepInfra',
    },
    {
        'id': 'deepseek',
        'label': 'DeepSeek',
    },
    {
        'id': 'fireworks',
        'label': 'Fireworks',
    },
    {
        'id': 'friendli',
        'label': 'Friendli',
    },
    {
        'id': 'gmicloud',
        'label': 'GMICloud',
    },
    {
        'id': 'lilac',
        'label': 'Lilac',
    },
    {
        'id': 'google',
        'label': 'Google',
    },
    {
        'id': 'groq',
        'label': 'Groq',
    },
    {
        'id': 'hyperbolic',
        'label': 'Hyperbolic',
    },
    {
        'id': 'ionet',
        'label': 'io.net',
    },
    {
        'id': 'inceptron',
        'label': 'Inceptron',
    },
    {
        'id': 'mancer',
        'label': 'Mancer',
    },
    {
        'id': 'mara',
        'label': 'Mara',
    },
    {
        'id': 'meganova',
        'label': 'MegaNova',
    },
    {
        'id': 'minimax',
        'label': 'MiniMax',
    },
    {
        'id': 'modelrun',
        'label': 'ModelRun',
    },
    {
        'id': 'moonshot',
        'label': 'Moonshot',
    },
    {
        'id': 'morph',
        'label': 'Morph',
    },
    {
        'id': 'ncompass',
        'label': 'NCompass',
    },
    {
        'id': 'nebius',
        'label': 'Nebius',
    },
    {
        'id': 'neuralwatt',
        'label': 'NeuralWatt',
    },
    {
        'id': 'tensorix',
        'label': 'Tensorix',
    },
    {
        'id': 'nextbit',
        'label': 'NextBit',
    },
    {
        'id': 'novita',
        'label': 'Novita',
    },
    {
        'id': 'parasail',
        'label': 'Parasail',
    },
    {
        'id': 'phala',
        'label': 'Phala',
    },
    {
        'id': 'redpill',
        'label': 'Redpill',
    },
    {
        'id': 'sambanova',
        'label': 'SambaNova',
    },
    {
        'id': 'sambanova-high-throughput',
        'label': 'SambaNova (High Throughput)',
    },
    {
        'id': 'siliconflow',
        'label': 'SiliconFlow',
    },
    {
        'id': 'streamlake',
        'label': 'StreamLake',
    },
    {
        'id': 'tinfoil',
        'label': 'Tinfoil',
    },
    {
        'id': 'together',
        'label': 'Together',
    },
    {
        'id': 'uomi',
        'label': 'UOMI',
    },
    {
        'id': 'venice',
        'label': 'Venice',
    },
    {
        'id': 'wafer',
        'label': 'Wafer',
    },
    {
        'id': 'wandb',
        'label': 'Weights & Biases',
    },
    {
        'id': 'xiaomi',
        'label': 'Xiaomi',
    },
    {
        'id': 'zai',
        'label': 'Z.AI',
    },
];

// 실리 public/scripts/textgen-models.js 1347~1385
export function getCurrentOpenRouterModelTokenizer() {
    const modelId = textgen_settings.openrouter_model;
    const model = openRouterModels.find(x => x.id === modelId);
    if (modelId?.includes('jamba')) {
        return tokenizers.JAMBA;
    }
    switch (model?.architecture?.tokenizer) {
        case 'Llama2':
            return tokenizers.LLAMA;
        case 'Llama3':
            return tokenizers.LLAMA3;
        case 'Yi':
            return tokenizers.YI;
        case 'Mistral':
            return tokenizers.MISTRAL;
        case 'Gemini':
            return tokenizers.GEMMA;
        case 'Claude':
            return tokenizers.CLAUDE;
        case 'Cohere':
            return tokenizers.COMMAND_R;
        case 'Qwen':
            return tokenizers.QWEN2;
        default:
            return tokenizers.OPENAI;
    }
}

export function getCurrentDreamGenModelTokenizer() {
    const modelId = textgen_settings.dreamgen_model;
    const model = dreamGenModels.find(x => x.id === modelId);
    if (model.id.startsWith('lucid-v1-medium') || model.id.startsWith('lucid-v1-base')) {
        return tokenizers.MISTRAL;
    } else if (model.id.startsWith('lucid-v1-extra-large') || model.id.startsWith('lucid-v1-max')) {
        return tokenizers.LLAMA3;
    } else {
        return tokenizers.MISTRAL;
    }
}

// (실리 initTextGenModels 1403~1416이 이 목록으로 화면의 공급자 칸(.openrouter_providers · #nanogpt_provider)을 채워요.
// 일꾼이 loadTextGenSettings 594 · loadOpenAISettings 4401~4403의 값 부분에 써요, plugin/st/naload.js)
export { OPENROUTER_PROVIDERS, NANOGPT_PROVIDERS };

/**
 * @param {{openRouterModels?: object[]}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'openRouterModels')) openRouterModels = v.openRouterModels;
}
