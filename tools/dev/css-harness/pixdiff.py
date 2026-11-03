# Pixel compare for compare.cjs: python3 -I pixdiff.py <before.png> <after.png> <tolerance 0-255> [x y w h] [diff.png]
# Prints one line: "<differing pixel count> <max channel delta>" — or "SIZE <wa>x<ha> vs <wb>x<hb>" when the images differ in size.
# With a rect, both images are cropped to it first (a dialog's own box, so the chat page behind it does not count) and the box's rounded
# corners (26px) and its outermost 1px edge are ignored too — the page shows through them.
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB'); tol = int(sys.argv[3])
rest = sys.argv[4:]
if len(rest) >= 4:
    x, y, w, h = [int(round(float(v))) for v in rest[:4]]; rest = rest[4:]
    box = (max(0, x), max(0, y), min(a.width, x + w), min(a.height, y + h))
    a = a.crop(box); b = b.crop(box)
if a.size != b.size:
    print(f'SIZE {a.width}x{a.height} vs {b.width}x{b.height}'); sys.exit(0)
d = ImageChops.difference(a, b)
if len(sys.argv) >= 8:
    from PIL import ImageDraw
    corner = Image.new('L', a.size, 0); ImageDraw.Draw(corner).rounded_rectangle((1, 1, a.width - 2, a.height - 2), radius=26, fill=255)  # 1px in: the box's anti-aliased edge blends with the page
    d = Image.composite(d, Image.new('RGB', a.size, (0, 0, 0)), corner)
# max over channels per pixel, then count those above the tolerance
m = d.split(); mx = m[0]
for ch in m[1:]: mx = ImageChops.lighter(mx, ch)
hist = mx.histogram(); count = sum(hist[tol + 1:]); peak = max((i for i, v in enumerate(hist) if v), default=0)
if rest and count:
    out = Image.new('RGB', a.size, (235, 235, 235)); out.paste(a.convert('L').point(lambda v: 160 + v // 3).convert('RGB'))
    mask = mx.point(lambda v: 255 if v > tol else 0); out.paste((220, 40, 40), mask=mask); out.save(rest[0])
print(f'{count} {peak}')
