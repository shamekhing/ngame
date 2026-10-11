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

const drain = () => new Promise((resolve) => { setImmediate(resolve); });

/** one 60 Hz tick on each side, letting packets cross in the right order */
async function run(host, guest, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i += 1) {
    guest.app.step(DT);            // guest sends its input
    await drain();
    host.app.step(DT);             // host applies it, then sends a snapshot
    await drain();
    guest.app.step(DT);            // guest applies the snapshot
    await drain();
  }
}

function match() {
  const hostApp = makeApp();
  const guestApp = makeApp();
  const [hostT, guestT] = LoopbackTransport.pair();
  const host = { app: hostApp, session: new NetSession(hostT, 'host') };
  const guest = { app: guestApp, session: new NetSession(guestT, 'guest') };
  hostApp.useNet(host.session);
  guestApp.useNet(guest.session);
  hostApp.state = new GameState(hostApp);
  guestApp.state = new GameState(guestApp);
  return { host, guest };
}

test('packets round-trip and stay tiny', () => {
  const input = encodeInput(513, 0b1010, 2);
  assert.equal(input.length, 5, 'an input packet is 5 bytes');
  assert.equal(kindOf(input), KIND.INPUT);
  assert.deepEqual(decodeInput(input), { seq: 513, dirs: 0b1010, actions: 2 });

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

test('the host owns every hit: a guest slap request stuns the guy', async () => {
  const { host, guest } = match();
  await run(host, guest, 1.6);

  host.app.state.girl.setPos(host.app.state.guy.x + 20, host.app.state.guy.y);
  await run(host, guest, 0.2);
  assert.ok(!host.app.state.guy.stunned);

  guest.app.input.pressed.add('Space');              // the guest's action key
  await run(host, guest, 0.4);                       // round trip + the slap beat
  assert.ok(host.app.state.guy.stunned, 'the host resolved the slap');
  assert.ok(host.app.state.popups.some((p) => p.text === 'SLAP!'), 'nobody sees a local popup');
  assert.ok(!guest.app.state.popups.some((p) => p.text === 'SLAP!'),
    'the guest does not resolve hits itself');

  guest.app.input.pressed.add('ShiftRight');         // the guest's dodge key
  await run(host, guest, 0.1);
  assert.ok(host.app.state.girl.dodging, 'the host also resolved the dodge');
});

test('a catch is announced and both screens move to the catch scene', async () => {
  const { host, guest } = match();
  await run(host, guest, 1.6);
  host.app.state.girl.setPos(host.app.state.guy.x + 20, host.app.state.guy.y);
  await run(host, guest, 0.2);

  host.app.input.pressed.add('KeyF');                // the host grabs
  host.app.step(DT);
  await drain();
  guest.app.step(DT);
  assert.equal(host.app.match.guy, 1, 'the host scored');
  assert.ok(guest.app.state.roundOver, 'the guest saw the catch');

  await run(host, guest, 1.2);                       // death beat -> catch scene
  assert.ok(host.app.state instanceof NsfwState, 'host is on the catch scene');
  assert.ok(guest.app.state instanceof NsfwState, 'the guest followed');
});

test('an escape and the next round stay in step', async () => {
  const { host, guest } = match();
  await run(host, guest, 1.6);
  host.app.state.timeLeft = 0.05;                    // let the clock run out
  await run(host, guest, 1.6);                       // banner, then the girl-win scene

  assert.ok(host.app.state instanceof NsfwState, 'the escape leads to a scene');
  assert.ok(guest.app.state instanceof NsfwState, 'the guest followed');
  assert.equal(host.app.state.sequence[0].anim, 'girl-sex2', 'girl win -> Sex 2');
  assert.equal(guest.app.state.sequence[0].anim, 'girl-sex2', 'the guest shows Sex 2 too');
  assert.equal(host.app.match.girl, 1);
  assert.equal(guest.app.match.girl, 1);

  host.app.state.advance();                          // the host moves on
  await run(host, guest, 0.4);
  assert.equal(host.app.match.round, 2);
  assert.equal(guest.app.match.round, 2, 'the guest replayed the round change');
  assert.equal(guest.app.state.layoutName, host.app.state.layoutName);
  assert.ok(guest.app.state instanceof GameState);
});

test('three escapes end the match for the girl on both screens', async () => {
  const { host, guest } = match();
  await run(host, guest, 1.6);
  for (let round = 1; round <= 3; round += 1) {
    assert.ok(host.app.state instanceof GameState, `round ${round} playable on the host`);
    host.app.state.timeLeft = 0.05;
    await run(host, guest, 1.6);                     // banner -> girl-win scene
    assert.ok(host.app.state instanceof NsfwState, `round ${round} shows the scene`);
    assert.equal(guest.app.state.sequence[0].anim, 'girl-sex2');
    host.app.state.advance();                        // the host finishes the scene
    await run(host, guest, 0.3);
  }
  assert.equal(host.app.match.girl, 3);
  assert.ok(host.app.state instanceof MatchOverState, 'host: girl takes the match');
  assert.ok(guest.app.state instanceof MatchOverState, 'guest: girl takes the match');
});

test('closing the channel drops both clients back to the menu', async () => {
  const { host, guest } = match();
  await run(host, guest, 0.2);
  assert.ok(host.app.net && guest.app.net);

  host.session.close();
  await drain();
  assert.equal(host.app.net, null);
  assert.equal(guest.app.net, null, 'the guest noticed the peer leaving');
  assert.equal(guest.app.state.constructor.name, 'MenuState');
});

test('a local-only game never touches the netcode', () => {
  const app = makeApp();
  app.startMatch({ intro: false });
  const start = app.state.girl.x;
  app.input.held = new Set(['ArrowRight']);
  for (let i = 0; i < 120; i += 1) app.state.update(DT);
  assert.ok(app.state.girl.x > start + 60, 'local P2 still uses the keyboard');
  assert.equal(app.net, null);
});
