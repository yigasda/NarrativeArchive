# Declarations that can never win: the same selector (exact text, same @media context) sets the same property again later,
# at the same or a stronger importance. Same selector = same elements and same specificity, so the later one always wins.
#   python3 tools/dev/css-harness/dupedecl.py [--write]
import re, sys, glob, os
ROOT = os.path.join(os.path.dirname(__file__), '../../..')
files = sorted(glob.glob(f'{ROOT}/css/*.css'))
pat = re.compile(r'/\*.*?\*/|@[^{;]*\{|@[^{;]*;|\}|[^{}@/]+\{[^{}]*\}|[\s\S]', re.S)
def norm(sel): return re.sub(r'\s+', ' ', sel.strip())
def decls(body):
    out, depth, cur = [], 0, ''
    for ch in body:
        if ch == '(': depth += 1
        if ch == ')': depth -= 1
        if ch == ';' and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur)
    return out
rules = []  # (file, start, end, ctx, sel, body)
texts = {}
for f in files:
    s = open(f, encoding='utf-8').read(); texts[f] = s; ctx = []
    for m in pat.finditer(s):
        t = m.group(0)
        if t.startswith('@') and t.endswith('{'): ctx.append(t.strip()); continue
        if t == '}' and ctx: ctx.pop(); continue
        if '{' in t and not t.startswith(('@', '/*')):
            sel, body = t.split('{', 1); body = body.rsplit('}', 1)[0]
            rules.append((f, m.start(), m.end(), '|'.join(ctx), norm(sel), body, t))
seen_later = {}  # key (ctx, sel) -> {prop: important}
kill = {}  # rule index -> set of decl indexes
for idx in range(len(rules) - 1, -1, -1):
    f, a, b, ctx, sel, body, t = rules[idx]
    if any(k in ctx for k in ('@keyframes', '@font-face')): continue
    later = seen_later.setdefault((ctx, sel), {})
    ds = decls(body)
    for j, d in enumerate(ds):
        if ':' not in d or d.strip().startswith('--') and False: pass
        if ':' not in d: continue
        prop, val = d.split(':', 1); prop = prop.strip().lower(); imp = '!important' in val
        if not prop or prop.startswith('/*'): continue
        if prop in later and (later[prop] or not imp): kill.setdefault(idx, set()).add(j)
    for d in ds:
        if ':' not in d: continue
        prop, val = d.split(':', 1); prop = prop.strip().lower(); imp = '!important' in val
        later[prop] = later.get(prop, False) or imp
n = sum(len(v) for v in kill.values()); print('declarations that never win:', n, 'in', len(kill), 'rules')
for idx in sorted(kill)[:15]:
    f, a, b, ctx, sel, body, t = rules[idx]; ds = decls(body)
    print(os.path.basename(f), sel[:90], '→', '; '.join(ds[j].strip()[:40] for j in sorted(kill[idx])))
if '--write' in sys.argv:
    by_file = {}
    for idx, js in kill.items(): by_file.setdefault(rules[idx][0], []).append((idx, js))
    for f, lst in by_file.items():
        s = texts[f]
        for idx, js in sorted(lst, key=lambda x: -rules[x[0]][1]):
            _, a, b, ctx, sel, body, t = rules[idx]; ds = decls(body)
            keep = [d.strip() for j, d in enumerate(ds) if j not in js and d.strip()]
            head = t.split('{', 1)[0]
            if keep:
                multiline = '\n' in body
                new = head + '{ ' + '; '.join(keep) + '; }' if not multiline else head + '{\n    ' + ';\n    '.join(keep) + ';\n}'
                s = s[:a] + new + s[b:]
            else:
                # drop the whole rule with its line
                lead = len(head) - len(head.lstrip()); a2 = a + lead
                end = b + (1 if s[b:b+1] == '\n' else 0)
                s = s[:a2] + s[end:]
        open(f, 'w', encoding='utf-8').write(s)
