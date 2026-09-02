# Checklist de Déploiement Self-Hosted

## Pré-Production Validation

Ce document fournit une checklist complète pour valider le déploiement self-hosted avant mise en production.

---

## Phase 1 : Infrastructure

### Serveur
- [ ] VPS avec minimum 4 vCPU, 8 GB RAM
- [ ] Ubuntu 22.04 LTS installé
- [ ] Docker 24.0+ et Docker Compose installés
- [ ] Accès SSH configuré (port non standard recommandé)
- [ ] Fail2ban configuré
- [ ] UFW firewall actif (ports 80, 443, 22 ouverts)

### Domaine & DNS
- [ ] Domaine configuré avec A record vers IP serveur
- [ ] Sous-domaines configurés si nécessaire (api.*, app.*)
- [ ] TTL DNS réglé à 300s pendant la migration

### SSL/TLS
- [ ] Script `init-ssl.sh` exécuté
- [ ] Certificat Let's Encrypt obtenu
- [ ] Renouvellement automatique configuré (crontab)
- [ ] DH params générés (/etc/nginx/ssl/dhparam.pem)

---

## Phase 2 : Base de Données

### PostgreSQL
- [ ] PostgreSQL 14+ installé
- [ ] Base de données créée
- [ ] Utilisateur avec droits appropriés créé
- [ ] Extensions activées (uuid-ossp, pgcrypto, unaccent, pg_trgm)
- [ ] Schéma appliqué (schema-complete.sql)

### Vérifications
- [ ] Toutes les 436+ tables créées
- [ ] ENUMs créés (app_role, statut_etablissement, etc.)
- [ ] Fonctions SQL créées (has_role, is_admin, can_manage_rh_data)
- [ ] Triggers créés (update_updated_at, on_status_change_generate_tasks)
- [ ] Indexes créés pour performance
- [ ] Catégories et modèles de tâches seed data insérés

### Migration Données
- [ ] Export Supabase exécuté (export-supabase-data.ts)
- [ ] Import PostgreSQL exécuté (import-to-postgres.ts)
- [ ] Vérification migration exécutée (verify-migration.ts)
- [ ] Comptages validés pour tables critiques
- [ ] Aucun orphelin détecté (tâches, messages)

---

## Phase 3 : Application

### Variables d'Environnement
- [ ] `DATABASE_URL` configurée
- [ ] `JWT_SECRET` générée (32+ caractères aléatoires)
- [ ] `AZURE_OPENAI_ENDPOINT` configurée
- [ ] `AZURE_OPENAI_API_KEY` configurée
- [ ] `EMAIL_ENCRYPTION_KEY` configurée
- [ ] `SUPPORT_EMAIL_PASSWORD` configurée
- [ ] `VAPID_PUBLIC_KEY` configurée
- [ ] `VAPID_PRIVATE_KEY` configurée
- [ ] `VAPID_SUBJECT` configurée
- [ ] `QONTO_API_KEY` configurée (si utilisé)
- [ ] `CORS_ORIGIN` configurée pour le domaine production

### Backend (Express)
- [ ] Build TypeScript réussi
- [ ] Serveur démarre sans erreur
- [ ] Health check répond (/health)
- [ ] Connexion base de données OK
- [ ] Jobs CRON initialisés

### Frontend (React)
- [ ] Build Vite réussi
- [ ] Variables env injectées
- [ ] Service worker généré
- [ ] Assets optimisés

### Nginx
- [ ] Configuration validée (nginx -t)
- [ ] Reverse proxy vers backend fonctionnel
- [ ] Fichiers statiques servis
- [ ] Compression gzip activée
- [ ] Headers de sécurité configurés

---

## Phase 4 : Tests

### Tests Automatisés
- [ ] Tests unitaires passent (services.test.ts)
- [ ] Tests API passent (api.test.ts)
- [ ] Tests d'intégration passent (integration.test.ts)

### Tests Manuels
- [ ] Page de login accessible
- [ ] Authentification fonctionne
- [ ] Navigation dans l'application OK
- [ ] Création d'établissement OK
- [ ] Synchronisation email OK (si configuré)
- [ ] Notifications push OK (si configuré)

### Tests de Charge
- [ ] Réponse < 200ms pour pages principales
- [ ] Pas de timeout sous charge modérée
- [ ] Mémoire stable

---

## Phase 5 : Sécurité

### Authentification
- [ ] JWT vérifié sur toutes les routes protégées
- [ ] Rate limiting actif (10 tentatives/15min pour login)
- [ ] 2FA fonctionnel pour admins

### Base de Données
- [ ] Mot de passe fort pour utilisateur PostgreSQL
- [ ] Accès limité depuis localhost ou IP spécifiques
- [ ] Backups automatisés configurés

### Réseau
- [ ] HTTPS forcé (redirect HTTP → HTTPS)
- [ ] Headers de sécurité présents (HSTS, CSP, etc.)
- [ ] Redis avec mot de passe (si utilisé)

### Secrets
- [ ] Fichier .env non versionné
- [ ] Secrets non exposés dans logs
- [ ] Clés API rotées depuis Supabase

---

## Phase 6 : Monitoring

### Logs
- [ ] Logs applicatifs configurés
- [ ] Rotation des logs configurée
- [ ] Logs accessibles pour debug

### Métriques
- [ ] Health endpoint monitored
- [ ] Alertes configurées (downtime, erreurs)

### Backups
- [ ] Backup base de données quotidien
- [ ] Backup storage hebdomadaire
- [ ] Procédure de restauration testée

---

## Go/No-Go Checklist

Avant mise en production :

| Critère | Statut |
|---------|--------|
| Infrastructure prête | ⬜ |
| Base de données migrée et vérifiée | ⬜ |
| Application déployée et fonctionnelle | ⬜ |
| Tests passent | ⬜ |
| Sécurité validée | ⬜ |
| Monitoring actif | ⬜ |
| Procédure rollback documentée | ⬜ |
| Équipe informée | ⬜ |

---

## Procédure de Rollback

En cas de problème critique :

1. **Rediriger le DNS** vers l'ancienne infrastructure (si encore active)
2. **Restaurer la base** depuis le dernier backup valide
3. **Analyser les logs** pour identifier la cause
4. **Documenter l'incident** avec timeline et actions

---

## Contacts

- **Responsable technique** : [À compléter]
- **Support infrastructure** : [À compléter]
- **Urgence** : [À compléter]

---

*Dernière mise à jour : Mars 2026 - Version 1.9.0*
