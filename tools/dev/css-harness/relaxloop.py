# Step 4-3, second pass: for every comment block of style.css that still carries !important / :not(#na_x) (phone css excluded),
# drop them from that block alone, capture the block's scenes (--fast, the four ST themes) and compare with the baseline.
# Same → keep the lighter block. Different → put the block back exactly as it was and note it in out/relaxloop.json with the
# differing elements, so the reason can be written next to the rule. Resumable: blocks already decided are skipped.
#   python3 -I tools/dev/css-harness/relaxloop.py [--from LINE] [--max N]
import re, json, subprocess, sys, os, time
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); CSS = os.path.join(ROOT, 'style.css')
OUT = os.path.join(os.path.dirname(__file__), 'out'); STATE = os.path.join(OUT, 'relaxloop.json')
ST_EXT = os.path.expanduser('~/sillytavern/data/default-user/extensions/NarrativeArchive/style.css')
args = sys.argv[1:]; frm = int(args[args.index('--from') + 1]) if '--from' in args else 0; mx = int(args[args.index('--max') + 1]) if '--max' in args else 999
PH = re.compile(r'\.ax\b|\.ax_|\.cg_|\.na_ph|\.lf_|\.dv_|\.cd_|\.iv_|#na_phl|\.na_phone|\.na_wal|\.na_bk')
OWNERS = json.loads(subprocess.run(['node', '-e', "console.log(JSON.stringify(require('./tools/dev/css-harness/scenes.cjs').OWNERS))"], cwd=ROOT, capture_output=True, text=True).stdout)
PREFIX = [(r'\.na_ly|\.na_layers|\.na_fp', '섹션 버전'), (r'\.na_rt|\.na_mg', '제목 다시 짓기 · 합치기'), (r'\.na_st\b|\.na_st_|\.na_qc', '작업실'), (r'\.na_wz|\.na_wiz|\.na_au', '압축 마법사 · AU'),
    (r'\.na_ex2|\.na_cp_|\.na_ex_', '원문 뽑기'), (r'\.na_kn', '누가 아는가'), (r'\.na_qb', '대사 은행'), (r'\.na_vc|\.na_pp_|\.na_people', '말투 지문 · 인물'), (r'\.na_dr|\.na_bn', '이탈 감지 · 분기'),
    (r'\.na_xr', 'X-ray'), (r'\.na_cal', '이야기 달력'), (r'\.na_kw', '키워드'), (r'\.na_ask|\.na_sf', '아카이브에 질문 · 고쳐 달라고'), (r'\.na_dg', '요약 받기'), (r'\.na_wd', '세계관'), (r'\.na_hl|\.na_health|\.na_hchip', '건강'),
    (r'\.na_pv', '미리보기'), (r'\.na_ap', '아카이브에 추가'), (r'\.na_sp|\.na_pchip', '섹션 고르기(공통)'), (r'\.na_confirm|\.na_sc_', '확인 팝업'), (r'\.na_px', '팝업 틀(공통)'), (r'#na_settings|\.na_nav|\.na_block|\.na_meter|\.na_cfg|\.na_tab|\.na_editor|\.na_prompt|\.na_tr_|\.na_search|\.na_next', '확장 패널')]
ALL = ','.join(n for n in {s for v in OWNERS.values() for s in v} if not n.startswith('phone-'))
def scenes_for(body):
    hits = {}
    for re_, name in PREFIX:
        c = len(re.findall(re_, body)); hits[name] = hits.get(name, 0) + c
    best = [k for k, v in sorted(hits.items(), key=lambda x: -x[1]) if v]
    if not best: return ALL
    names = set()
    for k in best[:2]: names |= set(OWNERS.get(k, []))
    names |= set(OWNERS['공통 부품']) if '공통' in best[0] or len(best) > 3 else set()
    return ','.join(n for n in names if not n.startswith('phone-')) or ALL
def run(cmd, **kw): return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, **kw)
state = json.load(open(STATE)) if os.path.exists(STATE) else {}
lines = open(CSS).read().split('\n')
heads = [i for i, l in enumerate(lines) if l.startswith('/*')] + [len(lines)]
done = 0
for h in range(len(heads) - 1):
    a, b = heads[h], heads[h + 1]
    if a + 1 < frm: continue
    key = f'{a + 1}: {lines[a][:60]}'
    if key in state: continue
    block = lines[a:b]
    stripped = [l if (PH.search(l) or l.startswith('/*')) else l.replace(' !important', '').replace('!important', '').replace(':not(#na_x)', '') for l in block]
    removed = sum(l.count('!important') + l.count(':not(#na_x)') for l in block if not PH.search(l))
    if not removed: continue
    if done >= mx: break
    done += 1
    scenes = scenes_for('\n'.join(block))
    lines[a:b] = stripped; open(CSS, 'w').write('\n'.join(lines)); open(ST_EXT, 'w').write('\n'.join(lines))
    label = f'rl_{a + 1}'; run(['rm', '-rf', os.path.join(OUT, label)])
    t0 = time.time()
    run(['node', 'tools/dev/css-harness/capture.cjs', label, '--fast', '--only', scenes, '--st', 'default,Cappuccino,Celestial Macaron,hostile', '--w', '412'], timeout=1500)
    cmp = run(['node', 'tools/dev/css-harness/compare.cjs', 'baseline', label]).stdout
    same = 'style diffs: 0' in cmp and 'unreadable: 0' in cmp and 'compared' in cmp and not cmp.startswith('0 compared')
    if not same:
        lines[a:b] = block; open(CSS, 'w').write('\n'.join(lines)); open(ST_EXT, 'w').write('\n'.join(lines))
    diffs = sorted(set(re.findall(r'<[A-Za-z]+\.[a-z0-9_-]*> [A-Za-z]+', cmp)))[:12]
    state[key] = {'removed': removed, 'kept': not same, 'scenes': scenes, 'diffs': diffs, 's': round(time.time() - t0)}
    json.dump(state, open(STATE, 'w'), ensure_ascii=False, indent=1)
    print(f"{'KEEP' if not same else 'drop'} {removed:3} {key[:70]} ({scenes.count(',') + 1} scenes, {round(time.time() - t0)}s)" + (f"  {diffs[:4]}" if not same else ''), flush=True)
    run(['rm', '-rf', os.path.join(OUT, label)])
print('done; !important now', open(CSS).read().count('!important'), '· :not(#na_x)', open(CSS).read().count(':not(#na_x)'))
