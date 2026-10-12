// Switch page chrome between menu and fullscreen gameplay.
import { MenuState, MatchOverState } from '../scenes.js';
import { setupTouchControls } from '../touch.js';
import { fitCanvas } from './fit.js';

export function setupChrome(app, canvas, updatePicks) {
  const chrome = {
    app: document.querySelector('.app'),
    menu: document.getElementById('menu'),
    touch: document.getElementById('touch'),
    stage: document.getElementById('stage'),
    results: document.getElementById('resultActions'),
    rotate: document.getElementById('rotatePrompt'),
  };
  const touchControls = setupTouchControls(app, chrome);

  // hide the page chrome while a match is on screen
  app.onChrome = (state) => {
    const onMenu = state instanceof MenuState;
    const wasInGame = chrome.app.classList.contains('in-game');
    chrome.app.classList.toggle('in-game', !onMenu);
    if (chrome.menu.hidden !== !onMenu) chrome.menu.hidden = !onMenu;
    chrome.stage.hidden = onMenu;
    chrome.results.hidden = !(state instanceof MatchOverState);
    chrome.rotate.hidden = onMenu || !touchControls.coarse || window.innerWidth > window.innerHeight || touchControls.allowPortrait;
    if (onMenu && wasInGame) {
      touchControls.releaseJoystick();
      touchControls.allowPortrait = false;
      if (document.fullscreenElement && document.exitFullscreen) void document.exitFullscreen().catch(() => {});
    }
    if (onMenu) updatePicks();
    const cursor = onMenu ? 'pointer' : 'default';
    if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
    const showPad = !onMenu && !(state instanceof MatchOverState) && (touchControls.coarse || window.innerWidth < 760);
    if (chrome.touch.hidden === showPad) {
      chrome.touch.hidden = !showPad;
    }
    if (wasInGame === onMenu) fitCanvas(canvas, !onMenu);
  };
  window.addEventListener('resize', () => fitCanvas(canvas, chrome.app.classList.contains('in-game')));
  window.visualViewport?.addEventListener('resize', () => fitCanvas(canvas, chrome.app.classList.contains('in-game')));
  fitCanvas(canvas, false);

}
