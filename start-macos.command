#!/bin/bash
cd "$(dirname "$0")"
echo "🐙 Starting GitHub Agent Studio on http://localhost:3011..."
bun server.ts
