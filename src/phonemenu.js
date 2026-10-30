// Direct character-phone entry in SillyTavern's extensions (magic-wand) menu.
import { hasChat } from './core.js';
import { openPhone } from './phone.js';

let opening = false;
let observer;
export function addPhoneMenu() {
    const put = () => {
        const menu = document.getElementById('extensionsMenu');
        if (!menu) return false;
        if (document.getElementById('na_phone_wand')) return true;
        const box = document.createElement('div');
        box.className = 'extension_container';
        box.id = 'na_phone_wand_container';
        const item = document.createElement('div');
        item.id = 'na_phone_wand';
        item.className = 'list-group-item flex-container flexGap5 interactable';
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.title = '캐릭터 휴대폰';
        item.innerHTML = '<div class="fa-solid fa-mobile-screen-button extensionsMenuExtensionButton"></div><span>캐릭터 휴대폰</span>';
        const open = async () => {
            if (!hasChat()) return toastr.info('채팅을 먼저 여세요.');
            if (opening) return;
            opening = true;
            try { await openPhone(); }
            catch (err) { toastr.error(String(err?.message || err), '캐릭터 휴대폰'); }
            finally { opening = false; }
        };
        item.addEventListener('click', open);
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
        box.append(item);
        menu.append(box);
        return true;
    };
    if (put()) { observer?.disconnect(); observer = null; return; }
    if (observer) return;
    observer = new MutationObserver(() => {
        if (put()) { observer.disconnect(); observer = null; }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
