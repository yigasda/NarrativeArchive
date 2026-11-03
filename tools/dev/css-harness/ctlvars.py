# Move control paint into the control shield's variables. For every rule whose subject is a control (button / label / input /
# textarea / select, by tag or by a class the code only puts on those), each paint declaration becomes the matching --c-*
# declaration, same rule, same place, same !important — so the variable cascades exactly as the property did, and the shield
# (69-components.css) paints it. Subjects whose class is also on other tags keep the original next to the variable.
# Phone rules are left alone. Usage: python3 tools/dev/css-harness/ctlvars.py [--write] <ctlclasses.json>
import re, sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); from rules import walk, split_top, subject
SCOPE = sys.argv[sys.argv.index('--scope') + 1] if '--scope' in sys.argv else None
C = json.load(open(sys.argv[-1])); ONLY, MIXED, NON, IDS = set(C['only']), set(C['mixed']), set(C.get('non', [])), set(C.get('ids', []))
CTL_TAGS = ('button', 'label', 'input', 'textarea', 'select')
PHONE = re.compile(r'\.(ax|axb|cg|pcf|na_phone)(?![\w-])|\.(ax|cg|cd|dv|lf|iv|ir|wb|na_ph)_[\w-]*|:has\(\.na_phone\)(?!\))')
WIDTH = re.compile(r'^(0|thin|medium|thick|[\d.]+(px|em|rem|%))$')
STYLES = {'none','hidden','dotted','dashed','solid','double','groove','ridge','inset','outset'}
def kind_compound(base):
    tag = re.match(r'^[a-z]+', base); tag = tag.group(0) if tag else None
    classes = re.findall(r'\.([A-Za-z_][\w-]*)', base)
    if re.search(r'type="?(checkbox|radio|range|file|color)', base) or any(c in NON for c in classes): return 'non'
    if tag in CTL_TAGS: return 'ctl'
    if tag and tag not in CTL_TAGS: return None
    if any(c in ONLY for c in classes): return 'ctl'
    if any(c in MIXED for c in classes): return 'mixed'
    if any(i in IDS for i in re.findall(r'#([A-Za-z_][\w-]*)', base)): return 'ctl'
    return None
def kind(part):
    sj = subject(part)
    if '::' in sj: return None
    if re.search(r'type="?(checkbox|radio)', re.sub(r':not\((?:[^()]|\([^()]*\))*\)', '', sj)): return None
    inner = []
    for m in re.finditer(r':is\(', sj):
        depth, i = 1, m.end()
        while depth and i < len(sj):
            depth += {'(': 1, ')': -1}.get(sj[i], 0); i += 1
        inner.append(sj[m.end():i - 1])
    base = re.sub(r':(not|has|where)\((?:[^()]|\([^()]*\))*\)', '', sj)
    base_wo_is = re.sub(r':is\((?:[^()]|\([^()]*\))*\)', '', base)
    k0 = kind_compound(base_wo_is)
    if k0 == 'non': return None
    if k0: return k0
    alts = [kind_compound(subject(x)) for blk in inner for x in split_top(blk, ',')]
    alts = [a for a in alts]
    if not alts or 'non' in alts: return None
    if all(a == 'ctl' for a in alts): return 'ctl'
    if any(a in ('ctl', 'mixed') for a in alts): return 'mixed'
    return None
def border_parts(v):
    w, s, c = '0', 'none', 'currentcolor'; got = []
    for tok in split_top(v.strip(), ' '):
        if not tok: continue
        if WIDTH.match(tok): w = tok; got.append('w')
        elif tok in STYLES: s = tok; got.append('s')
        else: c = (c if 'c' in got else '') + tok if False else tok; got.append('c')
    if 's' in got and 'w' not in got: w = 'medium'
    return w, s, c
def to_vars(prop, val):
    imp = ' !important' if '!important' in val else ''; v = val.replace('!important', '').strip()
    p = prop.lower()
    if p in ('background', 'background-color'): return [('--c-bg', v)], imp
    if p == 'color': return [('--c-fg', v)], imp
    if p == 'border': w, s, c = border_parts(v); return [('--c-bw', w), ('--c-bs', s), ('--c-bc', c), ('--c-bwt', w), ('--c-bst', s), ('--c-bct', c)], imp
    if p == 'border-top': w, s, c = border_parts(v); return [('--c-bwt', w), ('--c-bst', s), ('--c-bct', c)], imp
    if p == 'border-width': return [('--c-bw', v), ('--c-bwt', v.split()[0])], imp
    if p == 'border-style': return [('--c-bs', v), ('--c-bst', v.split()[0])], imp
    if p == 'border-color': return [('--c-bc', v), ('--c-bct', split_top(v, ' ')[0])], imp
    if p == 'border-top-color': return [('--c-bct', v)], imp
    if p == 'border-top-width': return [('--c-bwt', v)], imp
    if p == 'border-radius': return [('--c-r', v)], imp
    if p == 'box-shadow': return [('--c-sh', v)], imp
    if p == 'font-family': return [('--c-ff', v)], imp
    if p == 'letter-spacing': return [('--c-ls', v)], imp
    if p == 'text-transform': return [('--c-tt', v)], imp
    return None, imp
write = '--write' in sys.argv; stats = {'rules': 0, 'decls': 0, 'kept': 0, 'skipped': []}
edits = {}
for f, a, b, ctx, sel, body, t in walk():
    if '@keyframes' in ctx: continue
    parts = split_top(sel.strip(), ',')
    kinds = [kind(p) if not PHONE.search(re.sub(r':not\(:has\(\.na_phone\)\)', '', p)) else None for p in parts]
    if SCOPE == 'all':
        kinds = ['mixed' if k else None for k in kinds]
    if SCOPE == 'panel':
        def pk(p, k):
            if not k: return None
            if re.search(r'dialog\.popup|\.na_popup|na_ap3_dlg|:has\(\.na_', p): return None
            return 'ctl' if '#na_settings' in p and k == 'ctl' else 'mixed'
        kinds = [pk(p, k) for p, k in zip(parts, kinds)]
    if not any(kinds): continue
    if 'var(--c-' in body and '!important' in body and '--c-bg, transparent' in body: continue  # the shield itself
    if re.search(r'(^|;)\s*--c-', body): continue  # already moved
    decls = split_top(body, ';')
    conv = []; touched = False
    for d in decls:
        if ':' not in d or d.strip().startswith('--'): conv.append((d, None)); continue
        prop, val = d.split(':', 1); vs, imp = to_vars(prop.strip(), val)
        if vs is None: conv.append((d, None)); continue
        if prop.strip().lower() in ('background',) and re.search(r'url\(|gradient\(', val) and False: pass
        conv.append((d, [f'{k}: {x}{imp}' for k, x in vs])); touched = True
    if not touched: continue
    groups = {}
    for p, k in zip(parts, kinds): groups.setdefault(k, []).append(p.strip())
    lead = sel[:len(sel) - len(sel.lstrip())]; out = []
    def body_for(k):
        res = []
        for d, vs in conv:
            if vs is None: res.append(d.strip())
            else:
                if k != 'ctl': res.append(d.strip())
                if k in ('ctl', 'mixed'): res += vs
        return [x for x in res if x]
    multiline = '\n' in body
    for k in [None, 'mixed', 'ctl']:
        if k not in groups: continue
        bd = body_for(k)
        if not bd: continue
        s2 = ', '.join(groups[k])
        out.append(s2 + (' {\n    ' + ';\n    '.join(bd) + ';\n}' if multiline else ' { ' + '; '.join(bd) + '; }'))
    stats['rules'] += 1; stats['decls'] += sum(1 for d, vs in conv if vs)
    edits.setdefault(f, []).append((a, b, lead + '\n'.join(out)))
print(stats['rules'], 'rules,', stats['decls'], 'paint declarations moved to variables')
if write:
    for f, lst in edits.items():
        s = open(f, encoding='utf-8').read()
        for a, b, new in sorted(lst, key=lambda x: -x[0]): s = s[:a] + new + s[b:]
        open(f, 'w', encoding='utf-8').write(s)
