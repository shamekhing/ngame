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

