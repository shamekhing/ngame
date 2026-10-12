// game input methods for GameState.
import { P1_KEYS, P2_KEYS, GRAB_RADIUS, SLAP_COOLDOWN_MS, DODGE_COOLDOWN_MS, DODGE_MS, GOLD, BLUE } from '../config.js';
import { EV } from '../net/netcode.js';
import { states } from './registry.js';

export const gameinputMethods = {
  handleKey(code) {
    if (code === 'Escape') {
      if (this.app.net) this.app.leaveNet();
      this.app.state = new states.MenuState(this.app);
      return;
    }
    if (this.roundOver || this.startLock > 0) return;

    const net = this.app.net;
    if (net && !net.isHost) {
      // the host resolves every hit; we only predict the animation locally
      const mine = this.mappingFor(net.localSeat);
      const char = net.localChar(this);
      if (code === mine.action) { net.queueAction('action'); this.previewAction(char); }
      else if (code === mine.dodge) { net.queueAction('dodge'); this.previewDodge(char); }
      return;
    }

    if (code === P1_KEYS.action) this.doAction(this.p1Char);
    else if (code === P2_KEYS.action) this.doAction(this.p2Char);
    else if (code === P1_KEYS.dodge) this.doDodge(this.p1Char);
    else if (code === P2_KEYS.dodge) this.doDodge(this.p2Char);
  },

  previewAction(char) {
    if (char === this.girl) this.girl.trySlap(this.elapsed, SLAP_COOLDOWN_MS);
  },

  previewDodge(char) { this.doDodge(char); },

  doAction(char) {
    if (char === this.guy) {
      if (this.girl.dodging) {
        this.addPopup(this.girl.x, this.girl.y - 34, 'MISS!', GOLD);   // dodge i-frames
      } else if (this.dist(this.guy, this.girl) <= GRAB_RADIUS) {
        this.onCatch();
      } else {
        this.addPopup(this.guy.x, this.guy.y - 34, 'grab!', BLUE);
      }
    } else if (this.girl.trySlap(this.elapsed, SLAP_COOLDOWN_MS)) {
      this.slapHitT = 0.14;
    }
  },

  doDodge(char) {
    if (char === this.girl) this.girl.tryDodge(this.elapsed, DODGE_COOLDOWN_MS, DODGE_MS);
  }
};
