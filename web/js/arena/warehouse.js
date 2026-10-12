// Warehouse arena painter.
import { WORLD_W, WORLD_H } from '../config.js';
import { floorSlabs, floorChecker, dashLine, paintOutline, stain, crack, cable, pallet, barrel, lamp, lightBand, brickWall, defaultCanvas } from './graphics.js';
import { blocks } from './blocks.js';

/** Steel Warehouse - polished concrete, hazard striping, crates, cables */
export function paintWarehouse(ctx, art, walls, low, make = defaultCanvas) {
  floorSlabs(ctx, art);
  floorChecker(ctx, art);
  dashLine(ctx, 90, 480, 1100, art.paintWarm, 26, 20);
  dashLine(ctx, 640, 110, 740, art.paintWarm, 26, 20, false);
  paintOutline(ctx, [120, 150, 200, 130], art.paintDim);
  paintOutline(ctx, [960, 690, 200, 130], art.paintDim);

  [[760, 560], [250, 620], [1080, 300], [480, 200]]
    .forEach(([x, y], i) => stain(ctx, x, y, 44, art.stains, 13 + i * 11));
  crack(ctx, 700, 250, 60, art.crack, 41);
  crack(ctx, 300, 900, 60, art.crack, 43);

  cable(ctx, [[70, 120], [420, 152], [900, 118], [1210, 158]], art.cable, 20);
  cable(ctx, [[80, 858], [500, 818], [980, 876]], art.cable, 16);
  pallet(ctx, 250, 200, art);
  pallet(ctx, 1050, 762, art);
  for (const [x, y] of [[350, 400], [960, 400], [350, 760], [960, 760]]) barrel(ctx, x, y, art);

  for (const [x, y] of [[330, 250], [950, 250], [330, 710], [950, 710]]) {
    lamp(ctx, x, y, art, 120, 0.5, make);
  }
  // skylight shafts falling between the pillars
  lightBand(ctx, [300, 40, 220, 880], art.lamplight, 18, 16, 4, make);
  lightBand(ctx, [760, 40, 220, 880], art.lamplight, 18, 16, 4, make);
  blocks(ctx, art, walls, low, { wallFunc: brickWall, hazard: true, make });
}

