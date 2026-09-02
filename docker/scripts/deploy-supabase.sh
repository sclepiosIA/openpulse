#!/bin/bash
# ============================================
# Script de déploiement - OpenPulse
# Configuration Supabase On-Premise
# ============================================

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions utilitaires
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Vérifier si on est dans le bon répertoire
if [ ! -f "docker-compose.supabase.yml" ]; then
    log_error "Ce script doit être exécuté depuis le répertoire docker/"
fi

# Détecter la commande docker-compose disponible
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    log_error "Ni docker-compose ni docker compose n'est disponible"
fi
log_info "Utilisation de: $DOCKER_COMPOSE"

# Variables
COMPOSE_FILE="docker-compose.supabase.yml"
ENV_FILE=".env"

# Vérifier le fichier .env
if [ ! -f "$ENV_FILE" ]; then
    log_error "Fichier $ENV_FILE non trouvé. Copiez .env.example vers .env et configurez-le."
fi

# Charger les variables d'environnement
source "$ENV_FILE"

# Vérifier les variables critiques
if [ -z "$SUPABASE_HOST" ] || [ "$SUPABASE_HOST" == "VOTRE_IP_PUBLIQUE" ]; then
    log_error "SUPABASE_HOST n'est pas configuré dans .env"
fi

if [ -z "$VITE_SUPABASE_URL" ] || [[ "$VITE_SUPABASE_URL" == *"VOTRE_IP_PUBLIQUE"* ]]; then
    log_error "VITE_SUPABASE_URL n'est pas configuré dans .env"
fi

log_info "============================================"
log_info "  Déploiement OpenPulse (Supabase On-Premise)"
log_info "============================================"
log_info "Supabase Host: $SUPABASE_HOST"
log_info "Supabase URL: $VITE_SUPABASE_URL"
echo ""

# Étape 1: Mettre à jour la config Nginx avec l'IP Supabase
log_info "Configuration de Nginx avec l'IP Supabase..."
sed -i "s/SUPABASE_HOST_PLACEHOLDER/$SUPABASE_HOST/g" nginx/nginx.supabase.conf
log_success "Nginx configuré"

# Étape 2: Vérifier la connectivité Supabase
log_info "Vérification de la connectivité Supabase..."
if curl -s --connect-timeout 5 "http://$SUPABASE_HOST:${SUPABASE_PORT:-8000}/rest/v1/" > /dev/null 2>&1; then
    log_success "Supabase accessible sur $SUPABASE_HOST:${SUPABASE_PORT:-8000}"
else
    log_warning "Impossible de contacter Supabase. Vérifiez que Supabase est démarré."
fi

# Étape 3: Build des images
log_info "Construction de l'image frontend..."
$DOCKER_COMPOSE -f $COMPOSE_FILE build --no-cache frontend
log_success "Image frontend construite"

# Étape 4: Arrêter les anciens conteneurs
log_info "Arrêt des conteneurs existants..."
$DOCKER_COMPOSE -f $COMPOSE_FILE down --remove-orphans

# Étape 5: Démarrer les services
log_info "Démarrage des services..."
$DOCKER_COMPOSE -f $COMPOSE_FILE up -d

# Étape 6: Vérifier la santé des services
log_info "Vérification de la santé des services..."
sleep 10

RETRIES=30
until curl -f http://localhost:80/health > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    log_info "En attente du frontend... ($RETRIES)"
    sleep 2
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    log_error "Le frontend n'a pas démarré à temps"
fi
log_success "Frontend accessible"

# Étape 7: Nettoyage
log_info "Nettoyage des images inutilisées..."
docker image prune -f

# Résumé
log_success "============================================"
log_success "    Déploiement terminé avec succès!        "
log_success "============================================"
echo ""
log_info "Services actifs:"
$DOCKER_COMPOSE -f $COMPOSE_FILE ps
echo ""
log_info "Accès:"
log_info "  - Application: http://$SUPABASE_HOST (ou https://gestion.exploitant.example.org)"
log_info "  - Supabase Studio: http://$SUPABASE_HOST:3000"
log_info "  - Health Check: http://$SUPABASE_HOST/health"
echo ""
log_info "Commandes utiles:"
log_info "  - Logs: $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
log_info "  - Status: $DOCKER_COMPOSE -f $COMPOSE_FILE ps"
log_info "  - Stop: $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo ""
log_warning "N'oubliez pas de configurer HTTPS avec Let's Encrypt pour la production!"
