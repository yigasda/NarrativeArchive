// 실리 1.19.1 public/scripts/i18n.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 매크로 계산에 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움), 대역(localeFile).
// 대역: 실리 localeFile(6줄)은 브라우저 localStorage · navigator.language에서 와요. 서버는 `__naSet({ localeFile })`로 채워요.
let localeFile = 'en';

// 실리 public/scripts/i18n.js 10~10
var localeData;

// 실리 public/scripts/i18n.js 13~13
let trackMissingDynamicTranslate = null;

// 실리 public/scripts/i18n.js 15~15
export const getCurrentLocale = () => localeFile;

// 실리 public/scripts/i18n.js 63~111
/**
 * Translates a template string with named arguments
 *
 * Uses the template literal with all values replaced by index placeholder for translation key.
 *
 * @example
 * ```js
 * toastr.warning(t`Tag ${tagName} not found.`);
 * ```
 * Should be translated in the translation files as:
 * ```
 * Tag ${0} not found. -> Tag ${0} nicht gefunden.
 * ```
 *
 * @param {TemplateStringsArray} strings - Template strings array
 * @param  {...any} values - Values for placeholders in the template string
 * @returns {string} Translated and formatted string
 */
export function t(strings, ...values) {
    let str = strings.reduce((result, string, i) => result + string + (values[i] !== undefined ? `\${${i}}` : ''), '');
    let translatedStr = translate(str);

    // Replace indexed placeholders with actual values
    return translatedStr.replace(/\$\{(\d+)\}/g, (match, index) => values[index]);
}

/**
 * Translates a given key or text
 *
 * If the translation is based on a key, that one is used to find a possible translation in the translation file.
 * The original text still has to be provided, as that is the default value being returned if no translation is found.
 *
 * For in-code text translation on a format string, using the template literal `t` is preferred.
 *
 * @param {string} text - The text to translate
 * @param {string?} key - The key to use for translation. If not provided, text is used as the key.
 * @returns {string} - The translated text
 */
export function translate(text, key = null) {
    const translationKey = key || text;
    if (translationKey === null || translationKey === undefined) {
        console.trace('WARN: No translation key provided');
        return '';
    }
    if (trackMissingDynamicTranslate && localeData && !Object.hasOwn(localeData, translationKey)) {
        trackMissingDynamicTranslate.add(translationKey);
    }
    return localeData?.[translationKey] || text;
}

/**
 * @param {{localeFile?: string}} v
 */
export function __naSet(v) {
    if (Object.hasOwn(v, 'localeFile')) localeFile = v.localeFile;
}
