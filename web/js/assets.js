// Sprite sheet loading + the animation table.
// Frames are kept as source rects on the loaded sheet image so drawing is a
// single drawImage() per frame (no per-frame copies).
import { FRAME } from './config.js';

const CHAR_DIR = '../assets/Character/';
const NPC_DIR = '../assets/NPC/';

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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load ' + src));
    img.src = src;
  });
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

/**
 * Load every sheet and build the animation table.
 * @returns {Promise<{sheets:Object, anims:Object, nsfwPool:Array, warnings:Array}>}
 */
export async function buildAssets() {
  const sheets = {};
  const warnings = [];

  const nsfwNames = new Set(NSFW_SHEETS.map((e) => e.sheet));
  const required = [
    ...GIRL_SHEETS.filter((n) => !nsfwNames.has(n)).map((n) => [n, CHAR_DIR + n + '.png']),
    ...GUY_SHEETS.map((n) => [n, NPC_DIR + n + '.png']),
  ];
  await Promise.all(required.map(async ([name, src]) => {
    sheets[name] = await loadImage(src);
  }));

  // Optional catch-scene sheets: a missing file just drops out of the pool.
  const nsfwPool = [];
  for (const entry of NSFW_SHEETS) {
    try {
      sheets[entry.sheet] = await loadImage(CHAR_DIR + entry.sheet + '.png');
    } catch (err) {
      warnings.push(`${entry.sheet}.png missing - "${entry.label}" disabled`);
      continue;
    }
    nsfwPool.push({ anim: entry.anim, sheet: entry.sheet, label: entry.label });
  }

  // built last, so it picks up whichever optional sheets actually loaded
  const anims = makeAnims(sheets);

  return { sheets, anims, nsfwPool, warnings };
}
