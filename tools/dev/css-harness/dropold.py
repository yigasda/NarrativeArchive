# After the control shield covers every extension window and the panel, a control's own paint declarations (background, color,
# border…, radius, shadow, font family / spacing / case) can never show: the shield paints from the --c-* variables. This drops
# those old declarations from rules whose every selector is a control the shield covers (by tag or control-only class, never a
# phone selector, never a class the phone code uses, never a checkbox / radio / slider / file input), and only where the rule
# already carries the matching variables.   python3 tools/dev/css-harness/dropold.py [--write] <ctlclasses.json>
import re, sys, os, glob, json
sys.path.insert(0, os.path.dirname(__file__)); from rules import walk, split_top
import importlib.util
spec = importlib.util.spec_from_file_location('cv', os.path.join(os.path.dirname(__file__), 'ctlvars.py'))
src = open(os.path.join(os.path.dirname(__file__), 'ctlvars.py')).read().split("write = '--write' in sys.argv")[0].replace("sys.path.insert(0, os.path.dirname(__file__)); ", '')
ns = {}; sys.argv = [sys.argv[0]] + [a for a in sys.argv[1:]]; exec(src, ns)
kind, PHONE = ns['kind'], ns['PHONE']
ROOT = os.path.join(os.path.dirname(__file__), '../../..')
phone_src = ''.join(open(f).read() for f in glob.glob(f'{ROOT}/src/phone*.js') + glob.glob(f'{ROOT}/src/invest*.js'))
phone_cls = set(re.findall(r'[A-Za-z_][\w-]*', phone_src))
PAINT = re.compile(r'^\s*(background(-color|-image)?|color|border(-top|-bottom)?(-width|-style|-color)?|border-radius|box-shadow|font-family|letter-spacing|text-transform)\s*:', re.I)
VAR_OF = {'background': '--c-bg', 'background-color': '--c-bg', 'color': '--c-fg', 'border': '--c-bw', 'border-width': '--c-bw', 'border-style': '--c-bs', 'border-color': '--c-bc',
          'border-top': '--c-bwt', 'border-top-width': '--c-bwt', 'border-top-style': '--c-bst', 'border-top-color': '--c-bct', 'border-bottom': '--c-bwb', 'border-bottom-width': '--c-bwb',
          'border-bottom-style': '--c-bsb', 'border-bottom-color': '--c-bcb', 'border-radius': '--c-r', 'box-shadow': '--c-sh', 'font-family': '--c-ff', 'letter-spacing': '--c-ls', 'text-transform': '--c-tt'}
write = '--write' in sys.argv; n_rules = n_decl = n_imp = 0; edits = {}
for f, a, b, ctx, sel, body, t in walk():
    if '--c-' not in body or 'var(--c-bg, transparent)' in body or '@keyframes' in ctx: continue
    parts = split_top(sel.strip(), ',')
    ok = True
    for p in parts:
        if PHONE.search(re.sub(r':not\(:has\(\.na_phone\)\)', '', p)) or kind(p) != 'ctl': ok = False; break
        if any(c in phone_cls for c in re.findall(r'\.([A-Za-z_][\w-]*)', p)): ok = False; break
        if re.search(r'dialog\.popup:has\(\.na_phone|\.na_phone\b', p): ok = False; break
    if not ok: continue
    ds = split_top(body, ';'); have = {d.split(':', 1)[0].strip() for d in ds if d.strip().startswith('--c-')}
    keep = []; dropped = 0
    for d in ds:
        if PAINT.match(d):
            prop = d.split(':', 1)[0].strip().lower()
            if prop == 'background-image' or VAR_OF.get(prop) in have:
                dropped += 1; n_imp += '!important' in d; continue
        keep.append(d)
    if not dropped: continue
    n_rules += 1; n_decl += dropped
    multiline = '\n' in body
    kept = [k.strip() for k in keep if k.strip()]
    nb = ('\n    ' + ';\n    '.join(kept) + ';\n') if multiline else (' ' + '; '.join(kept) + '; ')
    edits.setdefault(f, []).append((a, b, t.split('{', 1)[0] + '{' + nb + '}'))
print(n_rules, 'rules,', n_decl, 'old declarations dropped,', n_imp, 'of them !important')
if write:
    for f, lst in edits.items():
        s = open(f, encoding='utf-8').read()
        for a, b, new in sorted(lst, key=lambda x: -x[0]): s = s[:a] + new + s[b:]
        open(f, 'w', encoding='utf-8').write(s)
