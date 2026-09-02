# Seed E2E users (RBAC matrix)

Provisionne les comptes E2E RBAC (dont un vrai **admin sandbox** avec rôle
`admin` réel, distinct de `direction`) dans Supabase, plus les données CRM
minimales nécessaires aux audits (établissement, contacts, contrat).

## Comptes provisionnés

| Rôle       | Email                              | Notes                         |
| ---------- | ---------------------------------- | ----------------------------- |
| admin      | `test-admin@exploitant.example.org`       | Sandbox admin (override via `E2E_ADMIN_EMAIL`) |
| csm        | `e2e-csm@marque-ia.test`         |                               |
| commercial | `e2e-commercial@marque-ia.test`  |                               |
| rh         | `e2e-rh@marque-ia.test`          |                               |
| manager    | `e2e-manager@marque-ia.test`     |                               |
| user       | `e2e-user@marque-ia.test`        |                               |

Le compte admin a **exclusivement** le rôle `admin` (les anciens rôles hérités
`direction` sont purgés à chaque exécution). Cela garantit l'accès aux routes
`strictAdminOnly` que la simple appartenance à `direction` bloquait.

## 2FA de l'admin sandbox

Certaines RLS utilisent `has_admin_role_strict()` qui exige `two_factor_enabled = true`.
Deux modes possibles :

1. **Sans 2FA (défaut)** : les routes admin sont accessibles (`RouteGuard`
   ne vérifie que le rôle), mais les RLS strictes renvoient `false`. Suffisant
   pour tester la navigation et les pages qui n'utilisent pas `has_admin_role_strict`.
2. **Avec 2FA (recommandé)** : fournir un secret TOTP partagé sandbox via
   `E2E_ADMIN_TOTP_SECRET`. Le script active `two_factor_enabled = true` et
   stocke le secret dans `profiles_secrets`. Le pipeline E2E calcule le code
   TOTP à partir du même secret au moment du login.

Le secret TOTP n'est **jamais** commit ; il vit uniquement dans les env vars
CI et sur les postes des développeurs autorisés.

## Exécution locale

```bash
# 1. Comptes + rôles
SUPABASE_URL="https://your-project-ref.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service_role_key>" \
E2E_PASSWORD_DEFAULT="<password sandbox>" \
E2E_ADMIN_TOTP_SECRET="<base32 TOTP secret optionnel>" \
bun run scripts/seed-e2e-users.ts

# 2. Données CRM minimales (établissement + 2 contacts + 1 contrat)
SUPABASE_URL="https://your-project-ref.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service_role_key>" \
bun run scripts/seed-e2e-crm-data.ts
```

Les deux scripts sont **idempotents** : ré-exécutables sans risque.
Les enregistrements CRM sont tagués `[e2e-admin-seed]` dans les champs
`notes` / `titre` pour être trivialement identifiables et ne jamais entrer
en collision avec de la donnée réelle.

## Variables CI à exporter

Le script `seed-e2e-users.ts` affiche en fin d'exécution le bloc `export` à
coller dans la config CI :

```bash
export RUN_RBAC_MATRIX=true
export E2E_EMAIL="e2e-admin@exploitant.example.org"
export E2E_PASSWORD="<password sandbox>"
export E2E_ADMIN_EMAIL="e2e-admin@exploitant.example.org"
export E2E_ADMIN_PASSWORD="<password sandbox>"
# + 1 paire E2E_<ROLE>_EMAIL/PASSWORD par rôle non-admin
```

Une fois exporté :

```bash
RUN_RBAC_MATRIX=true bunx playwright test
```

Les 225 tests RBAC (5 rôles × 45 routes) deviennent actifs automatiquement.

## Sécurité

- `SUPABASE_SERVICE_ROLE_KEY` : jamais commit, jamais exposé au frontend.
- Mot de passe : fourni via `E2E_PASSWORD_DEFAULT` (défaut interne
  `TestE2E!2026Marque` si non fourni — à remplacer en CI/local).
- Le compte admin sandbox utilise un email `@exploitant.example.org` réel ; il est
  isolé des vrais utilisateurs par (1) le préfixe `e2e-`, (2) le tag
  `e2e: true` dans `user_metadata`, (3) le tag `[e2e-admin-seed]` sur les
  données CRM associées. Ne pas renommer, ne pas supprimer, ne pas
  fusionner avec un vrai compte.
- 2FA sandbox : le secret TOTP partagé n'est utilisé QUE pour ce compte
  de test ; rotation à faire si suspicion de fuite.
