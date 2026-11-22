// 플러그인의 기록 줄. 마리나라에서 가져온 파일(plugin/marinara/)이 그쪽 logger · logRateLimited를 부르는 자리를 채워요.
//   logger.info('글 %s %d', a, b) · logger.warn(err 또는 { err }, '글 %s', a)  (마리나라가 쓰는 pino 모양)
//   logRateLimited('warn', key, err, '글'): 같은 key는 1분에 한 번만 적고, 그사이 몇 번 더 있었는지 같이 적어요

const TAG = '[narrative-archive plugin]';
const fill = (fmt, args) => { let i = 0; const s = String(fmt).replace(/%[sdo]/g, () => String(args[i++])); return i < args.length ? `${s} ${args.slice(i).join(' ')}` : s; };
const errOf = x => (x instanceof Error ? x : x && typeof x === 'object' && x.err instanceof Error ? x.err : null);
function write(level, args) {
    const first = args[0];
    const lead = typeof first === 'string' ? null : first;
    const rest = lead === null ? args : args.slice(1);
    const text = rest.length ? fill(rest[0], rest.slice(1)) : '';
    const err = errOf(lead);
    const out = err ? [TAG, text, err] : [TAG, text];
    (level === 'info' ? console.log : level === 'warn' ? console.warn : console.error)(...out);
}
export const logger = {
    info: (...a) => write('info', a),
    warn: (...a) => write('warn', a),
    error: (...a) => write('error', a),
};

const RATE_MS = 60_000, seen = new Map();
export function logRateLimited(level, key, err, fmt, ...args) {
    const now = Date.now(), had = seen.get(key);
    if (had && now - had.at < RATE_MS) { had.more += 1; return; }
    const more = had?.more || 0;
    seen.set(key, { at: now, more: 0 });
    write(level, [err instanceof Error ? err : {}, more ? `${fmt} (그사이 ${more}번 더)` : fmt, ...args]);
}
