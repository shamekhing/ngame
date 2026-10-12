// The netcode, end to end, over an in-memory transport pair: packets, input
// replication, host authority and the transitions both sides have to agree on.
import test from 'node:test';
import assert from 'node:assert/strict';

import { LoopbackTransport } from '../js/net/transport.js';
import {
  NetSession, encodeInput, decodeInput, encodeSnapshot, decodeSnapshot,
  encodeCtl, decodeCtl, kindOf, KIND, CTL, EV,
} from '../js/net/netcode.js';
import { GameState, NsfwState, MatchOverState } from '../js/scenes.js';
import { makeApp, DT } from './helpers.mjs';
import { run, match, drain } from './net-helpers.mjs';

test('packets round-trip and stay tiny', () => {
  const input = encodeInput(513, 0b1010, 2);
  assert.equal(input.length, 5, 'an input packet is 5 bytes');
  assert.equal(kindOf(input), KIND.INPUT);
  assert.deepEqual(decodeInput(input), { seq: 513, dirs: 0b1010, actions: 2 });
  const analog = decodeInput(encodeInput(514, 0, 0, { x: 0.5, y: -0.75 }));
  assert.equal(analog.seq, 514);
  assert.ok(Math.abs(analog.axis.x - 0.5) < 0.01);
  assert.ok(Math.abs(analog.axis.y + 0.75) < 0.01);

  const state = new GameState(makeApp());
  state.timeLeft = 42.5;
  state.app.match = { guy: 2, girl: 1, round: 3 };
  const snap = encodeSnapshot(7, 900, state);
  assert.ok(snap.length <= 32, `a snapshot stays small (${snap.length} bytes)`);
  const back = decodeSnapshot(snap);
  assert.equal(back.seq, 7);
  assert.equal(back.timeLeft, 42.5);
  assert.deepEqual(back.scores, { guy: 2, girl: 1 });
  assert.equal(back.round, 3);
  assert.equal(back.ents.length, 2);
  assert.ok(Math.abs(back.ents[0].x - state.guy.x) < 0.1, 'position survives 1/16 px');

  assert.deepEqual(decodeCtl(encodeCtl(EV.ROUND, [2, 1, 0])), { sub: EV.ROUND, values: [2, 1, 0] });
  assert.equal(decodeCtl(encodeCtl(CTL.PING)).sub, CTL.PING);
  assert.equal(kindOf(new Uint8Array(0)), -1);
});

test('control and event codes can never collide on the wire', () => {
  // CTL and EV share a single byte, and a collision silently eats a round change
  const ctl = Object.values(CTL);
  const ev = Object.values(EV);
  assert.equal(new Set([...ctl, ...ev]).size, ctl.length + ev.length,
    'CTL and EV ranges overlap');
  for (const v of [...ctl, ...ev]) assert.ok(v >= 0 && v <= 255, `${v} does not fit a byte`);
});

test('loopback transport delivers both ways and closes as a pair', async () => {
  const [a, b] = LoopbackTransport.pair();
  const got = [];
  a.onMessage = (bytes) => got.push(['a', [...bytes]]);
  b.onMessage = (bytes) => got.push(['b', [...bytes]]);
  a.send(new Uint8Array([1, 2, 3]));
  b.send(new Uint8Array([9]));
  await drain();
  assert.deepEqual(got, [['b', [1, 2, 3]], ['a', [9]]]);

  let closed = 0;
  a.onClose = () => { closed += 1; };
  b.close();
  assert.equal(closed, 1, 'closing one end closes the other');
  assert.ok(!a.connected && b.closed);
});


test('the guest drives its own character and the host agrees', async () => {
  const { host, guest } = match();
  await run(host, guest, 1.6);                       // let the round intro finish

  const start = guest.app.state.girl.x;
  guest.app.input.held = new Set(['ArrowRight']);    // the guest owns P2
  await run(host, guest, 1.0);

  const hostX = host.app.state.girl.x;               // where the authority put her
  const guestX = guest.app.state.girl.x;             // where the guest predicted her
  assert.ok(hostX > start + 60, `the host moved her (${start} -> ${hostX.toFixed(1)})`);
  assert.ok(Math.abs(hostX - guestX) < 24,
    `prediction tracks the host (host ${hostX.toFixed(1)} vs guest ${guestX.toFixed(1)})`);
  assert.ok(host.session.remoteKeys.has('ArrowRight'), 'the host sees the guest keys');
});

test('the guest joystick sends proportional movement to the host', async () => {
  const { host, guest } = match();
  await run(host, guest, 1.6);
  const start = host.app.state.girl.x;
  guest.app.input.setAxis(0.5, 0);
  await run(host, guest, 1);
  assert.ok(host.session.remoteAxis && Math.abs(host.session.remoteAxis.x - 0.5) < 0.01);
  assert.ok(host.app.state.girl.x > start + 55 && host.app.state.girl.x < start + 110);
  guest.app.input.setAxis(0, 0);
  await run(host, guest, 0.1);
  assert.equal(host.session.remoteAxis, null, 'release clears the remote axis');
});

