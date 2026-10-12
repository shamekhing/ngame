// Sprite sheet loading + the animation table.
// Frames are kept as source rects on the loaded sheet image so drawing is a
// single drawImage() per frame (no per-frame copies).
import { FRAME } from '../config.js';

export const GIRL_SHEETS = [
  'Idle', 'IdleDown', 'Run', 'Jump', 'Fall', 'Roll', 'WallCling', 'WallHang',
  'Enter', 'Slap', 'ATK1', 'ATK2', 'Jerk', 'Kneel', 'Sex1', 'Sex2', 'Death',
];
export const GUY_SHEETS = ['GuyIdle', 'GuyIdleDown', 'GuyWalk', 'GuyAlert'];

// Catch scenes shown when the guy grabs the girl. These sheets are optional: a
// --sfw build omits the files and the entries drop out of the pool on their own.
export const NSFW_SHEETS = [
  { sheet: 'Sex1', anim: 'girl-sex1', fps: 8, label: '' },
  { sheet: 'Sex2', anim: 'girl-sex2', fps: 8, label: '' },
  //{ sheet: 'Kneel', anim: 'girl-kneel', fps: 8, label: 'Kneel' },
  //{ sheet: 'Jerk', anim: 'girl-jerk', fps: 8, label: 'Jerk' },
];

export class Animation {
  constructor(frames, fps = 8, loop = true) {
    this.frames = frames;       // [{ image, sx, sy, sw, sh }]
    this.fps = fps;
    this.loop = loop;
  }

  get lastIndex() { return this.frames.length - 1; }
}

function stripFrames(image) {
  const n = Math.max(1, Math.floor(image.naturalWidth / FRAME));
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ image, sx: i * FRAME, sy: 0, sw: FRAME, sh: FRAME });
  }
  return out;
}

/**
 * Build the animation table from a map of loaded sheets. Kept free of the DOM
 * so tests can drive it with stub images.
 */
export function makeAnims(sheets) {
  const A = (sheet, fps = 8, loop = true) => new Animation(stripFrames(sheets[sheet]), fps, loop);

  const anims = {
    'girl-idle': A('Idle', 8),
    'girl-idle-down': A('IdleDown', 8),
    'girl-run': A('Run', 10),
    'girl-jump': A('Jump', 8, false),
    'girl-fall': A('Fall', 8, false),
    'girl-roll': A('Roll', 12, false),
    'girl-wallcling': A('WallCling', 6),
    'girl-wallhang': A('WallHang', 6),
    'girl-enter': A('Enter', 6, false),
    'girl-slap': A('Slap', 14, false),
    'girl-atk1': A('ATK1', 14, false),
    'girl-atk2': A('ATK2', 14, false),
    'girl-death': A('Death', 8, false),
    'guy-idle': A('GuyIdle', 6),
    'guy-idle-down': A('GuyIdleDown', 6),
    'guy-walk': A('GuyWalk', 10),
    'guy-alert': A('GuyAlert', 6),
  };

  // Jump + Roll + Fall combined into a single 'dodge' (jump-roll) animation,
  // using three sheets that nobody else uses.
  anims['girl-dodge'] = new Animation(
    [...anims['girl-jump'].frames, ...anims['girl-roll'].frames, ...anims['girl-fall'].frames],
    18, false,
  );

  // Optional catch-scene sheets, only when those sheets are present.
  for (const entry of NSFW_SHEETS) {
    if (sheets[entry.sheet]) anims[entry.anim] = A(entry.sheet, entry.fps);
  }
  return anims;
}

