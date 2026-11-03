# Step 4-4: every --na-* definition in one block at the top of style.css.
#   python3 -I tools/dev/css-harness/varblock.py            # dry run: what moves, what goes
#   python3 -I tools/dev/css-harness/varblock.py --write
# What it does (each one was checked by reading the cascade, and the harness confirms it):
#  - deletes the three fallback blocks (#na_settings / .na_popup / .na_popup,.na_v2 at the top): the light/dark palette sets every one of
#    their variables on the same elements with a stronger selector, and body is always either .na_darkui or not, so they never apply;
#  - deletes the "dark popups" variable block: its values equal the dark palette's, on elements the palette already covers;
#  - moves the palette pair, the home-tab override (and its .na_v2 line), the dialog.popup.na_px pair and the body-level --na-onaccent
#    to the top, in that order. Nothing between their old and new places sets the same variables on the same elements.
# Window-scoped variables (.na_st, .na_qc) stay with their window.
import re, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); CSS = os.path.join(ROOT, 'style.css')
L = open(CSS).read().split('\n')
if L[-1] == '': L.pop()
def block_at(i):
    # a rule starting at line i: one line, or up to its closing brace
    if re.search(r'\}\s*(/\*.*\*/)?\s*$', L[i]) and '{' in L[i]: return i, i
    j = i
    while not L[j].startswith('}'): j += 1
    return i, j
def find(pred, start=0):
    for i in range(start, len(L)):
        if pred(L[i]): return i
    raise SystemExit('not found')
take = []   # (start, end, role)
# fallback blocks
take.append((*block_at(find(lambda l: l == '#na_settings {')), 'drop'))
take.append((*block_at(find(lambda l: l == '.na_popup {')), 'drop'))
take.append((*block_at(find(lambda l: l == '.na_popup, .na_v2 {')), 'drop'))
# palette pair (with its heading comment)
pl = find(lambda l: l.startswith('body:not(.na_darkui) #na_settings, body:not(.na_darkui) .na_popup, body:not(.na_darkui) .na_v2'))
pd = find(lambda l: l.startswith('body.na_darkui #na_settings, body.na_darkui .na_popup, body.na_darkui .na_v2'))
head = pl - 1 if L[pl - 1].startswith('/* ============ mockup palette') else pl
take.append((head, block_at(pl)[1], 'move:1'))
take.append((*block_at(pd), 'move:2'))
# home tab override: two blocks + two .na_v2 lines
hl = find(lambda l: l.startswith('body:not(.na_darkui) #na_settings :is(.inline-drawer-header, #na_meter, .na_nav, .na_tab_pane[data-pane="home"]) {'))
hhead = hl - 1 if L[hl - 1].startswith('/* ============ home tab') else hl
hd = find(lambda l: l.startswith('body.na_darkui #na_settings :is(.inline-drawer-header, #na_meter, .na_nav, .na_tab_pane[data-pane="home"]) {'))
hv1 = find(lambda l: l.startswith('body:not(.na_darkui) #na_settings :is(.inline-drawer-header, #na_meter, .na_nav, .na_tab_pane[data-pane="home"]) .na_v2 {'))
hv2 = find(lambda l: l.startswith('body.na_darkui #na_settings :is(.inline-drawer-header, #na_meter, .na_nav, .na_tab_pane[data-pane="home"]) .na_v2 {'))
take += [(hhead, block_at(hl)[1], 'move:3'), (*block_at(hd), 'move:4'), (*block_at(hv1), 'move:5'), (*block_at(hv2), 'move:6')]
# dark popups variable block (drop) — the comment line above it stays only if other rules follow it
dp = find(lambda l: l.startswith('body.na_darkui dialog.popup:has(.na_popup) :is(.na_popup, .na_popup .na_v2), body.na_darkui dialog.popup:has(.na_confirm) .na_confirm {'))
take.append((*block_at(dp), 'drop'))
# na_px pair and body-level onaccent
px1 = find(lambda l: l.startswith('body:not(.na_darkui) dialog.popup.na_px {')); px2 = find(lambda l: l.startswith('body.na_darkui dialog.popup.na_px {'))
on = find(lambda l: l.startswith('body.na_darkui { --na-onaccent: #1B1B1F; }'))
onhead = on - 1 if L[on - 1].startswith('/* 3.169.30: dark') else on
take += [(px1, px1, 'move:7'), (px2, px2, 'move:8'), (onhead, on, 'move:9')]
# guard: the moved/dropped ranges must not overlap
spans = sorted((a, b) for a, b, _ in take)
for (a1, b1), (a2, b2) in zip(spans, spans[1:]): assert b1 < a2, ('overlap', a1, b1, a2, b2)
moved = {int(r.split(':')[1]): L[a:b + 1] for a, b, r in take if r.startswith('move')}
dropped = sum(b - a + 1 for a, b, r in take if r == 'drop')
out = []
idx = {i for a, b, _ in take for i in range(a, b + 1)}
top = ['/* ============ variables: every --na-* in one place — the light / dark palette, the home tab (which follows the SillyTavern theme),',
       '   the popup frame (dialog.popup.na_px, for the buttons outside .na_popup) and the body-level text-on-accent. Window-only ones (.na_st, .na_qc) live with their window. */']
for k in sorted(moved): top += [l for l in moved[k] if not (l.startswith('/* ============ mockup palette') or l.startswith('/* ============ home tab'))]
top.append('')
first = next(i for i, l in enumerate(L) if i not in idx and l.strip())   # the file's first line that stays (its title comment)
for i, l in enumerate(L):
    if i in idx: continue
    out.append(l)
    if i == first: out += top
# collapse runs of blank lines
txt = re.sub(r'\n\n\n+', '\n\n', '\n'.join(out)) + '\n'
print(f'moved {sum(len(v) for v in moved.values())} lines to the top, dropped {dropped} lines; style.css {len(L)} → {txt.count(chr(10))} lines')
if '--write' in sys.argv: open(CSS, 'w').write(txt)
