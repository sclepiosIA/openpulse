#!/bin/bash
# ============================================
# Script d'initialisation SSL/TLS
# Phase 4 : Sécurité
# ============================================

set -e

# Configuration
DOMAIN=${DOMAIN:-"localhost"}
EMAIL=${SSL_EMAIL:-"admin@example.com"}
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
NGINX_CONF="/etc/nginx/conf.d/default.conf"

echo "🔐 SSL/TLS Initialization Script"
echo "================================"
echo "Domain: ${DOMAIN}"
echo "Email: ${EMAIL}"

# Vérifier si c'est un environnement de production
if [ "$DOMAIN" = "localhost" ]; then
  echo "ℹ️  Localhost detected - generating self-signed certificate"
  
  mkdir -p /etc/nginx/ssl
  
  # Générer un certificat auto-signé
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/privkey.pem \
    -out /etc/nginx/ssl/fullchain.pem \
    -subj "/CN=localhost"
  
  echo "✅ Self-signed certificate generated"
  
else
  echo "🌐 Production domain detected - using Let's Encrypt"
  
  # Vérifier si certbot est installé
  if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    apt-get update && apt-get install -y certbot python3-certbot-nginx
  fi
  
  # Vérifier si le certificat existe déjà
  if [ -d "$CERT_DIR" ]; then
    echo "ℹ️  Certificate already exists, checking renewal..."
    certbot renew --quiet
  else
    echo "📝 Requesting new certificate..."
    
    # Arrêter nginx temporairement pour le challenge HTTP
    if systemctl is-active --quiet nginx; then
      systemctl stop nginx
    fi
    
    # Obtenir le certificat
    certbot certonly --standalone \
      -d "$DOMAIN" \
      --email "$EMAIL" \
      --agree-tos \
      --non-interactive
    
    echo "✅ Certificate obtained"
  fi
  
  # Mettre à jour les liens symboliques
  ln -sf "${CERT_DIR}/fullchain.pem" /etc/nginx/ssl/fullchain.pem
  ln -sf "${CERT_DIR}/privkey.pem" /etc/nginx/ssl/privkey.pem
  
  # Configurer le renouvellement automatique
  echo "0 3 * * * certbot renew --quiet --deploy-hook 'nginx -s reload'" | crontab -
  echo "✅ Auto-renewal configured"
fi

# Générer les paramètres DH si nécessaire
DH_PARAMS="/etc/nginx/ssl/dhparam.pem"
if [ ! -f "$DH_PARAMS" ]; then
  echo "🔑 Generating DH parameters (this may take a while)..."
  openssl dhparam -out "$DH_PARAMS" 2048
  echo "✅ DH parameters generated"
fi

# Mettre à jour la configuration Nginx pour SSL
cat > /etc/nginx/snippets/ssl-params.conf << 'EOF'
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_ecdh_curve secp384r1;
ssl_session_timeout 10m;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=63072000" always;
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
EOF

echo ""
echo "✅ SSL initialization complete!"
echo ""
echo "Certificate location: /etc/nginx/ssl/"
echo "To test: curl -k https://${DOMAIN}/"
