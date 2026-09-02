# ============================================
# Guide de Déploiement Complet - Self-Hosting
# OpenPulse
# ============================================

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Architecture](#architecture)
4. [Installation rapide](#installation-rapide)
5. [Configuration détaillée](#configuration-détaillée)
6. [Migration depuis Supabase](#migration-depuis-supabase)
7. [Sécurité](#sécurité)
8. [Monitoring](#monitoring)
9. [Maintenance](#maintenance)
10. [Dépannage](#dépannage)

---

## Vue d'ensemble

Ce guide explique comment déployer OpenPulse sur votre propre infrastructure, indépendamment de la plateforme initiale et Supabase. L'application est conteneurisée avec Docker pour une installation simplifiée.

### Composants

| Service | Description | Port |
|---------|-------------|------|
| **Frontend** | Application React/Vite | 3000 |
| **API** | Backend Express.js | 4000 |
| **PostgreSQL** | Base de données | 5432 |
| **Redis** | Cache et sessions | 6379 |
| **Nginx** | Reverse proxy + SSL | 80/443 |

---

## Prérequis

### Serveur

| Ressource | Minimum | Recommandé |
|-----------|---------|------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Stockage | 40 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Logiciels

```bash
# Docker
docker --version  # >= 24.0

# Docker Compose
docker-compose --version  # >= 2.20

# Git
git --version  # >= 2.30
```

### Réseau

- Domaine avec accès DNS (ex: gestion.exploitant.example.org)
- Ports 80 et 443 ouverts
- Connexion SSH au serveur

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Nginx (Port 443)                          │
│            SSL/TLS • Reverse Proxy • Rate Limiting           │
└──────────────────────────┬───────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│     Frontend        │         │       API           │
│     (React)         │         │    (Express.js)     │
│     Port 3000       │         │     Port 4000       │
└─────────────────────┘         └──────────┬──────────┘
                                           │
                           ┌───────────────┴───────────────┐
                           │                               │
                           ▼                               ▼
                ┌─────────────────────┐         ┌─────────────────────┐
                │    PostgreSQL       │         │       Redis         │
                │     Port 5432       │         │     Port 6379       │
                └─────────────────────┘         └─────────────────────┘
```

---

## Installation rapide

### Étape 1: Préparer le serveur

```bash
# Se connecter au serveur
ssh root@votre-serveur.com

# Mettre à jour le système
apt update && apt upgrade -y

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Installer Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Vérifier l'installation
docker --version
docker-compose --version
```

### Étape 2: Cloner le projet

```bash
# Créer le répertoire
mkdir -p /opt/marque
cd /opt/marque

# Cloner le repository
git clone https://github.com/votre-org/marque-ia.git .

# Aller dans le répertoire docker
cd docker
```

### Étape 3: Configurer les variables

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer les variables
nano .env
```

**Variables essentielles à modifier:**

```env
# Sécurité (OBLIGATOIRE - générer des valeurs uniques)
POSTGRES_PASSWORD=VotreMotDePasseSuperSecurise123!
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://votre-instance.openai.azure.com/...
AZURE_OPENAI_API_KEY=votre-cle-api

# Email OVH
SMTP_USER=contact@votre-domaine.com
SMTP_PASS=votre-mot-de-passe-email

# Domaine
CORS_ORIGIN=https://votre-domaine.com
```

### Étape 4: Configurer SSL

```bash
# Créer les répertoires pour Certbot
mkdir -p certbot/conf certbot/www

# Modifier nginx.conf pour votre domaine
sed -i 's/gestion.exploitant.example.org/votre-domaine.com/g' nginx/nginx.conf
```

### Étape 5: Déployer

```bash
# Rendre le script exécutable
chmod +x scripts/deploy.sh

# Lancer le déploiement
./scripts/deploy.sh
```

### Étape 6: Obtenir le certificat SSL

```bash
# Première fois: obtenir le certificat
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d votre-domaine.com \
    --email admin@votre-domaine.com \
    --agree-tos \
    --no-eff-email

# Redémarrer Nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## Configuration détaillée

### Variables d'environnement complètes

```env
# ============================================
# Application
# ============================================
NODE_ENV=production
APP_URL=https://gestion.exploitant.example.org

# ============================================
# Base de données PostgreSQL
# ============================================
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_USER=marque
POSTGRES_PASSWORD=CHANGER_MOT_DE_PASSE_SECURISE
POSTGRES_DB=marque_db
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}

# ============================================
# JWT Authentication
# ============================================
JWT_SECRET=GENERER_UN_SECRET_DE_256_BITS_MINIMUM
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# ============================================
# Azure OpenAI (GPT-5)
# ============================================
AZURE_OPENAI_ENDPOINT=https://votre-instance.openai.azure.com/openai/deployments/gpt-5/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=votre-cle-api-azure

# ============================================
# Email (OVH SMTP/IMAP)
# ============================================
SMTP_HOST=smtp.example.org
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contact@exploitant.example.org
SMTP_PASS=votre-mot-de-passe-email

IMAP_HOST=smtp.example.org
IMAP_PORT=993

SUPPORT_EMAIL=support@exploitant.example.org
SUPPORT_EMAIL_PASSWORD=votre-mot-de-passe-support

# ============================================
# Stockage S3 Compatible
# ============================================
S3_ENDPOINT=https://s3.example.org
S3_ACCESS_KEY=votre-access-key
S3_SECRET_KEY=votre-secret-key
S3_BUCKET=marque-storage
S3_REGION=gra

# ============================================
# Push Notifications (VAPID)
# ============================================
# Générer avec: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=YOUR_VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:contact@exploitant.example.org

# ============================================
# Sécurité
# ============================================
ENCRYPTION_KEY=GENERER_UNE_CLE_DE_32_CARACTERES
CORS_ORIGIN=https://gestion.exploitant.example.org

# ============================================
# Redis
# ============================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379
```

### Configuration Nginx personnalisée

Le fichier `nginx/nginx.conf` contient:
- Reverse proxy vers frontend et API
- Configuration SSL/TLS moderne
- Rate limiting
- Headers de sécurité
- Compression Gzip
- Cache des assets statiques

---

## Migration depuis Supabase / plateforme initiale tierce

### Scripts de Migration Automatisés

Nous fournissons des scripts pour faciliter la migration:

| Script | Description |
|--------|-------------|
| `scripts/export-plateforme-edition-db.sh` | Exporte la BDD depuis Supabase Cloud |
| `scripts/sync-from-plateforme-edition.sh` | Synchronise les mises à jour |
| `scripts/install-prerequisites.sh` | Installe tous les prérequis |

### Étape 1: Exporter les données

```bash
# Méthode recommandée: utiliser notre script
cd /opt/marque
./scripts/export-plateforme-edition-db.sh

# Les fichiers sont générés dans ./exports/:
# - schema_YYYYMMDD_HHMMSS.sql (structure)
# - data_YYYYMMDD_HHMMSS.sql (données)
# - README_IMPORT.md (instructions)
```

Alternative manuelle:
```bash
# Depuis Supabase Dashboard > Settings > Database
# Télécharger le backup SQL

# Ou via CLI
supabase db dump --project-ref your-project-ref > backup.sql
supabase db dump --project-ref your-project-ref --data-only > data.sql
```

### Étape 2: Initialiser le schéma

```bash
# Option A: Utiliser le schéma consolidé (recommandé pour nouvelles installations)
docker exec -i marque-db psql -U marque -d marque_db < docker/init-db/00-full-schema.sql

# Option B: Importer depuis l'export la plateforme initiale
docker exec -i marque-db psql -U marque -d marque_db < exports/schema_*.sql
```

### Étape 3: Importer les données

```bash
docker exec -i marque-db psql -U marque -d marque_db < exports/data_*.sql

# Vérifier l'import
docker exec marque-db psql -U marque -d marque_db -c \
    "SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema='public';"
# Résultat attendu: 436 tables
```

### Étape 4: Migrer le stockage

```bash
# Télécharger les fichiers depuis Supabase Storage
# Via Dashboard: Storage > Sélectionner bucket > Download

# Uploader vers votre stockage S3 compatible
# Exemple avec MinIO CLI:
mc cp --recursive local/files/ myminio/marque-storage/
```

### Étape 5: Mettre à jour les secrets

Transférer les secrets Supabase vers les variables d'environnement dans `docker/.env`:

| Secret Supabase | Variable .env |
|-----------------|---------------|
| `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_ENDPOINT` |
| `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_API_KEY` |
| `EMAIL_ENCRYPTION_KEY` | `ENCRYPTION_KEY` |
| `SUPPORT_EMAIL_PASSWORD` | `SUPPORT_EMAIL_PASSWORD` |
| `VAPID_PUBLIC_KEY` | `VAPID_PUBLIC_KEY` |
| `VAPID_PRIVATE_KEY` | `VAPID_PRIVATE_KEY` |

### Synchronisation Continue

Pour maintenir votre installation à jour avec les évolutions la plateforme initiale:

```bash
# Synchronisation automatique
./scripts/sync-from-plateforme-edition.sh

# Mode dry-run (prévisualisation)
./scripts/sync-from-plateforme-edition.sh --dry-run

# Migrations uniquement
./scripts/sync-from-plateforme-edition.sh --migrations-only
```

---

## Sécurité

### Configuration pare-feu (UFW)

```bash
# Activer UFW
ufw enable

# Ports autorisés
ufw allow 22/tcp    # SSH (ou votre port personnalisé)
ufw allow 80/tcp    # HTTP (redirection)
ufw allow 443/tcp   # HTTPS

# Vérifier
ufw status
```

### Fail2ban

```bash
# Installer
apt install fail2ban -y

# Configuration pour SSH
cat > /etc/fail2ban/jail.local << EOF
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF

# Redémarrer
systemctl restart fail2ban
```

### SSH sécurisé

```bash
# Modifier /etc/ssh/sshd_config
Port 2222                    # Changer le port
PermitRootLogin no           # Désactiver root
PasswordAuthentication no    # Clés SSH uniquement
MaxAuthTries 3

# Redémarrer SSH
systemctl restart sshd
```

### Mises à jour automatiques

```bash
# Installer unattended-upgrades
apt install unattended-upgrades -y

# Configurer
dpkg-reconfigure -plow unattended-upgrades
```

---

## Monitoring

### Logs en temps réel

```bash
# Tous les services
docker-compose -f docker-compose.prod.yml logs -f

# Service spécifique
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f db
```

### État des conteneurs

```bash
# Status
docker-compose -f docker-compose.prod.yml ps

# Ressources
docker stats
```

### Health checks

```bash
# API
curl -f http://localhost:4000/health

# Frontend
curl -f http://localhost:3000/health

# Base de données
docker-compose -f docker-compose.prod.yml exec db pg_isready -U marque
```

### Monitoring avancé (optionnel)

Pour un monitoring complet, utilisez le stack fourni:

```bash
# Démarrer le monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# Accès:
# - Grafana: http://localhost:3000
# - Prometheus: http://localhost:9090
```

---

## Maintenance

### Sauvegardes

```bash
# Exécuter une sauvegarde
./docker/scripts/openpulse-backup.sh

# Configurer une sauvegarde quotidienne (cron)
echo "0 2 * * * /opt/marque/docker/scripts/backup.sh" | crontab -
```

### Restauration

```bash
# Lister les backups disponibles
ls -lh backups/

# Restaurer un répertoire produit par le script canonique
./docker/scripts/openpulse-restore.sh backups/<horodatage>
```

### Mises à jour

```bash
# Récupérer les dernières modifications
cd /opt/marque
git pull origin main

# Rebuilder et redéployer
cd docker
./scripts/deploy.sh
```

### Nettoyage

```bash
# Supprimer les images inutilisées
docker image prune -a -f

# Supprimer les volumes orphelins
docker volume prune -f

# Logs Docker (attention à l'espace disque)
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

---

## Dépannage

### Problèmes courants

#### L'application ne démarre pas

```bash
# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs

# Vérifier les variables d'environnement
docker-compose -f docker-compose.prod.yml config
```

#### Erreur de connexion à la base de données

```bash
# Tester la connexion
docker-compose -f docker-compose.prod.yml exec db psql -U marque -d marque_db -c "SELECT 1"

# Vérifier que le conteneur est en cours d'exécution
docker-compose -f docker-compose.prod.yml ps db
```

#### Certificat SSL expiré

```bash
# Renouveler le certificat
docker-compose -f docker-compose.prod.yml run --rm certbot renew

# Redémarrer Nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

#### Performance lente

```bash
# Vérifier les ressources
docker stats

# Vérifier l'espace disque
df -h

# Vérifier les connexions DB
docker-compose -f docker-compose.prod.yml exec db psql -U marque -c "SELECT count(*) FROM pg_stat_activity"
```

---

## Support

Pour toute question ou problème:
- **Email**: support@exploitant.example.org
- **Documentation**: https://docs.exploitant.example.org

---

*Documentation mise à jour en mars 2026 — v1.9.0*
