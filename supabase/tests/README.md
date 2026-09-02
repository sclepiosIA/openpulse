# Tests backend Supabase (pgTAP)

Foundation pour les tests SQL de Row-Level Security (RLS) et de logique
PostgreSQL. Couvre l'item **17 du plan d'industrialisation** (cf.
[`AUDIT_TESTS_2026-06-02.md`](../../AUDIT_TESTS_2026-06-02.md) §5 Phase 2).

## Stack

- Extension Postgres : **pgTAP** (`CREATE EXTENSION IF NOT EXISTS pgtap`).
- Lanceur : `supabase test db` (Supabase CLI ≥ 1.180).
- Convention de fichier : `supabase/tests/<domaine>/<table>_rls.sql`.

## Organisation

```
supabase/tests/
├── README.md           ← ce fichier
├── helpers/
│   └── auth.sql        ← helpers `set_auth_uid(uuid)`, `clear_auth()`
└── rls/
    ├── contacts_rls.sql
    └── email_messages_rls.sql
```

## Lancer en local

```bash
supabase start                 # nécessite Docker
supabase test db               # exécute *.sql dans supabase/tests
```

## Lancer en CI

Job dédié (à câbler dans `.github/workflows/ci.yml`) :

```yaml
backend-rls:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: supabase/setup-cli@v1
    - run: supabase db start
    - run: supabase test db
```

## Règles d'écriture

1. **Toujours** ouvrir le test par `BEGIN; SELECT plan(<n>);` et le fermer
   par `SELECT * FROM finish(); ROLLBACK;` — aucun side-effect persistant.
2. **Toujours** changer d'identité avant chaque assertion RLS :
   `SELECT set_auth_uid('<uuid>');` puis `RESET ROLE` à la fin.
3. **Couvrir au minimum** : owner read, foreign read denied, anon denied,
   admin override (si applicable).
4. Une **table sensible = un fichier** : pas de tests croisés.

## Tables sensibles prioritaires (item 17)

| Table | Test | État |
|-------|------|------|
| `contacts` | `rls/contacts_rls.sql` | ✅ scaffold |
| `email_messages` | `rls/email_messages_rls.sql` | ✅ scaffold |
| `formation_emargements` | `rls/formation_emargements_rls.sql` | ☐ TODO |
| `bookings` | `rls/bookings_rls.sql` | ☐ TODO |
| `rgpd_consentements` | `rls/rgpd_consentements_rls.sql` | ☐ TODO |
| `salaires` | `rls/salaires_rls.sql` | ☐ TODO |
| `user_roles` | `rls/user_roles_rls.sql` | ☐ TODO |
