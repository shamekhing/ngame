// Catch the Girl - browser build constants.
// Sizes, controls, timing, speeds and the arena layouts live here.
export const WINDOW_W = 960;
export const WINDOW_H = 540;
export const WORLD_W = 1280;
export const WORLD_H = 960;
export const FRAME = 48;
export const FPS = 60;
export const TITLE = 'Catch the Girl';

// --- timing / balance ---
export const ROUND_SECONDS = 60;
export const SLAP_STUN_MS = 1200;        // how long a slap stuns the guy
export const SLAP_COOLDOWN_MS = 3000;    // girl slap cooldown
export const SLAP_RADIUS = 44;
export const GRAB_RADIUS = 42;
export const ALERT_RADIUS = 120;           // guy notices her inside this
export const GIRL_SENSE_RADIUS = 300;      // girl sees him coming this far out
export const KNOCKBACK_PX = 64;
export const WIN_TARGET = 3;             // first to this many round wins takes the match

// --- match presentation ---
export const ZOOM_MIN = 0.55;            // zoomed out on the whole map (round intro)
export const ZOOM_MAX = 1.2;             // tightest chase cam
export const INTRO_MS = 1700;            // push-in from the full map to the players
export const CARD_MS = 3000;             // control card + countdown before a match

// --- girl dodge / slap combo ---
export const DODGE_MS = 520;             // dodge (jump-roll) duration
export const DODGE_COOLDOWN_MS = 1600;   // dodge cooldown
export const DODGE_SPEED = 360;          // dodge dash speed
export const COMBO_WINDOW_MS = 650;      // time between slap presses to keep the combo going

export const GUY_SPEED = 196;            // guy is clearly faster; her edge is the slap + dodge
export const GIRL_SPEED = 160;

// --- input: KeyboardEvent.code values ---
export const P1_KEYS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  action: 'KeyF', dodge: 'ShiftLeft',
};
export const P2_KEYS = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  action: 'Space', dodge: 'ShiftRight',
};

// --- arena layouts (name, solid walls, low cover) ---
// rects are [centre_x, centre_y, w, h]. All three are maze-like but every
// corridor is at least 100px wide (the collider is 26x30), so both characters
// always fit through comfortably. 'low' cover blocks normal movement but the
// girl's dodge (jump-roll) passes over it.
const PERIMETER = [
  [WORLD_W / 2, 16, WORLD_W, 32],             // top
  [WORLD_W / 2, WORLD_H - 16, WORLD_W, 32],   // bottom
  [16, WORLD_H / 2, 32, WORLD_H],             // left
  [WORLD_W - 16, WORLD_H / 2, 32, WORLD_H],   // right
];

export const ARENA_LAYOUTS = [
  {
    name: 'Neon Maze',                        // serpentine: alternate the gaps
    solid: PERIMETER.concat([
      [380, 316, 32, 568],                    // seals the top, gap below (328px)
      [640, 644, 32, 568],                    // seals the bottom, gap above (328px)
      [900, 316, 32, 568],                    // seals the top, gap below (328px)
      [200, 300, 64, 64], [470, 780, 64, 64], // islands in the wide lanes
    ]),
    low: [[200, 700, 72, 72], [1080, 300, 72, 72], [1080, 700, 72, 72]],
  },
  {
    name: 'Crossroads',                       // ring corridor around a keep
    solid: PERIMETER.concat([
      [640, 480, 360, 280],                   // keep (ring around it is 428px+)
      [200, 200, 120, 120], [1060, 200, 120, 120],   // corner blocks
      [200, 760, 120, 120], [1060, 760, 120, 120],
    ]),
    low: [[300, 480, 72, 72], [980, 480, 72, 72], [640, 180, 72, 72], [640, 780, 72, 72]],
  },
  {
    name: 'Spiral',                           // two rings, mouth left, gap right
    solid: PERIMETER.concat([
      [640, 200, 880, 32], [640, 760, 880, 32],   // outer ring top / bottom
      [1048, 480, 32, 576],                       // outer ring right (wide corridor)
      [216, 300, 32, 224], [216, 660, 32, 224],   // outer left, mouth y 412..548
      [640, 352, 576, 32], [640, 608, 576, 32],   // inner ring top / bottom
      [368, 480, 32, 272],                        // inner ring left
      [912, 388, 32, 72], [912, 572, 32, 72],     // inner right, gap y 424..536
    ]),
    low: [[640, 480, 80, 80]],
  },
];

/** centre-based layout lists -> top-left rects, like pygame.Rect does in config.py */
export function rects(list) {
  return list.map(([cx, cy, w, h]) => ({
    x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h,
  }));
}

// --- screenshot / net phases ---
export const PHASE = { MENU: 0, GAME: 1, NSFW: 2, MATCHOVER: 3 };

// --- palette (HUD / menus; the arena paints itself from arena.js) ---
export const BG = '#1a1426';
export const WHITE = '#ffffff';
export const MUTED = '#9a8fb5';
export const DANGER = '#ff5588';
export const GOLD = '#ffd479';
export const GREEN = '#7ee0a3';
export const BLUE = '#7fb3ff';
