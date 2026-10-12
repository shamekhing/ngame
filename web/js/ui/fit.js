// Scale the logical 960 x 540 canvas into the available viewport.
import { WINDOW_W, WINDOW_H } from '../config.js';

export function fitCanvas(canvas, inGame) {
  const appWidth = document.querySelector('.app').clientWidth;
  const availableWidth = inGame ? window.innerWidth : Math.min(window.innerWidth - 28, appWidth - 28);
  const availableHeight = inGame ? window.innerHeight : Math.max(100, window.innerHeight - 100);
  const scale = Math.min(
    availableWidth / WINDOW_W,
    availableHeight / WINDOW_H,
  );
  canvas.style.width = `${Math.round(WINDOW_W * scale)}px`;
  canvas.style.height = `${Math.round(WINDOW_H * scale)}px`;
}


