# Comptes sandbox CRM (`test-*@exploitant.example.org`)

Ces comptes sont **exclusivement** provisionnés par l'edge function
[`provision-test-accounts`](../supabase/functions/provision-test-accounts/index.ts).
Ils servent aux audits RBAC (browser-use / Playwright) et **ne doivent jamais
être mélangés aux vrais utilisateurs**.

## Invariants

1. **Un seul rôle par compte sandbox.** L'edge function `DELETE FROM user_roles
   WHERE user_id = ?` avant d'insérer le rôle attendu — l'idempotence est
   garantie, pas de doublon possible même après plusieurs runs.
2. **Marqueur `profiles.is_sandbox = true`.** Filtre à utiliser dans toute vue
   ou export pour exclure les comptes de test.
3. **Email pattern figé : `test-<role>@exploitant.example.org`**. Le domaine et le
   préfixe `test-` permettent d'identifier un compte sandbox sans requête DB.
4. **Mot de passe unique via secret `TEST_ACCOUNTS_PASSWORD`** (jamais commit).

## Comptes provisionnés

| Email                              | Rôle          | Usage audit                          |
| ---------------------------------- | ------------- | ------------------------------------ |
| `test-admin@exploitant.example.org`       | `admin`       | Toutes routes, sauf `strictAdminOnly` sans 2FA |
| `test-direction@exploitant.example.org`   | `direction`   | Hérite admin (voir RBAC_MATRIX)      |
| `test-commercial@exploitant.example.org`  | `commercial`  | CRM, prospects, devis                |
| `test-chef_projet@exploitant.example.org` | `chef_projet` | Déploiement, production              |
| `test-csm@exploitant.example.org`         | `csm`         | Santé comptes, playbooks             |
| `test-rh@exploitant.example.org`          | `rh`          | Module RH, salaires                  |
| `test-copil@exploitant.example.org`       | `copil`       | Lecture élargie, pas admin           |

## Priorité de résolution en cas de doublons historiques

Même si `provision-test-accounts` garantit l'unicité, des doublons peuvent
subsister sur d'anciens comptes utilisateurs (multi-rôle légitime ou hérité).
Le hook [`useUserRole`](../src/hooks/shared/useUserRole.ts) résout ces cas :

- Tentative `.maybeSingle()` d'abord.
- Si Supabase renvoie **`PGRST116` (multiple rows returned)**, fallback en mode
  liste + résolution par priorité :

  ```
  admin > direction > copil > rh > chef_projet > csm > commercial
  ```

Cette priorité garantit qu'un utilisateur avec `{admin, commercial}` est bien
identifié comme `admin`, jamais rétrogradé.

## Ré-exécution

```bash
# Depuis un shell avec SUPABASE_SERVICE_ROLE_KEY
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/functions/v1/provision-test-accounts"
```

Retourne `{ success: true, results: [{ email, status, role, user_id }, ...] }`.

## Compte admin E2E — source de vérité

Le compte admin canonique pour les tests E2E est :

| Champ    | Valeur                                                     |
| -------- | ---------------------------------------------------------- |
| Email    | `test-admin@exploitant.example.org`                               |
| Rôle     | `admin` (unique, `user_roles.role = 'admin'`)              |
| Password | Secret `TEST_ACCOUNTS_PASSWORD`                            |
| Flag     | `profiles.is_sandbox = true`                               |

L'alias historique `e2e-admin@exploitant.example.org` **n'est pas provisionné** — ne
pas le créer, il fragmenterait la source de vérité. Toujours pointer vers
`test-admin@exploitant.example.org`.

### Ordre de résolution des credentials (helper `loginAsAdmin`)

`tests/e2e/helpers/auth.ts` résout dans cet ordre strict pour éviter
d'hériter accidentellement d'une session CSM :

1. `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` (recommandé pour CI)
2. `E2E_EMAIL` / `E2E_PASSWORD` (fallback partagé)
3. Fallback email : `test-admin@exploitant.example.org`; mot de passe obligatoire via `TEST_ACCOUNTS_PASSWORD`

**Ne jamais** mettre un email CSM/direction dans `E2E_EMAIL` si des tests
admin tournent dans la même suite — préférer `E2E_ADMIN_EMAIL` scopé.

### 2FA — exemption sandbox documentée

Les routes `strictAdminOnly` exigent `has_admin_role_strict()`, qui contrôle
la présence d'un secret TOTP validé. Deux modes acceptés pour le sandbox :

- **Mode TOTP** : renseigner `E2E_ADMIN_TOTP_SECRET` (cf.
  `scripts/seed-e2e-users.ts`). Le seed injecte le secret dans
  `profiles_secrets` et la 2FA est satisfaite.
- **Mode exemption** : si la CI ne peut pas gérer TOTP, la couverture
  strict-admin passe par des tests unitaires (`AdminGuard.test.tsx`,
  `RouteGuard.test.tsx`) plutôt qu'E2E. **Aucune bypass server-side** — la
  fonction `has_admin_role_strict` reste inchangée en production.

### Données sandbox minimales attendues

Le seed `scripts/seed-e2e-crm-data.ts` (owner = compte admin sandbox)
provisionne le jeu de données minimal pour couvrir les parcours admin :

- 1 établissement sandbox (préfixe `[E2E]`) + contacts
- 1 contrat lié + 1 facture
- Entrées `security_logs` / `api_logs` pour /logs-systeme
- Ligne `app_config` sandbox pour /configuration-systeme

Ces données sont taggées `is_sandbox = true` (ou préfixées `[E2E]`) pour être
filtrées des vues métier — ne jamais éditer les vraies entités.

