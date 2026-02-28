#!/bin/sh
# ─── nginx/docker-entrypoint.sh ───────────────────────────
# Bootstraps a self-signed cert (if none exists) so nginx can
# start with HTTPS immediately.  Certbot replaces the cert
# with a real Let's Encrypt one shortly after.
# ──────────────────────────────────────────────────────────

set -e

# openssl is not included in nginx:alpine — install it
apk add --no-cache openssl >/dev/null 2>&1

DOMAIN="${DOMAIN:-localhost}"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

# ── 1. Ensure an SSL certificate exists ──────────────────
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
    echo "▶ No SSL certificate found for $DOMAIN"
    echo "  Creating self-signed certificate (certbot will replace it)..."
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN"
    echo "✓ Self-signed certificate created."
else
    echo "✓ SSL certificate found for $DOMAIN"
fi

# ── 2. Generate nginx config from template ───────────────
envsubst '${DOMAIN}' < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf

echo "✓ nginx config generated for $DOMAIN"

# ── 3. Start reload loops ────────────────────────────────
# Quick reload at ~2 min mark to pick up the initial real cert from certbot
(sleep 120 && nginx -s reload 2>/dev/null && echo "✓ nginx reloaded (initial cert pickup)") &

# Regular reload every 6 hours (for cert renewals)
while :; do sleep 6h & wait ${!}; nginx -s reload 2>/dev/null; done &

# ── 4. Launch nginx ──────────────────────────────────────
echo "▶ Starting nginx..."
exec nginx -g 'daemon off;'
