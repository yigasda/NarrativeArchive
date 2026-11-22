# NOTICE

NarrativeArchive is licensed under the GNU Affero General Public License v3.0 (see `LICENSE`).

## Marinara Engine

The files under `src/marinara/` and `plugin/marinara/` are ported from
[Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine) (version 2.5.2, commit fc0333c).

    Marinara Engine
    Copyright (C) 2025-2026 Spicy Marinara
    Licensed under the GNU Affero General Public License v3.0.

Each ported file names the Marinara file it came from and what was changed.
"Marinara Engine" and its marks belong to their owners; this project is not affiliated with or endorsed by them.

## SillyTavern

`src/stprofile.js` copies three small functions from [SillyTavern](https://github.com/SillyTavern/SillyTavern) 1.19.1
(`extractMessageFromData` from `public/script.js`, `extractReasoningFromData` from `public/scripts/reasoning.js`, and the
stop-string trimming of `TextCompletionService.processRequest` from `public/scripts/custom-request.js`), and
`src/phone2stlevel.js` mirrors its reasoning-effort rules. The file names the lines it came from.

    SillyTavern
    Licensed under the GNU Affero General Public License v3.0.

## Lucide

Some icons in the Orbit messenger (`src/phoneorbit.js`, `LU`) are taken from [Lucide](https://lucide.dev).

    ISC License
    Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
    All other copyright (c) for Lucide are held by Lucide Contributors 2022.

    Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
    granted, provided that the above copyright notice and this permission notice appear in all copies.
