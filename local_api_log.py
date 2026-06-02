"""
local_api_log.py — Send Log ファイル操作 API のビジネスロジック

各関数は (response_dict, status_code) のタプルを返す。
HTTPレスポンスの送信は local_server.py 側が担う。
"""
import json
import subprocess
import sys
import os
from pathlib import Path

from local_config import get_vault_path


def _log_path() -> Path | None:
    vault_path = get_vault_path()
    if not vault_path:
        return None
    return Path(vault_path) / 'Braided' / 'ctx-log.jsonl'


def api_log_append(body: dict) -> tuple[dict, int]:
    """POST /api/log — Send logエントリを jsonl に追記"""
    log_path = _log_path()
    if log_path is None:
        return {'status': 'skip', 'message': 'Vault path not configured'}, 200

    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open('a', encoding='utf-8') as f:
            f.write(json.dumps(body, ensure_ascii=False) + '\n')
        return {'status': 'ok'}, 200
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 500


def api_log_clear() -> tuple[dict, int]:
    """DELETE /api/log — Send log ファイルを削除"""
    log_path = _log_path()
    if log_path is None:
        return {'status': 'skip', 'message': 'Vault path not configured'}, 200

    try:
        if log_path.exists():
            log_path.unlink()
        return {'status': 'ok'}, 200
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 500


def api_log_open() -> tuple[dict, int]:
    """GET /api/log/open — Send log ファイルをエディタで開く"""
    log_path = _log_path()
    if log_path is None:
        return {'status': 'error', 'message': 'Vault path not configured'}, 400

    if not log_path.exists():
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_path.touch()
        except Exception as e:
            return {'status': 'error', 'message': str(e)}, 500

    try:
        if sys.platform == 'darwin':
            subprocess.run(['open', str(log_path)], check=False)
        elif sys.platform == 'win32':
            os.startfile(str(log_path))
        else:
            subprocess.run(['xdg-open', str(log_path)], check=False)
        return {'status': 'ok', 'path': str(log_path)}, 200
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 500
