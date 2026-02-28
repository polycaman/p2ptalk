#!/bin/sh
# ─── coturn entrypoint ────────────────────────────────────
# Wait for SSL certs, then generate config and start turnserver
# ──────────────────────────────────────────────────────────

set -e

DOMAIN="${DOMAIN:-localhost}"
TURN_SECRET="${TURN_SECRET:-changeme}"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

echo "▶ TURN server starting for $DOMAIN..."

# Wait for SSL certificate (certbot needs time on first run)
echo "  Waiting for SSL certificate..."
while [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; do
    sleep 5
done
echo "✓ SSL certificate found."

# Generate config from template
sed -e "s|\${DOMAIN}|$DOMAIN|g" \
    -e "s|\${TURN_SECRET}|$TURN_SECRET|g" \
    /etc/turnserver.conf.template > /etc/turnserver.conf

echo "✓ Config generated. Starting turnserver..."
exec turnserver -c /etc/turnserver.conf
