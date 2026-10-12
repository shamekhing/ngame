// Character geometry and collision.
import { WORLD_W, WORLD_H } from '../config.js';

export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export const geometryMethods = {
  rect() {
    return {
      x: Math.trunc(this.x - this.halfW),
      y: Math.trunc(this.y - this.halfH),
      w: Math.trunc(this.halfW * 2),
      h: Math.trunc(this.halfH * 2),
    };
  },

  blocked(walls, lowWalls) {
    const r = this.rect();
    for (const w of walls) if (overlaps(r, w)) return true;
    if (!this.dodging) {              // the jump-roll clears low cover
      for (const w of lowWalls) if (overlaps(r, w)) return true;
    }
    return false;
  },

  setPos(x, y) {
    this.x = Math.min(Math.max(x, this.halfW), WORLD_W - this.halfW);
    this.y = Math.min(Math.max(y, this.halfH), WORLD_H - this.halfH);
  },

  get isMoving() { return this.vx !== 0 || this.vy !== 0; }
};
