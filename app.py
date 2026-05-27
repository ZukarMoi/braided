#!/usr/bin/env python3
"""
Braided ランチャー — index.html をローカルサーバーで配信してブラウザを開く
使い方: python app.py [port]
"""
import http.server
import socketserver
import threading
import webbrowser
import subprocess
import sys
import os
import json
from pathlib import Path

DIR        = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = Path(DIR) / 'braided-config.json'
DEFAULT_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

# Serve from dist/ if it exists (production build), otherwise from DIR (legacy)
_dist = Path(DIR) / 'dist'
SERVE_DIR = str(_dist) if _dist.exists() else DIR


# ─── Config helpers ────────────────────────────────────────────────────────────

def load_config():
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {}


def save_config(data):
    CONFIG_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


def get_vault_path():
    """設定から vault パスを取得し ~ を展開して返す。未設定なら空文字。"""
    raw = load_config().get('vault', {}).get('path', '').strip()
    if not raw:
        return ''
    return str(Path(raw).expanduser())


# ─── Request handler ───────────────────────────────────────────────────────────

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=SERVE_DIR, **kw)

    def log_message(self, *_):
        pass  # アクセスログ抑制

    # ── routing ────────────────────────────────────────────────────────────────

    def do_GET(self):
        if self.path == '/api/vault/config':
            self._json_response(load_config().get('vault', {}))
        elif self.path == '/api/vault/sessions':
            self._handle_sessions_load()
        elif self.path == '/api/log/open':
            self._handle_log_open()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/vault/config':
            self._handle_vault_config()
        elif self.path == '/api/vault/sync':
            self._handle_vault_sync()
        elif self.path == '/api/log':
            self._handle_log_append()
        else:
            self.send_error(404)

    def do_DELETE(self):
        if self.path == '/api/log':
            self._handle_log_clear()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    # ── API handlers ───────────────────────────────────────────────────────────

    def _handle_vault_config(self):
        body = self._read_json()
        if body is None:
            return
        cfg = load_config()
        cfg['vault'] = body
        save_config(cfg)
        self._json_response({'status': 'ok'})

    def _handle_vault_sync(self):
        body = self._read_json()
        if body is None:
            return

        vault_path = get_vault_path()
        if not vault_path:
            self._json_response({'status': 'error', 'message': 'Vault path not configured'}, 400)
            return

        session = body.get('session')
        if not session:
            self._json_response({'status': 'error', 'message': 'No session data'}, 400)
            return

        try:
            from vault import sync_session, save_sessions_backup, load_sessions_backup
            result = sync_session(vault_path, session)
            # sessions.json バックアップを更新（既存 + 今回のセッションをマージ）
            existing = load_sessions_backup(vault_path) or []
            existing_ids = {s.get('id') for s in existing}
            if session.get('id') not in existing_ids:
                existing.append(session)
            else:
                existing = [session if s.get('id') == session.get('id') else s for s in existing]
            save_sessions_backup(vault_path, existing)
            self._json_response(result)
        except Exception as e:
            self._json_response({'status': 'error', 'message': str(e)}, 500)

    def _handle_sessions_load(self):
        vault_path = get_vault_path()
        if not vault_path:
            self._json_response({'status': 'error', 'message': 'Vault path not configured'}, 400)
            return
        try:
            from vault import load_sessions_backup
            data = load_sessions_backup(vault_path)
            if data is None:
                self._json_response({'status': 'not_found', 'sessions': []})
            else:
                self._json_response({'status': 'ok', 'sessions': data})
        except Exception as e:
            self._json_response({'status': 'error', 'message': str(e)}, 500)

    def _log_path(self):
        vault_path = get_vault_path()
        if not vault_path:
            return None
        return Path(vault_path) / 'Braided' / 'ctx-log.jsonl'

    def _handle_log_append(self):
        body = self._read_json()
        if body is None:
            return
        log_path = self._log_path()
        if log_path is None:
            self._json_response({'status': 'skip', 'message': 'Vault path not configured'})
            return
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with log_path.open('a', encoding='utf-8') as f:
                f.write(json.dumps(body, ensure_ascii=False) + '\n')
            self._json_response({'status': 'ok'})
        except Exception as e:
            self._json_response({'status': 'error', 'message': str(e)}, 500)

    def _handle_log_clear(self):
        log_path = self._log_path()
        if log_path is None:
            self._json_response({'status': 'skip', 'message': 'Vault path not configured'})
            return
        try:
            if log_path.exists():
                log_path.unlink()
            self._json_response({'status': 'ok'})
        except Exception as e:
            self._json_response({'status': 'error', 'message': str(e)}, 500)

    def _handle_log_open(self):
        log_path = self._log_path()
        if log_path is None:
            self._json_response({'status': 'error', 'message': 'Vault path not configured'}, 400)
            return
        if not log_path.exists():
            # 空ファイルを作って開く
            try:
                log_path.parent.mkdir(parents=True, exist_ok=True)
                log_path.touch()
            except Exception as e:
                self._json_response({'status': 'error', 'message': str(e)}, 500)
                return
        try:
            if sys.platform == 'darwin':
                subprocess.run(['open', str(log_path)], check=False)
            elif sys.platform == 'win32':
                os.startfile(str(log_path))
            else:
                subprocess.run(['xdg-open', str(log_path)], check=False)
            self._json_response({'status': 'ok', 'path': str(log_path)})
        except Exception as e:
            self._json_response({'status': 'error', 'message': str(e)}, 500)

    # ── helpers ────────────────────────────────────────────────────────────────

    def _read_json(self):
        length = int(self.headers.get('Content-Length', 0))
        try:
            raw = self.rfile.read(length)
            return json.loads(raw)
        except Exception as e:
            self._json_response({'status': 'error', 'message': f'Invalid JSON: {e}'}, 400)
            return None

    def _json_response(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self._cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


# ─── Main ──────────────────────────────────────────────────────────────────────

def find_free_port(start):
    import socket
    for port in range(start, start + 10):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    raise OSError(f'No free port found in range {start}–{start+9}')


def main():
    port = find_free_port(DEFAULT_PORT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', port), Handler) as srv:
        url = f'http://localhost:{port}'
        print('=' * 40)
        print(f'  Braided  →  {url}')
        print(f'  Ctrl+C で終了')
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
