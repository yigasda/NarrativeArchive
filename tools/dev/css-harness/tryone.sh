#!/bin/bash
# tools/dev/css-harness/tryone.sh css/X.css 'unique text on the line' scenes  → strip that line's !important; keep only if BL on, BL off and hostile show 0 changes
F=$1; K=$2; SC=$3; SP=${NA_SCRATCH:-/tmp/na-css}; mkdir -p $SP; H=$(cd "$(dirname "$0")" && pwd); EXT=~/sillytavern/data/default-user/extensions
cd "$H/../../.."
cp $F $SP/try_backup.css
python3 - "$F" "$K" <<'PY'
import sys; f,k=sys.argv[1],sys.argv[2]; L=open(f,encoding='utf-8').read().split('\n'); n=[i for i,l in enumerate(L) if k in l and '!important' in l]
assert len(n)==1, ('lines', len(n)); L[n[0]]=L[n[0]].replace(' !important',''); open(f,'w',encoding='utf-8').write('\n'.join(L))
PY
[ $? -ne 0 ] && { echo "SKIP: line not unique"; exit 1; }
ok=1
for run in on off hostile; do st=default; [ $run = hostile ] && st=hostile; [ $run = off ] && mv $EXT/blue-lemonade $SP/bl-ext
  python3 $H/cmpgen.py $F $st $SC > $SP/try_$run.log 2>&1
  [ $run = off ] && mv $SP/bl-ext $EXT/blue-lemonade
  r=$(tail -1 $SP/try_$run.log); echo "  $run: $r"; grep "^DIFF" $SP/try_$run.log | cut -c1-160 | head -2
  [ "$r" != "done 0 changed" ] && ok=0
done
if [ $ok = 1 ]; then echo "KEEP stripped: $K"; else cp $SP/try_backup.css $F; echo "REVERT: $K"; fi
EXT2=$EXT/NarrativeArchive/css; rm -rf $EXT2 && cp -r css $EXT2
