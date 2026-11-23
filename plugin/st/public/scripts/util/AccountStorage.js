// 실리 1.19.1 public/scripts/util/AccountStorage.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 서버가 실리 요청을 만드는 데 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
// 실리 public/scripts/util/AccountStorage.js 1~140
import { saveSettingsDebounced } from '../../script.js';

const MIGRATED_MARKER = '__migrated';
const MIGRATABLE_KEYS = [
    /^AlertRegex_/,
    /^AlertWI_/,
    /^Assets_SkipConfirm_/,
    /^Characters_PerPage$/,
    /^DataBank_sortField$/,
    /^DataBank_sortOrder$/,
    /^extension_update_nag$/,
    /^extensions_sortByName$/,
    /^FeatherlessModels_PerPage$/,
    /^GroupMembers_PerPage$/,
    /^GroupCandidates_PerPage$/,
    /^LNavLockOn$/,
    /^LNavOpened$/,
    /^mediaWarningShown:/,
    /^NavLockOn$/,
    /^NavOpened$/,
    /^Personas_PerPage$/,
    /^Personas_GridView$/,
    /^Proxy_SkipConfirm_/,
    /^qr--executeShortcut$/,
    /^qr--syntax$/,
    /^qr--tabSize$/,
    /^qr--wrap$/,
    /^RegenerateWithCtrlEnter$/,
    /^SelectedNavTab$/,
    /^sendAsNamelessWarningShown$/,
    /^StoryStringValidationCache$/,
    /^WINavOpened$/,
    /^WI_PerPage$/,
    /^world_info_sort_order$/,
];

/**
 * Provides access to account storage of arbitrary key-value pairs.
 */
class AccountStorage {
    /**
     * @type {Record<string, string>} Storage state
     */
    #state = {};

    /**
     * @type {boolean} If the storage was initialized
     */
    #ready = false;

    #migrateLocalStorage() {
        const localStorageKeys = [];
        for (let i = 0; i < globalThis.localStorage.length; i++) {
            localStorageKeys.push(globalThis.localStorage.key(i));
        }
        for (const key of localStorageKeys) {
            if (MIGRATABLE_KEYS.some(k => k.test(key))) {
                const value = globalThis.localStorage.getItem(key);
                this.#state[key] = value;
                globalThis.localStorage.removeItem(key);
            }
        }
    }

    /**
     * Initialize the account storage.
     * @param {Object} state Initial state
     */
    init(state) {
        if (state && typeof state === 'object') {
            this.#state = Object.assign(this.#state, state);
        }

        if (!Object.hasOwn(this.#state, MIGRATED_MARKER)) {
            this.#migrateLocalStorage();
            this.#state[MIGRATED_MARKER] = '1';
            saveSettingsDebounced();
        }

        this.#ready = true;
    }

    /**
     * Get the value of a key in account storage.
     * @param {string} key Key to get
     * @returns {string|null} Value of the key
     */
    getItem(key) {
        if (!this.#ready) {
            console.warn(`AccountStorage not ready (trying to read from ${key})`);
        }

        return Object.hasOwn(this.#state, key) ? String(this.#state[key]) : null;
    }

    /**
     * Set a key in account storage.
     * @param {string} key Key to set
     * @param {string} value Value to set
     */
    setItem(key, value) {
        if (!this.#ready) {
            console.warn(`AccountStorage not ready (trying to write to ${key})`);
        }

        const hasPropertySet = Object.hasOwn(this.#state, key) && this.#state[key] === String(value);

        if (hasPropertySet) {
            return;
        }

        this.#state[key] = String(value);
        saveSettingsDebounced();
    }

    /**
     * Remove a key from account storage.
     * @param {string} key Key to remove
     */
    removeItem(key) {
        if (!this.#ready) {
            console.warn(`AccountStorage not ready (trying to remove ${key})`);
        }

        if (!Object.hasOwn(this.#state, key)) {
            return;
        }

        delete this.#state[key];
        saveSettingsDebounced();
    }

    /**
     * Gets a snapshot of the storage state.
     * @returns {Record<string, string>} A deep clone of the storage state
     */
    getState() {
        return structuredClone(this.#state);
    }
}

// 우리 것: 실리 145줄 `export const accountStorage = new AccountStorage();`을 일마다 새로 만들게 let으로 둬요.
// 일꾼이 settings.json의 accountStorage로 init해요(실리 script.js 7935 `accountStorage.init(settings?.accountStorage)`).
// 실리는 처음 한 번 브라우저 localStorage의 값을 옮겨 와요(#migrateLocalStorage). 서버에는 그 localStorage가 없어서, 옮긴 표시가 없으면 표시만 붙여요.
export let accountStorage = new AccountStorage();
accountStorage.init({ [MIGRATED_MARKER]: '1' });

/**
 * @param {{accountStorage?: object}} v
 */
export function __naSet(v) {
    if (!Object.hasOwn(v, 'accountStorage')) return;
    const state = v.accountStorage && typeof v.accountStorage === 'object' ? { ...v.accountStorage } : {};
    if (!Object.hasOwn(state, MIGRATED_MARKER)) state[MIGRATED_MARKER] = '1';
    accountStorage = new AccountStorage();
    accountStorage.init(state);
}
