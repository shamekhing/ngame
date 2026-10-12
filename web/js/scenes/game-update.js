// game update methods for GameState.
import { P1_KEYS, P2_KEYS, ALERT_RADIUS, GIRL_SENSE_RADIUS } from '../config.js';

export const gameupdateMethods = {
  update(dt) {
    this.elapsed += dt;

    if (this.transitionT > 0) {
      this.transitionT -= dt;
      if (this.transitionT <= 0 && this.transitionCb) {
        const cb = this.transitionCb;
        this.transitionCb = null;
        cb();
        return;
      }
    }

    if (this.shakeT > 0) this.shakeT -= dt;

    if (this.banner !== null && this.banner.t > 0) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) {
        const cb = this.banner.cb;
        this.banner = null;
        if (cb) { cb(); return; }
      }
    }

    if (this.startLock > 0) this.startLock -= dt;

    if (!this.roundOver) this.updatePlay(dt);
    else { this.guy.vx = 0; this.guy.vy = 0; this.girl.vx = 0; this.girl.vy = 0; }

    this.guy.update(dt);
    this.girl.update(dt);
    this.updatePopups(dt);
    this.camera.update([[this.guy.x, this.guy.y], [this.girl.x, this.girl.y]], dt);
  },

  updatePlay(dt) {
    const p1 = this.keysFor(P1_KEYS, 'p1');
    const p2 = this.keysFor(P2_KEYS, 'p2');
    const [guyKeys, girlKeys] = this.app.roles.p1 === 'guy' ? [p1, p2] : [p2, p1];

    const playable = this.startLock <= 0;
    const step = (ent, keys) => {
      if (!playable || !this.drives(ent)) {
        if (this.drives(ent)) { ent.vx = 0; ent.vy = 0; }
        return;                                  // not ours: the host places it
      }
      ent.move(keys, dt, this.walls, this.lowWalls);
    };
    step(this.guy, guyKeys);
    step(this.girl, girlKeys);

    if (this.slapHitT >= 0) {
      this.slapHitT -= dt;
      if (this.slapHitT < 0) this.resolveSlap();
    }

    this.guy.alert = this.dist(this.guy, this.girl) <= ALERT_RADIUS;
    this.guy.sync();
    this.girl.sense = this.dist(this.guy, this.girl) <= GIRL_SENSE_RADIUS;

    // girl: cling to a wall when idle beside one, else normal animation
    this.girl.clinging = this.nearWall(this.girl);
    if (this.girl.clinging) {
      this.clingTime += dt;
      this.girl.clingAnim = this.clingTime > 0.7 ? 'girl-wallhang' : 'girl-wallcling';
    } else {
      this.clingTime = 0;
    }
    if (this.startLock <= 0) this.girl.sync();

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.onEscape();
    }
  }
};
