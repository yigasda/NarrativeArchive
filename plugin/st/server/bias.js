// 실리 1.19.1 src/endpoints/backends/chat-completions.js 2158~2240 (router.post('/bias'))의 처리 그대로 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게).
// SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: express 처리기 대신 함수예요. request.body → body, request.query.model → model, response.send(x) → { status: 200, body: x },
//   response.sendStatus(400) → { status: 400, body: 'Bad Request' }. 토크나이저는 실리 서버 자신의 것(src/endpoints/tokenizers.js)을 이 자리에서 불러요:
//   플러그인은 실리 폴더(process.cwd())에서 돌아요. 다리에 새 길을 열지 않아도 돼요(옛 플러그인에서도 돌아요).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let tok = null;
const tokenizers = () => (tok ||= import(pathToFileURL(path.join(process.cwd(), 'src', 'endpoints', 'tokenizers.js')).href));

/**
 * @param {any} body 실리 브라우저가 보내는 몸통: 로짓 바이어스 프리셋의 줄들 [{ text, value }]
 * @param {string} queryModel ?model= 값 (실리 브라우저 tokenizers.js getTokenizerModel)
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function bias(body, queryModel) {
    if (!body || !Array.isArray(body))
        return { status: 400, body: 'Bad Request' };

    const { getTokenizerModel, sentencepieceTokenizers, getSentencepiceTokenizer, webTokenizers, getWebTokenizer, getTiktokenTokenizer } = await tokenizers();

    try {
        const result = {};
        const model = getTokenizerModel(String(queryModel || ''));

        // no bias for claude
        if (model == 'claude') {
            return { status: 200, body: result };
        }

        let encodeFunction;

        if (sentencepieceTokenizers.includes(model)) {
            const tokenizer = getSentencepiceTokenizer(model);
            const instance = await tokenizer?.get();
            if (!instance) {
                console.error('Tokenizer not initialized:', model);
                return { status: 200, body: {} };
            }
            encodeFunction = (text) => new Uint32Array(instance.encodeIds(text));
        } else if (webTokenizers.includes(model)) {
            const tokenizer = getWebTokenizer(model);
            const instance = await tokenizer?.get();
            if (!instance) {
                console.warn('Tokenizer not initialized:', model);
                return { status: 200, body: {} };
            }
            encodeFunction = (text) => new Uint32Array(instance.encode(text));
        } else {
            const tokenizer = getTiktokenTokenizer(model);
            encodeFunction = (tokenizer.encode.bind(tokenizer));
        }

        for (const entry of body) {
            if (!entry || !entry.text) {
                continue;
            }

            try {
                const tokens = getEntryTokens(entry.text, encodeFunction);

                for (const token of tokens) {
                    result[token] = entry.value;
                }
            } catch {
                console.warn('Tokenizer failed to encode:', entry.text);
            }
        }

        // not needed for cached tokenizers
        //tokenizer.free();
        // (express의 response.send(객체)는 JSON으로 보내요: Uint32Array의 토큰 번호가 열쇠인 객체 그대로)
        return { status: 200, body: result };

        /**
         * Gets tokenids for a given entry
         * @param {string} text Entry text
         * @param {(string) => Uint32Array} encode Function to encode text to token ids
         * @returns {Uint32Array} Array of token ids
         */
        function getEntryTokens(text, encode) {
            // Get raw token ids from JSON array
            if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
                try {
                    const json = JSON.parse(text);
                    if (Array.isArray(json) && json.every(x => typeof x === 'number')) {
                        return new Uint32Array(json);
                    }
                } catch {
                    // ignore
                }
            }

            // Otherwise, get token ids from tokenizer
            return encode(text);
        }
    } catch (error) {
        console.error(error);
        return { status: 200, body: {} };
    }
}
