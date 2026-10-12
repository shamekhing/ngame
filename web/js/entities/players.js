// Guy and Girl special abilities.
import { GUY_SPEED, GIRL_SPEED, DODGE_SPEED } from '../config.js';
import { Character } from './character.js';

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
