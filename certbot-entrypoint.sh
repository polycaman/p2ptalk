#!/bin/sh
# ─── certbot-entrypoint.sh ────────────────────────────────
# Obtains a real Let's Encrypt certificate on first run,
# then enters a renewal loop.
# ──────────────────────────────────────────────────────────

set -e

DOMAIN="${DOMAIN}"
CERTBOT_EMAIL="${CERTBOT_EMAIL}"

if [ -z "$DOMAIN" ] || [ -z "$CERTBOT_EMAIL" ]; then
    echo "Error: DOMAIN and CERTBOT_EMAIL must be set."
    exit 1
fi

# ── 1. Wait for nginx to be ready (serves ACME challenges) ─
echo "▶ Waiting for nginx to start..."
sleep 15

# ── 2. First-time certificate acquisition ────────────────
# Check if certbot already manages a cert for this domain
if [ ! -f "/etc/letsencrypt/renewal/$DOMAIN.conf" ]; then
    echo "▶ No Let's Encrypt certificate found for $DOMAIN"
    echo "  Requesting new certificate..."

    # Remove self-signed cert that nginx created (so certbot starts clean)
    rm -rf "/etc/letsencrypt/live/$DOMAIN"
    rm -rf "/etc/letsencrypt/archive/$DOMAIN"

    certbot certonly --webroot \
        -w /var/www/certbot \
        --email "$CERTBOT_EMAIL" \
        -d "$DOMAIN" \
        --rsa-key-size 4096 \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        --force-renewal

    echo "✓ Let's Encrypt certificate obtained for $DOMAIN"
    echo "  nginx will pick it up within ~2 minutes."
else
    echo "✓ Existing Let's Encrypt certificate found for $DOMAIN"
fi

# ── 3. Renewal loop (every 12 hours) ─────────────────────
echo "▶ Starting certificate renewal loop..."
trap exit TERM
while :; do
    certbot renew --quiet
    sleep 12h & wait ${!}
done
