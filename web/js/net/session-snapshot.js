// Guest correction toward authoritative host snapshots.
const CORRECTION = 0.18;
const SNAP_IF_FAR = 48;
const EXTRAP_MAX = 0.12;

export const sessionsnapshotMethods = {
  applySnapshot() {
    const state = this.state;
    const age = Math.min(this.snapAge, EXTRAP_MAX);      // dead reckoning
    const ents = [state.guy, state.girl];
    const mine = this.localChar(state);
    for (let i = 0; i < 2; i += 1) {
      const ent = ents[i];
      const s = this.snap.ents[i];
      const ex = s.x + s.vx * age;
      const ey = s.y + s.vy * age;
      if (ent === mine) {
        // predicted locally, so only nudge - unless we have drifted badly
        if (Math.hypot(ent.x - ex, ent.y - ey) > SNAP_IF_FAR) {
          ent.setPos(ex, ey);
          ent.vx = s.vx;
          ent.vy = s.vy;
        } else {
          ent.x += (ex - ent.x) * CORRECTION;
          ent.y += (ey - ent.y) * CORRECTION;
          ent.vx += (s.vx - ent.vx) * CORRECTION;
          ent.vy += (s.vy - ent.vy) * CORRECTION;
        }
      } else {
        // the peer's character: placed straight from the host
        ent.setPos(ex, ey);
        ent.vx = s.vx;
        ent.vy = s.vy;
      }
    }
    state.timeLeft = this.snap.timeLeft;
    state.app.match.guy = this.snap.scores.guy;
    state.app.match.girl = this.snap.scores.girl;
    state.app.match.round = this.snap.round;
    if (this.snap.roundOver) state.roundOver = true;
  }
};
