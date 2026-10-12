// The two copy/paste steps of manual WebRTC signaling.
import { ManualSignaler } from '../net/signaling.js';
import { connected, resetLobby } from './session.js';

export async function startLobby(c, nextMode) {
  resetLobby(c);
  c.mode = nextMode;
  c.io.hidden = false;
  c.menu.classList.add('is-exchanging');
  c.actions.hidden = true;
  c.localBtn.hidden = true;
  c.backBtn.hidden = false;
  c.title.textContent = c.mode === 'host' ? 'Host a match' : 'Join a match';
  c.signaler = new ManualSignaler({
    onChannel: (channel) => connected(c, channel),
    onState: (state) => {
      if (state === 'failed') {
        c.clearConnectTimer();
        c.say('Direct connection failed. Try the same Wi-Fi, or use a TURN relay for restricted networks.', true);
      }
    },
  });
  try {
    if (c.mode === 'host') {
      c.showOutgoingCode();
      c.ourLabel.textContent = '1. Send this code';
      c.theirLabel.textContent = '2. Paste their reply';
      c.ourCode.value = 'gathering network addresses...';
      c.ourCode.value = await c.signaler.createOffer();
      c.say('send your code, then paste theirs below');
    } else {
      c.theirLabel.textContent = "Paste the host's code";
      c.say('paste the host\'s code above, then press "Use their code"');
    }
  } catch (err) {
    c.say(`could not start: ${err.message}`, true);
  }
}

export async function useTheirCode(c) {
  if (!c.signaler || !c.mode) return;
  const code = c.theirCode.value.trim();
  if (!code) { c.say('paste their code first', true); return; }
  c.useBtn.disabled = true;
  try {
    if (c.mode === 'host') {
      await c.signaler.accept(code);
      c.say('connecting...');
      c.connectTimer = setTimeout(() => {
        if (!c.app.net && c.mode === 'host') {
          c.say('Still connecting. Check both codes; a direct route may be blocked by the phone networks. Try the same Wi-Fi.', true);
        }
      }, 15000);
    } else {
      c.ourCode.value = 'building the reply...';
      c.ourCode.value = await c.signaler.joinWith(code);
      c.showOutgoingCode();
      c.ourLabel.textContent = '2. Send this reply';
      c.say('send your reply - the host pastes it on their side');
    }
  } catch (err) {
    c.useBtn.disabled = false;
    c.say(`that code did not work: ${err.message}`, true);
  }
}
