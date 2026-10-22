#!/usr/bin/env python3
"""Screen a generated 1x4 strip before it goes in. Usage: python3 tools/check-strip.py <strip.png>
Checks: a real alpha channel, exactly four pictures, each plot's lower edges at the
game's slope (accepted art measures 0.58-0.69 here), the four plots the same width, and no
two views the same picture. Prints PASS or the reasons it fails."""
import sys, numpy as np
from PIL import Image
im = Image.open(sys.argv[1]); bad = []
if im.mode != 'RGBA' or np.asarray(im.convert('RGBA'))[..., 3].min() > 10:
    print('FAIL  no real transparency (checkerboard or JPEG?)'); sys.exit(1)
a = np.asarray(im.convert('RGBA')); m = a[..., 3] > 64
# the four views: split at the emptiest column near each quarter line
prof = m.sum(0).astype(float); W = len(prof); cuts = [0]
for k in (1, 2, 3):
    lo, hi = int(W * (k / 4 - 0.12)), int(W * (k / 4 + 0.12)); cuts.append(lo + int(np.argmin(prof[lo:hi])))
cuts.append(W); boxes = []
for k in range(4):
    x0, x1 = cuts[k], cuts[k + 1]; sub = m[:, x0:x1]
    if sub.sum() < m.sum() * 0.08: bad.append(f'view {k+1} is missing or tiny'); continue
    ys = np.where(sub.any(1))[0]; xs = np.where(sub.any(0))[0]
    boxes.append((slice(ys.min(), ys.max() + 1), slice(x0 + xs.min(), x0 + xs.max() + 1)))
    if k and prof[cuts[k]] > 0.25 * prof[x0:x1].max(): bad.append(f'views {k} and {k+1} run into each other: leave a clear gap')
cells = []
for k, (ys, xs) in enumerate(boxes):
    c = m[ys, xs]; h, w = c.shape
    yb = np.array([np.where(c[:, x])[0].max() if c[:, x].any() else -1 for x in range(w)])
    cx = int(np.median(np.where(yb == yb.max())[0])); slopes = []; xl = xr = None
    for sg in (-1, 1):
        xsx = [cx + sg * d for d in range(int(w * .08), int(w * .35)) if 0 <= cx + sg * d < w and yb[cx + sg * d] > 0]
        kk, b0 = np.polyfit(xsx, [yb[x] for x in xsx], 1); slopes.append(abs(kk))
    cells.append((w, slopes, np.asarray(Image.fromarray(a[ys, xs]).convert('L').resize((64, 48)), float)))
    for s in slopes:
        # measured along the slab's bottom, which reads a little steeper than the grid's 0.5625:
        # every accepted house and civic strip lands 0.50-0.69
        if not 0.47 <= s <= 0.72: bad.append(f'view {k+1}: plot edge slope {s:.2f}, want about 0.64 (camera too {"high" if s > .64 else "low"})')
if cells:
    ws = [c[0] for c in cells]
    if max(ws) / min(ws) > 1.08: bad.append(f'plot widths differ: {ws}')
    spread = np.mean([c[2].std() for c in cells])
    for i in range(len(cells)):
        for j in range(i + 1, len(cells)):
            if np.abs(cells[i][2] - cells[j][2]).mean() < 0.3 * spread: bad.append(f'views {i+1} and {j+1} look like the same picture')
print('PASS' if not bad else 'FAIL\n  ' + '\n  '.join(bad)); sys.exit(1 if bad else 0)
