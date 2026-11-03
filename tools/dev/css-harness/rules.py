# shared CSS rule walker for css/*.css: yields (file, start, end, ctx, selector, body, text)
import re, glob, os
ROOT = os.path.join(os.path.dirname(__file__), '../../..')
PAT = re.compile(r'/\*.*?\*/|@[^{;]*\{|@[^{;]*;|\}|[^{}@/]+\{[^{}]*\}|[\s\S]', re.S)
def walk(files=None):
    for f in files or sorted(glob.glob(f'{ROOT}/css/*.css')):
        s = open(f, encoding='utf-8').read(); ctx = []
        for m in PAT.finditer(s):
            t = m.group(0)
            if t.startswith('@') and t.endswith('{'): ctx.append(t.strip()); continue
            if t == '}' and ctx: ctx.pop(); continue
            if '{' in t and not t.startswith(('@', '/*')):
                sel, body = t.split('{', 1); body = body.rsplit('}', 1)[0]
                yield f, m.start(), m.end(), '|'.join(ctx), sel, body, t
def split_top(s, sep):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '([': depth += 1
        if ch in ')]': depth -= 1
        if ch == sep and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur)
    return out
def subject(part):
    # last compound of a complex selector (split on combinators at depth 0)
    depth, last, i = 0, 0, 0
    p = part.strip()
    for i, ch in enumerate(p):
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        elif depth == 0 and ch in ' >+~': last = i + 1
    return p[last:].strip()
