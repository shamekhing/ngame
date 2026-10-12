// Per-frame input, snapshots, and event replay.
import { DIR, dirsFromHeld } from './packet-core.js';
import { encodeInput, encodeSnapshot } from './packet-codecs.js';

const SNAP_DT = 1 / 30;

export const sessionpollMethods = {
  poll(dt, app, state) {
    this.state = state && typeof state.doAction === 'function' ? state : null;
    this.snapAge += dt;

    if (this.isHost) {
      this.snapAcc += dt;
      if (this.snapAcc >= SNAP_DT && this.state) {
        this.snapAcc = 0;
        this.tick = (this.tick + 1) & 0xffff;
        this.send(encodeSnapshot((this.seq += 1), this.tick, this.state));
      }
    } else {
      // 60 Hz: the host wants our direction keys the moment they change
      this.inputAcc += dt;
      if (this.inputAcc >= 1 / 60) {
        this.inputAcc = 0;
        const mapping = this.state ? this.state.mappingFor(this.localSeat) : null;
        let dirs = mapping ? dirsFromHeld(app.input.held, mapping) : 0;
        const axis = app.input.axis;
        // Direction bits keep movement usable with an older five-byte peer.
        if (axis.y < -0.2) dirs |= DIR.up;
        if (axis.y > 0.2) dirs |= DIR.down;
        if (axis.x < -0.2) dirs |= DIR.left;
        if (axis.x > 0.2) dirs |= DIR.right;
        this.send(encodeInput((this.seq += 1), dirs, this.pendingActions,
          axis.x !== 0 || axis.y !== 0 ? axis : null));
        this.pendingActions = 0;
      }
    }

    // re-play the host's transitions
    while (this.events.length) {
      const pkt = this.events.shift();
      if (state && typeof state.applyNetEvent === 'function') {
        state.applyNetEvent(pkt.sub, pkt.values);
      }
    }

    if (!this.isHost && this.snap && this.state) this.applySnapshot();
  }
};
