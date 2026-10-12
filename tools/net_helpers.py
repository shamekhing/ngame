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

