# 실제 지도 한 장(osmmap.js의 svg)을 폰에 넣을 크기로 줄여요. 모양은 화면에서 그대로예요.
#   python3 docs/mockups/phone-map/osm/shrink.py <osmmap out.html | .svg> <out.svg> [eps px, 0.5] [id 접두어, 기본은 파일 이름에서]
# 1. 화면(390 × 560) 밖은 잘라요: 화면에 닿지 않는 조각은 빼고, 선은 화면 밖으로 이어지는 점 하나까지만 남겨요
# 2. 0.5px 안의 굴곡은 점을 빼요(Ramer–Douglas–Peucker), 화면에서 3px²보다 작은 면도 빼요
# 3. 좌표는 정수, 첫 점 뒤로는 앞 점에서의 거리(l)로 적어요
# 4. 같은 좌표를 두 번 쓰는 길(테두리 + 안쪽)은 <defs>에 한 번 적고 <use>로 두 번 그려요
# 5. id는 지도마다 다른 접두어를 붙여요: 한 화면에 지도가 여럿이어도 서로의 길을 끌어오지 않게요
# 출처 표시(© OpenStreetMap contributors)와 이름표 · 아이콘은 손대지 않아요
import re, sys
src, out = sys.argv[1], sys.argv[2]; EPS = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
W, H, M = 390, 560, 24  # screen, and how far past it a piece may reach
s = open(src, encoding='utf-8').read()
svg = s[s.index('<svg'):s.index('</svg>') + 6]

def subpaths(d):
    out = []
    for part in re.findall(r'[Mm][^Mm]*', d.replace('undefined', '')):
        closed = bool(re.search(r'[Zz]\s*$', part))
        nums = [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:e-?\d+)?', part)]
        pts = list(zip(nums[0::2], nums[1::2]))
        if part[0] == 'm':  # relative (not written by osmmap, kept right anyway)
            acc = []; x = y = 0
            for dx, dy in pts: x += dx; y += dy; acc.append((x, y))
            pts = acc
        if pts: out.append((pts, closed))
    return out

def inside(p, m=M): return -m <= p[0] <= W + m and -m <= p[1] <= H + m
def bbox_hits(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return max(xs) >= -M and min(xs) <= W + M and max(ys) >= -M and min(ys) <= H + M

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = (dx * dx + dy * dy) ** .5 or 1e-9
    i, dm = 0, -1
    for k in range(1, len(pts) - 1):
        p = pts[k]; d = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L if L > 1e-9 else ((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2) ** .5
        if d > dm: i, dm = k, d
    if dm <= eps: return [a, b]
    return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)

def area(pts): return abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2

def clip_line(pts):
    # runs of points on screen, each with one point past the edge on either side (so the line still leaves the screen)
    runs, cur = [], []
    for k, p in enumerate(pts):
        near = inside(p) or (k > 0 and inside(pts[k - 1])) or (k + 1 < len(pts) and inside(pts[k + 1]))
        if near: cur.append(p)
        elif cur: runs.append(cur); cur = []
    if cur: runs.append(cur)
    return [r for r in runs if len(r) >= 2]

def clip_poly(pts):
    # Sutherland–Hodgman against the screen and its margin
    def cut(poly, inside_f, inter):
        out = []
        for k in range(len(poly)):
            p, q = poly[k - 1], poly[k]
            if inside_f(q):
                if not inside_f(p): out.append(inter(p, q))
                out.append(q)
            elif inside_f(p): out.append(inter(p, q))
        return out
    poly = pts
    for axis, lim, keep_lt in ((0, -M, False), (0, W + M, True), (1, -M, False), (1, H + M, True)):
        if not poly: break
        f = (lambda p, a=axis, l=lim, lt=keep_lt: p[a] <= l if lt else p[a] >= l)
        def inter(p, q, a=axis, l=lim):
            t = (l - p[a]) / ((q[a] - p[a]) or 1e-9); return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
        poly = cut(poly, f, inter)
    return poly

def enc(sp):
    out = []
    for pts, closed in sp:
        q = [(round(x), round(y)) for x, y in pts]
        z = [q[0]] + [p for k, p in enumerate(q[1:], 1) if p != q[k - 1]]
        if len(z) < 2: continue
        s = f'M{z[0][0]} {z[0][1]}l' + ''.join(f'{"" if (dx < 0 or k == 1) else " "}{dx}{"" if dy < 0 else " "}{dy}' for k, (dx, dy) in enumerate(((b[0] - a[0], b[1] - a[1]) for a, b in zip(z, z[1:])), 1))
        out.append(s + ('z' if closed else ''))
    return ''.join(out)

def shrink(d, filled):
    keep = []
    for pts, closed in subpaths(d):
        if not bbox_hits(pts): continue
        if closed or filled:
            poly = clip_poly(pts)
            if len(poly) < 3: continue
            poly = rdp(poly + [poly[0]], EPS)[:-1]
            if len(poly) < 3 or area(poly) < 3: continue
            keep.append((poly, True))
        else:
            for r in clip_line(pts):
                r = rdp(r, EPS)
                if len(r) >= 2: keep.append((r, False))
    return enc(keep)

# the paths: filled ones (fill not none) close their rings; text paths (<textPath href>) are kept whole, only re-encoded
tp = set(re.findall(r'href="#([^"]+)"', svg))
# icons and anything else drawn in its own small grid (<g transform=…>, with all it holds): left exactly as they are
held = []
def hold_groups(t):
    out, k = [], 0
    for m in re.finditer(r'<g\b[^>]*\btransform="[^"]*"[^>]*>', t):
        if m.start() < k: continue
        depth, j = 0, m.start()
        for g in re.finditer(r'<g\b[^>]*?(/?)>|</g>', t[m.start():]):
            if g.group(0) == '</g>': depth -= 1
            elif not g.group(1): depth += 1
            if depth == 0: j = m.start() + g.end(); break
        out.append(t[k:m.start()]); held.append(t[m.start():j]); out.append(f'<!--H{len(held) - 1}-->'); k = j
    out.append(t[k:]); return ''.join(out)
svg = hold_groups(svg)
PATH = r'<path\b([^>]*?)/?>'
def redo(attrs):
    dm = re.search(r'\sd="([^"]*)"', attrs)
    if not dm: return None, attrs
    idm = re.search(r'\sid="([^"]+)"', attrs)
    if idm and idm.group(1) in tp:   # a street name runs along it: only fewer points and digits
        return 'text', attrs.replace(dm.group(0), f' d="{enc([(rdp(p, EPS), c) for p, c in subpaths(dm.group(1))])}"')
    return shrink(dm.group(1), not re.search(r'fill="none"', attrs)), attrs.replace(dm.group(0), '').strip()
done = [redo(m.group(1)) for m in re.finditer(PATH, svg)]
count = {}
for d, _ in done:
    if d and d != 'text': count[d] = count.get(d, 0) + 1
ids, defs, it = {}, [], iter(done)
def path_sub(m):
    d, rest = next(it)
    if d == 'text': return '<path' + rest + '/>'
    if not d: return ''
    if count[d] < 2: return f'<path d="{d}" {rest}/>'
    if d not in ids: ids[d] = f'q{len(ids) + 1}'; defs.append(f'<path id="{ids[d]}" d="{d}"/>')
    return f'<use href="#{ids[d]}" {rest}/>'
svg2 = re.sub(PATH, path_sub, svg)
# a road drawn twice (its edge, then its middle): one path in <defs>, two <use>s
if defs: svg2 = re.sub(r'(<svg\b[^>]*>)', lambda m: m.group(1) + '<defs>' + ''.join(defs) + '</defs>', svg2, count=1)
svg2 = re.sub(r'<!--H(\d+)-->', lambda m: held[int(m.group(1))], svg2)
svg2 = re.sub(r'>\s+<', '><', svg2)
# a file of its own (an <img>, a download) needs the namespace; inline in HTML it is harmless
if 'xmlns=' not in svg2[:200]: svg2 = svg2.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"', 1)
# every id gets this map's own prefix (from the out file's name): two maps on one page (the phone, a contact sheet)
# would otherwise share q1, q2 … and draw each other's roads
import hashlib, os
PFX = sys.argv[4] if len(sys.argv) > 4 else 'm' + hashlib.md5(os.path.basename(out).encode()).hexdigest()[:4]
names = set(re.findall(r'\sid="([^"]+)"', svg2))
svg2 = re.sub(r'(\sid="|href="#|url\(#)([^")]+)', lambda m: m.group(1) + (PFX + m.group(2) if m.group(2) in names else m.group(2)), svg2)
open(out, 'w', encoding='utf-8').write(svg2)
print(f'{len(svg)} → {len(svg2)} bytes')
