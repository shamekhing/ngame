// Browser startup and asset loading.
import { WINDOW_W, WINDOW_H, TITLE } from './config.js';
import { buildAssets } from './assets.js';
import { MenuState } from './scenes.js';
import { App } from './app.js';
import { setupLobby } from './lobby.js';
import { setupMenu } from './ui/menu.js';
import { setupChrome } from './ui/chrome.js';

export async function boot() {
  document.title = TITLE;
  const canvas = document.getElementById('game');
  canvas.width = WINDOW_W;
  canvas.height = WINDOW_H;
  const status = document.getElementById('status');

  const app = new App(canvas);
  app.ctx.imageSmoothingEnabled = false;
  window.__game = app;          // exposed early so headless checks can watch it boot

  try {
    const assets = await buildAssets();
    app.anims = assets.anims;
    app.nsfwPool = assets.nsfwPool;
    app.warnings = assets.warnings;
    if (assets.warnings.length) status.textContent = assets.warnings.join(' | ');
  } catch (err) {
    status.textContent = `asset load failed: ${err.message}`;
    throw err;
  }

  const menuState = new MenuState(app);
  app.state = menuState;
  app.input.attach(window);
  app.onStatus = (text) => { status.textContent = text; };
  window.__lobby = setupLobby(app, status);

  // ---- the main page: host, join, or play here (picking is on the canvas) ----
  const updatePicks = setupMenu(app, canvas, menuState);
  setupChrome(app, canvas, updatePicks);

  requestAnimationFrame((t) => { app.last = t; app.frame(t); });
}

