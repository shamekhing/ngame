// Top-down characters: the shared Character base plus Guy / Girl.
import { WORLD_W, WORLD_H, GUY_SPEED, GIRL_SPEED, DODGE_SPEED } from './config.js';

const INV_SQRT2 = 0.70710678118;

/** pygame.Rect-style overlap test (strict, like colliderect). */
export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export class Character {
  constructor(x, y, speed, anims, idle, idleDown, run) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.anims = anims;
    this.idle = idle;
    this.idleDown = idleDown;
    this.run = run;

    this.facing = 'right';
    this.flip = false;
    this.halfW = 13;
    this.halfH = 15;

    this.animName = idle;
    this.frameI = 0;
    this.frameT = 0;

    this.locked = false;      // true while a one-shot action anim plays
    this.stunned = false;
    this.stunTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.dodging = false;     // true during the jump-roll (passes over low cover)
    this.dodgeTimer = 0;
    this.dodgeSpeed = 0;
    this.clinging = false;    // idle against a wall -> cling animation
    this.clingAnim = null;
  }

  // --- geometry ---
  rect() {
    return {
      x: Math.trunc(this.x - this.halfW),
      y: Math.trunc(this.y - this.halfH),
      w: Math.trunc(this.halfW * 2),
      h: Math.trunc(this.halfH * 2),
    };
  }

  blocked(walls, lowWalls) {
    const r = this.rect();
    for (const w of walls) if (overlaps(r, w)) return true;
    if (!this.dodging) {              // the jump-roll clears low cover
      for (const w of lowWalls) if (overlaps(r, w)) return true;
    }
    return false;
  }

  setPos(x, y) {
    this.x = Math.min(Math.max(x, this.halfW), WORLD_W - this.halfW);
    this.y = Math.min(Math.max(y, this.halfH), WORLD_H - this.halfH);
  }

  get isMoving() { return this.vx !== 0 || this.vy !== 0; }

  // --- control ---
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
  }

  stun(ms) {
    if (this.stunned) return;
    this.stunned = true;
    this.locked = true;
    this.vx = 0;
    this.vy = 0;
    this.stunTimer = ms / 1000;
  }

  // --- animation ---
  play(name, restart = false) {
    if (name === this.animName && !restart) return;
    this.animName = name;
    this.frameI = 0;
    this.frameT = 0;
  }

  playAction(name) {
    if (this.locked || this.stunned) return false;
    this.locked = true;
    this.vx = 0;
    this.vy = 0;
    this.flip = this.facing === 'left';
    this.play(name, true);
    return true;
  }

  sync() {
    if (this.stunned) {
      this.play(this.idle);
      this.flip = false;
      return;
    }
    if (this.locked) return;
    if (this.isMoving) {
      this.play(this.run);
      this.flip = this.facing === 'left';
    } else if (this.clinging && this.clingAnim) {
      this.play(this.clingAnim);
      this.flip = this.facing === 'left';
    } else if (this.facing === 'down') {
      this.play(this.idleDown);
      this.flip = false;
    } else {
      this.play(this.idle);
      this.flip = this.facing === 'left';
    }
  }

  update(dt) {
    if (this.stunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) { this.stunned = false; this.locked = false; }
    }

    if (this.dodging) {
      this.dodgeTimer -= dt;
      if (this.dodgeTimer <= 0) { this.dodging = false; this.locked = false; }
    }

    const anim = this.anims[this.animName];
    const spf = 1 / anim.fps;
    this.frameT += dt;
    while (this.frameT >= spf) {
      this.frameT -= spf;
      if (this.frameI < anim.lastIndex) this.frameI += 1;
      else if (anim.loop) this.frameI = 0;
      else {
        if (this.locked) this.locked = false;
        break;
      }
    }
  }

  currentFrame() {
    const anim = this.anims[this.animName];
    return { frame: anim.frames[Math.min(this.frameI, anim.lastIndex)], flip: this.flip };
  }
}

export class Guy extends Character {
  constructor(x, y, anims) {
    super(x, y, GUY_SPEED, anims, 'guy-idle', 'guy-idle-down', 'guy-walk');
    this.alert = false;
  }

  sync() {
    if (this.alert && !this.isMoving && !this.stunned && !this.locked) {
      this.play('guy-alert');
      this.flip = this.facing === 'left';
      return;
    }
    super.sync();
  }
}

export class Girl extends Character {
  static SLAP_ANIMS = ['girl-slap', 'girl-atk1', 'girl-atk2'];

  constructor(x, y, anims) {
    super(x, y, GIRL_SPEED, anims, 'girl-idle', 'girl-idle-down', 'girl-run');
    this.slapReadyT = 0;
    this.dodgeReadyT = 0;
    this.dodgeSpeed = DODGE_SPEED;
    this.comboIndex = 0;
    this.clingAnim = 'girl-wallcling';
    this.sense = false;               // true while the guy is inside her sense radius
  }

  // --- slap (cycles Slap / ATK1 / ATK2 so all three attack sheets get used) ---
  slapReady(now) { return now >= this.slapReadyT; }

  trySlap(now, cooldownMs) {
    if (!this.slapReady(now)) return false;
    const anim = Girl.SLAP_ANIMS[this.comboIndex % Girl.SLAP_ANIMS.length];
    if (!this.playAction(anim)) return false;
    this.comboIndex = (this.comboIndex + 1) % Girl.SLAP_ANIMS.length;
    this.slapReadyT = now + cooldownMs / 1000;
    return true;
  }

  cooldownFraction(now, cooldownMs) {
    const remaining = this.slapReadyT - now;
    if (remaining <= 0) return 0;
    return Math.min(1, remaining / (cooldownMs / 1000));
  }

  // --- dodge (jump-roll): burst + iframes + passes over low cover ---
  tryDodge(now, cooldownMs, dodgeMs) {
    if (now < this.dodgeReadyT || this.locked || this.stunned || this.dodging) return false;
    this.dodging = true;
    this.locked = true;
    this.dodgeTimer = dodgeMs / 1000;
    this.dodgeReadyT = now + cooldownMs / 1000;
    this.flip = this.facing === 'left';
    this.play('girl-dodge', true);
    return true;
  }

  dodgeFraction(now, cooldownMs) {
    const remaining = this.dodgeReadyT - now;
    if (remaining <= 0) return 0;
    return Math.min(1, remaining / (cooldownMs / 1000));
  }
}
