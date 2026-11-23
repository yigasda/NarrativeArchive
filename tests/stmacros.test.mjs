// 실리 매크로 계산(substituteParams)을 서버로 옮긴 것(plugin/st/public/)이 실리 브라우저와 같은 글을 만드는지.
// EXPECTED는 실리 1.19.1 브라우저에서 실리 자신의 substituteParams(await import('/script.js'))에 같은 상태 · 같은 입력을 넣어
// 나온 값이에요(Playwright, 2026-11-23). 지어낸 값이 아니에요. {{random}}은 둘 중 하나인지, {{time}}은 moment().format('LT')인지만 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';

const P = new URL('../plugin/st/public/', import.meta.url);
// 실리는 scripts/i18n.js → power-user.js → script.js 순서로 먼저 불러요. 그래서 power-user.js를 먼저 불러야 해요(순환 import).
const PU = await import(new URL('scripts/power-user.js', P));
const S = await import(new URL('script.js', P));
const G = await import(new URL('scripts/group-chats.js', P));
const E = await import(new URL('scripts/extensions.js', P));
const SC = await import(new URL('scripts/st-context.js', P));
const M = await import(new URL('scripts/macros.js', P));
const { moment } = await import(new URL('lib.js', P));

// variable-macros.js · MacroCstWalker.js는 전역 SillyTavern.getContext().variables를 써요. initMacros 전에 넣어야 해요.
globalThis.SillyTavern = { getContext: () => ({ variables: SC.variables }) };
M.initMacros();

const CHARACTERS = [
    {
        "name": "Ren",
        "avatar": "Ren.png",
        "description": "{{char}} is a courier who trusts {{user}}.",
        "personality": "calm, {{char}}-like",
        "scenario": "Rain over the harbor where {{user}} waits.",
        "mes_example": "",
        "first_mes": "",
        "data": {
            "system_prompt": "",
            "post_history_instructions": "",
            "creator_notes": "notes for {{char}}",
            "character_version": "v2",
            "extensions": {
                "depth_prompt": {
                    "prompt": ""
                }
            },
            "alternate_greetings": []
        }
    },
    {
        "name": "Ivo",
        "avatar": "Ivo.png",
        "description": "Ivo fixes radios.",
        "personality": "loud",
        "scenario": "",
        "mes_example": "",
        "first_mes": "",
        "data": {
            "system_prompt": "",
            "post_history_instructions": "",
            "creator_notes": "",
            "character_version": "",
            "extensions": {
                "depth_prompt": {
                    "prompt": ""
                }
            },
            "alternate_greetings": []
        }
    },
    {
        "name": "Lio",
        "avatar": "Lio.png",
        "description": "Lio sleeps a lot.",
        "personality": "",
        "scenario": "",
        "mes_example": "",
        "first_mes": "",
        "data": {
            "system_prompt": "",
            "post_history_instructions": "",
            "creator_notes": "",
            "character_version": "",
            "extensions": {
                "depth_prompt": {
                    "prompt": ""
                }
            },
            "alternate_greetings": []
        }
    }
];
const NAME1 = "Mara";
const PERSONA = "{{user}} draws maps of {{char}}'s routes.";
const CHAT_METADATA = {
    "chat_id_hash": 424242,
    "variables": {
        "x": "7",
        "word": "tea"
    }
};
const GLOBAL_VARS = {
    "y": "blue"
};
const GROUP = {
    "id": "na-test-group",
    "name": "Harbor",
    "members": [
        "Ren.png",
        "Ivo.png",
        "Lio.png"
    ],
    "disabled_members": [
        "Lio.png"
    ],
    "chat_id": "na-test-group-chat",
    "generation_mode": 0
};
// 브라우저의 그때 상태(새 설정): main_api "koboldhorde", collapse_newlines false, prefer_character_prompt true
const MAIN_API = "koboldhorde";

const CASES = [
    {
        "id": "card",
        "group": false,
        "call": "opts",
        "text": "{{user}} meets {{char}}. {{description}} | {{persona}} | {{personality}} | {{scenario}} | {{charVersion}} | {{creatorNotes}}"
    },
    {
        "id": "card-nocard",
        "group": false,
        "call": "opts",
        "opts": {
            "replaceCharacterCard": false
        },
        "text": "[{{description}}][{{persona}}]"
    },
    {
        "id": "names-solo",
        "group": false,
        "call": "opts",
        "text": "{{group}} | {{groupNotMuted}} | {{notChar}} | {{charIfNotGroup}}"
    },
    {
        "id": "names-group",
        "group": true,
        "call": "opts",
        "text": "{{group}} | {{groupNotMuted}} | {{notChar}} | {{charIfNotGroup}} | {{char}}"
    },
    {
        "id": "trim",
        "group": false,
        "call": "opts",
        "text": "A\n\n{{trim}}\n\nB"
    },
    {
        "id": "newline",
        "group": false,
        "call": "opts",
        "text": "x{{newline}}y"
    },
    {
        "id": "comment",
        "group": false,
        "call": "opts",
        "text": "a{{// a note for {{char}}}}b"
    },
    {
        "id": "if",
        "group": false,
        "call": "opts",
        "text": "{{if {{char}}}}has {{char}}{{else}}none{{/if}} / {{if 0}}A{{else}}B{{/if}} / {{if .x}}x is {{getvar::x}}{{/if}}"
    },
    {
        "id": "random",
        "group": false,
        "call": "opts",
        "kind": "oneof",
        "oneof": [
            "a",
            "b"
        ],
        "text": "{{random::a::b}}"
    },
    {
        "id": "pick",
        "group": false,
        "call": "opts",
        "text": "{{pick::north::south::east::west}} {{pick::north::south::east::west}} {{pick::1::2::3::4::5::6::7::8::9}}"
    },
    {
        "id": "roll",
        "group": false,
        "call": "opts",
        "text": "{{roll:1d1}} {{roll:1d1+2}}"
    },
    {
        "id": "getvar",
        "group": false,
        "call": "opts",
        "text": "{{getvar::x}} {{getvar::word}} [{{getvar::missing}}]"
    },
    {
        "id": "setvar",
        "group": false,
        "call": "opts",
        "text": "{{setvar::z::1}}{{getvar::z}}"
    },
    {
        "id": "globalvar",
        "group": false,
        "call": "opts",
        "text": "{{getglobalvar::y}}"
    },
    {
        "id": "time",
        "group": false,
        "call": "opts",
        "kind": "time",
        "text": "{{time}}"
    },
    {
        "id": "unknown",
        "group": false,
        "call": "opts",
        "text": "{{notAMacro}} and {{foo::bar}} and {{user}}"
    },
    {
        "id": "escaped",
        "group": false,
        "call": "opts",
        "text": "\\{\\{user\\}\\} {{user}}"
    },
    {
        "id": "dynamic",
        "group": false,
        "call": "opts",
        "opts": {
            "name1Override": "Ivo",
            "dynamicMacros": {
                "mood": "quiet"
            }
        },
        "text": "{{user}} is {{mood}}"
    },
    {
        "id": "legacy-args",
        "group": false,
        "call": "legacy",
        "args": [
            "Ivo",
            "Lio",
            "ORIG",
            "G1, G2"
        ],
        "text": "{{user}}/{{char}}/{{group}}/{{original}}{{original}}"
    },
    {
        "id": "legacy-plain",
        "group": false,
        "call": "legacy",
        "args": [
            null
        ],
        "text": "{{user}} and {{char}}: {{description}}"
    },
    {
        "id": "legacy-group",
        "group": true,
        "call": "legacy",
        "args": [
            null,
            "Ivo"
        ],
        "text": "{{notChar}} | {{group}}"
    }
];

// 실리 1.19.1 브라우저가 낸 값
const EXPECTED = {
    "new:card": "Mara meets Ren. Ren is a courier who trusts Mara. | Mara draws maps of Ren's routes. | calm, Ren-like | Rain over the harbor where Mara waits. | v2 | notes for Ren",
    "new:card-nocard": "[][]",
    "new:names-solo": "Ren | Ren | Mara | Ren",
    "new:names-group": "Ren, Ivo, Lio | Ren, Ivo | Ivo | Ren, Ivo, Lio | Ren",
    "new:trim": "AB",
    "new:newline": "x\ny",
    "new:comment": "ab",
    "new:if": "has Ren / B / x is 7",
    "new:pick": "south north 6",
    "new:roll": "1 3",
    "new:getvar": "7 tea []",
    "new:setvar": "1",
    "new:setvar:after": "{\"x\":\"7\",\"word\":\"tea\",\"z\":\"1\"}",
    "new:globalvar": "blue",
    "new:unknown": "{{notAMacro}} and {{foo::bar}} and Mara",
    "new:escaped": "{{user}} Mara",
    "new:dynamic": "Ivo is quiet",
    "new:legacy-args": "Ivo/Lio/G1, G2/ORIG",
    "new:legacy-plain": "Mara and Ren: Ren is a courier who trusts Mara.",
    "new:legacy-group": "Ren | Ren, Ivo, Lio",
    "new:pick:again": "south north 6",
    "legacy:card": "Mara meets Ren. Ren is a courier who trusts Mara. | Mara draws maps of Ren's routes. | calm, Ren-like | Rain over the harbor where Mara waits. | v2 | notes for Ren",
    "legacy:card-nocard": "[{{description}}][{{persona}}]",
    "legacy:names-solo": "Ren | Ren | Mara | Ren",
    "legacy:names-group": "Ren, Ivo, Lio | Ren, Ivo | Ivo, Lio, Mara | Ren, Ivo, Lio | Ren",
    "legacy:trim": "AB",
    "legacy:newline": "x\ny",
    "legacy:comment": "ab",
    "legacy:if": "{{if Ren}}has Ren{{else}}none{{/if}} / {{if 0}}A{{else}}B{{/if}} / {{if .x}}x is 7{{/if}}",
    "legacy:pick": "east east 2",
    "legacy:roll": "1 3",
    "legacy:getvar": "7 tea []",
    "legacy:setvar": "1",
    "legacy:setvar:after": "{\"x\":\"7\",\"word\":\"tea\",\"z\":\"1\"}",
    "legacy:globalvar": "blue",
    "legacy:unknown": "{{notAMacro}} and {{foo::bar}} and Mara",
    "legacy:escaped": "\\{\\{user\\}\\} Mara",
    "legacy:dynamic": "Ivo is quiet",
    "legacy:legacy-args": "Ivo/Lio/G1, G2/ORIG",
    "legacy:legacy-plain": "Mara and Ren: Ren is a courier who trusts Mara.",
    "legacy:legacy-group": "Ren, Lio, Mara | Ren, Ivo, Lio",
    "legacy:pick:again": "east east 2"
};

S.__naSet({ name1: NAME1, characters: structuredClone(CHARACTERS), main_api: MAIN_API });
PU.power_user.persona_description = PERSONA;

function setWorld(c) {
    G.__naSet(c.group ? { groups: [structuredClone(GROUP)], selected_group: GROUP.id } : { groups: [], selected_group: null });
    S.__naSet({ this_chid: '0', name2: 'Ren', chat_metadata: structuredClone(CHAT_METADATA) });
    E.__naSet({ extension_settings: { variables: { global: structuredClone(GLOBAL_VARS) } } });
}
const run = (c) => c.call === 'opts' ? S.substituteParams(c.text, c.opts ?? {}) : S.substituteParams(c.text, ...c.args);

for (const engine of ['new', 'legacy']) {
    const on = () => { PU.power_user.experimental_macro_engine = engine === 'new'; };
    for (const c of CASES) {
        test(`${engine} engine: ${c.id}`, () => {
            on();
            setWorld(c);
            if (c.kind === 'oneof') {
                assert.ok(c.oneof.includes(run(c)));
            } else if (c.kind === 'time') {
                const a = moment().format('LT'), got = run(c), b = moment().format('LT');
                assert.ok(got === a || got === b, got);
            } else {
                assert.equal(run(c), EXPECTED[`${engine}:${c.id}`]);
            }
        });
    }
    test(`${engine} engine: pick is the same for the same chat and text`, () => {
        on();
        const c = CASES.find(x => x.id === 'pick');
        setWorld(c);
        const first = run(c), second = run(c);
        assert.equal(first, second);
        assert.equal(second, EXPECTED[`${engine}:pick:again`]);
    });
    test(`${engine} engine: setvar writes chat_metadata.variables`, () => {
        on();
        const c = CASES.find(x => x.id === 'setvar');
        setWorld(c);
        run(c);
        assert.equal(JSON.stringify(S.chat_metadata.variables), EXPECTED[`${engine}:setvar:after`]);
    });
}
