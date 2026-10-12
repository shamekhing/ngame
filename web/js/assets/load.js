// Load required and optional sprite sheets.
import { GIRL_SHEETS, GUY_SHEETS, NSFW_SHEETS, makeAnims } from './animations.js';
import { loadImage } from './images.js';

const CHAR_DIR = '../assets/Character/';
const NPC_DIR = '../assets/NPC/';

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
