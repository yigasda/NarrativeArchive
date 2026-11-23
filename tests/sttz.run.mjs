// 서버 쪽: 옮긴 실리 매크로(plugin/st/public)를 작업 스레드에서, 브라우저가 적은 device로(plugin/zone.mjs · i18n localeFile: plugin/work.mjs useDevice와 같게),
// 시계를 at에 고정해서 돌려요. tests/sttz.test.mjs와 tools/st/oracle-tz.mjs가 불러요.
//   runServer(device | null, at) → { device, env, macros }  (device가 null이면 서버 컴퓨터의 것: 브라우저가 아직 안 적었을 때)
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';

export function runServer(device, at) {
    return new Promise((ok, no) => {
        const w = new Worker(new URL(import.meta.url), { workerData: { device, at } });
        w.on('error', no);
        w.on('message', m => { w.terminate(); ok(m); });
    });
}

if (!isMainThread) {
    const { device, at } = workerData;
    // (before the zone: the shim's clock is the engine's own Date.now)
    Date.now = () => at;
    const Z = await import('../plugin/zone.mjs');
    const C = await import('./sttz.cases.mjs');
    const P = new URL('../plugin/st/public/', import.meta.url);
    const PU = await import(new URL('scripts/power-user.js', P));
    const S = await import(new URL('script.js', P));
    const SC = await import(new URL('scripts/st-context.js', P));
    const M = await import(new URL('scripts/macros.js', P));
    const I = await import(new URL('scripts/i18n.js', P));
    const { moment } = await import(new URL('lib.js', P));
    moment.suppressDeprecationWarnings = true;
    // (plugin/work.mjs useDevice: the zone, the default language, SillyTavern's localeFile)
    if (device) {
        Z.setZone(device.timeZone || null);
        Z.setLocale(device.intl || null);
        I.__naSet({ localeFile: device.locale ? String(device.locale).toLowerCase() : 'en' });
    }
    globalThis.SillyTavern = { getContext: () => ({ variables: SC.variables }) };
    M.initMacros();
    S.__naSet({ name1: 'Mara', name2: 'Ren', characters: [{ name: 'Ren', avatar: 'Ren.png', data: { extensions: {} } }], this_chid: '0', chat: [], chat_metadata: {}, main_api: 'openai' });
    const macros = C.macrosOf({ S, PU, setChat: chat => S.__naSet({ chat }), currentLocale: I.getCurrentLocale(), globalLocale: moment.locale() });
    parentPort.postMessage({ device, env: C.envOf(), macros });
}
