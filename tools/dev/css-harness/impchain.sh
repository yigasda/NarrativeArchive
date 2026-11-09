#!/bin/bash
# tools/dev/css-harness/impchain.sh css/A.css css/B.css …  — impstrip on each in turn; a clean result (tests too) is committed and pushed to
# NA_BRANCH with the budget's !important lowered; one that didn't finish is put back (git checkout)
SP=${NA_SCRATCH:-/tmp/na-css}; mkdir -p $SP; BR=${NA_BRANCH:?set NA_BRANCH to the work branch}
cd "$(dirname "$0")/../../.."
until curl -s -o /dev/null http://127.0.0.1:8000/; do sleep 1; done
E=~/sillytavern/data/default-user/extensions/NarrativeArchive; cp -r src css manifest.json index.js $E/
for f in "$@"; do
  n=$(basename $f .css)
  BL_PARK=$SP/bl-ext python3 tools/dev/css-harness/impstrip.py $f > $SP/imp_$n.log 2>&1
  if grep -q '^done:' $SP/imp_$n.log && ! grep -q 'giving those scenes every' $SP/imp_$n.log; then
    c=$(grep -o '!important' css/*.css | wc -l)
    python3 -c "import json;p='tests/css.budget.json';d=json.load(open(p));d['important']=$c;open(p,'w').write(json.dumps(d,indent=2)+'\n')"
    if node --test tests/*.test.mjs 2>&1 | grep -q '^# fail 0'; then
      git add $f tests/css.budget.json && git commit -qm "$n css: $(grep '^done:' $SP/imp_$n.log | sed 's/done: //') !important (same captures with Blue Lemonade on and off, hover and focus included)"
      for i in 2 4 8 16; do git push -q origin $BR && break; sleep $i; done
      echo "$n: $(grep '^done:' $SP/imp_$n.log)"
    else echo "$n: tests failed, left uncommitted"; break; fi
  else echo "$n: did not finish cleanly"; tail -3 $SP/imp_$n.log; git checkout -- $f; fi
done
