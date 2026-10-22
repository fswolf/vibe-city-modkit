#!/usr/bin/env python3
"""Stretch a sprite sideways until its ground plot matches the game's grid.

Three generated power-plant strips in a row have come back with the concrete
plot drawn STEEPER than the map: 0.61-0.74 (reverted at 0.9.51), 0.600-0.624
(v3), 0.654-0.678 (v4), against the grid's 0.5625. At 1x1 that is invisible and
tools/fit-slab.py just hangs it; at 2x2 the plot has roads on four sides to be
judged against and the mismatch is what Ryan keeps seeing.

A horizontal stretch fixes it EXACTLY, and it is the only global transform that
can. The plot's slope is h/w, so scaling width by k = slope/0.5625 lands it on
0.5625 while leaving every vertical dimension alone - the chimney stays the
height it was drawn. The cost is that everything gets k wider: at k = 1.17 a
chimney is a sixth fatter than it should be, which is the thing to go and look
at rather than argue about.

(The alternative, scaling the HEIGHT down by 1/k, fixes the plot just as well
and squashes the buildings instead. That is worse: these strips are already
shorter than the art they replace.)

Usage:  python3 tools/square-plot.py <indir> <outdir>
        where indir holds R0..R3.png already sliced by tools/fit-power.py
"""
import sys, os
import numpy as np
from PIL import Image

TW, TH = 32, 18
TARGET = TH / TW

def lower_edges(m):
    """Slope of each lower edge, fitted out of the bottom vertex."""
    h, w = m.shape
    ybot = np.array([np.where(m[:, x])[0].max() if m[:, x].any() else -1 for x in range(w)])
    yb = ybot.max()
    cx = int(np.median(np.where(ybot == yb)[0]))
    out = []
    for sgn in (-1, 1):
        xs = [cx+sgn*d for d in range(15, w//2) if 0 <= cx+sgn*d < w and ybot[cx+sgn*d] > 0]
        k, b = np.polyfit(xs, [ybot[x] for x in xs], 1)
        out.append(abs(k))
    return out

def main(indir, outdir):
    os.makedirs(outdir, exist_ok=True)
    for r in range(4):
        im = Image.open(f'{indir}/R{r}.png').convert('RGBA')
        m = np.array(im)[..., 3] > 64
        sl, sr = lower_edges(m)
        slope = (sl + sr) / 2
        k = slope / TARGET
        w, h = im.size
        W2 = max(1, int(round(w * k)))
        out = im.resize((W2, h), Image.LANCZOS)
        out.save(f'{outdir}/R{r}.png')
        m2 = np.array(out)[..., 3] > 64
        nl, nr = lower_edges(m2)
        print(f'R{r}: {w}x{h} slope {sl:.4f}/{sr:.4f} (mean {slope:.4f})  '
              f'x{k:.4f} -> {W2}x{h} slope {nl:.4f}/{nr:.4f}  want {TARGET:.4f}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
