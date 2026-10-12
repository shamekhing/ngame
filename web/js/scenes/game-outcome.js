// game outcome methods for GameState.
import { SLAP_RADIUS, SLAP_STUN_MS, DANGER, GREEN, GOLD, KNOCKBACK_PX } from '../config.js';
import { WIN_SCENES, EV } from '../net/netcode.js';
import { states } from './registry.js';

export const gameoutcomeMethods = {
  onCatch() {
    if (this.roundOver) return;
    this.app.match.guy += 1;
    this.showCatch();
    this.netEvent(EV.CATCH);
  },

  showCatch() {
    this.roundOver = true;
    this.shakeT = 0.28;
    this.addPopup(this.girl.x, this.girl.y - 40, 'CAUGHT!', DANGER);
    this.girl.play('girl-death', true);           // uses the Death sheet
    this.transitionT = 0.9;
    this.transitionCb = () => this.goNsfw(WIN_SCENES.guy);   // guy wins -> Sex 1
  },

  onEscape() {
    if (this.roundOver) return;
    this.app.match.girl += 1;
    this.showEscape();
    this.netEvent(EV.ESCAPE);
  },

  showEscape() {
    this.roundOver = true;
    this.addPopup(this.girl.x, this.girl.y - 40, 'ESCAPED!', GREEN);
    this.banner = {
      title: 'GIRL ESCAPES!', sub: 'the guy ran out of time', t: 1.3,
      cb: () => this.goNsfw(WIN_SCENES.girl),    // girl wins -> Sex 2
    };
  },

  goNsfw(scene = WIN_SCENES.guy) {
    this.netEvent(EV.NSFW, [scene]);
    this.app.state = new states.NsfwState(this.app, scene);
  },

  resolveSlap() {
    if (this.dist(this.girl, this.guy) <= SLAP_RADIUS) {
      this.guy.stun(SLAP_STUN_MS);
      this.knockback(this.guy, this.girl.x, this.girl.y);
      this.shakeT = 0.12;
      this.addPopup(this.guy.x, this.guy.y - 34, 'SLAP!', DANGER);
      this.addPopup(this.guy.x, this.guy.y - 56, 'STUNNED', GOLD);
    }
  }
};
