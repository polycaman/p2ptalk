#!/bin/sh
# ─── nginx/docker-entrypoint.sh ───────────────────────────
# Starts nginx in HTTP-only mode if no SSL cert exists.
# Once certbot obtains a real cert, nginx auto-switches to HTTPS.
# No openssl dependency required.
# ──────────────────────────────────────────────────────────

set -e

DOMAIN="${DOMAIN:-localhost}"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

# ── 1. Choose config based on cert availability ──────────
if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
    echo "✓ SSL certificate found for $DOMAIN — HTTPS mode"
    envsubst '\${DOMAIN}' < /etc/nginx/templates/default.conf.template \
        > /etc/nginx/conf.d/default.conf
else
    echo "▶ No SSL certificate yet — starting HTTP-only mode"
    echo "  certbot will obtain a certificate, then nginx switches to HTTPS"
    cat > /etc/nginx/conf.d/default.conf <<HTTPCONF
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
HTTPCONF
fi

# ── 2. Background: watch for new certs, then switch to HTTPS ─
(
    # Quick checks every 30s for 5 minutes (for initial cert)
    i=0
    while [ $i -lt 10 ]; do
        sleep 30
        if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
            envsubst '\${DOMAIN}' < /etc/nginx/templates/default.conf.template \
                > /etc/nginx/conf.d/default.conf
            nginx -s reload 2>/dev/null
            echo "✓ Switched to HTTPS (certificate found)"
            break
        fi
        i=$((i + 1))
    done
    # Then reload every 6h for renewals
    while :; do sleep 6h & wait ${!}; nginx -s reload 2>/dev/null; done
) &

# ── 3. Launch nginx ──────────────────────────────────────
echo "▶ Starting nginx..."
exec nginx -g 'daemon off;'
