# Migrations Azure PostgreSQL — Emails Smart Inbox

Migrations SQL destinées à la base **Azure PostgreSQL miroir** de Gestion
(pas Supabase — les migrations Supabase restent dans `supabase/migrations/`).

## Convention

- Fichiers numérotés `NNN_description.sql`, idempotents (`IF NOT EXISTS`).
- Aucun secret en base : les credentials IMAP/SMTP/Graph sont référencés via
  `secret_ref` (Azure Key Vault).
- Les tables miroir historiques (`email_threads`, `email_messages`,
  `email_attachments`, `email_sync_logs`) ne sont **jamais** modifiées ici.

## Application

```bash
psql "$AZURE_PG_CONNECTION_STRING" -f scripts/migration/azure/001_email_smart_inbox_lot1.sql
```

## Lots

| Fichier | Contenu | Plan |
| --- | --- | --- |
| `001_email_smart_inbox_lot1.sql` | `email_accounts_azure`, `email_sync_cursors`, `email_ai_insights`, `email_actions` + index + triggers `updated_at` | §6 du plan Smart Inbox (2026-07-07) |

## Feature flag associé côté front

```env
VITE_EMAIL_BACKEND=supabase|azure|hybrid   # défaut : supabase
VITE_EMAIL_AZURE_API_URL=                  # base URL openpulse-email-api (optionnel)
```

`supabase` = comportement historique inchangé. `hybrid` active la supervision
Azure additive dans `/emails` (onglet Paramètres). `azure` prépare le cutover
complet (lots suivants).
