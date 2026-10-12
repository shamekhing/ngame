// game network methods for GameState.
import { EV, WIN_SCENES } from '../net/netcode.js';
import { handleSharedNetEvent } from './transitions.js';

export const gamenetworkMethods = {
  applyNetEvent(sub, values = []) {
    if (handleSharedNetEvent(this.app, sub, values)) return;
    switch (sub) {
      case EV.CATCH:
        if (!this.roundOver) this.showCatch();
        break;
      case EV.ESCAPE:
        if (!this.roundOver) this.showEscape();
        break;
      default: break;
    }
  }
};
