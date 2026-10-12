// Reset the lobby or adopt an open data channel.
import { RTCTransport } from '../net/transport.js';
import { NetSession } from '../net/netcode.js';

export function resetLobby(c) {
  if (c.poll) clearInterval(c.poll);
  c.poll = null;
  c.clearConnectTimer();
  if (c.signaler) c.signaler.close();
  c.signaler = null;
  c.app.leaveNet();
  c.mode = null;
  c.io.hidden = true;
  c.menu.classList.remove('is-exchanging');
  c.actions.hidden = false;
  c.localBtn.hidden = false;
  c.ourField.hidden = true;
  c.theirField.hidden = false;
  c.copyBtn.hidden = true;
  c.shareBtn.hidden = true;
  c.leaveBtn.hidden = true;
  c.startBtn.hidden = true;
  c.useBtn.hidden = false;
  c.useBtn.disabled = true;
  c.ourLabel.textContent = 'Share your code';
  c.theirLabel.textContent = 'Enter their code';
  c.ourCode.value = '';
  c.theirCode.value = '';
  c.say('');
}

export function connected(c, channel) {
  c.clearConnectTimer();
  const transport = new RTCTransport(channel);
  const session = new NetSession(transport, c.mode === 'host' ? 'host' : 'guest');
  c.app.useNet(session);
  c.ourField.hidden = true;
  c.theirField.hidden = true;
  c.useBtn.hidden = true;
  c.leaveBtn.hidden = false;
  c.backBtn.hidden = true;
  c.startBtn.hidden = c.mode !== 'host';
  if (c.status) c.status.textContent = '';
  c.say(c.mode === 'host' ? 'Connected. Start when both players are ready.'
    : 'connected - the host starts the match');
  c.poll = setInterval(() => {
    if (c.app.net !== session) { clearInterval(c.poll); c.poll = null; return; }
    session.pingNow();
    const ms = session.ping === null ? '?' : Math.round(session.ping);
    const kb = (transport.bytesIn / 1024).toFixed(1);
    c.say(`online - ping ${ms} ms - ${kb} KB in - round ${c.app.match.round}`);
  }, 1000);
}
