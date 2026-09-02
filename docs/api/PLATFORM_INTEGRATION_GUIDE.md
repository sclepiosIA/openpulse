# Guide d'intégration — OpenPulse Platform API

> Destiné aux équipes intégrant la **Platform API** : Site Web (la plateforme initiale) et Backend Produit (PHP/MySQL).

## 1. Vue d'ensemble

- **Hôte** : `https://your-project-ref.supabase.co/functions/v1`
- **Préfixe** : toutes les fonctions s'appellent `platform-*` (ex: `platform-clients`, `platform-usage-events`).
- **Spec** : voir [`platform-api.openapi.yaml`](./platform-api.openapi.yaml).
- **Événements** : voir [`EVENT_CATALOG.md`](./EVENT_CATALOG.md).

## 2. Authentification

### 2.1 Appels entrants (vous → Gestion)

Header obligatoire :
```
x-api-key: <clé fournie par OpenPulse>
```

Les clés sont scopées (`platform:site_web` ou `platform:product`) et hashées dans `api_keys`. Rate limit : 600 req/min.

### 2.2 Webhooks entrants (Gestion → vous)

Vous devez vérifier la signature HMAC :

```php
// Exemple PHP
function verifyMarqueSignature(string $rawBody, string $headerSig, string $secret): bool {
    if (!preg_match('/t=(\d+),v1=([a-f0-9]+)/', $headerSig, $m)) return false;
    [$_, $ts, $sig] = $m;
    if (abs(time() - (int)$ts) > 300) return false;
    $expected = hash_hmac('sha256', "$ts.$rawBody", $secret);
    return hash_equals($expected, $sig);
}
```

```ts
// Exemple TypeScript (Deno)
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";
function verify(rawBody: string, headerSig: string, secret: string): boolean {
  const m = headerSig.match(/t=(\d+),v1=([a-f0-9]+)/);
  if (!m) return false;
  const [, ts, sig] = m;
  if (Math.abs(Date.now() / 1000 - +ts) > 300) return false;
  const expected = hmac("sha256", secret, `${ts}.${rawBody}`, "utf8", "hex");
  return expected === sig;
}
```

### 2.3 SSO Produit (Site Web → Produit, via Gestion)

1. Site Web POST `/platform-sso-issue` avec `etablissement_id` + `user_email`.
2. Gestion répond `{ token, url, expires_at }`.
3. Site Web redirige le user vers `url` (ex: `https://produit.exploitant.example.org/v1/product/sso/exchange?token=...`).
4. Produit décode le JWT (HS256, secret partagé `PLATFORM_SSO_JWT_SECRET`), vérifie `exp` (5 min), `iss=gestion`, `aud=product`, ouvre la session.

## 3. Endpoints à exposer côté Backend Produit

| Endpoint | Méthode | Auth | Rôle |
|---|---|---|---|
| `/v1/product/tenants` | POST | `x-api-key` | Création tenant (reçu via webhook `client.created`) |
| `/v1/product/tenants/{etab_id}` | PATCH | `x-api-key` | Maj plan/modules |
| `/v1/product/tenants/{etab_id}` | DELETE | `x-api-key` | RGPD |
| `/v1/product/tenants/{etab_id}/users` | POST | `x-api-key` | Création user |
| `/v1/product/sso/exchange` | POST | JWT signé | Échange token → session PHP |
| `/v1/product/webhook` | POST | HMAC | Récepteur événements Gestion |

## 4. Provisioning A→Z

```
[Gestion: prospect → production]
     │
     ▼ trigger SQL
[platform_events.INSERT('client.created')]
     │
     ▼ CRON dispatcher (1 min)
[POST https://siteweb.../platform-webhook-receive]   (HMAC)
[POST https://produit.../v1/product/webhook]         (HMAC)
     │
     ▼ side-effects
[Site Web crée client_portal_user + magic link email]
[Produit crée tenant MySQL + admin user]
     │
     ▼ callback
[POST /platform-clients-link/{etab_id}  { system, external_id }]
     │
     ▼
[Gestion: client_external_ids mis à jour, UI ✅]
```

## 5. Télémétrie d'usage

Le Produit POST en batch (max 500 events/req) sur `/platform-usage-events` :

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/platform-usage-events \
  -H "x-api-key: $PLATFORM_API_KEY" \
  -H "Idempotency-Key: batch-2026-06-12-001" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "etablissement_id": "uuid",
        "user_external_id": "prod-user-42",
        "event_name": "module.opened",
        "module": "urgences",
        "occurred_at": "2026-06-12T10:15:00Z",
        "metadata": { "patient_count": 12 }
      }
    ]
  }'
```

Fréquence recommandée : batch toutes les 60s ou dès 500 events accumulés.

## 6. Idempotence

Tous les POST exigent `Idempotency-Key` (8-128 chars). OpenPulse stocke 7 j. Rejouer la même clé renvoie la 1re réponse (200 idempotent).

## 7. Codes erreur

| Code | Sens |
|---|---|
| 400 | Payload invalide (voir `error` + `code`) |
| 401 | API key manquante / invalide |
| 403 | Scope insuffisant |
| 404 | Ressource introuvable |
| 409 | Conflit (ex: link déjà enregistré pour ce system) |
| 422 | Validation métier (ex: etab non en production) |
| 429 | Rate limit |
| 5xx | Erreur Gestion — retry exponentiel conseillé |

Les erreurs sont sanitisées (pas d'info interne DB/Azure).

## 8. Secrets à configurer

### 8.1 Récapitulatif des 3 projets

| Projet | Variable | Scope clé | Où l'obtenir |
|---|---|---|---|
| **Site Web** (la plateforme initiale) | `PLATFORM_API_URL` | — | Valeur fixe (voir §8.2) |
| **Site Web** | `PLATFORM_API_KEY` | `site_web` | Gestion → Paramètres → Platform API → Clés API |
| **Site Web** | `PLATFORM_WEBHOOK_HMAC_SECRET` | — | Gestion → Paramètres → Platform API → Webhooks (à la création) |
| **Backend PHP** | `PLATFORM_API_URL` | — | Valeur fixe (voir §8.2) |
| **Backend PHP** | `PLATFORM_API_KEY` | `product` | Gestion → Paramètres → Platform API → Clés API |
| **Backend PHP** | `PLATFORM_WEBHOOK_HMAC_SECRET` | — | Gestion → Paramètres → Platform API → Webhooks |
| **Backend PHP** | `PLATFORM_SSO_JWT_SECRET` | — | Gestion → secret Supabase `PLATFORM_SSO_JWT_SECRET` (à partager) |
| **Gestion** (Supabase Secrets) | `PLATFORM_SSO_JWT_SECRET` | — | Généré 1x (`openssl rand -hex 32`) et partagé au Produit |
| **Gestion** | `CRON_SECRET` | — | Déjà configuré (dispatcher) |
| **Gestion** | `PRODUCT_API_URL` | — | URL publique du backend PHP, ex: `https://produit.exploitant.example.org` |

### 8.2 Valeurs exactes pour ce projet

```env
# URL de la Platform API (identique pour Site Web et Produit)
PLATFORM_API_URL=https://your-project-ref.supabase.co/functions/v1
```

### 8.3 Procédure côté Site Web (la plateforme initiale)

> ⚠️ **Ne PAS utiliser la page `/api-developer`** (Espace Développeur).
> Elle gère uniquement les anciens webhooks génériques (table `webhooks`) et
> n'est **pas** reliée au bus Platform. Toute la configuration inter-produits
> OpenPulse passe obligatoirement par **`/parametres/platform-api`**
> (table `platform_webhook_endpoints`, lue par `platform-events-dispatcher`).


Le Site Web demande 3 secrets : `PLATFORM_API_URL`, `PLATFORM_API_KEY`, `PLATFORM_WEBHOOK_HMAC_SECRET`.

**Étape 1 — `PLATFORM_API_URL`**
Coller directement :
```
https://your-project-ref.supabase.co/functions/v1
```
(sans slash final, sans `/platform-clients` ni autre suffixe)

**Étape 2 — `PLATFORM_API_KEY`**
1. Aller sur Gestion → `/parametres/platform-api`
2. Onglet **« Clés API »** → bouton **« Créer une clé »**
3. Scope : **`site_web`**
4. Label : `Site Web OpenPulse`
5. **Copier la clé affichée (format `sk_sitew_…`) — elle n'est visible qu'une seule fois**
6. Coller dans le champ `PLATFORM_API_KEY` du Site Web

**Étape 3 — `PLATFORM_WEBHOOK_HMAC_SECRET`**
1. Même page Gestion → onglet **« Webhooks »** → **« Ajouter un endpoint »**
2. URL : `https://<domaine-site-web>/api/platform/webhook` (route à exposer côté Site Web)
3. Événements cochés : `client.created`, `client.updated`, `client.suspended`, `client.archived`, `user.invited`
4. À la création, un secret `whsec_…` s'affiche → copier
5. Coller dans le champ `PLATFORM_WEBHOOK_HMAC_SECRET` du Site Web

> ⚠️ Si la clé API ou le secret HMAC est perdu, il faut en regénérer un nouveau et mettre à jour le Site Web (les anciennes valeurs ne sont jamais réaffichées en clair).

### 8.4 Procédure côté Backend Produit PHP

```env
PLATFORM_API_URL=https://your-project-ref.supabase.co/functions/v1
PLATFORM_API_KEY=sk_prod_…             # créer avec scope "product" dans Gestion
PLATFORM_WEBHOOK_HMAC_SECRET=whsec_…   # créer un endpoint webhook pointant sur https://produit.../v1/product/webhook
PLATFORM_SSO_JWT_SECRET=<hex 64 chars> # à demander à l'équipe Gestion (secret Supabase partagé)
```

Génération du `PLATFORM_SSO_JWT_SECRET` (côté Gestion, une seule fois) :
```bash
openssl rand -hex 32
```
La valeur doit être strictement identique côté Gestion (secret Supabase) et côté Produit (`.env`).

### 8.5 Snippet TypeScript — vérification webhook côté Site Web

```ts
// app/api/platform/webhook/route.ts (ou edge function équivalente)
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-marque-signature") ?? "";
  const m = sig.match(/t=(\d+),v1=([a-f0-9]+)/);
  if (!m) return new Response("bad sig format", { status: 401 });
  const [, ts, v1] = m;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    return new Response("stale", { status: 401 });
  }
  const expected = createHmac("sha256", process.env.PLATFORM_WEBHOOK_HMAC_SECRET!)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) {
    return new Response("invalid", { status: 401 });
  }
  const event = JSON.parse(rawBody);
  // … switch(event.type) { case "client.created": … }
  return new Response("ok");
}
```

## 9. Sandbox / test

Avant prod, demander une API key avec scope `platform:product:sandbox` qui pointe sur un etablissement de test. Aucun event réel n'est dispatché.

## 10. Support

Incidents : `support@exploitant.example.org` — inclure `request_id` retourné en header `X-Request-Id`.
