# Stalwart Mail Server — Guide de configuration

## Vue d'ensemble

Stalwart est utilisé comme **proxy JMAP** entre les comptes email externes (OVH, Gmail, etc.) et OpenPulse.
Il remplace le client IMAP artisanal (~2100 lignes) par une API JSON/HTTP standard (~250 lignes).

### Architecture

```
Serveurs IMAP externes (OVH, Gmail)
         │
         ▼
   Stalwart (Docker)
   127.0.0.1:8180
         │
    API JMAP (HTTP/JSON)
         │
         ▼
  sync-emails-jmap (Edge Function)
         │
         ▼
    Supabase DB
```

## 1. Démarrage

### Prérequis
- Docker et Docker Compose installés
- Le réseau `marque-dev-network` actif (les autres services suffisent)

### Lancer Stalwart

```bash
cd docker
docker-compose -f docker-compose.dev.yml up -d stalwart
```

### Récupérer le mot de passe admin

```bash
docker logs marque-stalwart-dev 2>&1 | grep password
```

### Accéder à l'interface admin

Ouvrir [http://127.0.0.1:8180](http://127.0.0.1:8180) dans le navigateur.

## 2. Script d'initialisation

```bash
chmod +x docker/stalwart/init-stalwart.sh
./docker/stalwart/init-stalwart.sh
```

Le script :
- Attend que Stalwart soit prêt (healthcheck)
- S'authentifie avec les credentials par défaut
- Vérifie que l'endpoint JMAP est actif
- Affiche les URLs de configuration

## 3. Configurer les comptes email

### Via l'interface admin (http://127.0.0.1:8180)

1. Aller dans **Settings → Accounts**
2. Créer un compte pour chaque adresse email synchronisée
3. Configurer le **relay IMAP** vers le serveur externe :
   - Serveur : `smtp.example.org` (OVH) ou `imap.gmail.com` (Gmail)
   - Port : `993` (IMAPS)
   - Credentials : même que dans `user_email_accounts`

### Via l'API REST

```bash
# Créer un compte
curl -X POST http://127.0.0.1:8180/api/account \
  -H "Authorization: Basic $(echo -n 'admin:MOT_DE_PASSE' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "support@exploitant.example.org",
    "email": "support@exploitant.example.org",
    "type": "individual"
  }'
```

## 4. Tester l'API JMAP

### Session discovery

```bash
curl -s http://127.0.0.1:8180/.well-known/jmap \
  -H "Authorization: Basic $(echo -n 'user:password' | base64)" | jq .
```

### Lister les emails

```bash
curl -s http://127.0.0.1:8180/jmap \
  -H "Authorization: Basic $(echo -n 'user:password' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
    "methodCalls": [
      ["Email/query", {
        "accountId": "ACCOUNT_ID",
        "sort": [{"property": "receivedAt", "isAscending": false}],
        "limit": 10
      }, "a"]
    ]
  }' | jq .
```

### Récupérer un email complet

```bash
curl -s http://127.0.0.1:8180/jmap \
  -H "Authorization: Basic $(echo -n 'user:password' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
    "methodCalls": [
      ["Email/get", {
        "accountId": "ACCOUNT_ID",
        "ids": ["EMAIL_ID"],
        "properties": ["subject", "from", "to", "cc", "receivedAt", "textBody", "htmlBody", "hasAttachment"]
      }, "b"]
    ]
  }' | jq .
```

### Sync incrémentale avec Email/changes

```bash
curl -s http://127.0.0.1:8180/jmap \
  -H "Authorization: Basic $(echo -n 'user:password' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
    "methodCalls": [
      ["Email/changes", {
        "accountId": "ACCOUNT_ID",
        "sinceState": "PREVIOUS_STATE"
      }, "c"]
    ]
  }' | jq .
```

## 5. Variables d'environnement

| Variable | Description | Valeur dev |
|----------|-------------|------------|
| `STALWART_URL` | URL du serveur Stalwart | `http://stalwart:8080` (inter-container) |
| `STALWART_ADMIN_USER` | Utilisateur admin | `admin` |
| `STALWART_ADMIN_PASSWORD` | Mot de passe admin | `marque-dev-admin` |

> **Note** : En inter-container (Edge Function → Stalwart), utiliser `http://stalwart:8080` (nom du service Docker).
> En accès local (navigateur, scripts), utiliser `http://127.0.0.1:8180`.

## 6. Bascule IMAP → JMAP

Chaque compte email a un champ `sync_method` dans `user_email_accounts` :
- `'imap'` (défaut) : utilise l'ancien client IMAP artisanal (`sync-emails`)
- `'jmap'` : utilise le nouveau client JMAP (`sync-emails-jmap`)

La bascule se fait compte par compte via la fonction `migrate-to-jmap`.

## 7. Ports et sécurité

| Port | Service | Binding |
|------|---------|---------|
| 8180 | Admin HTTP | `127.0.0.1` uniquement |
| 8443 | Admin HTTPS | `127.0.0.1` uniquement |
| 25 | SMTP | `127.0.0.1` uniquement |
| 587 | SMTP Submission | `127.0.0.1` uniquement |
| 465 | SMTPS | `127.0.0.1` uniquement |
| 143 | IMAP | `127.0.0.1` uniquement |
| 993 | IMAPS | `127.0.0.1` uniquement |
| 4190 | ManageSieve | `127.0.0.1` uniquement |

> ⚠️ **Tous les ports sont bindés sur `127.0.0.1`** — Stalwart n'est pas exposé sur internet en dev.

## 8. Troubleshooting

### Stalwart ne démarre pas
```bash
docker logs marque-stalwart-dev
```

### JMAP endpoint retourne 401
Vérifier les credentials. Le mot de passe admin initial est dans les logs Docker.

### Pas de relay IMAP
Vérifier que le compte est configuré avec le bon serveur IMAP externe dans l'admin Stalwart.

### Healthcheck échoue
```bash
curl -sf http://127.0.0.1:8180/healthz
```
Si timeout, vérifier que le port 8180 n'est pas utilisé par un autre service.
