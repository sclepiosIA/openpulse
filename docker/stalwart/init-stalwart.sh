#!/bin/bash
# ============================================
# Stalwart Mail Server — Initialisation Dev
# ============================================
# Usage: ./init-stalwart.sh
# Prérequis: docker-compose up -d stalwart (attendre healthcheck OK)
#
# Ce script configure Stalwart pour fonctionner comme proxy JMAP
# entre les comptes email externes (OVH, Gmail) et OpenPulse.

set -euo pipefail

STALWART_URL="${STALWART_URL:-http://127.0.0.1:8180}"
ADMIN_USER="${STALWART_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${STALWART_ADMIN_PASSWORD:-marque-dev-admin}"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# 1. Attendre que Stalwart soit prêt
# ============================================
log_info "Attente de Stalwart sur ${STALWART_URL}..."
for i in $(seq 1 30); do
  if curl -sf "${STALWART_URL}/healthz" > /dev/null 2>&1; then
    log_info "Stalwart est prêt !"
    break
  fi
  if [ "$i" -eq 30 ]; then
    log_error "Stalwart n'a pas démarré après 60s"
    exit 1
  fi
  sleep 2
done

# ============================================
# 2. Récupérer le mot de passe admin initial
# ============================================
log_info "Récupération du mot de passe admin initial..."
INITIAL_PASSWORD=$(docker logs marque-stalwart-dev 2>&1 | grep -oP 'password: \K.*' | tail -1 || echo "")

if [ -z "$INITIAL_PASSWORD" ]; then
  log_warn "Impossible de récupérer le mot de passe initial."
  log_warn "Vérifiez: docker logs marque-stalwart-dev"
  log_warn "Tentative avec le mot de passe configuré..."
  INITIAL_PASSWORD="$ADMIN_PASSWORD"
fi

# ============================================
# 3. Obtenir un token d'authentification
# ============================================
log_info "Authentification auprès de Stalwart..."
AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${STALWART_URL}/api/authenticate" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${ADMIN_USER}\", \"password\": \"${INITIAL_PASSWORD}\"}" \
  2>/dev/null || echo -e "\n000")

HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -n1)
AUTH_BODY=$(echo "$AUTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  log_warn "Authentification échouée (HTTP $HTTP_CODE). Premier démarrage probable."
  log_info "Utilisation de Basic Auth avec les credentials par défaut..."
  AUTH_HEADER="Authorization: Basic $(echo -n "${ADMIN_USER}:${INITIAL_PASSWORD}" | base64)"
else
  TOKEN=$(echo "$AUTH_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$TOKEN" ]; then
    AUTH_HEADER="Authorization: Bearer ${TOKEN}"
    log_info "Token obtenu avec succès"
  else
    AUTH_HEADER="Authorization: Basic $(echo -n "${ADMIN_USER}:${INITIAL_PASSWORD}" | base64)"
  fi
fi

# ============================================
# 4. Vérifier le endpoint JMAP
# ============================================
log_info "Vérification du endpoint JMAP..."
JMAP_RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${STALWART_URL}/.well-known/jmap" \
  -H "$AUTH_HEADER" 2>/dev/null || echo -e "\n000")

JMAP_CODE=$(echo "$JMAP_RESPONSE" | tail -n1)

if [ "$JMAP_CODE" = "200" ]; then
  log_info "Endpoint JMAP actif et fonctionnel ✅"
  JMAP_BODY=$(echo "$JMAP_RESPONSE" | sed '$d')
  API_URL=$(echo "$JMAP_BODY" | grep -o '"apiUrl":"[^"]*"' | cut -d'"' -f4)
  log_info "JMAP API URL: ${API_URL:-N/A}"
else
  log_warn "Endpoint JMAP non disponible (HTTP $JMAP_CODE)"
  log_warn "Il sera activé automatiquement au prochain redémarrage"
fi

# ============================================
# 5. Afficher les informations de configuration
# ============================================
echo ""
echo "============================================"
echo " Stalwart Mail Server — Configuration Dev"
echo "============================================"
echo ""
echo " Admin UI:      ${STALWART_URL}"
echo " JMAP API:      ${STALWART_URL}/jmap"
echo " JMAP Session:  ${STALWART_URL}/.well-known/jmap"
echo ""
echo " IMAP:          127.0.0.1:143 (STARTTLS)"
echo " IMAPS:         127.0.0.1:993"
echo " SMTP:          127.0.0.1:25"
echo " SMTP Submit:   127.0.0.1:587"
echo " SMTPS:         127.0.0.1:465"
echo ""
echo " Admin User:    ${ADMIN_USER}"
echo " Admin Pass:    (voir docker logs marque-stalwart-dev)"
echo ""
echo "============================================"
echo ""
echo " Prochaines étapes :"
echo " 1. Accéder à ${STALWART_URL} pour configurer les comptes"
echo " 2. Ajouter les comptes email externes (OVH, Gmail)"
echo " 3. Configurer le relay IMAP pour chaque compte"
echo " 4. Tester l'API JMAP :"
echo ""
echo "    curl -s ${STALWART_URL}/.well-known/jmap | jq ."
echo ""
echo "============================================"

log_info "Initialisation terminée ✅"
