"""
local_config.py — ローカル設定ファイル（braided-config.json）の読み書き
"""
import json
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / 'braided-config.json'


def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {}


def save_config(data: dict) -> None:
    CONFIG_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


def get_vault_path() -> str:
    """設定から vault パスを取得し ~ を展開して返す。未設定なら空文字。"""
    raw = load_config().get('vault', {}).get('path', '').strip()
    if not raw:
        return ''
    return str(Path(raw).expanduser())
