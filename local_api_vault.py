"""
local_api_vault.py — Obsidian Vault 連携 API のビジネスロジック

各関数は (response_dict, status_code) のタプルを返す。
HTTPレスポンスの送信は local_server.py 側が担う。
"""
from local_config import load_config, save_config, get_vault_path


def api_vault_config_get() -> tuple[dict, int]:
    """GET /api/vault/config — Vault設定を返す"""
    return load_config().get('vault', {}), 200


def api_vault_config_post(body: dict) -> tuple[dict, int]:
    """POST /api/vault/config — Vault設定を保存"""
    cfg = load_config()
    cfg['vault'] = body
    save_config(cfg)
    return {'status': 'ok'}, 200


def api_vault_sync(body: dict) -> tuple[dict, int]:
    """POST /api/vault/sync — セッションを Obsidian Vault に書き出す"""
    vault_path = get_vault_path()
    if not vault_path:
        return {'status': 'error', 'message': 'Vault path not configured'}, 400

    session = body.get('session')
    if not session:
        return {'status': 'error', 'message': 'No session data'}, 400

    try:
        from vault import sync_session, save_sessions_backup, load_sessions_backup
        result = sync_session(vault_path, session)

        # sessions.json バックアップを更新
        existing = load_sessions_backup(vault_path) or []
        existing_ids = {s.get('id') for s in existing}
        if session.get('id') not in existing_ids:
            existing.append(session)
        else:
            existing = [
                session if s.get('id') == session.get('id') else s
                for s in existing
            ]
        save_sessions_backup(vault_path, existing)
        return result, 200
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 500


def api_sessions_load() -> tuple[dict, int]:
    """GET /api/vault/sessions — Vault から sessions.json をロード"""
    vault_path = get_vault_path()
    if not vault_path:
        return {'status': 'error', 'message': 'Vault path not configured'}, 400

    try:
        from vault import load_sessions_backup
        data = load_sessions_backup(vault_path)
        if data is None:
            return {'status': 'not_found', 'sessions': []}, 200
        return {'status': 'ok', 'sessions': data}, 200
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 500
