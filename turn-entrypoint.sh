#!/bin/sh
# ─── coturn entrypoint ────────────────────────────────────
# Wait for SSL certs, detect public IP, generate config, start turnserver
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

# Auto-detect public IP for external-ip directive
echo "  Detecting public IP..."
EXTERNAL_IP=""
# Try multiple services in case one is down
for url in "https://ifconfig.me" "https://api.ipify.org" "https://icanhazip.com"; do
    EXTERNAL_IP=$(wget -qO- --timeout=5 "$url" 2>/dev/null | tr -d '[:space:]') && break
done

if [ -z "$EXTERNAL_IP" ]; then
    # Fallback: resolve DOMAIN via DNS
    EXTERNAL_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -1)
fi

if [ -z "$EXTERNAL_IP" ]; then
    echo "⚠ Could not detect public IP, coturn may not relay correctly!"
    EXTERNAL_IP="0.0.0.0"
fi
echo "✓ Public IP: $EXTERNAL_IP"

# Generate config from template
sed -e "s|\${DOMAIN}|$DOMAIN|g" \
    -e "s|\${TURN_SECRET}|$TURN_SECRET|g" \
    -e "s|\${EXTERNAL_IP}|$EXTERNAL_IP|g" \
    /etc/turnserver.conf.template > /etc/turnserver.conf

echo "✓ Config generated. Starting turnserver..."
exec turnserver -c /etc/turnserver.conf
