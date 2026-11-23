// 일꾼이 실리 서버의 처리기를 부르는 다리 (docs/PHONE2-PLAN.md "서버 플러그인" 3-2b).
// 진짜 답장 코드(src/ai.js 등)는 브라우저에서처럼 fetch('/api/backends/chat-completions/generate')를 불러요. 서버에는
// 브라우저의 로그인 · CSRF가 없어서, 실리 자신의 처리기(라우터)를 이 컴퓨터 안에서만 들리는 작은 길에 그대로 붙여 줘요:
//   - 127.0.0.1의 아무 포트. 밖에서는 못 들어와요
//   - 요청마다 이 플러그인만 아는 토큰(실리를 켤 때마다 새로 만들어요)이 있어야 해요
//   - 아래 길만 열어요. 나머지는 404
//   - 요청의 사용자(req.user)는 그 일꾼의 사용자예요: 실리가 자기 키(secrets.json)를 그 사용자 것으로 붙여요
// 실리의 처리기를 고치거나 흉내 내지 않아요: 실리가 브라우저의 요청을 받을 때와 같은 코드가 돌아요.
//   POST /api/backends/chat-completions/generate   모델 요청 (Vertex · 실리 연결 방식 · 채팅 완성 연결 프로필)
//   POST /api/backends/text-completions/generate   모델 요청 (글 완성 연결 프로필)
//   POST /api/backends/chat-completions/bias       로짓 바이어스의 토큰 (채팅 완성: 실리 openai.js calculateLogitBias)
//   POST /api/tokenizers/<토크나이저>/encode · /api/tokenizers/remote/textgenerationwebui/encode · /api/tokenizers/remote/kobold/count
//                                                   금지 토큰 · 로짓 바이어스의 토큰 (글 완성: 실리 tokenizers.js getTextTokens)
//   (이 길들이 없는 옛 다리면 404: 일꾼은 그 요청을 보내지 않고 이유를 알려요. plugin/st/public/naFetch.js naFetchFailures)
//   POST /api/backends/chat-completions/status     연결 확인 (실리 openai.js getStatusOpen: 연결 상태 · 모델 목록)
//   POST /api/backends/text-completions/status     연결 확인 (실리 textgen-settings.js getStatusTextgen: 연결 상태 · 모델 목록 · API 토크나이저)
//   POST /api/backends/kobold/status               연결 확인 (실리 kai-settings.js getStatusKobold: {{model}} · Kobold 기능)
//   POST /api/secrets/read                         키가 저장돼 있나 (실리 openai.js onConnectButtonClick: 키가 없으면 연결하지 않아요).
//                                                   실리의 같은 길은 키 글의 끝 몇 자(설정에 따라 키 전체)를 줘요. 다리는 실리 SecretManager.getSecretState에서
//                                                   키 글 · 이름표를 빼고 키마다 [{ id, active }] | null만 줘요 (있는지 · 어느 것이 쓰이는지만)
//   POST /api/nanogpt/models/providers             NanoGPT 모델의 공급자 고르기 (실리 textgen-models.js syncNanoGptProvidersForModel)
//   (이 길들이 없는 옛 다리면 404: 일꾼은 연결 안 됨 · 키 확인 없음 · 공급자 그대로로 보고 지금처럼 요청을 보내요. 막지 않아요. plugin/st/nastatus.js)
//   POST /api/characters/all                       캐릭터 목록 (답장마다 카드를 새로 읽어요)
//   POST /api/characters/get                       카드 하나 (목록이 간단한 카드로 왔을 때)
//   POST /api/characters/merge-attributes          카드의 확장 칸 쓰기 (스케줄 · 상태)
//   POST /api/avatars/get                          페르소나 그림 목록 (그 채팅의 페르소나 고르기)
//   POST /api/worldinfo/get                        로어북 읽기 (폰 프로필로 고른 로어 항목)
//   GET  /user/files/…                             보낸 첨부 파일 읽기

import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const TOKENIZERS = ['llama', 'llama3', 'mistral', 'yi', 'gemma', 'jamba', 'qwen2', 'command-r', 'command-a', 'nemo', 'deepseek', 'openai', 'claude', 'gpt2'].map(t => `/api/tokenizers/${t}/encode`);
const STATUS = ['/api/backends/chat-completions/status', '/api/backends/text-completions/status', '/api/backends/kobold/status'];
const POSTS = new Set(['/api/backends/chat-completions/generate', '/api/backends/chat-completions/bias', '/api/backends/text-completions/generate', ...STATUS, '/api/secrets/read', '/api/nanogpt/models/providers', ...TOKENIZERS, '/api/tokenizers/remote/textgenerationwebui/encode', '/api/tokenizers/remote/kobold/count', '/api/characters/all', '/api/characters/get', '/api/characters/merge-attributes', '/api/avatars/get', '/api/worldinfo/get']);
export const allowed = (method, url) => { const p = String(url || '').split('?')[0]; return method === 'POST' ? POSTS.has(p) : method === 'GET' ? p.startsWith('/user/files/') && !p.includes('..') : false; };

// stRoot: 실리 서버의 폴더 · userOf(root) → 그 사용자 폴더의 req.user ({ profile, directories }) | null
// → { url, token, close() }
export async function startBridge({ stRoot = process.cwd(), userOf } = {}) {
    const need = createRequire(path.join(stRoot, 'package.json'));
    const express = need('express');
    const st = file => import(pathToFileURL(path.join(stRoot, 'src', file)).href);
    const [chat, text, kobold, chars, avatars, world, users, tokenizers] = await Promise.all([st('endpoints/backends/chat-completions.js'), st('endpoints/backends/text-completions.js'), st('endpoints/backends/kobold.js'), st('endpoints/characters.js'), st('endpoints/avatars.js'), st('endpoints/worldinfo.js'), st('users.js'), st('endpoints/tokenizers.js')]);
    for (const [name, m] of [['chat-completions', chat], ['text-completions', text], ['kobold', kobold], ['characters', chars], ['avatars', avatars], ['worldinfo', world], ['users', users], ['tokenizers', tokenizers]]) if (typeof m?.router !== 'function') throw new Error(`실리 ${name} 엔드포인트를 찾을 수 없습니다. 실리 버전이 다를 수 있습니다.`);
    // (only for the connection check: a SillyTavern without them answers 404 there, as an older bridge does — the worker goes on without)
    const [secrets, nanogpt] = await Promise.all([st('endpoints/secrets.js').catch(() => null), st('endpoints/nanogpt.js').catch(() => null)]);
    const token = crypto.randomBytes(24).toString('hex'), want = Buffer.from(token);
    const app = express();
    app.disable('x-powered-by');
    app.use((req, res, next) => {
        const got = Buffer.from(String(req.headers['x-na-token'] || ''));
        if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return res.sendStatus(403);
        if (!allowed(req.method, req.url)) return res.sendStatus(404);
        let root = '';
        try { root = decodeURIComponent(String(req.headers['x-na-root'] || '')); } catch { root = ''; }
        const user = root ? userOf(root) : null;
        if (!user?.directories?.root) return res.sendStatus(401);
        req.user = user;
        return next();
    });
    app.use(express.json({ limit: '500mb' }));
    app.use('/api/backends/chat-completions', chat.router);
    app.use('/api/backends/text-completions', text.router);
    app.use('/api/backends/kobold', kobold.router);
    app.use('/api/characters', chars.router);
    app.use('/api/avatars', avatars.router);
    app.use('/api/worldinfo', world.router);
    app.use('/api/tokenizers', tokenizers.router);
    // (SillyTavern's /api/secrets/read — src/endpoints/secrets.js 529~538 — with the key text and labels left out: the worker needs to know only
    //  whether a key is saved — openai.js onConnectButtonClick 6089 — and which one is used, never the key)
    if (typeof secrets?.SecretManager === 'function') {
        app.post('/api/secrets/read', (request, response) => {
            try {
                const state = new secrets.SecretManager(request.user.directories).getSecretState();
                const out = {};
                for (const [key, list] of Object.entries(state)) out[key] = Array.isArray(list) ? list.map(x => ({ id: x?.id, active: x?.active })) : null;
                return response.send(out);
            } catch (error) {
                console.error('Error reading secret state:', error);
                return response.send({});
            }
        });
    }
    if (typeof nanogpt?.router === 'function') app.use('/api/nanogpt', nanogpt.router);
    app.use('/', users.router);
    const server = await new Promise((ok, no) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); s.once('error', no); });
    server.unref?.();
    return { url: `http://127.0.0.1:${server.address().port}`, token, close: () => new Promise(r => server.close(() => r())) };
}
