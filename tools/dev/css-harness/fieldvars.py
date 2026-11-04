# (copied from ctlvars.py) Move control paint into the control shield's variables. For every rule whose subject is a control (button / label / input /
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

# Field metrics (padding, min-height, font-size, line-height) next to their --f-* variables, so the field shield in
# 69-components.css can hold them against a theme's !important form rules. The original declaration stays.
SIDES = ('--f-pt', '--f-pr', '--f-pb', '--f-pl')
def box4(v):
    t = [x for x in split_top(v.strip(), ' ') if x]
    if len(t) == 1: t = t * 4
    elif len(t) == 2: t = [t[0], t[1], t[0], t[1]]
    elif len(t) == 3: t = [t[0], t[1], t[2], t[1]]
    return t[:4]
def to_vars(prop, val):
    imp = ' !important' if '!important' in val else ''; v = val.replace('!important', '').strip(); p = prop.lower()
    if p == 'padding': return list(zip(SIDES, box4(v))), imp
    if p in ('padding-top', 'padding-right', 'padding-bottom', 'padding-left'): return [(SIDES[('top', 'right', 'bottom', 'left').index(p[8:])], v)], imp
    if p in ('padding-inline', 'padding-block'):
        t = [x for x in split_top(v, ' ') if x]; a, b = t[0], t[-1]
        return ([('--f-pl', a), ('--f-pr', b)] if p == 'padding-inline' else [('--f-pt', a), ('--f-pb', b)]), imp
    if p == 'min-height': return [('--f-mh', v)], imp
    if p == 'font-size': return [('--f-fs', v)], imp
    if p == 'line-height': return [('--f-lh', v)], imp
    return None, imp
write = '--write' in sys.argv; n_rules = n_decls = 0; edits = {}
for f, a, b, ctx, sel, body, t in walk():
    if '@keyframes' in ctx: continue
    parts = split_top(sel.strip(), ',')
    kinds = [kind(p) if not PHONE.search(re.sub(r':not\(:has\(\.na_phone\)\)', '', p)) else None for p in parts]
    if not any(kinds): continue
    if 'var(--f-pt' in body: continue  # the shield itself
    if re.search(r'(^|;)\s*--f-', body): continue  # already done
    decls = split_top(body, ';'); conv = []; touched = False
    for d in decls:
        if ':' not in d or d.strip().startswith('--'): conv.append((d, None)); continue
        prop, val = d.split(':', 1); vs, imp = to_vars(prop.strip(), val)
        if vs is None: conv.append((d, None)); continue
        conv.append((d, [f'{k}: {x}{imp}' for k, x in vs])); touched = True
    if not touched: continue
    groups = {}
    for p, k in zip(parts, kinds): groups.setdefault(bool(k), []).append(p.strip())
    lead = sel[:len(sel) - len(sel.lstrip())]; out = []; multiline = '\n' in body
    for k in (False, True):
        if k not in groups: continue
        bd = []
        for d, vs in conv:
            if d.strip(): bd.append(d.strip())
            if k and vs: bd += vs
        s2 = ', '.join(groups[k])
        out.append(s2 + (' {\n    ' + ';\n    '.join(bd) + ';\n}' if multiline else ' { ' + '; '.join(bd) + '; }'))
    n_rules += 1; n_decls += sum(1 for d, vs in conv if vs)
    edits.setdefault(f, []).append((a, b, lead + '\n'.join(out)))
print(n_rules, 'rules,', n_decls, 'field declarations got a --f-* twin')
if write:
    for f, lst in edits.items():
        s = open(f, encoding='utf-8').read()
        for a, b, new in sorted(lst, key=lambda x: -x[0]): s = s[:a] + new + s[b:]
        open(f, 'w', encoding='utf-8').write(s)
