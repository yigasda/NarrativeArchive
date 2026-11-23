// 사용자 지정 알림음: 소리 파일 하나를 사용자 폴더에 둬요.
// 마리나라 packages/server/src/routes/notification-sound.routes.ts (212줄, staging 32c47a1)를 우리 모양으로 가져왔어요.
// 바꾼 것:
//   - 둘 곳: 마리나라의 DATA_DIR/notification-sounds → <사용자 폴더>/NarrativeArchive/notification-sounds (실리 사용자마다)
//   - 올리기: 마리나라는 fastify의 req.file()로 받아요. 실리는 모든 길 앞에서 multer가 'avatar' 칸의 파일을 임시 폴더에
//     받아 두므로(실리 src/server-main.js 269줄) 그 파일을 읽어요 → upload({ name, tmp }). 임시 파일은 늘 지워요
//   - 길의 답(오류)은 plugin/index.mjs가 해요. 오류 글은 화면이 한국어라서 한국어로(뜻은 마리나라 것 그대로)
//   - 파일 주는 주소: /api/plugins/narrative-archive/sound/file?v=<updatedAt>
//   - writeFileAtomic: 옆에 쓰고 옮기기(plugin/store.mjs와 같은 방식)
// 이 파일은 실리 · 익스프레스를 몰라요: 테스트에서 임시 폴더로 그대로 돌려요.

import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import crypto from 'node:crypto';

export const MAX_NOTIFICATION_SOUND_BYTES = 10 * 1024 * 1024;
export const SOUND_URL = '/api/plugins/narrative-archive/sound/file';

export class SoundError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}

const ALLOWED_UPLOAD_EXTENSIONS = new Map([
    ['.mp3', '.mp3'],
    ['.wav', '.wav'],
    ['.ogg', '.ogg'],
    ['.oga', '.ogg'],
    ['.m4a', '.m4a'],
    ['.mp4', '.mp4'],
    ['.webm', '.webm'],
]);

const STORED_FORMATS = [
    { extension: '.mp3', mimeType: 'audio/mpeg' },
    { extension: '.wav', mimeType: 'audio/wav' },
    { extension: '.ogg', mimeType: 'audio/ogg' },
    { extension: '.m4a', mimeType: 'audio/mp4' },
    { extension: '.mp4', mimeType: 'audio/mp4' },
    { extension: '.webm', mimeType: 'audio/webm' },
];

// (Marinara's detectNotificationSoundFormat, as it is)
export function detectNotificationSoundFormat(buffer) {
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF') {
        if (buffer.subarray(8, 12).toString('ascii') === 'WAVE') {
            return { extension: '.wav', mimeType: 'audio/wav' };
        }
        if (buffer.subarray(8, 12).toString('ascii') === 'WEBP') return null;
    }
    if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') {
        return { extension: '.ogg', mimeType: 'audio/ogg' };
    }
    if (
        buffer.length >= 3 &&
        (buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
            (buffer[0] === 0xff && buffer[1] !== undefined && (buffer[1] & 0xe0) === 0xe0))
    ) {
        return { extension: '.mp3', mimeType: 'audio/mpeg' };
    }
    if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
        return { extension: '.m4a', mimeType: 'audio/mp4' };
    }
    if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
        return { extension: '.webm', mimeType: 'audio/webm' };
    }
    return null;
}

// (the replacement and the deletion rename/unlink the same fixed file names, so they must not interleave: one queue per folder —
//  Marinara's withNotificationSoundLock)
const queues = new Map();
function withNotificationSoundLock(key, task) {
    const before = queues.get(key) || Promise.resolve();
    const run = before.then(task, task);
    queues.set(key, run.catch(() => undefined));
    return run;
}

// root: 실리 사용자 폴더 → { status(), upload({ name, tmp }), remove(), file() }
export function soundStore(root) {
    const NOTIFICATION_SOUNDS_DIR = join(String(root), 'NarrativeArchive', 'notification-sounds');
    const soundPath = extension => join(NOTIFICATION_SOUNDS_DIR, `notification${extension}`);

    async function findStoredNotificationSound() {
        const candidates = await Promise.all(
            STORED_FORMATS.map(async format => {
                const path = soundPath(format.extension);
                try {
                    const details = await stat(path);
                    if (!details.isFile()) return null;
                    return { ...format, path, updatedAt: details.mtime.toISOString(), mtimeMs: details.mtimeMs };
                } catch (error) {
                    if (error?.code === 'ENOENT') return null;
                    throw error;
                }
            }),
        );
        const newest = candidates.filter(candidate => candidate !== null).sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
        if (!newest) return null;
        const { mtimeMs: _mtimeMs, ...sound } = newest;
        return sound;
    }

    async function removeStoredNotificationSounds(exceptPath) {
        await Promise.all(
            STORED_FORMATS.map(async format => {
                const path = soundPath(format.extension);
                if (path === exceptPath) return;
                await unlink(path).catch(error => {
                    if (error.code !== 'ENOENT') throw error;
                });
            }),
        );
    }

    function soundStatus(sound) {
        if (!sound) return { configured: false, url: null, updatedAt: null };
        return {
            configured: true,
            url: `${SOUND_URL}?v=${encodeURIComponent(sound.updatedAt)}`,
            updatedAt: sound.updatedAt,
        };
    }

    // (written beside itself, then moved over: a reader never sees half a file)
    async function writeFileAtomic(file, buffer) {
        const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
        await writeFile(tmp, buffer);
        await rename(tmp, file);
    }

    return {
        status: async () => soundStatus(await findStoredNotificationSound()),
        // name: 올린 파일의 이름 · tmp: 실리가 받아 둔 임시 파일(읽고 나면 지워요) · size: 그 크기
        async upload({ name, tmp, size }) {
            try {
                if (!tmp) throw new SoundError(400, '올린 알림음이 없어요.');
                if (Number(size) > MAX_NOTIFICATION_SOUND_BYTES) throw new SoundError(413, '알림음은 10MB 이하여야 해요.');
                const uploadedExtension = ALLOWED_UPLOAD_EXTENSIONS.get(extname(String(name || '')).toLowerCase());
                if (!uploadedExtension) throw new SoundError(400, 'MP3 · WAV · OGG · M4A · MP4 · WebM 소리 파일을 골라 주세요.');
                let buffer;
                try { buffer = await readFile(tmp); } catch { throw new SoundError(400, '알림음을 읽지 못했어요.'); }
                if (buffer.byteLength > MAX_NOTIFICATION_SOUND_BYTES) throw new SoundError(413, '알림음은 10MB 이하여야 해요.');
                const format = detectNotificationSoundFormat(buffer);
                const extensionMatches =
                    format &&
                    (uploadedExtension === format.extension ||
                        ((uploadedExtension === '.mp4' || uploadedExtension === '.m4a') && format.mimeType === 'audio/mp4'));
                if (!format || !extensionMatches) throw new SoundError(400, '올린 파일이 받는 소리 형식이 아니에요.');

                const finalPath = soundPath(uploadedExtension);
                try {
                    return await withNotificationSoundLock(NOTIFICATION_SOUNDS_DIR, async () => {
                        await mkdir(NOTIFICATION_SOUNDS_DIR, { recursive: true });
                        await writeFileAtomic(finalPath, buffer);
                        await removeStoredNotificationSounds(finalPath);
                        const details = await stat(finalPath);
                        return soundStatus({ extension: uploadedExtension, mimeType: format.mimeType, path: finalPath, updatedAt: details.mtime.toISOString() });
                    });
                } catch (error) {
                    console.error('[narrative-archive plugin] 알림음을 저장하지 못했어요', error);
                    throw new SoundError(500, '알림음을 저장하지 못했어요.');
                }
            } finally {
                if (tmp) await unlink(tmp).catch(() => {});
            }
        },
        remove: () => withNotificationSoundLock(NOTIFICATION_SOUNDS_DIR, () => removeStoredNotificationSounds()),
        // → { handle (열린 파일: 그사이 바뀌거나 지워져도 읽혀요), size, mimeType } | null
        async file() {
            const sound = await findStoredNotificationSound();
            if (!sound) return null;
            let handle;
            try {
                handle = await open(sound.path, 'r');
            } catch (error) {
                if (error?.code === 'ENOENT') return null;
                throw error;
            }
            const details = await handle.stat();
            return { handle, size: details.size, mimeType: sound.mimeType };
        },
    };
}
