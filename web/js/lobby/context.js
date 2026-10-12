// Shared references and mutable connection state for one lobby.
export function createLobbyContext(app, status) {
  const el = (id) => document.getElementById(id);
  const ctx = {
    app, status, el,
    io: el('lobby-io'), ourField: el('ourField'), ourLabel: el('ourLabel'),
    ourCode: el('ourCode'), copyBtn: el('copyBtn'), shareBtn: el('shareBtn'),
    theirField: el('theirField'), theirLabel: el('theirLabel'),
    theirCode: el('theirCode'), useBtn: el('useBtn'),
    leaveBtn: el('leaveBtn'), backBtn: el('backBtn'), startBtn: el('startBtn'),
    actions: document.querySelector('.actions'), localBtn: el('localBtn'),
    title: el('exchangeTitle'), menu: el('menu'), stateEl: el('lobbyState'),
    signaler: null, mode: null, poll: null, connectTimer: null,
  };
  ctx.say = (message, isErr = false) => {
    ctx.stateEl.textContent = message || '';
    ctx.stateEl.classList.toggle('err', !!isErr);
  };
  ctx.clearConnectTimer = () => {
    if (ctx.connectTimer) clearTimeout(ctx.connectTimer);
    ctx.connectTimer = null;
  };
  ctx.showOutgoingCode = () => {
    ctx.ourField.hidden = false;
    ctx.copyBtn.hidden = false;
    ctx.shareBtn.hidden = typeof navigator.share !== 'function';
  };
  return ctx;
}
