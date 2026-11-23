// 첨부 보내기 (마리나라의 첨부 기능을 우리 저장 모양에 이은 것): src/phone2attach.js · src/marinara/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as A from '../src/phone2attach.js';
import * as P from '../src/marinara/prompt-attachments.js';
import * as C from '../src/marinara/image-captioning.js';
import { readEncodedImageDimensions } from '../src/marinara/chat-attachment-images.js';

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const url = (type, text) => `data:${type};base64,${b64(text)}`;
const PNG = 'data:image/png;base64,iVBORw0KGgo=', PDF = 'data:application/pdf;base64,JVBERi0=';
const file = (name, type, size = 10) => ({ name, type, size });

test('받는 파일: 그림 · PDF · 글 파일만, 20MB까지. 그림은 줄이는 함수로, 나머지는 그대로 읽어요 (마리나라의 handleFileUpload)', async () => {
    const errors = [], reads = [];
    const got = await A.readChatAttachments([
        file('a.png', 'image/png'), file('b.PDF', ''), file('c.md', ''), file('d.json', 'application/json'), file('e.exe', 'application/x-msdownload'),
        file('big.txt', 'text/plain', 20 * 1024 * 1024 + 1), file('', 'text/plain'), file('bad.png', 'image/png'), file('f.yaml', ''),
    ], {
        onError: (why, name) => errors.push([why, name]), onRead: () => reads.push(1),
        prepare: async (f, name) => { if (name === 'bad.png') throw new Error('x'); return { type: 'image/jpeg', data: PNG, name: 'a.jpg', resized: true }; },
        read: async f => url('text/plain', f.name),
    });
    assert.deepEqual(got.map(x => [x.type, x.name]), [['image/jpeg', 'a.jpg'], ['application/pdf', 'b.PDF'], ['text/markdown', 'c.md'], ['application/json', 'd.json'], ['text/plain', 'pasted-file'], ['application/yaml', 'f.yaml']]);
    assert.deepEqual(errors, [['unsupported', 'e.exe'], ['size', 'big.txt'], ['prepare', 'bad.png']]);
    assert.equal(reads.length, 7);                                                   // (받은 파일마다 한 번: 읽었든 실패했든)
    assert.deepEqual(A.toPendingAttachments([{ type: 'text/plain', data: 'd', name: 'n.txt' }]), [{ type: 'text/plain', data: 'd', filename: 'n.txt', name: 'n.txt' }]);
    assert.match(A.CHAT_ATTACHMENT_ACCEPT, /image\/\*,application\/pdf,\.pdf,\.txt/);
});

test('그림 크기 읽기 (마리나라의 readEncodedImageDimensions): PNG 머리에서', () => {
    const png = new Uint8Array(24); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); new DataView(png.buffer).setUint32(16, 640); new DataView(png.buffer).setUint32(20, 480);
    assert.deepEqual(readEncodedImageDimensions(png), { width: 640, height: 480 });
});

test('요청에 넣는 법 (마리나라의 prompt-attachments): 글 파일은 내용을 꼬리표로, 그림 · PDF는 그대로', () => {
    const atts = [{ type: 'text/plain', data: url('text/plain', '안녕 <b>'), filename: 'note "1".txt' }, { type: 'image/png', data: PNG, name: 'p.png' }, { type: '', data: PDF, filename: 'doc.pdf' }, { type: 'application/zip', data: 'data:application/zip;base64,AAAA', name: 'z.zip' }];
    assert.equal(P.appendReadableAttachmentsToContent('봐', atts), '봐\n\n<attached_file name="note &quot;1&quot;.txt" type="text/plain">\n안녕 <b>\n</attached_file>');
    assert.equal(P.appendReadableAttachmentsToContent('', atts).startsWith('<attached_file'), true);
    assert.deepEqual(P.extractImageAttachmentDataUrls(atts), [PNG]);
    assert.deepEqual(P.extractFileAttachmentInputs(atts), [{ type: 'application/pdf', data: PDF, filename: 'doc.pdf' }]);
    // (6MB가 넘는 그림은 모델에 안 보내요)
    assert.deepEqual(P.extractImageAttachmentDataUrls([{ type: 'image/png', data: `data:image/png;base64,${'A'.repeat(8 * 1024 * 1024 + 4)}` }]), []);
    assert.equal(P.readableAttachmentText({ type: 'text/plain', data: 'data:text/plain,%EC%95%88%EB%85%95', name: 'u.txt' }).text, '안녕');
});

test('올리기: 파일은 실리 저장소로, 말에는 주소만. 다시 읽을 때는 주소에서', async () => {
    const puts = [];
    const kept = await A.storeAttachments([{ type: 'image/png', data: PNG, filename: '사진 1.png', name: '사진 1.png' }, { type: 'application/pdf', data: PDF, filename: 'doc.pdf', name: 'doc.pdf' }], { put: async (name, data) => { puts.push([name, data]); return `/user/files/${name}`; } });
    assert.equal(kept.length, 2);
    for (const [name] of puts) assert.match(name, /^na_orbit_[a-z0-9_]+\.(png|pdf)$/);            // (실리가 받는 이름: 영문 · 숫자만)
    assert.deepEqual(puts.map(p => p[1]), ['iVBORw0KGgo=', 'JVBERi0=']);
    assert.deepEqual(kept[0], { type: 'image/png', url: `/user/files/${puts[0][0]}`, filename: '사진 1.png', name: '사진 1.png' });
    assert.ok(!('data' in kept[0]));
    await assert.rejects(A.storeAttachments([{ type: 'image/png', data: 'nope' }], { put: async () => '/x' }), /첨부 파일을 읽을 수 없습니다/);
    await assert.rejects(A.storeAttachments([{ type: 'image/png', data: PNG }], { put: async () => '' }), /첨부 파일을 업로드하지 못했습니다/);
    // (다른 기기 · 새로 연 뒤: 주소에서 읽어 와요)
    let gets = 0;
    const get = async () => { gets++; return Uint8Array.from(Buffer.from('JVBERi0=', 'base64')).buffer; };
    const a = await A.withData({ type: 'application/pdf', url: '/user/files/elsewhere.pdf', name: 'e.pdf' }, { get });
    assert.equal(a.data, PDF);
    await A.withData({ type: 'application/pdf', url: '/user/files/elsewhere.pdf' }, { get });
    assert.equal(gets, 1);                                                                          // (한 번 읽은 것은 다시 안 읽어요)
});

test('답장 요청에 넣기: 글 파일은 내용, 그림 · PDF는 "이 요청의 몇 번째"로 그 말의 줄에 적혀요. PDF를 못 받는 연결이면 안 보내요', async () => {
    const get = async () => { throw new Error('안 불러요'); };
    const rows = [
        { id: 'a', text: '봐', extra: { attachments: [{ type: 'image/png', data: PNG, name: 'cat.png' }, { type: 'text/plain', data: url('text/plain', '메모'), name: 'm.txt' }] } },
        { id: 'b', text: '없음' },
        { id: 'c', text: '', extra: { attachments: [{ type: 'application/pdf', data: PDF, filename: 'doc.pdf' }, { type: 'image/png', data: 'data:image/png;base64,AAAA', name: 'dog.png' }] } },
    ];
    const r = await A.attachmentInputs(rows, { captioning: A.DISABLED_IMAGE_CAPTIONING, get, signal: new AbortController().signal });
    assert.deepEqual(r.images, [PNG, 'data:image/png;base64,AAAA']);
    assert.deepEqual(r.files, [{ type: 'application/pdf', data: PDF, filename: 'doc.pdf' }]);
    assert.equal(r.blocks.get('a'), '<attached_file name="m.txt" type="text/plain">\n메모\n</attached_file>\n\n<attached_image name="cat.png" type="image/png">\n(image 1 attached to this request)\n</attached_image>');
    assert.equal(r.blocks.get('c'), '<attached_image name="dog.png" type="image/png">\n(image 2 attached to this request)\n</attached_image>\n\n<attached_file name="doc.pdf" type="application/pdf">\n(file 1 attached to this request)\n</attached_file>');
    assert.equal(r.blocks.has('b'), false); assert.equal(r.updated.size, 0);
    const no = await A.attachmentInputs(rows, { captioning: A.DISABLED_IMAGE_CAPTIONING, get, signal: new AbortController().signal, takesFiles: false });
    assert.deepEqual(no.files, []);
    assert.match(no.blocks.get('c'), /<attached_file name="doc\.pdf" type="application\/pdf">\n\(a PDF: this connection cannot read it\)\n<\/attached_file>/);
});

test('그림 설명 (마리나라의 Image captioning): 켜면 그림 대신 설명이 들어가고, 설명은 첨부에 남겨 다시 써요. 지시문 · 모델이 바뀌면 새로 만들어요', async () => {
    const asked = [];
    const captioning = (over = {}) => ({ enabled: true, connectionId: 'ai', connection: { model: 'vision-1', provider: 'custom' }, prompt: null, provider: { chatComplete: async (messages, o) => { asked.push({ messages, o }); return { content: '```\n고양이가 창가에 앉아 있다.\n```' }; } }, ...over });
    const signal = new AbortController().signal, get = async () => { throw new Error('x'); };
    const rows = [{ id: 'a', text: '봐', extra: { attachments: [{ type: 'image/png', url: '/user/files/cat.png', data: PNG, name: 'cat.png' }] } }];
    const r = await A.attachmentInputs(rows, { captioning: captioning(), get, signal });
    assert.deepEqual(r.images, []);
    assert.equal(r.blocks.get('a'), '<attached_image name="cat.png" type="image/png">\n고양이가 창가에 앉아 있다.\n</attached_image>');
    // (마리나라의 요청 그대로: 지시문 + "Describe this image attachment named …", 온도 0.2, 700토큰)
    assert.equal(asked[0].messages[0].content, A.DEFAULT_IMAGE_CAPTIONING_PROMPT);
    assert.equal(asked[0].messages[1].content, 'Describe this image attachment named "cat.png" for use inside a chat prompt. Return only the description.');
    assert.deepEqual(asked[0].messages[1].images, [PNG]);
    assert.deepEqual([asked[0].o.temperature, asked[0].o.maxTokens, asked[0].o.model], [0.2, 700, 'vision-1']);
    // (저장할 모양: 주소가 있으니 data는 빼고, 설명과 누가 만들었는지)
    const kept = r.updated.get('a')[0];
    assert.ok(!('data' in kept));
    assert.deepEqual([kept.url, kept.imageCaption, kept.imageCaptionConnectionId, kept.imageCaptionModel, kept.imageCaptionProvider], ['/user/files/cat.png', '고양이가 창가에 앉아 있다.', 'ai', 'vision-1', 'custom']);
    assert.equal(kept.imageCaptionPromptKey, createHash('sha256').update(A.DEFAULT_IMAGE_CAPTIONING_PROMPT).digest('hex').slice(0, 16));   // (마리나라와 같은 열쇠)
    assert.equal(await C.captionPromptKey('x'), createHash('sha256').update('x').digest('hex').slice(0, 16));
    // (다음 요청: 저장한 설명을 그대로, 다시 묻지 않아요)
    const again = [{ id: 'a', text: '봐', extra: { attachments: [{ ...kept, data: PNG }] } }];
    const r2 = await A.attachmentInputs(again, { captioning: captioning(), get, signal });
    assert.equal(asked.length, 1); assert.equal(r2.updated.size, 0); assert.match(r2.blocks.get('a'), /고양이가 창가에/);
    // (지시문이나 모델이 바뀌면 새로)
    await A.attachmentInputs(again, { captioning: captioning({ prompt: '짧게' }), get, signal }); assert.equal(asked.length, 2); assert.equal(asked[1].messages[0].content, '짧게');
    await A.attachmentInputs(again, { captioning: captioning({ connection: { model: 'vision-2', provider: 'custom' } }), get, signal }); assert.equal(asked.length, 3);
    // (설명에 실패하면 던져요: 그림을 몰래 그대로 보내지 않아요)
    await assert.rejects(A.attachmentInputs(rows, { captioning: captioning({ provider: { chatComplete: async () => { throw new Error('boom'); } } }), get, signal }), /Image captioning failed for "cat\.png"/);
    await assert.rejects(A.attachmentInputs(rows, { captioning: captioning({ provider: { chatComplete: async () => ({ content: '  ' }) } }), get, signal }), /sent back no text/);
    await assert.rejects(A.attachmentInputs(rows, { captioning: { enabled: true, connectionId: null, connection: null, provider: null, unavailableReason: 'the captioning connection was not found' }, get, signal }), /Image captioning failed: the captioning connection was not found/);
});
