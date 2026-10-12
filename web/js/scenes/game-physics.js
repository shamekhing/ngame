// game physics methods for GameState.
import { KNOCKBACK_PX, P1_KEYS, P2_KEYS } from '../config.js';
import { overlaps } from '../entities.js';

export const gamephysicsMethods = {
  knockback(target, fromX, fromY) {
    const ang = Math.atan2(target.y - fromY, target.x - fromX);
    target.setPos(target.x + Math.cos(ang) * KNOCKBACK_PX,
                  target.y + Math.sin(ang) * KNOCKBACK_PX);
  },

  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },

  nearWall(ent) {
    const r = ent.rect();
    const inflated = { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 };
    return this.walls.some((w) => overlaps(inflated, w));
  },

  addPopup(x, y, text, color) {
    this.popups.push({ x, y, y0: y, text, color, t: 0.75 });
  },

  updatePopups(dt) {
    for (const p of this.popups) p.t -= dt;
    this.popups = this.popups.filter((p) => p.t > 0);
  },

  mappingFor(seat) { return seat === 'p1' ? P1_KEYS : P2_KEYS; },

  heldFor(who) {
    const net = this.app.net;
    if (!net || !who) return this.app.input.held;
    return who === net.localSeat ? this.app.input.held : net.remoteKeys;
  },

  keysFor(mapping, who = null) {
    const held = this.heldFor(who);
    const net = this.app.net;
    const axis = net
      ? who === net.localSeat ? this.app.input.axis : net.remoteAxis
      : who === 'p2' ? this.app.input.axis : null;
    return {
      up: held.has(mapping.up), down: held.has(mapping.down),
      left: held.has(mapping.left), right: held.has(mapping.right),
      axis: axis && (axis.x !== 0 || axis.y !== 0) ? axis : null,
    };
  },

  drives(ent) {
    const net = this.app.net;
    if (!net || net.isHost) return true;      // single player, or host = authority
    return ent === net.localChar(this);
  }
};
