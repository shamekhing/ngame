// Encode and decode fixed-size protocol packets.
import { KIND, Writer, Reader, encPos, decPos, encVel, clampTime } from './packet-core.js';

// ---------------------------------------------------------------------------
// packets
// ---------------------------------------------------------------------------

export function encodeInput(seq, dirs, actions, axis = null) {
  const w = new Writer(7).u8(KIND.INPUT).u16(seq & 0xffff).u8(dirs).u8(actions);
  if (axis) w.i8(Math.round(axis.x * 127)).i8(Math.round(axis.y * 127));
  return w.bytes();
}

export function decodeInput(bytes) {
  const r = new Reader(bytes);
  if (r.u8() !== KIND.INPUT) throw new Error('not an input packet');
  const input = { seq: r.u16(), dirs: r.u8(), actions: r.u8() };
  if (bytes.length >= 7) input.axis = { x: r.i8() / 127, y: r.i8() / 127 };
  return input;
}

export function encodeSnapshot(seq, tick, state) {
  const w = new Writer(40).u8(KIND.SNAP).u16(seq & 0xffff).u16(tick & 0xffff);
  w.u16(clampTime(state.timeLeft));
  w.u8(state.app.match.guy).u8(state.app.match.girl).u8(state.app.match.round);
  let flags = 0;
  if (state.roundOver) flags |= 1;
  if (state.startLock > 0) flags |= 2;
  w.u8(flags);
  for (const ent of [state.guy, state.girl]) {
    w.u16(encPos(ent.x)).u16(encPos(ent.y)).i16(encVel(ent.vx)).i16(encVel(ent.vy));
  }
  return w.bytes();
}

export function decodeSnapshot(bytes) {
  const r = new Reader(bytes);
  if (r.u8() !== KIND.SNAP) throw new Error('not a snapshot');
  const snap = {
    seq: r.u16(), tick: r.u16(), timeLeft: r.u16() / 100,
    scores: { guy: r.u8(), girl: r.u8() }, round: r.u8(), flags: r.u8(), ents: [],
  };
  snap.roundOver = (snap.flags & 1) !== 0;
  snap.startLock = (snap.flags & 2) !== 0;
  for (let i = 0; i < 2; i += 1) {
    snap.ents.push({
      x: decPos(r.u16()), y: decPos(r.u16()), vx: r.i16(), vy: r.i16(),
    });
  }
  return snap;
}

export function encodeCtl(sub, values = []) {
  const w = new Writer(16).u8(KIND.CTL).u8(sub);
  for (const v of values) w.u8(v);
  return w.bytes();
}

export function decodeCtl(bytes) {
  const r = new Reader(bytes);
  if (r.u8() !== KIND.CTL) throw new Error('not a control packet');
  const sub = r.u8();
  const values = [];
  while (r.at < bytes.length) values.push(r.u8());
  return { sub, values };
}

export function kindOf(bytes) {
  return bytes.length ? bytes[0] : -1;
}

