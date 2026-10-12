// Generate reusable material textures from a palette.
import { rgb, noiseTile, defaultCanvas } from './graphics.js';
import { PALETTES } from './palette-data.js';

function tintTile(size, color, alpha, make) {
  const c = make(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = rgb(color, alpha);
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** palette + the textures generated from it */
export function makeArt(kind, make = defaultCanvas) {
  const p = PALETTES[kind] || PALETTES.yard;
  const art = Object.assign({}, p);
  art.floorTex = noiseTile(128, art.floorColors, art.floorBlock, art.salt, make);
  art.wallTex = noiseTile(64, art.wallTexColors, 4, art.salt + 3, make);
  art.slabTints = (p.slabTints || []).map(([c, a]) => tintTile(p.slab, c, a, make));
  art.checker = p.checker ? tintTile(p.slab, p.checker[0], p.checker[1], make) : null;
  return art;
}

