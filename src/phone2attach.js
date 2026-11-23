// 폰 2 Orbit: 첨부 보내기 (마리나라의 첨부 기능을 우리 저장 모양에 잇는 곳)
//
// 마리나라의 코드는 src/marinara/에 그대로 있어요:
//   chat-attachment-images.js (그림 줄이기) · conversation-attachments.js (입력창이 파일을 받는 법) ·
//   prompt-attachments.js (요청에 넣는 법) · image-captioning.js · image-captioning-prompt.js (그림을 글로 설명하기)
//
// 우리 저장 모양에 맞춘 것 (마리나라와 다른 것은 이것뿐이에요):
//   1. 마리나라는 파일을 말 안에 통째로(data URL) 저장해요. 우리 폰 기록은 실리의 채팅 파일 안에 있어서, 그렇게 하면
//      그림 한 장마다 채팅 파일이 몇 MB씩 커져요. 그래서 파일은 실리의 파일 저장소에 올리고 말에는 주소만 남겨요:
//      x.extra.attachments = [{ type, url, filename, name, (그림 설명을 만든 뒤) imageCaption… }]
//      요청을 만들 때 주소에서 다시 읽어 와 마리나라의 함수에 data로 넘겨요
//   2. 마리나라는 말마다 따로 모델에 보내서, 그림이 그 말에 붙어 가요. 우리 답장 요청은 대화가 MESSENGER 블록 하나에
//      글로 들어가요. 그래서 그림 · PDF를 그대로 보낼 때는, 그 말의 줄에 마리나라의 꼬리표 모양으로 "이 요청에 붙은
//      몇 번째 그림"인지 적어요 (그림 설명을 쓰는 방에서는 마리나라처럼 그 자리에 설명이 들어가요)
//
// 이 파일은 실리의 함수를 직접 부르지 않아요 (올리기 · 읽기는 put · get으로 받아요: 답장 돌리는 파일이 넘겨요).
import { resolvePromptAttachmentInputs, formatImageCaptionBlock, normalizePromptAttachments } from './marinara/image-captioning.js';
import { getAttachmentFilename, escapeXmlAttribute } from './marinara/prompt-attachments.js';
import { getFileExtension } from './marinara/conversation-attachments.js';

export { readChatAttachments, toPendingAttachments, isSupportedChatAttachment, inferAttachmentType, CHAT_ATTACHMENT_ACCEPT, CHAT_ATTACHMENT_MAX_SIZE } from './marinara/conversation-attachments.js';
export { prepareImageAttachment } from './marinara/chat-attachment-images.js';
export { DISABLED_IMAGE_CAPTIONING, normalizePromptAttachments } from './marinara/image-captioning.js';
export { DEFAULT_IMAGE_CAPTIONING_PROMPT } from './marinara/image-captioning-prompt.js';

// data URL ↔ 바이트
const base64Of = dataUrl => { const s = String(dataUrl || ''), i = s.indexOf(','); return s.startsWith('data:') && i > 0 && s.slice(0, i).toLowerCase().includes(';base64') ? s.slice(i + 1) : ''; };
export function bytesToDataUrl(buffer, type) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${String(type || 'application/octet-stream')};base64,${globalThis.btoa(bin)}`;
}
// 실리의 파일 저장소가 받는 이름: 영문 · 숫자 · _ · - · . 만 (원래 이름은 filename · name에 그대로 남아요)
const EXT_OF = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf', 'application/json': 'json', 'text/csv': 'csv', 'text/markdown': 'md', 'application/xml': 'xml', 'application/yaml': 'yaml', 'text/plain': 'txt' };
let seq = 0;
const storeName = a => { const ext = getFileExtension(String(a.filename || a.name || '')) || EXT_OF[String(a.type || '').toLowerCase()] || 'bin'; return `na_orbit_${Date.now().toString(36)}_${(seq++).toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`; };

// 보낼 첨부를 실리에 올려요. pending: 마리나라의 pendingAttachments [{ type, data, filename, name }]
//   put(올릴 이름, base64) → 주소. → 말에 남길 것 [{ type, url, filename, name }]
//   하나라도 못 올리면 던져요 (보내기를 멈추고 입력창의 첨부는 그대로 둬요)
const loaded = new Map();   // 주소 → data URL (방금 올린 것 · 한 번 읽어 온 것)
export async function storeAttachments(pending, { put }) {
    const out = [];
    for (const a of pending || []) {
        const b64 = base64Of(a?.data);
        if (!a || typeof a.type !== 'string' || !b64) throw new Error('첨부 파일을 읽을 수 없습니다.');
        const url = String(await put(storeName(a), b64) || '');
        if (!url) throw new Error('첨부 파일을 업로드하지 못했습니다.');
        loaded.set(url, a.data);
        out.push({ type: a.type, url, ...(a.filename ? { filename: a.filename } : {}), ...(a.name ? { name: a.name } : {}) });
    }
    return out;
}
// 말에 남긴 첨부 하나를 data까지 채워서 (요청을 만들 때). get(주소) → ArrayBuffer
export async function withData(a, { get }) {
    if (typeof a?.data === 'string' && a.data) return a;
    const url = String(a?.url || '');
    if (!url) return a;
    if (!loaded.has(url)) loaded.set(url, bytesToDataUrl(await get(url), a.type));
    return { ...a, data: loaded.get(url) };
}
// 저장할 모양으로: 주소가 있으면 data는 빼요
const stored = a => { if (!a?.url) return a; const rest = { ...a }; delete rest.data; return rest; };

// 답장 요청에 들어갈 말들(rows)의 첨부를 마리나라의 resolvePromptAttachmentInputs로 풀어요
//   captioning: 마리나라의 그림 설명 설정 (DISABLED_IMAGE_CAPTIONING이면 그림을 그대로 보내요)
//   takesFiles: 이 연결이 PDF를 그대로 받나 (못 받으면 PDF는 안 보내고 그 줄에 적어요)
// → { blocks: Map(말 id → 그 말의 글 뒤에 붙일 글), images: [data URL], files: [{ type, data, filename }],
//     updated: Map(말 id → 그림 설명이 새로 생긴 첨부 목록, 저장할 모양) }
export async function attachmentInputs(rows, { captioning, get, signal, takesFiles = true }) {
    const out = { blocks: new Map(), images: [], files: [], updated: new Map() };
    for (const x of rows || []) {
        const kept = normalizePromptAttachments(x?.extra);
        if (!kept) continue;
        const attachments = [];
        for (const a of kept) attachments.push(await withData(a, { get }));
        const res = await resolvePromptAttachmentInputs({ content: '', attachments, imageCaptioning: captioning, signal });
        const blocks = res.content ? [res.content] : [];
        // (pictures and PDFs that go as they are: the row says which one of this request's they are)
        for (const data of res.images) {
            const a = attachments.find(y => y.data === data) || {};
            out.images.push(data);
            blocks.push(formatImageCaptionBlock(a, `(image ${out.images.length} attached to this request)`));
        }
        for (const f of res.files) {
            const head = `<attached_file name="${escapeXmlAttribute(getAttachmentFilename(f))}" type="${escapeXmlAttribute(f.type)}">`;
            if (takesFiles) { out.files.push(f); blocks.push(`${head}\n(file ${out.files.length} attached to this request)\n</attached_file>`); }
            else blocks.push(`${head}\n(a PDF: this connection cannot read it)\n</attached_file>`);
        }
        if (blocks.length) out.blocks.set(x.id, blocks.join('\n\n'));
        if (res.updatedAttachments) out.updated.set(x.id, res.updatedAttachments.map(stored));
    }
    return out;
}
