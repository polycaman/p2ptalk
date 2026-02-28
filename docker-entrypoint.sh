#!/bin/sh
# ─── docker-entrypoint.sh ─────────────────────────────────
# App container entrypoint: migrate DB schema then start server
# ──────────────────────────────────────────────────────────

set -e

echo "╔══════════════════════════════════════════╗"
echo "║  p2ptalk.org — Starting application      ║"
echo "╚══════════════════════════════════════════╝"

# ── 1. Database migration ────────────────────────────────
# Pipe "y" for any interactive confirmation (no TTY in Docker)
echo ""
echo "▶ Pushing database schema..."
echo "y" | npx drizzle-kit push 2>&1
echo "✓ Database schema is up to date."

# ── 2. Start server ──────────────────────────────────────
echo ""
echo "▶ Starting server on port 3000..."
exec npx tsx server.ts
