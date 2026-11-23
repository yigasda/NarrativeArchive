// 이 브라우저의 시간대 · 언어를 확장 설정에 적기 (src/phone2keepon.js keepDevice): 서버 플러그인의 일꾼이 그 값으로 돌아요(plugin/work.mjs useDevice).
// 바뀌었을 때만 저장해요. 플러그인이 없어도(요청이 실패해도) 적어요. 확장 설정이 아직 없으면 적지 않아요(처음 켠 때의 "시작하기"를 건드리지 않게).
process.env.NA_SCREEN_ANYWHERE = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
const { setContext } = await import('../plugin/screen.mjs');
globalThis.document = { hidden: false, addEventListener() {}, dispatchEvent() { return true; }, querySelectorAll: () => [] };
const KO = await import('../src/phone2keepon.js');

const page = ({ locale = 'ko-kr', es = { narrative_archive: { usePrompt: false } } } = {}) => {
    const c = { saves: 0, locale, extensionSettings: es, getCurrentLocale: () => c.locale, saveSettingsDebounced: () => { c.saves += 1; }, getRequestHeaders: () => ({}), chatMetadata: {} };
    setContext(c);
    return c;
};
const o = Intl.DateTimeFormat().resolvedOptions();

test('브라우저의 시간대 · 실리 화면 언어 · Intl 언어를 적고, 같으면 다시 저장하지 않아요. 바뀌면 그때 저장해요', () => {
    const c = page();
    assert.equal(KO.keepDevice(), true);
    assert.deepEqual(c.extensionSettings.narrative_archive.device, { timeZone: o.timeZone, locale: 'ko-kr', intl: o.locale });
    assert.equal(c.extensionSettings.narrative_archive.usePrompt, false);   // (다른 설정은 그대로)
    assert.equal(c.saves, 1);
    assert.equal(KO.keepDevice(), false);
    assert.equal(KO.keepDevice(), false);
    assert.equal(c.saves, 1);
    c.locale = 'ja-jp';
    assert.equal(KO.keepDevice(), true);
    assert.equal(c.extensionSettings.narrative_archive.device.locale, 'ja-jp');
    assert.equal(c.saves, 2);
    // (another device wrote its own since: this one writes its own again)
    c.extensionSettings.narrative_archive.device = { timeZone: 'Pacific/Chatham', locale: 'ja-jp', intl: o.locale };
    assert.equal(KO.keepDevice(), true);
    assert.equal(c.extensionSettings.narrative_archive.device.timeZone, o.timeZone);
    assert.equal(c.saves, 3);
});

test('확장 설정이 아직 없거나 실리 문맥에 없으면 적지 않고 오류도 없어요', () => {
    const none = page({ es: {} });
    assert.equal(KO.keepDevice(), false);
    assert.deepEqual(none.extensionSettings, {});
    assert.equal(none.saves, 0);
    page({ es: null });
    assert.equal(KO.keepDevice(), false);
});

test('30초마다 부르는 keepBeat가 적어요 — 플러그인이 없어도(요청 실패)', async () => {
    globalThis.fetch = async () => { throw new Error('no plugin'); };
    const c = page();
    await KO.keepBeat();
    assert.deepEqual(c.extensionSettings.narrative_archive.device, { timeZone: o.timeZone, locale: 'ko-kr', intl: o.locale });
    assert.equal(c.saves, 1);
    await KO.keepBeat();
    assert.equal(c.saves, 1);
});
