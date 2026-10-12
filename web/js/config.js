// Catch the Girl - browser build constants.
// Sizes, controls, timing, speeds and the arena layouts live here.
export * from './config/dimensions.js';
export * from './config/layouts.js';

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
