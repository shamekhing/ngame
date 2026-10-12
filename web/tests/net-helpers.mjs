import { LoopbackTransport } from '../js/net/transport.js';
import { NetSession } from '../js/net/netcode.js';
import { GameState } from '../js/scenes.js';
import { makeApp, DT } from './helpers.mjs';

export const drain = () => new Promise((resolve) => { setImmediate(resolve); });

/** one 60 Hz tick on each side, letting packets cross in the right order */
export async function run(host, guest, seconds) {
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

export function match() {
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
