#!/usr/bin/env python3
"""
local_server.py — Braided ローカルサーバー（開発・デスクトップ起動用）

役割:
  1. dist/ を localhost で配信（静的ファイルサーバー）
  2. Obsidian Vault 連携 API を提供 (/api/vault/*)
  3. Send Log ファイル操作 API を提供 (/api/log/*)
  4. ブラウザを自動で開く

使い方: python local_server.py [port]
"""
import http.server
import socketserver
import threading
import webbrowser
import sys
import json
from pathlib import Path

from local_api_vault import (
    api_vault_config_get,
    api_vault_config_post,
    api_vault_sync,
    api_sessions_load,
)
from local_api_log import (
    api_log_append,
    api_log_clear,
    api_log_open,
)

DIR          = Path(__file__).parent
_dist        = DIR / 'dist'
SERVE_DIR    = str(_dist) if _dist.exists() else str(DIR)
DEFAULT_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


# ─── HTTP Handler ─────────────────────────────────────────────────────────────

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=SERVE_DIR, **kw)

    def log_message(self, *_):
        pass  # アクセスログ抑制

    # ── routing ────────────────────────────────────────────────────────────────

    def do_GET(self):
        if   self.path == '/api/vault/config':   self._respond(*api_vault_config_get())
        elif self.path == '/api/vault/sessions': self._respond(*api_sessions_load())
        elif self.path == '/api/log/open':       self._respond(*api_log_open())
        else: super().do_GET()

    def do_POST(self):
        body = self._read_json()
        if body is None:
            return
        if   self.path == '/api/vault/config': self._respond(*api_vault_config_post(body))
        elif self.path == '/api/vault/sync':   self._respond(*api_vault_sync(body))
        elif self.path == '/api/log':          self._respond(*api_log_append(body))
        else: self.send_error(404)

    def do_DELETE(self):
        if self.path == '/api/log': self._respond(*api_log_clear())
        else: self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    # ── helpers ────────────────────────────────────────────────────────────────

    def _read_json(self):
        length = int(self.headers.get('Content-Length', 0))
        try:
            return json.loads(self.rfile.read(length))
        except Exception as e:
            self._respond({'status': 'error', 'message': f'Invalid JSON: {e}'}, 400)
            return None

    def _respond(self, data: dict, code: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self._cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


# ─── Entry point ──────────────────────────────────────────────────────────────

def _find_free_port(start: int) -> int:
    import socket
    for port in range(start, start + 10):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    raise OSError(f'No free port found in range {start}–{start + 9}')


def main():
    port = _find_free_port(DEFAULT_PORT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', port), Handler) as srv:
        url = f'http://localhost:{port}'
        print('=' * 40)
        print(f'  Braided  →  {url}')
        print('  Ctrl+C で終了')
        print('=' * 40)
        threading.Thread(
            target=lambda: (__import__('time').sleep(0.6), webbrowser.open(url)),
            daemon=True,
        ).start()
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print('\n終了します。')


if __name__ == '__main__':
    main()
