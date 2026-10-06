// 서사 아카이브 (Narrative Archive): entry point. Imports the parts and wires SillyTavern events.
// You write the archive. This extension stores it per chat, injects it, hides already-compressed messages,
// extracts raw ranges, and shows token counts. The code lives in src/.

import { onChatChanged } from './src/chats.js';
import { ctx, getMeta, hasChat } from './src/core.js';
import { driftTick } from './src/drift.js';
import { applyInjection } from './src/inject.js';
import { addWandMenu, renderPanel, sectionPanel } from './src/panel.js';
import { onGenerationStarted, onMessageSent } from './src/router.js';
import { linkedMap } from './src/sections.js';
import { refreshStatusSoon } from './src/status.js';
import { applyTheme } from './src/theme.js';
import { xrayArm, xrayCapture, xrayWorldInfo } from './src/xray.js';

(function init() {
    const c = ctx();
    const es = c.eventSource;
    const et = c.eventTypes || c.event_types;

    let started = false;
    const start = () => {
        if (started) return;
        started = true;
        if (!$('#na_settings').length) renderPanel();
        applyTheme();
        addWandMenu();
        onChatChanged();
    };

    es.on(et.APP_READY, start);
    es.on(et.CHAT_CHANGED, onChatChanged);
    if (et.GENERATION_STARTED) es.on(et.GENERATION_STARTED, xrayArm);
    if (et.GENERATION_STARTED) es.on(et.GENERATION_STARTED, onGenerationStarted);
    if (et.MESSAGE_SENT) es.on(et.MESSAGE_SENT, onMessageSent);
    if (et.WORLD_INFO_ACTIVATED) es.on(et.WORLD_INFO_ACTIVATED, xrayWorldInfo);
    if (et.CHAT_COMPLETION_PROMPT_READY) es.on(et.CHAT_COMPLETION_PROMPT_READY, xrayCapture);
    if (et.GENERATE_AFTER_COMBINE_PROMPTS) es.on(et.GENERATE_AFTER_COMBINE_PROMPTS, xrayCapture);
    if (et.MESSAGE_RECEIVED) es.on(et.MESSAGE_RECEIVED, driftTick);
    for (const ev of [et.MESSAGE_RECEIVED, et.MESSAGE_SENT, et.MESSAGE_DELETED, et.MESSAGE_UPDATED]) {
        if (ev) es.on(ev, refreshStatusSoon);
    }
    // keyword-linked sections follow the conversation
    let linkTimer;
    const relink = () => {
        if (!hasChat() || !Object.keys(linkedMap(getMeta())).length) return;
        clearTimeout(linkTimer);
        linkTimer = setTimeout(() => { applyInjection().then(() => sectionPanel?.render()); }, 300);
    };
    for (const ev of [et.MESSAGE_RECEIVED, et.MESSAGE_SENT, et.MESSAGE_DELETED, et.MESSAGE_UPDATED, et.MESSAGE_SWIPED, et.MESSAGE_EDITED]) {
        if (ev) es.on(ev, relink);
    }
    if (document.getElementById('extensions_settings2')) start();
})();
