// 폰 2(실시간)의 "롤플에 넣기": 롤플에 넣기를 켠 실시간 폰이 지금 담고 있는 것을 롤플 프롬프트에 적는 글.
// 폰 1의 글(# PHONES) 뒤에 따로 제목(# PHONES NOW (messenger))을 달고 붙어요. 폰 한 대를 적는 방법은 폰 1의
// phoneBlock 그대로예요(그 함수에 실시간 폰만 건네서 받은 글의 제목만 바꿔요). 폰 1의 글은 여기서 만들지도 바꾸지도 않아요.
import { phoneBlock } from './phonedata.js';

export const LIVE_NOTE_HEAD = `# PHONES NOW (messenger)\n_What these characters' phones hold now, from their talk on a messenger outside the scenes. Background only: do not bring it up unprompted, and do not build new events on it._`;

// phones: 실시간 폰들. 넣을 게 없거나 실시간 폰을 적다가 문제가 나면 '' (폰 1의 글은 그대로 나가게)
export function liveNote(phones) {
    try {
        const text = phoneBlock({ phones: Object.fromEntries((Array.isArray(phones) ? phones : []).map((p, i) => [i, p])) });
        const at = text.indexOf('\n## ');
        return text && at >= 0 ? `\n\n${LIVE_NOTE_HEAD}${text.slice(at)}` : '';
    } catch { return ''; }
}
