#!/usr/bin/env python3
"""Slice a residential sheet into <out>/L{tier}_R{rot}.png.

Usage: slice-houses.py <sheet.png> <out-dir> [ROWSxCOLS]

The grid defaults to 4x4. A one-building strip (civic services) is 1x4 and
comes out as L0_R{rot}.png - rename to R{rot}.png for the civic folders.

Follows claude/sprite-pipeline.md: this is an alpha-haze sheet, so the cells
are isolated by thresholding alpha at 64 and labelling connected components
rather than by cutting on a fixed grid. Sixteen components over 200px come out,
which is exactly the sixteen cells, plus one single-pixel speck that the size
filter drops.

Row = growth tier (1..4, smallest first), column = camera rotation.

The interesting part is the BASE PLATE, because the renderer hangs a sprite by
its plate and not by its bounding box:

    dw = span * TW * scale
    dh = dw * imgH / imgW
    drawImage(img, x - dw/2, y - dh + dh*nudge, dw, dh)

so span = imgW/plateW and nudge = 1 - plateY/imgH. The plate's centre row is
its widest scanline, but NOT necessarily the widest row in the picture - on a
low wide house with trees either side the roofline is broader. So walk UP from
the bottom and take the FIRST peak, then check it geometrically: a plate is a
diamond with the game's own aspect, so

    predicted_bottom = plateRow + plateWidth * (TH/TW) / 2

has to land just above the slice's bottom edge. A detector that locked onto a
roofline instead would be short by most of a plate half-height.
"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

TW, TH = 32, 18
SRC = sys.argv[1] if len(sys.argv) > 1 else "/root/.claude/uploads/sheet.png"
OUT = sys.argv[2] if len(sys.argv) > 2 else "img/res2"
ROWS, COLS = (int(v) for v in (sys.argv[3] if len(sys.argv) > 3 else "4x4").split("x"))

im = Image.open(SRC).convert("RGBA")
a = np.array(im)
H, W = a.shape[:2]
cw, ch = W // COLS, H // ROWS

mask = a[..., 3] > 64
lab, n = ndimage.label(mask)
sizes = ndimage.sum(mask, lab, range(1, n + 1))

# Two neighbours can TOUCH - the Tudor manors' hedges met at the cell edge -
# and then one component covers two cells. A component wider or taller than
# a cell is cut at the thinnest scanline within 40px of the grid line it
# straddles, which is the gap between the two plates, not a spire.
def split_merged(mask, lab, n, sizes):
    cut = False
    for k in range(1, n + 1):
        if sizes[k - 1] < 200: continue
        ys, xs = np.where(lab == k)
        for axis, span, cell in ((1, (xs.min(), xs.max()), cw), (0, (ys.min(), ys.max()), ch)):
            if span[1] - span[0] <= cell * 1.1: continue
            g = int(round((span[0] + span[1]) / 2 / cell)) * cell   # the grid line inside it
            best, bestn = None, None
            for v in range(g - 40, g + 41):
                line = (lab[:, v] if axis == 1 else lab[v]) == k
                if bestn is None or line.sum() < bestn: best, bestn = v, line.sum()
            if axis == 1: mask[:, best] = False
            else: mask[best, :] = False
            cut = True
    return cut
while split_merged(mask, lab, n, sizes):
    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))

# Group components by which cell their centroid falls in. A very dark facade
# can split a building in two along a shadow line, so this groups rather than
# assuming one component per cell.
cells = {}
for k in range(1, n + 1):
    if sizes[k - 1] < 200:
        continue
    cy, cx = ndimage.center_of_mass(lab == k)
    cells.setdefault((int(cy // ch), int(cx // cw)), []).append(k)

assert len(cells) == ROWS * COLS, f"expected {ROWS*COLS} cells, got {len(cells)}: {sorted(cells)}"

report = []
for (row, col), comps in sorted(cells.items()):
    m = np.isin(lab, comps)
    # Fill holes and close: dark windows and the gaps between porch rails are
    # part of the building.
    m = ndimage.binary_fill_holes(m)
    m = ndimage.binary_closing(m, np.ones((5, 5)))
    # Dilate a little and keep the ORIGINAL alpha underneath, so the soft edge
    # of the art survives but anything unattached is cut away.
    keep = ndimage.binary_dilation(m, np.ones((3, 3)), iterations=3)

    cut = a.copy()
    cut[..., 3] = np.where(keep, a[..., 3], 0)
    ys, xs = np.where(keep)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    sl = cut[y0:y1, x0:x1]
    sh, sw = sl.shape[:2]

    # Width of each scanline, smoothed, then walk up from the bottom for the
    # first sustained peak.
    solid = sl[..., 3] > 40
    width = np.zeros(sh, int)
    for r in range(sh):
        c = np.where(solid[r])[0]
        if len(c):
            width[r] = c[-1] - c[0] + 1
    kern = np.ones(7) / 7
    sm = np.convolve(width, kern, mode="same")

    plate_row = None
    for r in range(sh - 4, 8, -1):
        if sm[r] <= sm[r - 1]:
            continue
        # a peak only counts if the decline holds for a while going up
        if all(sm[r - d] <= sm[r] for d in range(1, 9)):
            plate_row = r
            break
    assert plate_row is not None, f"no plate found for row {row} col {col}"

    # The plate's own width at that row, from the raw profile rather than the
    # smoothed one - the smoothing is only for finding WHERE it is.
    plate_w = int(width[max(0, plate_row - 2):plate_row + 3].max())
    cols = np.where(solid[plate_row])[0]
    plate_cx = (cols[0] + cols[-1]) / 2

    # Pad the short side until the plate's centre IS the image's centre, so the
    # renderer's `x - dw/2` puts the plate over the tile. Done before span is
    # worked out, because padding changes the width span is measured against.
    left, right = plate_cx, sw - plate_cx
    pad_l = int(round(max(0.0, right - left)))
    pad_r = int(round(max(0.0, left - right)))
    if pad_l or pad_r:
        wide = np.zeros((sh, sw + pad_l + pad_r, 4), np.uint8)
        wide[:, pad_l:pad_l + sw] = sl
        sl = wide
        sh, sw = sl.shape[:2]

    # The geometric check. A plate is a diamond with the game's own aspect, so
    # its bottom vertex follows from the row and width it was found at, and has
    # to land just above the slice's bottom edge - short only by the slab's
    # thickness and whatever grass and fence hang below it. A detector that had
    # locked onto a roofline would be short by most of a plate half-height,
    # which for these is 73-86px, so the two cases do not overlap.
    predicted = plate_row + plate_w * (TH / TW) / 2
    report.append(dict(row=row, col=col, w=sw, h=sh, plate_row=int(plate_row),
                       plate_w=plate_w, half=round(plate_w * (TH / TW) / 2, 1),
                       short_by=round(sh - predicted, 1),
                       pad=[pad_l, pad_r],
                       span=round(sw / plate_w, 4),
                       nudge=round(1 - plate_row / sh, 4)))

    Image.fromarray(sl).save(f"{OUT}/L{row}_R{col}.png")

print(json.dumps(report, indent=1))
