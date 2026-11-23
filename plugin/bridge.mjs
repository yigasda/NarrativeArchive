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

const POSTS = new Set(['/api/backends/chat-completions/generate', '/api/backends/chat-completions/bias', '/api/backends/text-completions/generate', '/api/characters/all', '/api/characters/get', '/api/characters/merge-attributes', '/api/avatars/get', '/api/worldinfo/get']);
export const allowed = (method, url) => { const p = String(url || '').split('?')[0]; return method === 'POST' ? POSTS.has(p) : method === 'GET' ? p.startsWith('/user/files/') && !p.includes('..') : false; };

// stRoot: 실리 서버의 폴더 · userOf(root) → 그 사용자 폴더의 req.user ({ profile, directories }) | null
// → { url, token, close() }
export async function startBridge({ stRoot = process.cwd(), userOf } = {}) {
    const need = createRequire(path.join(stRoot, 'package.json'));
    const express = need('express');
    const st = file => import(pathToFileURL(path.join(stRoot, 'src', file)).href);
    const [chat, text, chars, avatars, world, users] = await Promise.all([st('endpoints/backends/chat-completions.js'), st('endpoints/backends/text-completions.js'), st('endpoints/characters.js'), st('endpoints/avatars.js'), st('endpoints/worldinfo.js'), st('users.js')]);
    for (const [name, m] of [['chat-completions', chat], ['text-completions', text], ['characters', chars], ['avatars', avatars], ['worldinfo', world], ['users', users]]) if (typeof m?.router !== 'function') throw new Error(`실리 ${name} 엔드포인트를 찾을 수 없습니다. 실리 버전이 다를 수 있습니다.`);
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
    app.use('/api/characters', chars.router);
    app.use('/api/avatars', avatars.router);
    app.use('/api/worldinfo', world.router);
    app.use('/', users.router);
    const server = await new Promise((ok, no) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); s.once('error', no); });
    server.unref?.();
    return { url: `http://127.0.0.1:${server.address().port}`, token, close: () => new Promise(r => server.close(() => r())) };
}
