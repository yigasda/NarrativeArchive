// A before | after sheet from two capture labels, for showing a cleanup step: the same capture from each label side by side, scenes stacked.
//   node tools/dev/css-harness/sheet.cjs <before> <after> [--scenes layers,retitle-result,panel] [--na light|dark] [--st default] [--w 412] [--out file.png]
// Default scenes: a spread of windows + the panel + the phone home. Output: out/sheet_<after>.png (needs python3 + Pillow).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [A, Bl] = process.argv.slice(2).filter(a => !a.startsWith('--')); const args = process.argv.slice(2); const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (!A || !Bl) { console.log('usage: sheet.cjs <before> <after> [--scenes a,b] [--na light|dark] [--st default] [--w 412] [--out f.png]'); process.exit(2); }
const scenes = (opt('--scenes') || 'quotes,layers,retitle-result,merge-result,wizard-grade,studio-2,panel,phone-home').split(',');
const na = opt('--na') || 'light', st = opt('--st') || 'default', w = opt('--w') || '412';
const out = opt('--out') || path.join(__dirname, 'out', `sheet_${Bl}.png`);
const pairs = scenes.map(s => { const t = `${s}__${na}__${st}__${w}.png`; return [s, path.join(__dirname, 'out', A, t), path.join(__dirname, 'out', Bl, t)]; }).filter(([, a, b]) => fs.existsSync(a) && fs.existsSync(b));
if (!pairs.length) { console.log('no matching captures'); process.exit(1); }
const py = `
import sys, json
from PIL import Image, ImageDraw
pairs = json.loads(sys.argv[1]); out = sys.argv[2]; labels = (sys.argv[3], sys.argv[4])
cells = []
for name, a, b in pairs:
    ia, ib = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    h = max(ia.height, ib.height); row = Image.new('RGB', (ia.width + ib.width + 24, h + 28), (20, 18, 16))
    d = ImageDraw.Draw(row); d.text((6, 6), f'{name} · {labels[0]}', fill=(255, 111, 163)); d.text((ia.width + 30, 6), f'{name} · {labels[1]}', fill=(255, 111, 163))
    row.paste(ia, (0, 28)); row.paste(ib, (ia.width + 24, 28)); cells.append(row)
W = max(c.width for c in cells); H = sum(c.height + 12 for c in cells)
sheet = Image.new('RGB', (W, H), (20, 18, 16)); y = 0
for c in cells: sheet.paste(c, (0, y)); y += c.height + 12
if sheet.width > 1800: sheet = sheet.resize((1800, int(sheet.height * 1800 / sheet.width)), Image.LANCZOS)
sheet.save(out); print(out, sheet.size)
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync('python3', ['-I', '-c', py, JSON.stringify(pairs), out, A, Bl], { stdio: 'inherit' });
