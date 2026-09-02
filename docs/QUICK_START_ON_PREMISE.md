# 🚀 Guide Rapide - Installation On-Premise

> **Version**: 1.9.0 | **Temps estimé**: 30-45 minutes | **Niveau**: Débutant

Ce guide vous accompagne **pas à pas** pour installer OpenPulse sur votre propre serveur.

---

## 📋 Prérequis

### Serveur Minimum

| Ressource | Minimum | Recommandé |
|-----------|---------|------------|
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 4 GB | 8 GB |
| **Stockage** | 40 GB SSD | 100 GB SSD |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Réseau** | IP publique + Domaine | IP publique + Domaine |

### Ce dont vous avez besoin avant de commencer

- ✅ Accès SSH à votre serveur (root ou sudo)
- ✅ Un nom de domaine pointant vers votre serveur
- ✅ Compte Azure OpenAI avec GPT-5 déployé (optionnel mais recommandé)
- ✅ Compte email SMTP pour l'envoi d'emails (OVH, Gmail, SendGrid...)

---

## 🛠️ Installation en 10 Étapes

### Étape 1/10 : Se connecter au serveur

```bash
# Ouvrez un terminal et connectez-vous à votre serveur
# Remplacez VOTRE_IP par l'adresse IP de votre serveur
ssh root@VOTRE_IP

# Si vous utilisez une clé SSH:
ssh -i ~/.ssh/votre_cle root@VOTRE_IP
```

**✅ Vérification**: Vous devez voir le prompt de votre serveur (ex: `root@serveur:~#`)

---

### Étape 2/10 : Installer les prérequis automatiquement

```bash
# Télécharger et exécuter le script d'installation
curl -fsSL https://raw.githubusercontent.com/marqueIA/marque-client-compass/main/scripts/install-prerequisites.sh -o install.sh

# Rendre exécutable et lancer
chmod +x install.sh
./install.sh

# OU installation manuelle:
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | bash
```

**✅ Vérification**:
```bash
docker --version
# Doit afficher: Docker version 24.x.x ou supérieur
```

---

### Étape 3/10 : Cloner le projet

```bash
# Créer le répertoire du projet
mkdir -p /opt/marque
cd /opt/marque

# Cloner le repository (remplacez par votre URL)
git clone https://github.com/marqueIA/marque-client-compass.git .

# Vérifier le contenu
ls -la
# Vous devez voir: docker/, docs/, src/, supabase/, etc.
```

---

### Étape 4/10 : Configurer les variables d'environnement

```bash
# Aller dans le répertoire docker
cd docker

# Copier le fichier d'exemple
cp .env.example .env

# Éditer le fichier de configuration
nano .env
```

**⚠️ Variables OBLIGATOIRES à modifier:**

```env
# 1. SÉCURITÉ - Générer des mots de passe uniques
# Exécutez ces commandes pour générer des valeurs sécurisées:
#   openssl rand -base64 24  → pour POSTGRES_PASSWORD
#   openssl rand -base64 48  → pour JWT_SECRET
#   openssl rand -hex 16     → pour ENCRYPTION_KEY

POSTGRES_PASSWORD=CollerLaValeurGénérée123!
JWT_SECRET=CollerLaValeurGénérée456!
ENCRYPTION_KEY=CollerLaValeurGénérée789

# 2. AZURE OPENAI (si vous utilisez l'IA)
AZURE_OPENAI_ENDPOINT=https://VOTRE_INSTANCE.openai.azure.com/openai/deployments/gpt-5/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=votre-cle-api-azure

# 3. EMAIL (pour l'envoi de notifications)
SMTP_HOST=smtp.example.org
SMTP_PORT=465
SMTP_USER=contact@votre-domaine.com
SMTP_PASS=votre-mot-de-passe-email

# 4. DOMAINE
APP_URL=https://votre-domaine.com
CORS_ORIGIN=https://votre-domaine.com
```

**💡 Astuce**: Générez vos mots de passe dans un terminal séparé:
```bash
# Générer POSTGRES_PASSWORD
openssl rand -base64 24
# Exemple de résultat: Kj9xP2mN8vL3qR5tY7wZ1aB4

# Générer JWT_SECRET
openssl rand -base64 48

# Générer ENCRYPTION_KEY
openssl rand -hex 16
```

Sauvegardez avec `Ctrl+O`, puis `Enter`, puis `Ctrl+X` pour quitter nano.

---

### Étape 5/10 : Configurer Nginx pour votre domaine

```bash
# Éditer la configuration Nginx
nano nginx/nginx.conf

# Remplacer toutes les occurrences de "gestion.exploitant.example.org"
# par votre domaine. Utilisez Ctrl+\ pour rechercher/remplacer:
#   Ctrl+\
#   Tapez: gestion.exploitant.example.org
#   Remplacer par: votre-domaine.com
#   Tapez: A (pour remplacer tout)
```

---

### Étape 6/10 : Lancer le déploiement

```bash
# Rendre les scripts exécutables
chmod +x scripts/*.sh

# Lancer le déploiement
./scripts/deploy.sh
```

**⏱️ Durée**: 5-10 minutes pour le premier déploiement

Vous verrez défiler les logs de déploiement. Attendez le message:
```
[SUCCESS] Déploiement terminé avec succès!
```

---

### Étape 7/10 : Obtenir le certificat SSL (HTTPS)

```bash
# Créer les répertoires pour Certbot
mkdir -p certbot/conf certbot/www

# Obtenir le certificat Let's Encrypt
# Remplacez votre-domaine.com et votre-email@exemple.com
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d votre-domaine.com \
    --email votre-email@exemple.com \
    --agree-tos \
    --no-eff-email

# Redémarrer Nginx pour charger le certificat
docker compose -f docker-compose.prod.yml restart nginx
```

---

### Étape 8/10 : Vérifier l'installation

```bash
# Tester l'API (depuis le serveur)
curl http://localhost:4000/health
# Résultat attendu: {"status":"ok"}

# Tester en HTTPS (remplacez par votre domaine)
curl -I https://votre-domaine.com
# Résultat attendu: HTTP/2 200

# Vérifier l'état des conteneurs
docker compose -f docker-compose.prod.yml ps
# Tous les services doivent être "Up"
```

---

### Étape 9/10 : Créer le premier administrateur

```bash
# Se connecter à la base de données
docker exec -it marque-db psql -U marque -d marque_db

# Créer l'utilisateur admin (remplacez les valeurs)
INSERT INTO profiles (
    email, 
    full_name, 
    role, 
    est_actif
) VALUES (
    'admin@votre-entreprise.com',
    'Administrateur Principal',
    'admin',
    true
);

# Vérifier la création
SELECT email, full_name, role FROM profiles;

# Quitter psql
\q
```

---

### Étape 10/10 : Configurer les sauvegardes automatiques

```bash
# Tester une sauvegarde manuelle
./docker/scripts/openpulse-backup.sh
# Vérifiez qu'un répertoire est créé dans backups/

# Configurer une sauvegarde quotidienne à 2h du matin
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/marque/docker/scripts/backup.sh") | crontab -

# Vérifier la configuration cron
crontab -l
```

---

## ✅ Checklist Post-Installation

Cochez chaque élément pour confirmer que tout fonctionne:

- [ ] **1. Interface accessible**: Ouvrez `https://votre-domaine.com` dans un navigateur
- [ ] **2. Certificat SSL valide**: Cadenas vert dans la barre d'adresse
- [ ] **3. Connexion admin**: Connectez-vous avec l'email admin créé
- [ ] **4. API fonctionnelle**: `curl https://votre-domaine.com/api/health` retourne `{"status":"ok"}`
- [ ] **5. Base de données**: Les tables sont créées (436 tables attendues)
- [ ] **6. Sauvegardes**: Un répertoire horodaté existe dans `backups/`
- [ ] **7. Logs accessibles**: `docker compose logs -f` fonctionne

---

## 🆘 Résolution de Problèmes Courants

### Problème: "Erreur de connexion à la base de données"

```bash
# Vérifier que PostgreSQL est démarré
docker compose -f docker-compose.prod.yml ps db
# Doit afficher: "Up"

# Vérifier les logs PostgreSQL
docker compose -f docker-compose.prod.yml logs db

# Vérifier la connectivité
docker exec marque-db pg_isready -U marque
# Doit afficher: "accepting connections"
```

### Problème: "Certificat SSL non valide"

```bash
# Vérifier que le domaine pointe vers le serveur
nslookup votre-domaine.com
# L'IP doit correspondre à votre serveur

# Régénérer le certificat
docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal
docker compose -f docker-compose.prod.yml restart nginx
```

### Problème: "Page blanche ou erreur 502"

```bash
# Vérifier les logs du frontend
docker compose -f docker-compose.prod.yml logs frontend

# Vérifier les logs de l'API
docker compose -f docker-compose.prod.yml logs api

# Redémarrer les services
docker compose -f docker-compose.prod.yml restart
```

### Problème: "Pas assez de mémoire"

```bash
# Vérifier l'utilisation mémoire
free -h
docker stats

# Si nécessaire, ajouter du swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 📚 Documentation Complémentaire

| Document | Description |
|----------|-------------|
| [SELF_HOSTING_GUIDE.md](./SELF_HOSTING_GUIDE.md) | Guide technique complet |
| [OVH_DEPLOYMENT.md](./OVH_DEPLOYMENT.md) | Déploiement spécifique OVH |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Résolution de problèmes |
| [SECURITY.md](../SECURITY.md) | Configuration sécurité avancée |

---

## 🔄 Mise à Jour depuis la plateforme initiale

Pour synchroniser votre installation avec les dernières mises à jour:

```bash
cd /opt/marque

# Utiliser le script de synchronisation
./scripts/sync-from-plateforme-edition.sh

# OU manuellement:
git pull origin main
cd docker
./scripts/deploy.sh
```

---

## 📞 Support

- **Documentation**: Consultez le dossier `docs/`
- **Issues GitHub**: [Créer une issue](https://github.com/marqueIA/marque-client-compass/issues)
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f`

---

*Guide mis à jour - Mars 2026 | Version 1.9.0*
