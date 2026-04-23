#!/bin/bash
# ============================================================
# Setup SSL con Let's Encrypt + Cloudflare DNS challenge
# No requiere puerto 80 libre
# Ejecutar UNA SOLA VEZ en el primer despliegue
# Uso: bash scripts/setup-ssl.sh
# ============================================================

set -e

# Cargar .env.prod
if [ ! -f ".env.prod" ]; then
  echo "ERROR: No se encontró .env.prod"
  exit 1
fi

source .env.prod

# Validaciones
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "TUDOMINIO.COM" ]; then
  echo "ERROR: Configura DOMAIN en .env.prod"
  exit 1
fi
if [ -z "$CERTBOT_EMAIL" ] || [ "$CERTBOT_EMAIL" = "tu@email.com" ]; then
  echo "ERROR: Configura CERTBOT_EMAIL en .env.prod"
  exit 1
fi

# Verificar token de Cloudflare en cloudflare.ini
if grep -q "PEGAR_TOKEN_AQUI" nginx-ssl/cloudflare.ini; then
  echo "ERROR: Agrega tu token de Cloudflare en nginx-ssl/cloudflare.ini"
  exit 1
fi

echo "================================================"
echo "  Dominio  : $DOMAIN"
echo "  Puerto HTTP : ${HTTP_PORT:-8080}"
echo "  Puerto HTTPS: ${HTTPS_PORT:-8443}"
echo "================================================"

# Crear carpetas
mkdir -p nginx-ssl/certbot/conf

# Permisos restrictivos en cloudflare.ini (requerido por certbot)
chmod 600 nginx-ssl/cloudflare.ini

# Descargar parámetros TLS de Let's Encrypt
if [ ! -f "nginx-ssl/certbot/conf/options-ssl-nginx.conf" ]; then
  echo "→ Descargando parámetros TLS..."
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    > nginx-ssl/certbot/conf/options-ssl-nginx.conf
  openssl dhparam -out nginx-ssl/certbot/conf/ssl-dhparams.pem 2048 2>/dev/null
  echo "✓ Parámetros TLS listos"
fi

# Crear certificado temporal para que nginx arranque
if [ ! -d "nginx-ssl/certbot/conf/live/$DOMAIN" ]; then
  echo "→ Creando certificado temporal..."
  mkdir -p "nginx-ssl/certbot/conf/live/$DOMAIN"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "nginx-ssl/certbot/conf/live/$DOMAIN/privkey.pem" \
    -out    "nginx-ssl/certbot/conf/live/$DOMAIN/fullchain.pem" \
    -subj "/CN=$DOMAIN" 2>/dev/null
  echo "✓ Certificado temporal creado"
fi

# Levantar nginx con cert temporal
echo "→ Iniciando Nginx..."
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d nginx
sleep 3

# Obtener certificado real via Cloudflare DNS
echo "→ Solicitando certificado SSL a Let's Encrypt (via Cloudflare)..."
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$DOMAIN"

# Reemplazar cert temporal con el real y recargar nginx
echo "→ Recargando Nginx con certificado real..."
docker compose --env-file .env.prod -f docker-compose.prod.yml exec nginx nginx -s reload

# Levantar stack completo
echo "→ Levantando stack completo..."
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

echo ""
echo "================================================"
echo "  ✓ Setup completado"
echo "  Accede a: https://$DOMAIN:${HTTPS_PORT:-8443}"
echo "================================================"
