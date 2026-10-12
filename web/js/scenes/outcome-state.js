// Round-outcome animation and continuation.
import { PHASE, WINDOW_W, WINDOW_H } from '../config.js';
import { WIN_SCENES } from '../net/netcode.js';
import { State } from './base.js';
import { states } from './registry.js';
import { forwardKey } from './transitions.js';
import { drawOutcome } from './outcome-render.js';
import { outcomeFlow } from './outcome-flow.js';

function uth(a, b) { return a + Math.random() * (b - a); }

export class NsfwState extends State {
  /**
   * The round-outcome scene. `scene` is an index into the nsfw pool:
   * guy win -> Sex 1, girl win -> Sex 2; null shuffles two out of the pool.
   */
  constructor(app, scene = null) {
    super(app);
    this.phase = PHASE.NSFW;
    const pool = app.nsfwPool.filter((entry) => app.anims[entry.anim]);   // skip --sfw gaps
    if (scene !== null && scene >= 0 && scene < pool.length) {
      this.sequence = [pool[scene]];
    } else {
      for (let i = pool.length - 1; i > 0; i -= 1) {   // shuffle
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      this.sequence = pool.length >= 2 ? pool.slice(0, 2) : pool;
    }
    this.title = scene === WIN_SCENES.girl ? 'ESCAPED!' : 'CAUGHT!';
    this.index = 0;
    this.frameI = 0;
    this.frameT = 0;
    this.timer = 0.5;        // input grace period
    this.autoT = 5;
    this.done = false;
    this.hearts = Array.from({ length: 12 }, () => [
      uth(60, WINDOW_W - 60), uth(WINDOW_H * 0.5, WINDOW_H - 40),
      uth(12, 26), Math.random(),
    ]);
  }

  get cur() { return this.sequence[this.index]; }

  anim() { return this.cur ? this.app.anims[this.cur.anim] : null; }

  handleKey() {
    if (this.timer > 0 || this.done) return;
    if (forwardKey(this.app)) return;              // the host moves the flow on
    this.advance();
  }

  

  

  update(dt) {
    if (this.timer > 0) this.timer -= dt;
    const anim = this.anim();
    if (anim) {
      const spf = 1 / anim.fps;
      this.frameT += dt;
      while (this.frameT >= spf) {
        this.frameT -= spf;
        this.frameI = (this.frameI + 1) % anim.frames.length;
      }
    }
    if (!this.done) {
      this.autoT -= dt;
      if (this.autoT <= 0) this.advance();
    }
    for (const h of this.hearts) {
      h[3] += dt * 0.15;
      if (h[3] > 1) h[3] = 0;
    }
  }

  draw(ctx) { drawOutcome(this, ctx); }
}

Object.defineProperties(NsfwState.prototype, Object.getOwnPropertyDescriptors(outcomeFlow));
