// 실리 1.19.1 public/scripts/logit-bias.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { getTextTokens } from './tokenizers.js';

// 실리 public/scripts/logit-bias.js 5~5
export const BIAS_CACHE = new Map();

// 실리 public/scripts/logit-bias.js 97~142
/**
 * Populate logit bias list from preset.
 * @param {object[]} biasPreset Bias preset
 * @param {number} tokenizerType Tokenizer type (see tokenizers.js)
 * @param {(bias: number, sequence: number[]) => object} getBiasObject Transformer function to create bias object
 * @returns {object[]} Array of logit bias objects
 */
export function getLogitBiasListResult(biasPreset, tokenizerType, getBiasObject) {
    const result = [];

    for (const entry of biasPreset) {
        if (entry.text?.length > 0) {
            const text = entry.text.trim();

            // Skip empty lines
            if (text.length === 0) {
                continue;
            }

            // Verbatim text
            if (text.startsWith('{') && text.endsWith('}')) {
                const tokens = getTextTokens(tokenizerType, text.slice(1, -1));
                result.push(getBiasObject(entry.value, tokens));
            } else if (text.startsWith('[') && text.endsWith(']')) {
                // Raw token ids, JSON serialized
                try {
                    const tokens = JSON.parse(text);

                    if (Array.isArray(tokens) && tokens.every(t => Number.isInteger(t))) {
                        result.push(getBiasObject(entry.value, tokens));
                    } else {
                        throw new Error('Not an array of integers');
                    }
                } catch (err) {
                    console.log(`Failed to parse logit bias token list: ${text}`, err);
                }
            } else {
                // Text with a leading space
                const biasText = ` ${text}`;
                const tokens = getTextTokens(tokenizerType, biasText);
                result.push(getBiasObject(entry.value, tokens));
            }
        }
    }
    return result;
}
