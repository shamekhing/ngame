"""Screenshot the browser build with a real headless browser (Playwright + Firefox).
Builds a small report: page errors, console errors, canvas pixel stats and PNGs
of the menu plus every arena layout.  Run from the repo root:
    /tmp/pw/bin/python tools/shots.py
"""
import json
import os
import sys
from webharness import OUT, serve, watch
from shot_capture import shot
PORT = 8123
def main():
    from playwright.sync_api import sync_playwright

    os.makedirs(OUT, exist_ok=True)
    httpd = serve(PORT)
    url = f'http://127.0.0.1:{PORT}/web/index.html'
    report = {'url': url, 'errors': [], 'shots': []}
    try:
        with sync_playwright() as p:
            browser = p.firefox.launch()
            page = watch(browser.new_page(viewport={'width': 1024, 'height': 720}),
                         report['errors'])

            page.goto(url, wait_until='load')
            page.wait_for_function('window.__game && window.__game.state', timeout=15000)
            page.wait_for_timeout(600)

            shot(page, report, 'web_01_menu')

            # The responsive menu cards select the player's character.
            page.locator('#girlPick').click()
            picked = page.evaluate('() => window.__game.roles.p1')
            print(f'menu pick: tapped the girl card -> p1 is {picked!r}')
            if picked != 'girl':
                report['errors'].append(f'menu picker failed: p1 is {picked!r}')
            page.locator('#guyPick').click()

            page.locator('#localBtn').click()     # -> control card + countdown
            page.wait_for_timeout(500)
            shot(page, report, 'web_02_card')
            # the round opens on the whole map, then pushes in on the players
            page.wait_for_function(
                "() => window.__game.state.camera && window.__game.state.camera.introT > 0.9",
                timeout=8000)
            shot(page, report, 'web_03_intro_zoom')
            page.wait_for_timeout(2600)           # push-in done, start lock gone
            shot(page, report, 'web_04_arena_open')
            shot(page, report, 'web_05_arena_pillars', 'window.__game.jumpToRound(2)')
            shot(page, report, 'web_06_arena_rooms', 'window.__game.jumpToRound(3)')
            # guy closes in and grabs -> popup, then the guy-win scene
            page.evaluate("() => { const s = window.__game.state; s.guy.setPos(s.girl.x - 26, s.girl.y); }")
            page.wait_for_function("() => window.__game.state.startLock <= 0", timeout=6000)
            page.keyboard.press('KeyF')
            page.wait_for_timeout(150)
            shot(page, report, 'web_07_popup')
            page.wait_for_timeout(1200)            # death beat -> guy-win scene
            shot(page, report, 'web_08_scene_guywin')

            # a fresh round where the girl wins instead
            page.evaluate("() => window.__game.jumpToRound(3)")
            page.wait_for_timeout(300)
            page.evaluate("() => { window.__game.state.timeLeft = 0.05; }")
            page.wait_for_function("() => window.__game.state.constructor.name === 'NsfwState'",
                                   timeout=12000)
            page.wait_for_timeout(400)
            shot(page, report, 'web_09_scene_girlwin')

            # read the page's status line while index.html is still open
            report['status_line'] = page.evaluate(
                "() => { const el = document.getElementById('status'); return el ? el.textContent : ''; }")
            report['assets_warnings'] = page.evaluate(
                "() => (window.__game && window.__game.warnings) || null")

            # whole-world arena renders (diff these against the Python build's)
            page.goto(f'http://127.0.0.1:{PORT}/web/debug.html', wait_until='load')
            page.wait_for_function('window.__ready === true', timeout=20000)
            page.wait_for_timeout(300)
            for i, el in enumerate(page.locator('figure canvas').all()):
                name = f'js_arena_{i + 1}'
                path = os.path.join(OUT, f'{name}.png')
                el.screenshot(path=path)
                report['shots'].append({'name': name, 'file': path})
                print(f'{name:14s} {el.get_attribute("width")}x{el.get_attribute("height")} -> {path}')

            browser.close()
    finally:
        httpd.shutdown()

    with open(os.path.join(OUT, 'web_report.json'), 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
    print('\nstatus line:', report['status_line'])
    print('asset warnings:', report.get('assets_warnings') or 'none')
    print('errors:', report['errors'] or 'none')
    return 1 if report['errors'] else 0


if __name__ == '__main__':
    sys.exit(main())
