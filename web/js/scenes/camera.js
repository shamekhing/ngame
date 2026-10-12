// Camera framing and intro zoom.
import { WORLD_W, WORLD_H, WINDOW_W, WINDOW_H, ZOOM_MIN, ZOOM_MAX } from '../config.js';

export class Camera {
  constructor(opts = {}) {
    this.center = [WORLD_W / 2, WORLD_H / 2];
    this.introT = opts.introT || 0;            // seconds left of the round intro
    this.introTotal = this.introT;
    this.zoom = this.introT > 0 ? ZOOM_MIN : 1;  // open on the whole map, then push in
  }

  update(points, dt) {
    const midX = points.reduce((s, p) => s + p[0], 0) / points.length;
    const midY = points.reduce((s, p) => s + p[1], 0) / points.length;
    const dx = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
    const dy = Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
    const pad = 220;
    let desired = Math.min(WINDOW_W / (dx + pad), WINDOW_H / (dy + pad));
    desired = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, desired));

    if (this.introT > 0) {                      // whole map -> the players
      this.introT = Math.max(0, this.introT - dt);
      const k = 1 - (this.introTotal ? this.introT / this.introTotal : 0);
      const e = 1 - (1 - k) * (1 - k);          // ease-out
      this.zoom = ZOOM_MIN + (desired - ZOOM_MIN) * e;
      this.center[0] = WORLD_W / 2 + (midX - WORLD_W / 2) * e;
      this.center[1] = WORLD_H / 2 + (midY - WORLD_H / 2) * e;
      return;
    }

    this.zoom += (desired - this.zoom) * Math.min(1, dt * 5);
    const halfW = WINDOW_W / (2 * this.zoom);
    const halfH = WINDOW_H / (2 * this.zoom);
    this.center[0] = Math.min(Math.max(midX, halfW), WORLD_W - halfW);
    this.center[1] = Math.min(Math.max(midY, halfH), WORLD_H - halfH);
  }

  toScreen(x, y) {
    return [(x - this.center[0]) * this.zoom + WINDOW_W / 2,
            (y - this.center[1]) * this.zoom + WINDOW_H / 2];
  }
}

