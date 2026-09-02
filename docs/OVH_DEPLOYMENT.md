# Guide de Déploiement OVH - OpenPulse

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

## Table des Matières

1. [Choix de l'Offre OVH](#choix-de-loffre-ovh)
2. [Configuration Initiale VPS](#configuration-initiale-vps)
3. [Installation des Prérequis](#installation-des-prérequis)
4. [Déploiement avec Docker](#déploiement-avec-docker)
5. [Configuration DNS](#configuration-dns)
6. [SSL avec Let's Encrypt](#ssl-avec-lets-encrypt)
7. [Configuration Email OVH](#configuration-email-ovh)
8. [Sauvegardes Automatisées](#sauvegardes-automatisées)
9. [Monitoring](#monitoring)
10. [Maintenance](#maintenance)

---

## Choix de l'Offre OVH

### VPS Recommandés

| Offre | Specs | Usage | Prix/mois |
|-------|-------|-------|-----------|
| **VPS Starter** | 2 vCPU, 4 GB RAM, 80 GB SSD | Développement/Test | ~6€ |
| **VPS Essential** | 4 vCPU, 8 GB RAM, 160 GB SSD | Production PME | ~12€ |
| **VPS Comfort** | 8 vCPU, 16 GB RAM, 320 GB SSD | Production Enterprise | ~24€ |

### Recommandation pour OpenPulse

**VPS Essential (4 vCPU, 8 GB RAM)** est le minimum recommandé pour une utilisation en production avec :
- 10-50 utilisateurs simultanés
- Base de données < 10 GB
- Migration vers 254 Edge Functions Deno (progressive)
- Email sync horaire

### Options Supplémentaires

- **Backup automatique OVH** : +2€/mois (recommandé)
- **IP Failover** : +2€/mois (haute disponibilité)
- **Stockage additionnel** : Variable selon besoins

---

## Configuration Initiale VPS

### 1. Accès SSH Initial

```bash
# Connexion avec les identifiants OVH
ssh root@votre-vps.ovh.net

# Changer le mot de passe root immédiatement
passwd
```

### 2. Mise à Jour Système

```bash
# Mise à jour complète
apt update && apt upgrade -y

# Installer les outils essentiels
apt install -y \
  curl \
  wget \
  git \
  vim \
  htop \
  unzip \
  fail2ban \
  ufw
```

### 3. Créer Utilisateur Non-Root

```bash
# Créer utilisateur
adduser marque

# Ajouter aux groupes sudo et docker (docker sera installé après)
usermod -aG sudo marque

# Configurer SSH pour le nouvel utilisateur
mkdir -p /home/marque/.ssh
cp ~/.ssh/authorized_keys /home/marque/.ssh/
chown -R marque:marque /home/marque/.ssh
chmod 700 /home/marque/.ssh
chmod 600 /home/marque/.ssh/authorized_keys
```

### 4. Sécuriser SSH

```bash
# Éditer la configuration SSH
nano /etc/ssh/sshd_config
```

Modifications recommandées :

```
# Désactiver login root
PermitRootLogin no

# Désactiver authentification par mot de passe (si clés SSH configurées)
PasswordAuthentication no

# Changer le port SSH (optionnel mais recommandé)
Port 2222

# Limiter les utilisateurs autorisés
AllowUsers marque
```

```bash
# Redémarrer SSH
systemctl restart sshd
```

### 5. Configurer le Pare-feu

```bash
# Configuration UFW
ufw default deny incoming
ufw default allow outgoing

# Autoriser SSH (avec le nouveau port si changé)
ufw allow 2222/tcp

# Autoriser HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Activer le pare-feu
ufw enable

# Vérifier le statut
ufw status verbose
```

### 6. Configurer Fail2ban

```bash
# Créer configuration locale
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
nano /etc/fail2ban/jail.local
```

Ajouter/modifier :

```ini
[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
```

```bash
# Redémarrer Fail2ban
systemctl restart fail2ban
systemctl enable fail2ban
```

---

## Installation des Prérequis

### Docker et Docker Compose

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker marque

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Vérifier les installations
docker --version
docker-compose --version
```

### Node.js (pour scripts de migration)

```bash
# Installer Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier
node --version
npm --version
```

### PostgreSQL Client (pour migrations)

```bash
sudo apt install -y postgresql-client
```

---

## Déploiement avec Docker

### 1. Cloner le Repository

```bash
# Se connecter en tant que marque
su - marque

# Créer répertoire
mkdir -p /home/marque/apps
cd /home/marque/apps

# Cloner le repo
git clone https://github.com/votre-org/marque-ia.git
cd marque-ia
```

### 2. Configuration Environnement

```bash
# Copier et configurer les variables
cp docker/.env.example docker/.env
nano docker/.env
```

Exemple de configuration production OVH :

```env
# === Application ===
NODE_ENV=production
APP_URL=https://gestion.exploitant.example.org

# === Base de données ===
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_USER=marque
POSTGRES_PASSWORD=MotDePasseTresSecurise123!
POSTGRES_DB=marque_db
DATABASE_URL=postgresql://marque:MotDePasseTresSecurise123!@db:5432/marque_db

# === JWT ===
JWT_SECRET=VotreSecretJWT256BitsMinimumTresLongEtSecurise
JWT_EXPIRES_IN=7d

# === Azure OpenAI ===
AZURE_OPENAI_ENDPOINT=https://votre-instance.openai.azure.com/openai/deployments/gpt-5/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=votre-cle-api-azure

# === Email (OVH) ===
SMTP_HOST=smtp.example.org
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contact@exploitant.example.org
SMTP_PASS=votre-mot-de-passe-email
IMAP_HOST=smtp.example.org
IMAP_PORT=993

# === Push Notifications ===
# Generate VAPID keys with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY_HERE
VAPID_PRIVATE_KEY=YOUR_VAPID_PRIVATE_KEY_HERE
VAPID_SUBJECT=mailto:contact@exploitant.example.org

# === Sécurité ===
ENCRYPTION_KEY=CleDeChiffrement32CaracteresMin
CORS_ORIGIN=https://gestion.exploitant.example.org
```

### 3. Lancer les Conteneurs

```bash
# Build et démarrage
cd /home/marque/apps/marque-ia
docker-compose -f docker/docker-compose.prod.yml up -d --build

# Vérifier le statut
docker-compose -f docker/docker-compose.prod.yml ps

# Voir les logs
docker-compose -f docker/docker-compose.prod.yml logs -f
```

### 4. Initialiser la Base de Données

```bash
# Exécuter les migrations
docker-compose -f docker/docker-compose.prod.yml exec api npm run migrate

# Ou manuellement
docker-compose -f docker/docker-compose.prod.yml exec db psql -U marque -d marque_db -f /migrations/init.sql
```

---

## Configuration DNS

### Chez OVH (Manager)

1. Connectez-vous à votre espace client OVH
2. Allez dans **Noms de domaine** → votre domaine
3. Onglet **Zone DNS**

### Enregistrements à Créer

| Type | Sous-domaine | Cible | TTL |
|------|--------------|-------|-----|
| A | gestion | IP_DU_VPS | 3600 |
| A | api | IP_DU_VPS | 3600 |
| AAAA | gestion | IPv6_DU_VPS | 3600 |
| CNAME | www.gestion | gestion.exploitant.example.org. | 3600 |

### Vérification

```bash
# Tester la résolution DNS
dig gestion.exploitant.example.org
nslookup gestion.exploitant.example.org
```

---

## SSL avec Let's Encrypt

### Installation Certbot

```bash
# Installer Certbot pour Nginx
sudo apt install -y certbot python3-certbot-nginx
```

### Obtenir le Certificat

```bash
# Obtenir et configurer SSL automatiquement
sudo certbot --nginx -d gestion.exploitant.example.org -d api.exploitant.example.org

# Options recommandées lors de l'assistant:
# - Redirection HTTP → HTTPS : Oui
# - Email pour notifications : admin@exploitant.example.org
```

### Renouvellement Automatique

```bash
# Tester le renouvellement
sudo certbot renew --dry-run

# Vérifier le cron (déjà configuré par Certbot)
sudo systemctl status certbot.timer
```

### Configuration Nginx avec SSL

Le fichier `/etc/nginx/sites-available/marque` devrait ressembler à :

```nginx
# Redirection HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name gestion.exploitant.example.org api.exploitant.example.org;
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name gestion.exploitant.example.org;

    # Certificats Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/gestion.exploitant.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gestion.exploitant.example.org/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Frontend React
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API Backend
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

---

## Configuration Email OVH

### Paramètres IMAP/SMTP OVH

| Protocole | Serveur | Port | Sécurité |
|-----------|---------|------|----------|
| IMAP | smtp.example.org | 993 | SSL/TLS |
| SMTP | smtp.example.org | 465 | SSL/TLS |
| SMTP (alt) | smtp.example.org | 587 | STARTTLS |

### Configuration dans l'Application

Les identifiants email sont stockés dans les variables d'environnement (voir section Configuration Environnement).

### Test de Connexion Email

```bash
# Tester IMAP
openssl s_client -connect smtp.example.org:993

# Tester SMTP
openssl s_client -connect smtp.example.org:465
```

---

## Sauvegardes Automatisées

### Script de Backup

```bash
# Créer le script
sudo nano /home/marque/scripts/backup.sh
```

```bash
#!/bin/bash
# /home/marque/scripts/backup.sh

set -e

BACKUP_DIR="/home/marque/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Créer répertoire
mkdir -p $BACKUP_DIR

echo "[$DATE] Starting backup..."

# 1. Backup PostgreSQL
docker exec marque-db pg_dump -U marque marque_db | gzip > $BACKUP_DIR/db_$DATE.sql.gz
echo "  Database backed up"

# 2. Backup uploads/storage
if [ -d "/home/marque/apps/marque-ia/uploads" ]; then
  tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/marque/apps/marque-ia/uploads
  echo "  Uploads backed up"
fi

# 3. Backup configuration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  /home/marque/apps/marque-ia/docker/.env \
  /etc/nginx/sites-available/marque \
  /etc/letsencrypt
echo "  Config backed up"

# 4. Supprimer les anciens backups
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
echo "  Old backups cleaned"

# 5. Optionnel: Upload vers stockage externe (OVH Object Storage, S3...)
# rclone sync $BACKUP_DIR remote:marque-backups/

echo "[$DATE] Backup completed!"
```

```bash
# Rendre exécutable
chmod +x /home/marque/scripts/backup.sh
```

### Crontab

```bash
# Éditer crontab
crontab -e
```

Ajouter :

```cron
# Backup quotidien à 3h du matin
0 3 * * * /home/marque/scripts/backup.sh >> /var/log/marque-backup.log 2>&1

# Nettoyage logs Docker hebdomadaire
0 4 * * 0 docker system prune -f >> /var/log/docker-prune.log 2>&1
```

---

## Monitoring

### Monitoring Simple avec Docker Stats

```bash
# Créer script de monitoring
nano /home/marque/scripts/monitor.sh
```

```bash
#!/bin/bash
# /home/marque/scripts/monitor.sh

echo "=== Docker Stats ==="
docker stats --no-stream

echo ""
echo "=== Disk Usage ==="
df -h /

echo ""
echo "=== Memory Usage ==="
free -h

echo ""
echo "=== Recent Logs ==="
docker-compose -f /home/marque/apps/marque-ia/docker/docker-compose.prod.yml logs --tail=20 api
```

### Alertes par Email

```bash
# Script d'alerte
nano /home/marque/scripts/alert.sh
```

```bash
#!/bin/bash
# /home/marque/scripts/alert.sh

THRESHOLD_DISK=80
THRESHOLD_MEM=90

# Check disk
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt $THRESHOLD_DISK ]; then
  echo "ALERT: Disk usage at $DISK_USAGE%" | mail -s "[Marque] Disk Alert" admin@exploitant.example.org
fi

# Check memory
MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ $MEM_USAGE -gt $THRESHOLD_MEM ]; then
  echo "ALERT: Memory usage at $MEM_USAGE%" | mail -s "[Marque] Memory Alert" admin@exploitant.example.org
fi

# Check API health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://gestion.exploitant.example.org/health)
if [ $HTTP_CODE -ne 200 ]; then
  echo "ALERT: API returned HTTP $HTTP_CODE" | mail -s "[Marque] API Down" admin@exploitant.example.org
fi
```

### Crontab Monitoring

```cron
# Check toutes les 5 minutes
*/5 * * * * /home/marque/scripts/alert.sh >> /var/log/marque-alerts.log 2>&1
```

### Prometheus + Grafana (Optionnel)

Pour un monitoring plus avancé, utilisez le fichier `docker/docker-compose.monitoring.yml` :

```bash
# 1. Configurer les credentials (OBLIGATOIRE - ne jamais utiliser les valeurs par défaut)
export GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 24)
export SENTRY_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
export SENTRY_DB_PASSWORD=$(openssl rand -base64 24)

# 2. Sauvegarder les credentials de façon sécurisée
echo "GRAFANA_ADMIN_PASSWORD=$GRAFANA_ADMIN_PASSWORD" >> ~/.marque-secrets
chmod 600 ~/.marque-secrets

# 3. Démarrer le monitoring
docker-compose -f docker/docker-compose.monitoring.yml up -d

# 4. Accéder à Grafana: http://votre-ip:3001
# Login: admin / (voir le mot de passe dans ~/.marque-secrets)
```

> ⚠️ **SÉCURITÉ**: Ne jamais utiliser de credentials par défaut en production.

---

## Maintenance

### Mise à Jour de l'Application

```bash
#!/bin/bash
# /home/marque/scripts/update.sh

cd /home/marque/apps/marque-ia

echo "Pulling latest code..."
git pull origin main

echo "Building new images..."
docker-compose -f docker/docker-compose.prod.yml build

echo "Restarting services..."
docker-compose -f docker/docker-compose.prod.yml up -d

echo "Cleaning old images..."
docker image prune -f

echo "Update complete!"
```

### Mise à Jour Système

```bash
# Mise à jour mensuelle recommandée
sudo apt update && sudo apt upgrade -y

# Redémarrer si nécessaire (kernel updates)
sudo reboot
```

### Logs Rotation

```bash
# Configurer logrotate pour les logs Docker
sudo nano /etc/logrotate.d/docker
```

```
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
```

### Commandes Utiles

```bash
# Voir l'espace disque
df -h

# Voir les processus gourmands
htop

# Nettoyer Docker
docker system prune -a

# Redémarrer les services
docker-compose -f docker/docker-compose.prod.yml restart

# Voir les logs en temps réel
docker-compose -f docker/docker-compose.prod.yml logs -f --tail=100

# Accéder au conteneur API
docker-compose -f docker/docker-compose.prod.yml exec api /bin/sh

# Accéder à PostgreSQL
docker-compose -f docker/docker-compose.prod.yml exec db psql -U marque -d marque_db
```

---

## Checklist Post-Déploiement OVH

### Sécurité

- [ ] SSH sécurisé (port changé, root désactivé)
- [ ] Fail2ban actif
- [ ] UFW configuré
- [ ] SSL Let's Encrypt installé
- [ ] Mots de passe forts

### Application

- [ ] Docker running
- [ ] API health check OK
- [ ] Frontend accessible
- [ ] Base de données migrée
- [ ] Emails fonctionnels

### Monitoring

- [ ] Script de backup configuré
- [ ] Crontab backup actif
- [ ] Alertes email configurées
- [ ] Logs accessibles

### Documentation

- [ ] Accès documentés (IP, ports, credentials)
- [ ] Procédures de rollback testées
- [ ] Contacts d'urgence définis
