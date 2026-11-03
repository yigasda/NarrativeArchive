# Rules that can never match: a class the selector needs (outside any parentheses) appears nowhere in our code (src/, index.js)
# nor in SillyTavern's public/ files. Classes built in code from a prefix (`na_ly_tok_${t}`) count as present.
#   python3 tools/dev/css-harness/deadclass.py            → list
#   python3 tools/dev/css-harness/deadclass.py --write    → delete those rules (or the dead parts of a selector list)
import re, sys, os, glob
ROOT = os.path.join(os.path.dirname(__file__), '../../..')
ST = os.path.expanduser('~/sillytavern/public')
ours = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(f'{ROOT}/src/*.js') + [f'{ROOT}/index.js'])
theirs = []
for ext in ('js', 'html', 'mjs'):
    for f in glob.glob(f'{ST}/**/*.{ext}', recursive=True):
        if '/extensions/third-party/' in f: continue
        try: theirs.append(open(f, encoding='utf-8', errors='ignore').read())
        except Exception: pass
theirs = ''.join(theirs)
prefixes = set(re.findall(r'([A-Za-z][\w-]*)\$\{', ours)) | set(re.findall(r'[\'"`]([A-Za-z][\w-]*)[\'"`]\s*\+', ours))
cache = {}
def live(c):
    if c not in cache:
        cache[c] = bool(re.search(r'(?<![\w-])' + re.escape(c) + r'(?![\w-])', ours)) or any(c.startswith(p) for p in prefixes) or bool(re.search(r'(?<![\w-])' + re.escape(c) + r'(?![\w-])', theirs))
    return cache[c]
def top_classes(sel):
    out, depth, i = [], 0, 0
    while i < len(sel):
        ch = sel[i]
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        elif ch == '.' and depth == 0:
            m = re.match(r'\.(-?[_a-zA-Z][\w-]*)', sel[i:])
            if m: out.append(m.group(1)); i += len(m.group(0)); continue
        i += 1
    return out
def split_list(sel):
    parts, depth, cur = [], 0, ''
    for ch in sel:
        if ch == '(': depth += 1
        if ch == ')': depth -= 1
        if ch == ',' and depth == 0: parts.append(cur); cur = ''
        else: cur += ch
    parts.append(cur); return parts
write = '--write' in sys.argv
total = 0
for f in sorted(glob.glob(f'{ROOT}/css/*.css')):
    s = open(f, encoding='utf-8').read(); out = []; i = 0; n = len(s); changed = False
    # walk: copy comments and at-rule heads as they are; look at each "selector { ... }" whose body has no nested braces
    pat = re.compile(r'/\*.*?\*/|@[^{;]*[;{]|\}|[^{}@/]+\{[^{}]*\}|[\s\S]', re.S)
    for m in pat.finditer(s):
        t = m.group(0)
        if '{' in t and not t.startswith(('@', '/*')) and t.rstrip().endswith('}'):
            sel, body = t.split('{', 1)
            lead = sel[:len(sel) - len(sel.lstrip())]
            parts = split_list(sel.strip())
            dead = [p for p in parts if any(not live(c) for c in top_classes(p))]
            if dead and len(parts) and not re.search(r'@keyframes', s[max(0, m.start()-200):m.start()]):
                total += 1
                print(f'{os.path.basename(f)}: {"ALL " if len(dead) == len(parts) else "PART"} {sel.strip()[:150]}  [{", ".join(sorted({c for p in dead for c in top_classes(p) if not live(c)}))}]')
                if write:
                    changed = True
                    keep = [p.strip() for p in parts if p not in dead]
                    if not keep:
                        # drop the rule and the line break after it
                        continue
                    t = lead + ', '.join(keep) + ' {' + body
        out.append(t)
    if write and changed:
        res = ''.join(out); res = re.sub(r'\n{3,}', '\n\n', res)
        # a rule removed from a line of its own leaves an empty line: fold "\n\n" left by it only where the removed text sat
        open(f, 'w', encoding='utf-8').write(res)
print('rules with a dead part:', total)
