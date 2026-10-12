// Character animation state.
export const animationMethods = {
  play(name, restart = false) {
    if (name === this.animName && !restart) return;
    this.animName = name;
    this.frameI = 0;
    this.frameT = 0;
  },

  playAction(name) {
    if (this.locked || this.stunned) return false;
    this.locked = true;
    this.vx = 0;
    this.vy = 0;
    this.flip = this.facing === 'left';
    this.play(name, true);
    return true;
  },

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
  },

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
  },

  currentFrame() {
    const anim = this.anims[this.animName];
    return { frame: anim.frames[Math.min(this.frameI, anim.lastIndex)], flip: this.flip };
  }
};
