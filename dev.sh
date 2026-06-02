#!/bin/bash
# dev.sh — ローカル開発起動スクリプト
# API サーバー (local_server.py) と Vite dev server を並列起動する
cd "$(dirname "$0")"

python3 local_server.py &
npm run dev
