// Yard arena painter.
import { WORLD_W, WORLD_H } from '../config.js';
import { floorSlabs, paintOutline, hline, circle, dashLine, crack, stain, tyres, puddle, grate, manhole, weeds, lightBand, lamp, defaultCanvas } from './graphics.js';
import { blocks } from './blocks.js';

/** Neon Yard - wet concrete, faded court paint, puddles, street lamps */
export function paintYard(ctx, art, walls, low, make = defaultCanvas) {
  floorSlabs(ctx, art);
  paintOutline(ctx, [150, 150, 300, 200], art.paintDim);
  hline(ctx, 150, 250, 300, art.paintDim);
  circle(ctx, 300, 250, 46, art.paintDim, 2);
  dashLine(ctx, 470, 250, 250, art.paintDim);
  dashLine(ctx, 640, 380, 250, art.paintDim, 18, 14, false);

  [[180, 300], [900, 420], [420, 800], [1140, 200]].forEach(([x, y], i) => {
    crack(ctx, x, y, 44, art.crack, 7 + i * 3);
  });
  [[300, 560], [900, 200], [1080, 700], [520, 120], [180, 500], [1180, 560]]
    .forEach(([x, y], i) => stain(ctx, x, y, 48, art.stains, 31 + i * 9));

  // loading bay paint and dumped tyres along the east kerb
  paintOutline(ctx, [1000, 620, 220, 220], art.paintDim);
  paintOutline(ctx, [1016, 636, 188, 188], art.paintDim);
  tyres(ctx, 1080, 740);
  tyres(ctx, 1160, 660);
  tyres(ctx, 152, 620);

  puddle(ctx, 560, 790, 62, 30, art, true, 5);
  puddle(ctx, 250, 230, 46, 22, art, true, 11);
  puddle(ctx, 1010, 560, 52, 24, art, false, 17);
  puddle(ctx, 780, 180, 40, 18, art, false, 23);

  grate(ctx, 168, 168, 36, 22, art);
  grate(ctx, 1150, 545, 36, 22, art);
  grate(ctx, 452, 836, 36, 22, art);
  manhole(ctx, 210, 430, 20, art);
  manhole(ctx, 1108, 760, 20, art);
  manhole(ctx, 700, 140, 18, art);

  [[288, 96], [864, 480], [432, 864], [1152, 288], [200, 700], [1000, 120]]
    .forEach(([x, y], i) => weeds(ctx, x, y, 6, art.foliage, 3 + i * 5));

  // light spilling in from the street lamps along the perimeter
  lightBand(ctx, [32, 32, WORLD_W - 64, 88], art.lamplight, 16, 16, 4, make);
  lightBand(ctx, [32, WORLD_H - 120, WORLD_W - 64, 88], art.lamplight, 16, 16, 4, make);
  for (const [x, y] of [[140, 140], [1140, 140], [140, 820], [1140, 820], [640, 170], [640, 800]]) {
    lamp(ctx, x, y, art, 88, 0.5, make);
  }
  blocks(ctx, art, walls, low, { neon: art.neon, make });
}

