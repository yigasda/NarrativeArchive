# 다녀간 곳 › 실제 지도 시안: 공개 지형 타일(terrarium)로 산 그림자 · 높이 · 바다 깊이 그림을 만들어요.
# python3 -I docs/mockups/phone-map/osm/terrain.py <S> <W> <N> <E> <out-prefix>
#   → <out>-shade.png (산 그림자, 회색+알파) · <out>-depth.png (바다 깊이, 파랑+알파) · <out>-hills.png (높이별 초록, 알파) · <out>.json (범위)
import sys, math, io, json, urllib.request
import numpy as np
from PIL import Image, ImageFilter

def blur(A, sig):   # separable gaussian on a float grid
    r = int(sig * 3) + 1; k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * sig * sig)); k /= k.sum()
    A = np.pad(A, r, mode='edge')
    A = np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 0, A)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 1, A)

S, W, N, E = map(float, sys.argv[1:5]); out = sys.argv[5]; Z = 14
def tile(la, lo):
    n = 2 ** Z
    return (lo + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(la))) / math.pi) / 2 * n
def lat_of(y):
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2 ** Z))))
x0, y0 = tile(N, W); x1, y1 = tile(S, E)
tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
H = np.zeros((rows * 256, cols * 256), dtype=np.float32)
for j in range(rows):
    for i in range(cols):
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx0 + i}/{ty0 + j}.png'
        im = np.asarray(Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert('RGB'), dtype=np.float32)
        H[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
lon_w = tx0 / 2 ** Z * 360 - 180; lon_e = (tx1 + 1) / 2 ** Z * 360 - 180
lat_n = lat_of(ty0); lat_s = lat_of(ty1 + 1)
mpp = 40075016 * math.cos(math.radians((S + N) / 2)) / (2 ** Z * 256)       # meters per pixel
# hillshade, light from the north-west, a little exaggerated so low hills still read
Hs = blur(H, 2.2)
gy, gx = np.gradient(Hs * 1.6, mpp)
slope = np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
az, alt = math.radians(315), math.radians(45)
sh = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
flat = math.sin(alt)
dark = np.clip((flat - sh) / flat, 0, 1) ** 0.9               # 0 on flat ground, 1 in deep shadow
lite = np.clip((sh - flat) / (1 - flat), 0, 1)
a = np.zeros(H.shape + (4,), dtype=np.uint8)
a[..., 0], a[..., 1], a[..., 2] = 70, 86, 78
a[..., 3] = (dark * 95).astype(np.uint8)
lit = lite > 0
a[lit, 0] = a[lit, 1] = a[lit, 2] = 255; a[lit, 3] = (lite[lit] * 70).astype(np.uint8)
Image.fromarray(a, 'RGBA').save(out + '-shade.png', optimize=True)
# height bands as faces: each 40 m above the lowest ground a slightly deeper green veil
land = H > 0
base = np.percentile(H[land], 5) if land.any() else 0
band = np.clip(np.floor((H - base - 25) / 40), 0, 6)
h = np.zeros(H.shape + (4,), dtype=np.uint8)
h[..., 0], h[..., 1], h[..., 2] = 60, 110, 50
h[..., 3] = (band * 9).astype(np.uint8)
h = np.asarray(Image.fromarray(h, 'RGBA').filter(ImageFilter.GaussianBlur(3)))
Image.fromarray(h, 'RGBA').save(out + '-hills.png', optimize=True)
# sea and lake depth: deeper water, deeper blue
dep = np.clip(-H, 0, 60) / 60
d = np.zeros(H.shape + (4,), dtype=np.uint8)
d[..., 0], d[..., 1], d[..., 2] = 30, 90, 170
d[..., 3] = (dep ** 0.7 * 120).astype(np.uint8)
Image.fromarray(np.asarray(Image.fromarray(d, 'RGBA').filter(ImageFilter.GaussianBlur(2))), 'RGBA').save(out + '-depth.png', optimize=True)
json.dump({'S': lat_s, 'W': lon_w, 'N': lat_n, 'E': lon_e, 'min': float(H.min()), 'max': float(H.max()), 'base': float(base)}, open(out + '.json', 'w'))
print('ok', cols, 'x', rows, 'tiles', 'height', round(float(H.min())), '…', round(float(H.max())), 'm')
