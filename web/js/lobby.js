// Manual two-code lobby for a direct WebRTC match.
import { createLobbyContext } from './lobby/context.js';
import { resetLobby, connected as adoptChannel } from './lobby/session.js';
import { startLobby, useTheirCode } from './lobby/handshake.js';
import { bindLobbyEvents } from './lobby/events.js';

export function setupLobby(app, status) {
  const ctx = createLobbyContext(app, status);
  const reset = () => resetLobby(ctx);
  const start = (mode) => startLobby(ctx, mode);
  const connected = (channel) => adoptChannel(ctx, channel);
  bindLobbyEvents(ctx, { reset, start, useTheirCode: () => useTheirCode(ctx) });
  return { reset, start, connected };
}
