#!/bin/bash
# ─── init-letsencrypt.sh (LEGACY — OPTIONAL) ─────────────
# This script is NO LONGER REQUIRED.
# SSL certificates are now obtained automatically on first
# `docker compose up -d`.  Keep this only as a manual fallback
# for debugging or if you need to force-renew certificates.
# ──────────────────────────────────────────────────────────

set -e

# Load environment variables from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$DOMAIN" ]; then
  echo "Error: DOMAIN is not set. Copy .env.example to .env and configure it."
  exit 1
fi

if [ -z "$CERTBOT_EMAIL" ]; then
  echo "Error: CERTBOT_EMAIL is not set in .env"
  exit 1
fi

data_path="./certbot"
rsa_key_size=4096

echo "### Creating required directories ..."
mkdir -p "$data_path/conf/live/$DOMAIN"
mkdir -p "$data_path/www"

# Check if certificates already exist
if [ -d "$data_path/conf/live/$DOMAIN" ] && [ -f "$data_path/conf/live/$DOMAIN/fullchain.pem" ]; then
  echo "### Existing certificates found for $DOMAIN. Skipping creation."
  echo "    Delete $data_path/conf/live/$DOMAIN to force renewal."
  exit 0
fi

echo "### Downloading recommended TLS parameters ..."
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"

echo "### Creating dummy certificate for $DOMAIN ..."
openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 \
  -keyout "$data_path/conf/live/$DOMAIN/privkey.pem" \
  -out "$data_path/conf/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=localhost"

echo "### Starting nginx ..."
docker compose up --force-recreate -d nginx

echo "### Removing dummy certificate ..."
rm -rf "$data_path/conf/live/$DOMAIN"

echo "### Requesting Let's Encrypt certificate for $DOMAIN ..."
docker compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  -d "$DOMAIN" \
  --rsa-key-size $rsa_key_size \
  --agree-tos \
  --no-eff-email \
  --force-renewal

echo "### Reloading nginx ..."
docker compose exec nginx nginx -s reload

echo ""
echo "### Done! SSL certificate installed for $DOMAIN"
echo "### Now start all services: docker compose up -d"
