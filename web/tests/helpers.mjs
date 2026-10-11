// Shared test helpers. No DOM needed: canvases and images are stubbed.
import { FRAME } from '../js/config.js';
import { GIRL_SHEETS, GUY_SHEETS, NSFW_SHEETS, makeAnims } from '../js/assets.js';
import { App } from '../js/main.js';

export const DT = 1 / 60;

// frame counts exactly as they are in assets/ (verified against the PNG widths)
export const FRAMES = {
  Idle: 6, IdleDown: 6, Run: 6, Jump: 3, Fall: 3, Roll: 3, WallCling: 2,
  WallHang: 2, Enter: 2, Slap: 5, ATK1: 3, ATK2: 3, Jerk: 8, Kneel: 6,
  Sex1: 4, Sex2: 3, Death: 6,
  GuyIdle: 2, GuyIdleDown: 2, GuyWalk: 6, GuyAlert: 2,
};

export function stubSheets() {
  const sheets = {};
  for (const name of [...GIRL_SHEETS, ...GUY_SHEETS]) {
    sheets[name] = { naturalWidth: FRAME * (FRAMES[name] || 4), naturalHeight: FRAME };
  }
  return sheets;
}

export function newBucket() {
  return { fillRect: 0, strokeRect: 0, fillText: 0, drawImage: 0, arc: 0, ellipse: 0, texts: [] };
}

/** a canvas-2d stub that records what the renderer asked for */
export function makeCtx(bucket = newBucket()) {
  const noop = () => {};
  return {
    bucket,
    calls: bucket,          // alias kept for readability at call sites
    ctx: {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
      textAlign: 'left', textBaseline: 'alphabetic', imageSmoothingEnabled: false,
      globalCompositeOperation: 'source-over',
      save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
      arcTo: noop, quadraticCurveTo: noop,
      stroke: noop, fill: noop, clip: noop,
      arc: () => { bucket.arc += 1; },
      ellipse: () => { bucket.ellipse += 1; },
      measureText: (t) => ({ width: t.length * 8 }),
      fillRect: () => { bucket.fillRect += 1; },
      strokeRect: () => { bucket.strokeRect += 1; },
      drawImage: () => { bucket.drawImage += 1; },
      fillText: (t) => { bucket.fillText += 1; bucket.texts.push(t); },
    },
  };
}

/** canvas factory bound to one shared bucket, so tests can total the paint work */
export function makeCanvasFactory(bucket = newBucket()) {
  const factory = (w = 0, h = 0) => {
    const { ctx } = makeCtx(bucket);
    return { width: w, height: h, getContext: () => ctx, bucket };
  };
  factory.bucket = bucket;
  return factory;
}

export function makeApp() {
  // the real App, so tests exercise the same loop / net plumbing the browser runs
  const app = new App(makeCanvasFactory()(0, 0));
  app.makeCanvas = makeCanvasFactory();     // keeps the arena painter DOM-free
  app.anims = makeAnims(stubSheets());
  app.nsfwPool = NSFW_SHEETS.map((e) => ({ anim: e.anim, sheet: e.sheet, label: e.label }));
  app.roles = { p1: 'guy', p2: 'girl' };
  return app;
}

export function step(app, seconds) {
  const n = Math.max(1, Math.round(seconds / DT));
  for (let i = 0; i < n; i += 1) app.state.update(DT);
}

export function hold(app, keys) { app.input.held = new Set(keys); }

/**
 * Minimal Image stub so buildAssets() can be driven headlessly.
 * Names listed in `missing` reject like a 404 would.
 */
export function installFakeImage({ missing = [] } = {}) {
  const missingSet = new Set(missing);
  globalThis.Image = class {
    constructor() { this.naturalWidth = 0; this.naturalHeight = 0; this.onload = null; this.onerror = null; }
    set src(value) {
      this._src = value;
      const name = value.split('/').pop().replace('.png', '');
      if (missingSet.has(name)) {
        setTimeout(() => { if (this.onerror) this.onerror(new Error(`404 ${value}`)); }, 0);
        return;
      }
      this.naturalWidth = FRAME * (FRAMES[name] || 4);
      this.naturalHeight = FRAME;
      setTimeout(() => { if (this.onload) this.onload(); }, 0);
    }
    get src() { return this._src; }
  };
}
