# old (HEAD) vs new (working copy) of one css file under one ST theme, for some scenes:
#   python3 tools/dev/css-harness/cmpgen.py css/X.css default|hostile scene1,scene2   → DIFF lines, then 'done N changed'
import os, sys, json, shutil, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); H = ROOT + '/tools/dev/css-harness'; rel, st, SC = sys.argv[1], sys.argv[2], sys.argv[3]
EXT = os.path.expanduser('~/sillytavern/data/default-user/extensions'); path = ROOT + '/' + rel
new = open(path, encoding='utf-8').read(); old = subprocess.run(['git', 'show', 'HEAD:' + rel], cwd=ROOT, capture_output=True, text=True).stdout
def install(text):
    open(path, 'w', encoding='utf-8').write(text); d = EXT + '/NarrativeArchive/css'; shutil.rmtree(d, ignore_errors=True); shutil.copytree(ROOT + '/css', d)
try:
    for lab, text in (('gold', old), ('gnew', new)):
        install(text); shutil.rmtree(H + '/out/' + lab, ignore_errors=True)
        r = subprocess.run(['node', H + '/capture.cjs', lab, '--nopng', '--st', st, '--w', '412', '--only', SC], cwd=ROOT, capture_output=True, text=True)
        print(lab, (r.stdout.strip().splitlines() or [r.stderr[-300:]])[-1], flush=True)
finally: install(new)
n = 0
for f in sorted(os.listdir(H + '/out/gnew')):
    if not f.endswith('.json') or f.startswith('_'): continue
    a = {e['path']: e for e in json.load(open(H + '/out/gold/' + f))}
    for e in json.load(open(H + '/out/gnew/' + f)):
        o = a.get(e['path'])
        if not o or o['tag'] != e['tag']: continue
        ks = [k for k in e if k not in ('path', 'tag', 'cls', 'inter') and o.get(k) != e.get(k)]
        if ks: n += 1; print('DIFF', f.split('__')[0], f.split('__')[1], e['tag'], e['cls'][:50], {k: (o.get(k), e.get(k)) for k in ks[:4]})
print('done', n, 'changed')
