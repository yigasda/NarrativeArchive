# Phone shield step: next to each phone rule's text declarations on buttons / labels (colour, font family, size, letter spacing, case,
# corners) and on spans (font size), add the matching phone variable, same rule, same place, same !important. The phone shield in
# css/69-components.css reads only the variables, so a theme that sizes or paints every span / button with !important can't reach in.
# The old declarations stay until a later clean-up.   python3 tools/dev/css-harness/phonevars.py [--write] <tagmap.json>
import re, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from rules import walk, split_top, subject
TAGS = {k: set(v) for k, v in json.load(open(sys.argv[-1])).items()}
PHONE = re.compile(r'\.(ax|axb|cg|pcf|na_phone)(?![\w-])|\.(ax|cg|cd|dv|lf|iv|ir|wb|sc|na_ph)_[\w-]*|:has\(\.na_phone\)(?!\))')
CTL = {'button', 'label'}
def strip(sj): return re.sub(r':(not|has|where|is)\((?:[^()]|\([^()]*\))*\)', '', sj)
def kinds(part):
    sj = subject(part)
    if '::' in sj: return set()
    base = strip(sj); tag = re.match(r'^[a-z][a-z0-9]*', base); tag = tag.group(0) if tag else None
    if tag: return ({'ctl'} if tag in CTL else set()) | ({'span'} if tag == 'span' else set())
    if not base: return set()
    return {'ctl', 'span'}   # classes the code builds at run time: unknown tag, so both (a variable is harmless where unused)
CTLMAP = {'color': '--axfg', 'font-family': '--axff', 'font-size': '--axfs', 'letter-spacing': '--axls', 'text-transform': '--axtt', 'border-radius': '--axr'}
def font_short(v):
    v = v.strip()
    if v in ('inherit', 'initial', 'unset'): return v, v
    toks = split_top(v, ' ')
    for i, t in enumerate(toks):
        if re.match(r'^[\d.]+(px|em|rem|%)(/.*)?$', t) or t in ('small', 'medium', 'large', 'larger', 'smaller'):
            return t.split('/')[0], ' '.join(toks[i + 1:]) or None
    return None, None
write = '--write' in sys.argv; edits = {}; n = 0; warn = []
for f, a, b, ctx, sel, body, t in walk():
    if '@keyframes' in ctx or re.search(r'var\(--ax(bg|fs|fg), (transparent|inherit)\) !important', body): continue   # the shield rules
    parts = split_top(sel.strip(), ',')
    ks = set()
    for p in parts:
        ks |= kinds(p)   # every rule: a shared part (a face, a number) shows inside the phone too; the variable is harmless elsewhere
    if not ks: continue
    ds = split_top(body, ';'); out = []; ch = False
    have = {d.split(':', 1)[0].strip() for d in ds if d.strip().startswith('--ax')}
    for d in ds:
        out.append(d)
        if ':' not in d or d.strip().startswith('--'): continue
        p, v = d.split(':', 1); p = p.strip().lower(); imp = ' !important' if '!important' in v else ''; v = v.replace('!important', '').strip()
        if re.search(r'var\(--ax(fg|ff|fs|ls|tt|r)\b', v): continue   # already reads a text variable
        add = []
        if p == 'font':
            sz, fam = font_short(v)
            if sz is None: warn.append(f'{os.path.basename(f)}: {sel.strip()[:60]} font: {v}'); continue
            if 'ctl' in ks or 'span' in ks: add.append(('--axfs', sz))
            if 'ctl' in ks and fam: add.append(('--axff', fam))
        elif p == 'font-size' and ('ctl' in ks or 'span' in ks): add.append(('--axfs', v))
        elif p in CTLMAP and 'ctl' in ks: add.append((CTLMAP[p], v))
        for k, x in add:
            if k in have: continue
            out.append(f' {k}: {x}{imp}'); ch = True
    if ch:
        n += 1; edits.setdefault(f, []).append((a, b, t.replace(body, ';'.join(out), 1)))
print(n, 'rules got phone variables'); [print('  ?', w) for w in warn[:12]]
if write:
    for f, lst in edits.items():
        s = open(f, encoding='utf-8').read()
        for a, b, new in sorted(lst, key=lambda x: -x[0]): s = s[:a] + new + s[b:]
        open(f, 'w', encoding='utf-8').write(s)
