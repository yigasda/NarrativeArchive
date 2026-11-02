// style.css stays within its budget: line count, forced priorities (!important, :not(#na_x)) and both-theme selectors may not grow.
// The numbers live in tests/css.budget.json; lower them when a cleanup step lands, never raise them to make a change fit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const budget = JSON.parse(readFileSync(new URL('./css.budget.json', import.meta.url), 'utf8'));
const count = re => (css.match(re) || []).length;
const now = {
    lines: css.split('\n').length - (css.endsWith('\n') ? 1 : 0), // what wc -l counts
    important: count(/!important/g),
    notx: count(/:not\(#na_x\)/g),
    bothThemes: count(/body:is\(\.na_darkui, :not\(\.na_darkui\)\)/g),
};
for (const k of Object.keys(now)) {
    test(`style.css ${k}: ${now[k]} ≤ ${budget[k]}`, () => {
        assert.ok(now[k] <= budget[k], `${k} grew to ${now[k]} (budget ${budget[k]}). Fold the rule into its block instead of adding a stronger copy — docs/CSS-CLEANUP-PLAN.md`);
    });
}
test('no new window block is appended after the file\'s last shared block', () => {
    // the tail of the file is where overrides used to pile up: a heading there that names a window version is the old habit coming back
    const tail = css.split('\n').slice(-40).join('\n');
    assert.ok(!/^\/\*.*\(3\.\d+\.\d+\)/m.test(tail) || budget.allowTailVersions, 'a versioned block sits at the end of style.css: put it with its window\'s block');
});
