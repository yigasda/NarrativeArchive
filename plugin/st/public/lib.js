// 실리 1.19.1 public/lib.js 자리 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 실리 것은 webpack 묶음이라 옮기지 않음. 매크로가 쓰는 라이브러리를 실리 public/lib.js와 같은 이름으로 내보냄.
// 실리 서버 폴더(process.cwd())의 node_modules에서 먼저, 없으면 확장의 node_modules(테스트용 devDependencies)에서 불러와요.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function load(name) {
    try {
        const require = createRequire(path.join(process.cwd(), 'package.json'));
        return await import(pathToFileURL(require.resolve(name)).href);
    } catch {
        return await import(name);
    }
}

// 실리 public/lib.js 5~25줄과 같은 꼴: 기본 내보내기(import x from) 또는 이름공간(import * as x from)
const lodash = (await load('lodash')).default;
const Handlebars = (await load('handlebars')).default;
const moment = (await load('moment')).default;
const seedrandom = (await load('seedrandom')).default;
const droll = (await load('droll')).default;
const chevrotain = await load('chevrotain');

export default {
    lodash,
    Handlebars,
    moment,
    seedrandom,
    droll,
    chevrotain,
};

export {
    lodash,
    Handlebars,
    moment,
    seedrandom,
    droll,
    chevrotain,
};
