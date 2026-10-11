"""Shared Playwright harness for the browser build: static server + error watch.

tools/shots.py and tools/net_test.py both drive real headless Firefox pages over
the same static server, so that plumbing lives here instead of being duplicated.
"""
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tmp')


def serve(port):
    """Serve the repo root on 127.0.0.1:port from a daemon thread."""
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(('127.0.0.1', port), SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def watch(page, errors, who=''):
    """Collect page errors and console errors/warnings into `errors`, in place."""
    tag = f'{who} ' if who else ''
    page.on('pageerror', lambda e: errors.append(f'{tag}pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'{tag}console.{m.type}: {m.text}')
            if m.type in ('error', 'warning') else None)
    return page
