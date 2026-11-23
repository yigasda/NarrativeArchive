// 테스트용 가짜 다리 (plugin/bridge.mjs가 붙이는 실리 서버의 처리기 대신): 일꾼이 답장마다 실리에서 읽는 것을 줘요.
//   POST /api/characters/all → cards (실리 processCharacter의 모양, 목록 순서 그대로) · /api/characters/get → 그 카드 하나 (shallow 빼고)
//   POST /api/avatars/get → avatars (User Avatars 폴더의 그림들) · /api/characters/merge-attributes → {} (쓴 것은 seen에)
//   more(req, body, res) → true면 그 요청은 거기서 끝 (모델 요청 등)
// 예시 캐릭터만 써요.
import http from 'node:http';

const bodyOf = req => new Promise(ok => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { ok(JSON.parse(b || 'null')); } catch { ok(b); } }); });
export const TOKEN = 'tok-123';
export const stCard = (name, more = {}) => ({ name, avatar: `${name.toLowerCase()}.png`, chat: `${name} - 2026-11-22`, description: `${name} is a baker.`, json_data: JSON.stringify({ spec: 'chara_card_v2', data: { name, description: `${name} is a baker.`, extensions: { talkativeness: 0.5 } } }), data: { name, description: `${name} is a baker.`, personality: 'warm', extensions: { talkativeness: 0.5 } }, ...more });

export async function fakeBridge({ cards = () => [], avatars = () => [], more = null } = {}) {
    const seen = [];
    const server = await new Promise(ok => {
        const s = http.createServer(async (req, res) => {
            const body = await bodyOf(req);
            seen.push({ url: req.url, token: req.headers['x-na-token'], root: decodeURIComponent(String(req.headers['x-na-root'] || '')), body });
            if (req.headers['x-na-token'] !== TOKEN) { res.statusCode = 403; res.end('{}'); return; }
            res.setHeader('content-type', 'application/json');
            if (more && await more(req, body, res)) return;
            const list = cards();
            if (req.url === '/api/characters/all') { res.end(JSON.stringify(list.map(c => (c.shallow ? { shallow: true, name: c.name, avatar: c.avatar, chat: c.chat, data: { name: c.name, extensions: {} } } : c)))); return; }
            if (req.url === '/api/characters/get') { const c = list.find(x => x.avatar === body?.avatar_url); if (!c) { res.statusCode = 404; res.end('{}'); return; } const { shallow, ...whole } = c; res.end(JSON.stringify(whole)); return; }
            if (req.url === '/api/avatars/get') { res.end(JSON.stringify(avatars())); return; }
            if (req.url === '/api/characters/merge-attributes') { res.end('{}'); return; }
            res.statusCode = 404; res.end('{}');
        });
        s.listen(0, '127.0.0.1', () => ok(s));
    });
    return { url: `http://127.0.0.1:${server.address().port}`, token: TOKEN, seen, close: () => server.close() };
}
// 실리 채팅 파일의 글: 헤더 줄 + 메시지 줄들 (chat_metadata: 헤더의 것)
export const chatFile = (chat_metadata = {}, messages = []) => [{ chat_metadata, user_name: 'unused', character_name: 'unused' }, ...messages].map(x => JSON.stringify(x)).join('\n');
