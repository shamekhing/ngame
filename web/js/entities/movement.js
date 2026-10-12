// Character movement, wall sliding, and stun.
import { WORLD_W, WORLD_H } from '../config.js';

const INV_SQRT2 = 0.70710678118;

export const movementMethods = {
  move(keys, dt, walls, lowWalls = []) {
    if (this.dodging) {
      const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const [dxn, dyn] = dirs[this.facing] || [1, 0];
      this.vx = dxn * this.dodgeSpeed;
      this.vy = dyn * this.dodgeSpeed;
    } else if (this.stunned || this.locked) {
      this.vx = 0;
      this.vy = 0;
      return;
    } else {
      let vx;
      let vy;
      if (keys.axis) {
        vx = keys.axis.x;
        vy = keys.axis.y;
        const length = Math.hypot(vx, vy);
        if (length > 1) { vx /= length; vy /= length; }
      } else {
        vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
        if (vx !== 0 && vy !== 0) { vx *= INV_SQRT2; vy *= INV_SQRT2; }
      }
      this.vx = vx * this.speed;
      this.vy = vy * this.speed;
      if (vx !== 0 || vy !== 0) {
        if (Math.abs(vx) >= Math.abs(vy)) this.facing = vx > 0 ? 'right' : 'left';
        else this.facing = vy > 0 ? 'down' : 'up';
      }
    }

    // per-axis integration so the character slides along walls
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    this.x += dx;
    if (this.blocked(walls, lowWalls)) this.x -= dx;
    this.y += dy;
    if (this.blocked(walls, lowWalls)) this.y -= dy;
    this.x = Math.min(Math.max(this.x, this.halfW), WORLD_W - this.halfW);
    this.y = Math.min(Math.max(this.y, this.halfH), WORLD_H - this.halfH);
  },

  stun(ms) {
    if (this.stunned) return;
    this.stunned = true;
    this.locked = true;
    this.vx = 0;
    this.vy = 0;
    this.stunTimer = ms / 1000;
  }
};
