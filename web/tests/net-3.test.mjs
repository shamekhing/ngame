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
