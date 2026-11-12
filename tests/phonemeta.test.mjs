// phoneMeta (core.js): 폰 2's drawer only while it is this chat's; a closed-by-error window or a changed chat gives the chat's own meta
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document={documentElement:{},addEventListener(){}};globalThis.MutationObserver=class{observe(){}};globalThis.$=()=>({on(){return this}});
let context={chatId:'a',chatMetadata:{},chat:[]};globalThis.SillyTavern={getContext:()=>context};
await import('../src/phone.js');
const {getMeta,phoneMeta,setPhoneMeta}=await import('../src/core.js');

test('phoneMeta: the drawer for its own chat, the chat meta otherwise', () => {
    const a=getMeta(), drawer={drawer:true};
    assert.equal(phoneMeta(),a);
    setPhoneMeta(drawer);
    assert.equal(phoneMeta(),drawer);
    // the chat changes while it is set (the window never cleared it): the new chat's own meta
    context={chatId:'b',chatMetadata:{},chat:[]};
    const b=getMeta();
    assert.notEqual(b,a); assert.equal(phoneMeta(),b);
    // chat a loaded again (a new meta object): not the meta the drawer was set for, so the chat's own
    context={chatId:'a',chatMetadata:{},chat:[]};
    assert.equal(phoneMeta(),getMeta());
    setPhoneMeta(null);
    assert.equal(phoneMeta(),getMeta());
});
