// Wire host, join, copy, share, and reset buttons.
import { MenuState } from '../scenes.js';

export function bindLobbyEvents(c, { reset, start, useTheirCode }) {
  c.el('hostBtn').addEventListener('click', () => { start('host'); });
  c.el('joinBtn').addEventListener('click', () => { start('join'); });
  c.leaveBtn.addEventListener('click', reset);
  c.backBtn.addEventListener('click', reset);
  c.startBtn.addEventListener('click', () => {
    if (c.mode === 'host' && c.app.net && c.app.net.isHost && c.app.state instanceof MenuState) {
      c.app.state.handleKey('Enter');
    }
  });
  c.useBtn.addEventListener('click', useTheirCode);
  c.copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(c.ourCode.value);
      c.say('copied - send it to the other player');
    } catch (err) {
      c.ourCode.select();
      let copied = false;
      try { copied = !!(document.execCommand && document.execCommand('copy')); } catch (_) { /* unsupported */ }
      c.say(copied ? 'copied - send it to the other player'
        : 'Select the code above, then use your phone’s Copy or Share menu.');
    }
  });
  c.shareBtn.addEventListener('click', async () => {
    try {
      await navigator.share({ title: 'Catch the Girl match code', text: c.ourCode.value });
      c.say('code shared - wait for the other player’s reply');
    } catch (err) {
      if (err.name !== 'AbortError') c.say(`could not share: ${err.message}`, true);
    }
  });
  c.theirCode.addEventListener('input', () => {
    c.useBtn.disabled = c.theirCode.value.trim().length === 0;
  });
}
