// 실리 1.19.1 public/scripts/variables.js의 일부를 그대로 옮긴 것 (서버 플러그인이 실리 브라우저 없이 같은 요청을 만들게). SillyTavern, AGPL-3.0 (NOTICE.md).
// 바꾼 것: 매크로 계산에 쓰는 것만 옮김. 옮긴 줄마다 위에 `// 실리 <경로> <시작줄>~<끝줄>`. 그 밖의 줄은 우리 것: import, `__naSet`(일꾼이 전역 값을 채움).
import { chat_metadata, saveSettingsDebounced } from '../script.js';
import { extension_settings, saveMetadataDebounced } from './extensions.js';
import { convertValueType } from './utils.js';

// 실리 public/scripts/variables.js 22~210
export function getLocalVariable(name, args = {}) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    let localVariable = chat_metadata?.variables[args.key ?? name];
    if (args.index !== undefined) {
        try {
            localVariable = JSON.parse(localVariable);
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                localVariable = localVariable[args.index];
            } else {
                localVariable = localVariable[Number(args.index)];
            }
            if (typeof localVariable == 'object') {
                localVariable = JSON.stringify(localVariable);
            }
        } catch {
            // that didn't work
        }
    }

    return (localVariable?.trim?.() === '' || isNaN(Number(localVariable))) ? (localVariable || '') : Number(localVariable);
}

export function setLocalVariable(name, value, args = {}) {
    if (!name) {
        throw new Error('Variable name cannot be empty or undefined.');
    }

    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    if (args.index !== undefined) {
        try {
            let localVariable = JSON.parse(chat_metadata.variables[name] ?? 'null');
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                if (localVariable === null) {
                    localVariable = {};
                }
                localVariable[args.index] = convertValueType(value, args.as);
            } else {
                if (localVariable === null) {
                    localVariable = [];
                }
                localVariable[numIndex] = convertValueType(value, args.as);
            }
            chat_metadata.variables[name] = JSON.stringify(localVariable);
        } catch {
            // that didn't work
        }
    } else {
        chat_metadata.variables[name] = value;
    }
    saveMetadataDebounced();
    return value;
}

export function getGlobalVariable(name, args = {}) {
    let globalVariable = extension_settings.variables.global[args.key ?? name];
    if (args.index !== undefined) {
        try {
            globalVariable = JSON.parse(globalVariable);
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                globalVariable = globalVariable[args.index];
            } else {
                globalVariable = globalVariable[Number(args.index)];
            }
            if (typeof globalVariable == 'object') {
                globalVariable = JSON.stringify(globalVariable);
            }
        } catch {
            // that didn't work
        }
    }

    return (globalVariable?.trim?.() === '' || isNaN(Number(globalVariable))) ? (globalVariable || '') : Number(globalVariable);
}

export function setGlobalVariable(name, value, args = {}) {
    if (!name) {
        throw new Error('Variable name cannot be empty or undefined.');
    }

    if (args.index !== undefined) {
        try {
            let globalVariable = JSON.parse(extension_settings.variables.global[name] ?? 'null');
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                if (globalVariable === null) {
                    globalVariable = {};
                }
                globalVariable[args.index] = convertValueType(value, args.as);
            } else {
                if (globalVariable === null) {
                    globalVariable = [];
                }
                globalVariable[numIndex] = convertValueType(value, args.as);
            }
            extension_settings.variables.global[name] = JSON.stringify(globalVariable);
        } catch {
            // that didn't work
        }
    } else {
        extension_settings.variables.global[name] = value;
    }
    saveSettingsDebounced();
    return value;
}

export function addLocalVariable(name, value) {
    const currentValue = getLocalVariable(name) || 0;
    try {
        const parsedValue = JSON.parse(currentValue);
        if (Array.isArray(parsedValue)) {
            parsedValue.push(value);
            setLocalVariable(name, JSON.stringify(parsedValue));
            return parsedValue;
        }
    } catch {
        // ignore non-array values
    }
    const increment = Number(value);

    if (isNaN(increment) || isNaN(Number(currentValue))) {
        const stringValue = String(currentValue || '') + value;
        setLocalVariable(name, stringValue);
        return stringValue;
    }

    const newValue = Number(currentValue) + increment;

    if (isNaN(newValue)) {
        return '';
    }

    setLocalVariable(name, newValue);
    return newValue;
}

export function addGlobalVariable(name, value) {
    const currentValue = getGlobalVariable(name) || 0;
    try {
        const parsedValue = JSON.parse(currentValue);
        if (Array.isArray(parsedValue)) {
            parsedValue.push(value);
            setGlobalVariable(name, JSON.stringify(parsedValue));
            return parsedValue;
        }
    } catch {
        // ignore non-array values
    }
    const increment = Number(value);

    if (isNaN(increment) || isNaN(Number(currentValue))) {
        const stringValue = String(currentValue || '') + value;
        setGlobalVariable(name, stringValue);
        return stringValue;
    }

    const newValue = Number(currentValue) + increment;

    if (isNaN(newValue)) {
        return '';
    }

    setGlobalVariable(name, newValue);
    return newValue;
}

export function incrementLocalVariable(name) {
    return addLocalVariable(name, 1);
}

export function incrementGlobalVariable(name) {
    return addGlobalVariable(name, 1);
}

export function decrementLocalVariable(name) {
    return addLocalVariable(name, -1);
}

export function decrementGlobalVariable(name) {
    return addGlobalVariable(name, -1);
}

// 실리 public/scripts/variables.js 234~261
/**
 * Returns built-in variable macros.
 * @returns {import('./macros.js').Macro[]}
 */
export function getVariableMacros() {
    return [
        // Replace {{setvar::name::value}} with empty string and set the variable name to value
        { regex: /{{setvar::([^:]+)::([^}]*)}}/gi, replace: (_, name, value) => { setLocalVariable(name.trim(), value); return ''; } },
        // Replace {{addvar::name::value}} with empty string and add value to the variable value
        { regex: /{{addvar::([^:]+)::([^}]+)}}/gi, replace: (_, name, value) => { addLocalVariable(name.trim(), value); return ''; } },
        // Replace {{incvar::name}} with empty string and increment the variable name by 1
        { regex: /{{incvar::([^}]+)}}/gi, replace: (_, name) => incrementLocalVariable(name.trim()) },
        // Replace {{decvar::name}} with empty string and decrement the variable name by 1
        { regex: /{{decvar::([^}]+)}}/gi, replace: (_, name) => decrementLocalVariable(name.trim()) },
        // Replace {{getvar::name}} with the value of the variable name
        { regex: /{{getvar::([^}]+)}}/gi, replace: (_, name) => getLocalVariable(name.trim()) },
        // Replace {{setglobalvar::name::value}} with empty string and set the global variable name to value
        { regex: /{{setglobalvar::([^:]+)::([^}]*)}}/gi, replace: (_, name, value) => { setGlobalVariable(name.trim(), value); return ''; } },
        // Replace {{addglobalvar::name::value}} with empty string and add value to the global variable value
        { regex: /{{addglobalvar::([^:]+)::([^}]+)}}/gi, replace: (_, name, value) => { addGlobalVariable(name.trim(), value); return ''; } },
        // Replace {{incglobalvar::name}} with empty string and increment the global variable name by 1
        { regex: /{{incglobalvar::([^}]+)}}/gi, replace: (_, name) => incrementGlobalVariable(name.trim()) },
        // Replace {{decglobalvar::name}} with empty string and decrement the global variable name by 1
        { regex: /{{decglobalvar::([^}]+)}}/gi, replace: (_, name) => decrementGlobalVariable(name.trim()) },
        // Replace {{getglobalvar::name}} with the value of the global variable name
        { regex: /{{getglobalvar::([^}]+)}}/gi, replace: (_, name) => getGlobalVariable(name.trim()) },
    ];
}

// 실리 public/scripts/variables.js 417~433
/**
 * Checks if a local variable exists.
 * @param {string} name Local variable name
 * @returns {boolean} True if the local variable exists, false otherwise
 */
export function existsLocalVariable(name) {
    return chat_metadata.variables && chat_metadata.variables[name] !== undefined;
}

/**
 * Checks if a global variable exists.
 * @param {string} name Global variable name
 * @returns {boolean} True if the global variable exists, false otherwise
 */
export function existsGlobalVariable(name) {
    return extension_settings.variables.global && extension_settings.variables.global[name] !== undefined;
}

// 실리 public/scripts/variables.js 587~617
/**
 * Deletes a local variable.
 * @param {string} name Variable name to delete
 * @returns {string} Empty string
 */
export function deleteLocalVariable(name) {
    if (!existsLocalVariable(name)) {
        console.warn(`The local variable "${name}" does not exist.`);
        return '';
    }

    delete chat_metadata.variables[name];
    saveMetadataDebounced();
    return '';
}

/**
 * Deletes a global variable.
 * @param {string} name Variable name to delete
 * @returns {string} Empty string
 */
export function deleteGlobalVariable(name) {
    if (!existsGlobalVariable(name)) {
        console.warn(`The global variable "${name}" does not exist.`);
        return '';
    }

    delete extension_settings.variables.global[name];
    saveSettingsDebounced();
    return '';
}
