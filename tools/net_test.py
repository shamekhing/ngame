"""End-to-end netplay check: two real browser pages shake hands over WebRTC and
then play the same match.

Run from the repo root (needs the playwright venv used by tools/shots.py):

    /tmp/pw/bin/python tools/net_test.py

It drives the same buttons a player would: host a match, copy the code across,
start the round, hold a key on the guest and compare both screens.
"""
import json
import os
import sys
import time

from webharness import OUT, serve, watch

PORT = 8124
URL = f'http://127.0.0.1:{PORT}/web/index.html'

READ_CODE = "() => document.getElementById('ourCode').value.trim()"
CONNECTED = "() => !!(window.__game.net && window.__game.net.t.connected)"
SNAP = """() => {
  const g = window.__game;
  const s = g.state;
  return { state: s.constructor.name, round: g.match.round, guy: g.match.guy, girl: g.match.girl,
           girlX: s.girl ? +s.girl.x.toFixed(1) : null, guyX: s.guy ? +s.guy.x.toFixed(1) : null,
           layout: s.layoutName || null, net: !!g.net,
           ping: g.net ? g.net.ping : null,
           bytes: g.net && g.net.t ? (g.net.t.bytesIn || 0) : 0 };
}"""


def wait_code(page, note, timeout=25000):
    page.wait_for_function(
        "() => { const v = document.getElementById('ourCode').value.trim();"
        " return v.startsWith('ctg1') && v.length > 40; }", timeout=timeout)
    code = page.evaluate(READ_CODE)
    print(f'  {note}: {len(code)} chars')
    return code


def main():
    from playwright.sync_api import sync_playwright

    os.makedirs(OUT, exist_ok=True)
    httpd = serve(PORT)
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.firefox.launch()
            ctx = browser.new_context(viewport={'width': 1100, 'height': 900})
            host = watch(ctx.new_page(), errors, 'host')
            guest = watch(ctx.new_page(), errors, 'guest')
            for page in (host, guest):
                page.goto(URL, wait_until='load')
                page.wait_for_function('window.__game && window.__game.state', timeout=20000)

            print('1. host creates an offer')
            host.click('#hostBtn')
            host_code = wait_code(host, 'offer code')

            print('2. guest answers')
            guest.click('#joinBtn')
            guest.fill('#theirCode', host_code)
            guest.click('#useBtn')
            guest_code = wait_code(guest, 'answer code')

            print('3. host accepts the answer')
            host.fill('#theirCode', guest_code)
            host.click('#useBtn')
            host.wait_for_function(CONNECTED, timeout=30000)
            guest.wait_for_function(CONNECTED, timeout=30000)
            state = host.evaluate("() => document.getElementById('lobbyState').textContent")
            print(f'   connected: {state!r}')

            print('4. host starts the match (control card, then the round)')
            host.click('#startBtn')
            host.wait_for_function("() => window.__game.state.constructor.name === 'GameState'",
                                   timeout=8000)
            guest.wait_for_function("() => window.__game.state.constructor.name === 'GameState'",
                                    timeout=8000)
            print('   both pages are in a round')

            print('5. the guest walks right for two seconds')
            guest.keyboard.down('ArrowRight')
            time.sleep(2.0)
            guest.keyboard.up('ArrowRight')
            time.sleep(0.4)

            host_stats = host.evaluate(SNAP)
            guest_stats = guest.evaluate(SNAP)
            print(f'   host  sees: {host_stats}')
            print(f'   guest sees: {guest_stats}')

            drift = abs(host_stats['girlX'] - guest_stats['girlX'])
            moved = guest_stats['girlX'] - 1100
            print(f'   guest character moved {moved:+.1f} px, screens differ by {drift:.1f} px')

            print('6. host kills the clock; both should roll to round 2')
            host.evaluate("() => { window.__game.state.timeLeft = 0.2; }")
            host.wait_for_function("() => window.__game.match.round === 2", timeout=12000)
            guest.wait_for_function("() => window.__game.match.round === 2", timeout=12000)
            print('   round 2 on both screens')

            host.screenshot(path=os.path.join(OUT, 'net_host.png'))
            guest.screenshot(path=os.path.join(OUT, 'net_guest.png'))

            report = {'host': host_stats, 'guest': guest_stats, 'drift': drift,
                      'guest_moved': moved, 'errors': errors}
            with open(os.path.join(OUT, 'net_report.json'), 'w', encoding='utf-8') as fh:
                json.dump(report, fh, indent=2)

            ok = (not errors) and drift < 30 and moved > 60
            print(f'\n{"PASS" if ok else "FAIL"}: drift {drift:.1f} px (<30), moved {moved:+.1f} px (>60)')
            print('errors:', errors or 'none')
            browser.close()
            return 0 if ok else 1
    finally:
        httpd.shutdown()


if __name__ == '__main__':
    sys.exit(main())
