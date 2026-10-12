// Base behavior shared by every screen.
import { PHASE } from '../config.js';
import { handleSharedNetEvent } from './transitions.js';

export class State {
  constructor(app) { this.app = app; this.phase = PHASE.MENU; }
  handleKey() {}
  update() {}
  draw() {}
  applyNetEvent(sub, values = []) { handleSharedNetEvent(this.app, sub, values); }

  /** the host announces a transition; the guest re-plays it from the event */
  netEvent(sub, values = []) {
    const net = this.app.net;
    if (net && net.isHost) net.event(sub, values);
  }
}
