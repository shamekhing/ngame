// Apartment arena painter.
import { WORLD_W, WORLD_H } from '../config.js';
import { floorParquet, floorChecker, rug, lamp, plant, stain, defaultCanvas } from './graphics.js';
import { blocks } from './blocks.js';

/** Apartment Suite - parquet floors, rugs, planting and warm floor lamps */
export function paintApartment(ctx, art, walls, low, make = defaultCanvas) {
  floorParquet(ctx, art);
  floorChecker(ctx, art);
  [[60, 80, 210, 160], [1010, 80, 210, 160], [60, 720, 210, 160], [1010, 720, 210, 160],
   [360, 340, 250, 180], [672, 340, 250, 180], [392, 52, 500, 56], [392, 858, 500, 52]]
    .forEach((r) => rug(ctx, r, art));

  for (const [x, y] of [[170, 160], [1110, 160], [170, 800], [1110, 800], [485, 430], [800, 430]]) {
    lamp(ctx, x, y, art, 72, 0.42, make);
  }
  for (const [x, y] of [[70, 70], [1210, 70], [70, 890], [1210, 890],
                        [350, 900], [930, 900], [350, 60], [930, 60]]) {
    plant(ctx, x, y, 1.0, art);
  }
  stain(ctx, 460, 620, 26, art.stains, 5);
  stain(ctx, 830, 620, 22, art.stains, 9);
  blocks(ctx, art, walls, low, { trim: art.trim, make });
}

