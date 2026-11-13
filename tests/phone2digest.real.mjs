// 실제 지시문 글을 화면 없이 꺼내요 (prompts.js · digest.js는 화면 파일을 불러서 node에서 못 불러요): 다이제스트
// 지시문. 시험 세션의 실제 모델 시험(폰 2 요약의 요약)이 써요. 요약 요청은 tests/phone2reflect.load.mjs의 G.digestAsk가 실제
// prompts.js로 짜 줘요. 저장소 코드는 안 바꿔요.
import { readFile } from 'node:fs/promises';

const literal = async (file, name) => {
    const src = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8'), a = src.indexOf(`export const ${name} = \``);
    if (a < 0) throw new Error(`${name}을 ${file}에서 못 찾았어요`);
    const from = src.indexOf('`', a) + 1;
    let to = from; while (to < src.length && !(src[to] === '`' && src[to - 1] !== '\\')) to++;
    const body = src.slice(from, to);
    if (body.includes('${')) throw new Error(`${name}에 끼워 넣는 값이 있어요 (그대로 못 꺼내요)`);
    return new Function(`return \`${body}\`;`)();
};
export const digestSystem = () => literal('digest.js', 'AI_SYS_DIGEST');
