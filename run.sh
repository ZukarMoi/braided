#!/bin/bash
cd "$(dirname "$0")"

# dev mode: start API server and Vite dev server in parallel
python3 app.py &
npm run dev
