import os
from webharness import OUT

PIXEL_JS = """() => {
  const app = window.__game;
  const c = app.canvas;
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  let lit = 0;
  for (let i = 0; i < d.length; i += 4 * 7) {
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    seen.add(key);
    if (d[i] + d[i + 1] + d[i + 2] > 30) lit += 1;
  }
  return { colors: seen.size, lit, zoom: app.state.camera ? +app.state.camera.zoom.toFixed(3) : null,
           layout: app.state.layoutName || null, state: app.state.constructor.name };
}"""


def shot(page, report, name, extra_js=None):
    if extra_js:
        page.evaluate(extra_js)
        page.wait_for_timeout(700)
    path = os.path.join(OUT, f'{name}.png')
    page.screenshot(path=path)
    stats = page.evaluate(PIXEL_JS)
    canvas = page.locator('#game').bounding_box()
    report['shots'].append({'name': name, 'file': path, 'stats': stats,
                            'canvas': canvas})
    print(f'{name:14s} {stats}')
