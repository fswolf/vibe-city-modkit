# Building sprites

Every building is four pictures, `R0.png` to `R3.png`: the same building from four camera angles, each standing on its own square plot. This is the part that is easy to get subtly wrong, so here is what works.

## The plot

The game's tile is a flat diamond about **1.79 times as wide as it is tall** (each edge drops 9 px for every 16 across). Draw the plot at that shape, with a thin slab edge, on a transparent background. The game finds the plot's two lower edges and fits them to the tile itself, so you never measure anything. Everything must stay **inside the plot**: anything hanging over the edge is trimmed.

[`sprite-templates/plot-template-1x4.png`](../sprite-templates/plot-template-1x4.png) is four empty plots at the exact shape and camera. Draw on it, or attach it to an image generator.

## The four views

The four pictures are **one building turned on a turntable**, a quarter turn each time. The camera moves, the building does not change: same roof, same props, same number of windows in every view.

| Picture | The front (door) faces |
|---|---|
| R0 | down-left |
| R1 | up-left (we see the side and back) |
| R2 | up-right (we see the back) |
| R3 | down-right: the door is on the right-hand face |

With your pictures in that order, `"facing": [0, 3, 2, 1]` in mod.json makes every copy of your building turn its door to the nearest road, whichever way the camera points.

## Asking an image generator

Ask for a **1x4 strip**, one row of four views, and attach the plot template. What has worked:

- "**The same building, rotated.** One building photographed from four angles 90 degrees apart, like a model on a turntable. Do NOT draw four different buildings." Without this you get four variations.
- Say which way the front faces in each view (the table above), and "the entrance must be on the RIGHT-hand face in view 4".
- "The plot is a flat diamond twice as wide as it is tall. Each edge drops 9 pixels for every 16 across. The camera is NOT higher than the template."
- "Nothing overhangs the plot edge: no tree canopy, awning, sign, vehicle or shadow."
- "A PNG with a real alpha channel, not a drawn checkerboard. Light from the upper left. No text."
- **Leave vehicles out** if they misbehave. Cars parked "in front" tend to end up on roofs or floating off the plot in the back views. A paved plaza is safer.
- To place a feature on one corner (a logo panel), say which corner it is in every view: the corner between the front and the face to its right is the **nearest** corner in view 1, **left** in view 2, **far** in view 3 and **right** in view 4.

## Checking and fixing

```bash
pip install -r tools/requirements.txt
python3 tools/check-strip.py my-strip.png       # transparency, four views, plot slope, plot widths
python3 tools/slice-houses.py my-strip.png out/ 1x4   # cut into R0..R3
python3 tools/square-plot.py in/ out/            # flatten a plot drawn too steep: in/ holds R0..R3.png
```

`check-strip.py` wants the plot slope between about 0.47 and 0.72. A steeper plot (camera too high) sits with its front corner below the tile; `square-plot.py` stretches it sideways to the right slope without squashing the building.

Then look at it: same roof and props in all four, nothing off the plot, the door turning the right way. Build a street of them in the game and turn the camera through all four angles.
