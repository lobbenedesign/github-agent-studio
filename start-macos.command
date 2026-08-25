#!/bin/bash
# Double-click this file in Finder to start GitHub Agent Studio and open it
# in your browser. Real checks below, not just a bare `bun server.ts` — this
# used to fail silently/confusingly if bun wasn't installed.
cd "$(dirname "$0")"

if ! command -v bun >/dev/null 2>&1; then
  echo "❌ Bun is not installed or not on PATH."
  echo "   Install it from https://bun.sh (curl -fsSL https://bun.sh/install | bash), then re-run this."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  export GITHUB_TOKEN="$(gh auth token 2>/dev/null)"
  echo "🔑 Using GitHub CLI token — real 5000 req/hour API limit instead of 60/hour."
else
  echo "⚠️  No 'gh' CLI auth found — running unauthenticated (real 60 req/hour GitHub API limit)."
  echo "   Run 'gh auth login' first for the higher limit, especially for the Deep Crawler."
fi

echo "🐙 Starting GitHub Agent Studio on http://localhost:3011 ..."
( sleep 2 && open "http://localhost:3011" ) &
exec bun server.ts
