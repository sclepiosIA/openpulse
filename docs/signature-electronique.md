# Signature électronique (DocuSeal)

> Pipeline complet de signature électronique pour les contrats, basé sur DocuSeal.
> **Statut** : ✅ Production · **Provider** : DocuSeal · **Module** : `/contrats/:id?tab=signature`

---

## 1. Architecture

```
contrats
  ├─ signature_request_id, signature_status, signed_document_path
  └─ statut → 'signe' (auto via trigger propagate_signature_event)

signature_requests        — 1 ligne par envoi (historique multi-tentatives)
  ├─ provider='docuseal', provider_request_id, provider_url
  ├─ signers jsonb [{name,email,role,status,signed_at,ip}]
  ├─ status (pending|sent|viewed|signed|completed|refused|expired|cancelled)
  ├─ expire_at, reminders_sent, last_reminder_at
  └─ document_hash (SHA-256), document_path, signed_document_path, audit_log_url

signature_events          — audit trail temps réel (immuable)
  ├─ event_type (created|sent|opened|viewed|signed|completed|refused
  │              |expired|reminded|cancelled|error)
  ├─ signer_email, signer_name, ip_address, user_agent
  └─ payload jsonb (raw webhook DocuSeal)
```

### Trigger SQL

`propagate_signature_event` (AFTER INSERT sur `signature_events`) :
- `event_type='completed'` → `contrats.statut='signe'`, `date_signature=CURRENT_DATE`, `signature_completed_at=now()`
- `event_type='refused'|'expired'|'cancelled'` → met à jour `contrats.signature_status` uniquement (pas de changement de statut métier)
- `event_type='signed'` (signature partielle) → met à jour le tableau `signers[]` dans la request

---

## 2. Edge Functions

| Function | Auth | Méthode | Rôle |
|----------|------|---------|------|
| **`signature-send`** | JWT user | POST | Calcule SHA-256 du PDF, crée submission DocuSeal, persiste `signature_requests` + events `created`/`sent`. Body : `{ contratId, signers[], message?, expireDays? }`. |
| **`signature-remind`** | JWT user | POST | Relance via DocuSeal API, log event `reminded`, incrémente `reminders_sent`. Body : `{ requestId, signerEmail? }`. |
| **`signature-cancel`** | JWT user | POST | Archive submission DocuSeal, marque `cancelled`. Body : `{ requestId, reason? }`. |
| **`docuseal-webhook`** | HMAC SHA-256 (`x-docuseal-signature`) | POST | Log `signature_events`, met à jour `signers[]`, archive PDF signé dans `storage/contrats/signed/`, notifie créateur, crée tâche d'archivage à J+7. |

### Format webhook DocuSeal

```json
{
  "event_type": "submission.completed" | "submitter.completed" | "submitter.opened" | "form.declined" | ...,
  "data": {
    "submission_id": "...",
    "submitter": { "email": "...", "name": "...", "ip": "..." },
    "documents": [{ "url": "https://..." }]
  }
}
```

Mapping → `signature_events.event_type` :
- `submission.completed` → `completed`
- `submitter.completed` → `signed`
- `submitter.opened` → `opened`
- `submitter.viewed` → `viewed`
- `form.declined` → `refused`

---

## 3. Frontend

| Composant | Rôle |
|-----------|------|
| `SignatureTab` | Onglet principal dans `ContratDetail` (lazy-loaded, deep-link `?tab=signature`) |
| `SignatureDialog` | Création de demande : multi-signataires, expiration 1-365 j, message |
| `SignatureTimeline` | Feed événements temps réel (icônes + IP + horodatage) |
| `SignedDocumentCard` | Preview hash SHA-256 + download via signed URL TTL 5 min |

**Hooks realtime** :
- `useSignatureRequest(contratId)` — query + subscription `postgres_changes` sur `signature_requests`
- `useSignatureEvents(requestId)` — query + subscription INSERT sur `signature_events`
- `useSendSignature` / `useRemindSignature` / `useCancelSignature` — mutations React Query avec invalidation

---

## 4. Configuration (`app_config`)

```json
{
  "key": "signature_config",
  "value": {
    "default_expiry_days": 30,
    "max_reminders": 2,
    "reminder_interval_days": 3,
    "auto_archive_days": 7
  }
}
```

Modifiable via `/parametres` (admin uniquement).

---

## 5. Sécurité

| Mécanisme | Détail |
|-----------|--------|
| **HMAC SHA-256** | Webhook validé via `DOCUSEAL_WEBHOOK_SECRET` (timing-safe compare). Rejet 401 si invalide. |
| **Hash SHA-256 PDF** | Calculé à l'envoi → preuve d'intégrité du document signé. |
| **Bucket privé** | `storage.contrats` privé. Téléchargement uniquement via `createSignedUrl` TTL 5 min. |
| **RLS** | `signature_requests` + `signature_events` : SELECT créateur/admin/direction, INSERT service_role. |
| **Sanitizer** | Toutes les Edge Functions passent les erreurs par `sanitize()` (regex sur api_key/token/secret). |
| **JWT validation** | `signature-send/remind/cancel` valident le JWT utilisateur via `supabase.auth.getUser()`. |

---

## 6. Cron (relances + expirations)

Job `pg_cron` `signature_cron_job` toutes les **6 heures** :

```sql
-- Relances automatiques
UPDATE signature_requests sr
   SET reminders_sent = reminders_sent + 1,
       last_reminder_at = now()
 WHERE status = 'sent'
   AND last_reminder_at < now() - interval '3 days'
   AND reminders_sent < (SELECT (value->>'max_reminders')::int FROM app_config WHERE key = 'signature_config');

-- Expirations
UPDATE signature_requests
   SET status = 'expired'
 WHERE status IN ('sent', 'viewed', 'signed')
   AND expire_at < now();
```

L'expiration insère automatiquement un event `expired` qui via le trigger met à jour `contrats.signature_status`.

---

## 7. Notifications

| Événement | Cible | Canal | Message |
|-----------|-------|-------|---------|
| `submission.completed` | `contrats.created_by` | Push + In-app | "Contrat signé ✅ — {titre}" |
| `form.declined` | `contrats.created_by` | Push + In-app | "Signature refusée ❌ — {titre}" |
| `expired` | `contrats.created_by` | In-app | "Demande expirée — relancer ?" |
| `auto-archive` (J+7) | Tâche `taches` | Système | Tâche "Archiver le contrat signé" |

---

## 8. Run-book

### Activer la signature pour un contrat
1. Ouvrir la fiche contrat → onglet **Signature** (ou bouton "Demander signature" depuis la liste).
2. Saisir signataires (nom + email valide), expiration (défaut 30j), message optionnel.
3. Cliquer "Envoyer" → la submission DocuSeal est créée + emails envoyés automatiquement.

### Relancer un signataire
- Bouton "Relancer" sur le tab Signature : relance tous les signataires en attente.
- Icône 🔄 à côté d'un signataire : relance individuelle.

### Annuler une demande
- Bouton "Annuler" → confirmation → submission DocuSeal archivée, événement `cancelled` loggé.

### Récupérer le PDF signé
- Onglet Signature → carte verte "Document signé" → bouton "Télécharger" (signed URL 5 min).

---

## 9. Troubleshooting

| Symptôme | Cause probable | Action |
|----------|---------------|--------|
| Webhook ignoré, statut bloqué `sent` | `DOCUSEAL_WEBHOOK_SECRET` non configuré ou incorrect | Vérifier secret côté Supabase + DocuSeal admin |
| `signature-send` retourne 500 | `DOCUSEAL_API_KEY` manquant ou PDF inaccessible | Logs Edge Function + vérif bucket `contrats` |
| Email signataire jamais reçu | Spam / domaine non vérifié côté DocuSeal | Vérifier dashboard DocuSeal → Resend |
| Hash différent après signature | Normal : DocuSeal embed signature dans le PDF final | Le `document_hash` représente le PDF original |
| Statut `completed` mais contrat reste `actif` | Trigger `propagate_signature_event` désactivé | Vérifier `pg_trigger` |

---

## 10. Secrets requis

| Secret | Description | Source |
|--------|-------------|--------|
| `DOCUSEAL_API_KEY` | Clé API DocuSeal | Console DocuSeal → API Keys |
| `DOCUSEAL_WEBHOOK_SECRET` | Secret HMAC webhook | Console DocuSeal → Webhooks → Generate secret |

À configurer dans **Supabase → Edge Functions → Secrets**.

---

## 11. Fichiers clés

```
src/
├── components/contrats/
│   ├── SignatureDialog.tsx          # Création de demande
│   └── signature/
│       ├── SignatureTab.tsx         # Onglet principal
│       ├── SignatureTimeline.tsx    # Audit trail visuel
│       └── SignedDocumentCard.tsx   # Preview + download
├── hooks/
│   ├── useSignatureRequest.ts       # Query + mutations
│   └── useSignatureEvents.ts        # Realtime events
└── types/signature.ts               # Types + labels

supabase/functions/
├── signature-send/index.ts          # POST création
├── signature-remind/index.ts        # POST relance
├── signature-cancel/index.ts        # POST annulation
└── docuseal-webhook/index.ts        # Webhook entrant (HMAC)
```
