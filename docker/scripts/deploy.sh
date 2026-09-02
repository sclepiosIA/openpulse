#!/bin/bash
# ============================================
# Script de déploiement production
# OpenPulse - Self-Hosted
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
if [ ! -f "docker-compose.prod.yml" ]; then
    log_error "Ce script doit être exécuté depuis le répertoire docker/"
fi

# Variables
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

# Vérifier le fichier .env
if [ ! -f "$ENV_FILE" ]; then
    log_error "Fichier $ENV_FILE non trouvé. Copiez .env.example vers .env et configurez-le."
fi

log_info "============================================"
log_info "    Déploiement OpenPulse - Production    "
log_info "============================================"

# Étape 1: Pull des dernières images
log_info "Récupération des dernières images..."
docker-compose -f $COMPOSE_FILE pull db redis nginx certbot

# Étape 2: Build des images locales
log_info "Construction des images frontend et API..."
docker-compose -f $COMPOSE_FILE build --no-cache frontend api

# Étape 3: Arrêter les anciens conteneurs
log_info "Arrêt des conteneurs existants..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# Étape 4: Démarrer les services de base de données
log_info "Démarrage de PostgreSQL et Redis..."
docker-compose -f $COMPOSE_FILE up -d db redis
sleep 10

# Étape 5: Vérifier la santé de la base de données
log_info "Vérification de la base de données..."
RETRIES=30
until docker-compose -f $COMPOSE_FILE exec -T db pg_isready -U ${POSTGRES_USER:-marque} -d ${POSTGRES_DB:-marque_db} > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    log_info "En attente de PostgreSQL... ($RETRIES)"
    sleep 2
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    log_error "PostgreSQL n'a pas démarré à temps"
fi
log_success "PostgreSQL est prêt"

# Étape 6: Exécuter les migrations (si nécessaire)
log_info "Exécution des migrations..."
docker-compose -f $COMPOSE_FILE run --rm api npm run migrate || log_warning "Pas de migrations ou déjà appliquées"

# Étape 7: Démarrer l'API
log_info "Démarrage de l'API..."
docker-compose -f $COMPOSE_FILE up -d api
sleep 5

# Vérifier l'API
RETRIES=30
until curl -f http://localhost:4000/health > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    log_info "En attente de l'API... ($RETRIES)"
    sleep 2
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    log_error "L'API n'a pas démarré à temps"
fi
log_success "API est prête"

# Étape 8: Démarrer le frontend
log_info "Démarrage du frontend..."
docker-compose -f $COMPOSE_FILE up -d frontend
sleep 5

# Étape 9: Démarrer Nginx
log_info "Démarrage de Nginx..."
docker-compose -f $COMPOSE_FILE up -d nginx

# Étape 10: Démarrer Certbot
log_info "Démarrage de Certbot..."
docker-compose -f $COMPOSE_FILE up -d certbot

# Étape 11: Nettoyage
log_info "Nettoyage des images inutilisées..."
docker image prune -f

# Résumé
log_success "============================================"
log_success "    Déploiement terminé avec succès!        "
log_success "============================================"
echo ""
log_info "Services actifs:"
docker-compose -f $COMPOSE_FILE ps
echo ""
log_info "Accès:"
log_info "  - Application: https://votre-domaine.com"
log_info "  - API Health: https://votre-domaine.com/health"
echo ""
log_info "Commandes utiles:"
log_info "  - Logs: docker-compose -f $COMPOSE_FILE logs -f"
log_info "  - Status: docker-compose -f $COMPOSE_FILE ps"
log_info "  - Stop: docker-compose -f $COMPOSE_FILE down"
