# Take !important off one css file and keep only the ones that change something.
#   python3 tools/dev/css-harness/impstrip.py css/42-home.css [--scenes a,b] [--iters 6]
# 1. baseline: the file as committed, captured with Blue Lemonade off and on (out/imp_<name>/base_off|base_on)
# 2. strip every !important in the file, capture again, compare element by element (hover / focus included)
# 3. for the elements that changed, ask the page which rules of this file reach them (each rule carries --imp-id while testing;
#    capture.cjs NA_WHO) and give those declarations their !important back; repeat until nothing changes
# The theme is switched by moving its folder in and out of SillyTavern's extensions (BL below). Needs SillyTavern on :8000.
import sys, os, re, json, shutil, subprocess, glob
sys.path.insert(0, os.path.dirname(__file__)); from rules import walk, split_top
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
EXT = os.path.expanduser('~/sillytavern/data/default-user/extensions')
BL_IN = os.path.join(EXT, 'blue-lemonade'); BL_OUT = os.environ.get('BL_PARK', os.path.join(ROOT, '..', 'bl-ext-parked'))
args = sys.argv[1:]; rel = args[0]; path = os.path.join(ROOT, rel); name = os.path.basename(rel).replace('.css', '')
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
WORK = os.path.join(os.path.dirname(__file__), 'out', 'imp_' + name); os.makedirs(WORK, exist_ok=True)
ORIG = os.path.join(WORK, 'orig.css')
if not os.path.exists(ORIG): shutil.copy(path, ORIG)
orig = open(ORIG, encoding='utf-8').read()
RULES = [(a, b, body) for f, a, b, ctx, sel, body, t in walk([ORIG]) if '@keyframes' not in ctx]
IMP = [i for i, (a, b, body) in enumerate(RULES) if '!important' in body]
INHERITED = {'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'white-space', 'visibility', 'word-break', 'overflow-wrap', 'cursor', 'fill', 'stroke'}

def pieces(body):
    out, depth, cur = [], 0, ''
    for ch in body:
        if ch in '([': depth += 1
        if ch in ')]': depth -= 1
        if ch == ';' and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    out.append(cur); return out

def build(keep, mark):
    out, pos = [], 0
    for i, (a, b, body) in enumerate(RULES):
        if i not in IMP: continue
        k = keep.get(str(i), [])
        decls = []
        for d in pieces(body):
            if '!important' in d and ':' in d:
                n = d.split(':', 1)[0].strip().lower()
                if not ('*' in k or any(x == n or x.startswith(n + '-') or (n.startswith('--') and x == n) for x in k)): d = re.sub(r'\s*!important', '', d)
            decls.append(d)
        nb = ';'.join(decls)
        if mark: nb = f' --imp-id: {i};' + nb
        seg = orig[a:b]; br = seg.index('{') + 1; end = seg.rindex('}')
        out.append(orig[pos:a]); out.append(seg[:br] + nb + seg[end:]); pos = b
    out.append(orig[pos:]); return ''.join(out)

def install(text):
    open(path, 'w', encoding='utf-8').write(text)
    dst = os.path.join(EXT, 'NarrativeArchive', 'css'); shutil.rmtree(dst, ignore_errors=True); shutil.copytree(os.path.join(ROOT, 'css'), dst)

def theme(on):
    if on and not os.path.exists(BL_IN): shutil.move(BL_OUT, BL_IN)
    if not on and os.path.exists(BL_IN): shutil.move(BL_IN, BL_OUT)

def capture(label, scenes, who=None):
    for th in ('off', 'on'):
        theme(th == 'on'); d = os.path.join(os.path.dirname(__file__), 'out', f'imp_{name}_{label}_{th}'); shutil.rmtree(d, ignore_errors=True)
        env = dict(os.environ)
        if who is not None:
            wf = os.path.join(WORK, f'who_{th}.json'); json.dump(who.get(th, {}), open(wf, 'w')); env['NA_WHO'] = wf
            sc = sorted({t.split('__')[0] for t in who.get(th, {})})
            if not sc: continue
        else: sc = scenes
        r = subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'capture.cjs'), f'imp_{name}_{label}_{th}', '--nopng', '--st', 'default', '--w', '412', '--only', ','.join(sc)], cwd=ROOT, env=env, capture_output=True, text=True)
        if 'captures →' not in r.stdout: print(r.stdout[-600:], r.stderr[-600:]); sys.exit('capture failed')
    theme(True)

def load(label, th):
    d = os.path.join(os.path.dirname(__file__), 'out', f'imp_{name}_{label}_{th}')
    return {f[:-5]: json.load(open(os.path.join(d, f))) for f in os.listdir(d) if f.endswith('.json') and not f.startswith(('_', 'who_'))}

def kebab(k): return re.sub(r'[A-Z]', lambda m: '-' + m.group(0).lower(), k)
def diffs(label):
    out = {}
    for th in ('off', 'on'):
        A, B = load('base', th), load(label, th)
        for tag, caps in B.items():
            base = {e['path']: e for e in A.get(tag, [])}
            for e in caps:
                o = base.get(e['path'])
                if not o or o['tag'] != e['tag']: continue
                keys = [k for k in e if k not in ('path', 'tag', 'cls', 'inter') and o.get(k) != e.get(k)]
                if keys: out.setdefault(th, {}).setdefault(tag, []).append((e['path'], keys))
    return out

def scenes_for():
    cls = set(re.findall(r'\.([A-Za-z_][\w-]*)', ' '.join(orig[a:orig.index('{', a)] for i, (a, b, body) in enumerate(RULES) if i in IMP)))
    ref = sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'out', 'nb10', '*__light__*.json')))
    pick = []
    for f in ref:
        seen = {c for e in json.load(open(f)) for c in e['cls'].split()}
        if seen & cls: pick.append(os.path.basename(f).split('__')[0])
    return pick

scenes = opt('--scenes').split(',') if opt('--scenes') else scenes_for()
print(name, len(IMP), 'rules with !important,', orig.count('!important'), 'in all ·', len(scenes), 'scenes:', ','.join(scenes), flush=True)
KEEP = os.path.join(WORK, 'keep.json'); keep = json.load(open(KEEP)) if os.path.exists(KEEP) else {}
if not os.path.exists(os.path.join(os.path.dirname(__file__), 'out', f'imp_{name}_base_on', '_done.json')):
    install(build({str(i): ['*'] for i in IMP}, False)); capture('base', scenes)
for it in range(int(opt('--iters', 6))):
    install(build(keep, True)); capture('try', scenes)
    dd = diffs('try'); n = sum(len(v) for th in dd.values() for v in th.values())
    print(f'round {it + 1}: {build(keep, False).count("!important")} left · {n} changed elements', flush=True)
    if not n: break
    who = {th: {tag: [{'path': p, 'props': ['*'] if any(k in ('w', 'h', 'hover', 'focus') or k.startswith('::') for k in ks) else [kebab(k) for k in ks],
                        'up': 8 if any(kebab(k) in INHERITED for k in ks) else 0} for p, ks in items] for tag, items in tags.items()} for th, tags in dd.items()}
    capture('who', scenes, who); grew = 0
    for th in ('off', 'on'):
        d = os.path.join(os.path.dirname(__file__), 'out', f'imp_{name}_who_{th}')
        for f in glob.glob(os.path.join(d, 'who_*.json')):
            for rid, props in json.load(open(f)).items():
                cur = set(keep.get(rid, [])); new = cur | set(props)
                if new != cur: keep[rid] = sorted(new); grew += 1
    json.dump(keep, open(KEEP, 'w'), indent=1)
    if not grew:
        print('the changed elements are not reached by a rule of this file; giving those scenes every !important back')
        for th in dd.values():
            for tag in th: pass
        keep = {str(i): ['*'] for i in IMP}; break
final = build(keep, False); install(final)
print('done:', orig.count('!important'), '→', final.count('!important'), flush=True)
