// Collision layouts in world coordinates.
import { WORLD_W, WORLD_H } from './dimensions.js';

// --- arena layouts (name, solid walls, low cover) ---
// rects are [centre_x, centre_y, w, h]. All three are maze-like but every
// corridor is at least 100px wide (the collider is 26x30), so both characters
// always fit through comfortably. 'low' cover blocks normal movement but the
// girl's dodge (jump-roll) passes over it.
const PERIMETER = [
  [WORLD_W / 2, 16, WORLD_W, 32],             // top
  [WORLD_W / 2, WORLD_H - 16, WORLD_W, 32],   // bottom
  [16, WORLD_H / 2, 32, WORLD_H],             // left
  [WORLD_W - 16, WORLD_H / 2, 32, WORLD_H],   // right
];

export const ARENA_LAYOUTS = [
  {
    name: 'Neon Maze',                        // serpentine: alternate the gaps
    solid: PERIMETER.concat([
      [380, 316, 32, 568],                    // seals the top, gap below (328px)
      [640, 644, 32, 568],                    // seals the bottom, gap above (328px)
      [900, 316, 32, 568],                    // seals the top, gap below (328px)
      [200, 300, 64, 64], [470, 780, 64, 64], // islands in the wide lanes
    ]),
    low: [[200, 700, 72, 72], [1080, 300, 72, 72], [1080, 700, 72, 72]],
  },
  {
    name: 'Crossroads',                       // ring corridor around a keep
    solid: PERIMETER.concat([
      [640, 480, 360, 280],                   // keep (ring around it is 428px+)
      [200, 200, 120, 120], [1060, 200, 120, 120],   // corner blocks
      [200, 760, 120, 120], [1060, 760, 120, 120],
    ]),
    low: [[300, 480, 72, 72], [980, 480, 72, 72], [640, 180, 72, 72], [640, 780, 72, 72]],
  },
  {
    name: 'Spiral',                           // two rings, mouth left, gap right
    solid: PERIMETER.concat([
      [640, 200, 880, 32], [640, 760, 880, 32],   // outer ring top / bottom
      [1048, 480, 32, 576],                       // outer ring right (wide corridor)
      [216, 300, 32, 224], [216, 660, 32, 224],   // outer left, mouth y 412..548
      [640, 352, 576, 32], [640, 608, 576, 32],   // inner ring top / bottom
      [368, 480, 32, 272],                        // inner ring left
      [912, 388, 32, 72], [912, 572, 32, 72],     // inner right, gap y 424..536
    ]),
    low: [[640, 480, 80, 80]],
  },
];

/** centre-based layout lists -> top-left rects, like pygame.Rect does in config.py */
export function rects(list) {
  return list.map(([cx, cy, w, h]) => ({
    x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h,
  }));
}

