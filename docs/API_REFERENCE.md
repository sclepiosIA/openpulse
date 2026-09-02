# API Reference - OpenPulse Edge Functions

Documentation manuelle des **Edge Functions** Supabase/Deno principales (~162).

> **Vérifié le** : 2026-06-03 | **Version**: 1.9.0
> **Total réel déployé** : **254 Edge Functions** — voir l'index exhaustif auto-généré [`API_REFERENCE_AUTO.md`](./API_REFERENCE_AUTO.md) (script : `scripts/gen-api-reference-auto.mjs`).
> **Revue de fraîcheur** : trimestrielle (prochaine échéance : 2026-09-03).

## Table des Matières

- [Authentification](#authentification)
- [Email](#email)
- [RH / People](#rh--people)
- [Trésorerie & Facturation](#trésorerie--facturation)
- [Contrats (DocuSeal)](#contrats-docuseal)
- [Pulse (Communication)](#pulse-communication)
- [R&D](#rd)
- [Support](#support)
- [Formations](#formations)
- [Booking (RDV Public)](#booking-rdv-public)
- [Knowledge Base](#knowledge-base)
- [Notifications](#notifications)
- [IA / Azure GPT-5](#ia--azure-gpt-5)
- [Utilitaires](#utilitaires)

---

## Authentification

La plupart des Edge Functions requièrent un JWT valide dans le header `Authorization`.

```bash
curl -X POST \
  'https://[project].supabase.co/functions/v1/[function]' \
  -H 'Authorization: Bearer [JWT_TOKEN]' \
  -H 'Content-Type: application/json' \
  -d '{"param": "value"}'
```

### Configuration `verify_jwt`

| Valeur  | Description         |
| ------- | ------------------- |
| `true`  | JWT requis (défaut) |
| `false` | Endpoint public     |

---

## Email

### `sync-emails`

Synchronise les emails depuis les serveurs IMAP.

**JWT**: Requis (CRON ou Admin)

```typescript
// Request
POST /functions/v1/sync-emails
{
  "accountId": "uuid",        // Optionnel: compte spécifique
  "forceFullSync": false      // Optionnel: resync complet
}

// Response
{
  "success": true,
  "accountsSynced": 5,
  "emailsFetched": 127,
  "errors": []
}
```

---

### `send-email`

Envoie un nouvel email via SMTP.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/send-email
{
  "accountId": "uuid",
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],        // Optionnel
  "bcc": ["bcc@example.com"],      // Optionnel
  "subject": "Sujet",
  "body": "<p>Contenu HTML</p>",
  "attachments": [                  // Optionnel
    {
      "filename": "doc.pdf",
      "content": "base64...",
      "contentType": "application/pdf"
    }
  ]
}

// Response
{
  "success": true,
  "messageId": "<unique-id@domain.com>"
}
```

---

### `send-email-reply`

Répond à un email existant.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/send-email-reply
{
  "threadId": "uuid",
  "accountId": "uuid",
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],
  "subject": "RE: Sujet original",
  "body": "<p>Réponse</p>",
  "inReplyTo": "<original-message-id>"
}

// Response
{
  "success": true,
  "messageId": "<reply-id@domain.com>"
}
```

---

### `process-email-with-ai`

Analyse un thread email avec GPT-5 pour classification.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/process-email-with-ai
{
  "threadId": "uuid"
}

// Response
{
  "success": true,
  "category": "Commercial",
  "tags": ["prospect", "tarification", "rendez-vous"],
  "confidence": 0.92,
  "extractedContacts": [
    {
      "name": "Jean Dupont",
      "email": "jean.dupont@hopital.fr",
      "function": "Directeur DIM"
    }
  ],
  "suggestedActions": [
    {
      "type": "create_task",
      "title": "Planifier RDV",
      "priority": "high"
    }
  ]
}
```

---

### `generate-thread-title`

Génère un titre lisible pour un thread email.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/generate-thread-title
{
  "threadId": "uuid",
  "subject": "RE:RE:TR: Marque facturation",
  "firstMessageContent": "Bonjour, suite à notre échange..."
}

// Response
{
  "success": true,
  "title": "Discussion facturation Q4 2025"
}
```

---

### `correct-spelling-email`

Corrige l'orthographe d'un texte.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/correct-spelling-email
{
  "text": "Bonjour, je voudrais savoir si vous pouvez m'envoiez..."
}

// Response
{
  "success": true,
  "correctedText": "Bonjour, je voudrais savoir si vous pouvez m'envoyer..."
}
```

---

### `reformulate-email`

Reformule un texte avec un ton professionnel.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/reformulate-email
{
  "text": "Original text...",
  "tone": "professional"  // professional, friendly, formal
}

// Response
{
  "success": true,
  "reformulatedText": "Reformulated text..."
}
```

---

### `translate-email`

Traduit un email.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/translate-email
{
  "text": "Hello, how are you?",
  "targetLanguage": "fr"
}

// Response
{
  "success": true,
  "translatedText": "Bonjour, comment allez-vous ?"
}
```

---

### `detect-calendar-invitations`

Détecte les invitations calendrier dans un email.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/detect-calendar-invitations
{
  "messageId": "uuid"
}

// Response
{
  "success": true,
  "invitations": [
    {
      "uid": "unique-calendar-id",
      "summary": "Réunion projet",
      "dtstart": "2025-01-15T14:00:00Z",
      "dtend": "2025-01-15T15:00:00Z",
      "location": "Salle A",
      "organizer": "organisateur@example.com"
    }
  ]
}
```

---

### `hourly-email-sync-and-analysis`

Orchestrateur CRON pour synchronisation et analyse.

**JWT**: Non (CRON interne)

```typescript
// Déclenché automatiquement toutes les heures
// Synchronise tous les comptes email actifs
// Lance l'analyse IA sur les nouveaux threads

// Response
{
  "success": true,
  "accountsSynced": 8,
  "threadsAnalyzed": 45,
  "duration": "2m 34s"
}
```

---

## RH / People

### `parse-bulletin-salaire`

Extrait les données d'un bulletin de paie PDF via GPT-5.

**JWT**: Requis (Admin/RH)

```typescript
// Request
POST /functions/v1/parse-bulletin-salaire
{
  "storagePath": "rh-documents/bulletins/2025-01/bulletin.pdf"
}

// Response
{
  "success": true,
  "data": {
    "employee_name": "Jean Dupont",
    "period": "2025-01",
    "salaire_brut": 4500.00,
    "salaire_net": 3510.00,
    "net_paye": 3450.00,
    "cotisations_salariales": 990.00,
    "cotisations_patronales": 1800.00,
    "heures_travaillees": 151.67
  },
  "confidence": 0.95
}
```

---

### `export-paie`

Exporte les données de paie au format CSV/Excel.

**JWT**: Requis (Admin/RH)

```typescript
// Request
POST /functions/v1/export-paie
{
  "period": "2025-01",
  "format": "xlsx",        // csv, xlsx
  "includeDetails": true
}

// Response
{
  "success": true,
  "downloadUrl": "https://...",
  "expiresAt": "2025-01-15T12:00:00Z"
}
```

---

### `sync-rh-tresorerie`

Synchronise les salaires vers le module trésorerie.

**JWT**: Requis (Admin)

```typescript
// Request
POST /functions/v1/sync-rh-tresorerie
{
  "period": "2025-01"
}

// Response
{
  "success": true,
  "expensesCreated": 12,
  "totalAmount": 45000.00
}
```

---

## Trésorerie

### `qonto-sync-transactions`

Synchronise les transactions depuis Qonto.

**JWT**: Requis (Admin)

```typescript
// Request
POST /functions/v1/qonto-sync-transactions
{
  "fromDate": "2025-01-01",  // Optionnel
  "toDate": "2025-01-31"     // Optionnel
}

// Response
{
  "success": true,
  "transactionsSynced": 87,
  "autoReconciled": 45,
  "pendingReconciliation": 42
}
```

---

### `generate-monthly-invoices`

Génère les factures mensuelles depuis les contrats actifs.

**JWT**: Non (CRON)

```typescript
// Response
{
  "success": true,
  "invoicesGenerated": 23,
  "totalAmount": 125000.00
}
```

---

## R&D

### `rd-ai-assist`

Assistance IA pour la rédaction de user stories.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/rd-ai-assist
{
  "storyId": "uuid",
  "description": "En tant qu'utilisateur, je veux..."
}

// Response
{
  "success": true,
  "improvedDescription": "<p>En tant qu'<strong>utilisateur</strong>...</p>",
  "suggestedTasks": [
    {
      "title": "Créer le composant UI",
      "estimated_hours": 4
    },
    {
      "title": "Implémenter la logique métier",
      "estimated_hours": 6
    }
  ],
  "acceptanceCriteria": [
    "Le formulaire valide les champs obligatoires",
    "Un message de confirmation s'affiche après soumission"
  ]
}
```

---

## Support

### `create-support-ticket`

Crée un ticket support depuis un email.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/create-support-ticket
{
  "threadId": "uuid",
  "emailContent": "Contenu de l'email..."
}

// Response
{
  "success": true,
  "ticketId": "uuid",
  "taskId": "uuid",
  "priority": "high",
  "establishmentId": "uuid"
}
```

---

## Formations

### `register-emargement-simple`

Enregistre un émargement de formation (public).

**JWT**: Non requis

```typescript
POST /functions/v1/register-emargement-simple
{
  "sessionId": "uuid",
  "userId": "uuid",
  "signature": "data:image/png;base64,...",
  "timestamp": "2025-01-15T09:00:00Z"
}

// Response
{ "success": true, "emargementId": "uuid" }
```

---

### `submit-satisfaction-solution`

Soumet une enquête de satisfaction solution (public).

**JWT**: Non requis

```typescript
POST /functions/v1/submit-satisfaction-solution
{
  "token": "enquete-token",
  "responses": {
    "satisfaction_solution": 8,
    "facilite_utilisation": 9,
    "recommandation_collegues": 8,
    "commentaire_libre": "Très bon outil..."
  }
}
```

---

### `recommend-training`

Recommande des formations basées sur les compétences.

**JWT**: Requis

```typescript
POST /functions/v1/recommend-training
{ "employeeId": "uuid" }

// Response
{
  "success": true,
  "recommendations": [
    { "trainingId": "uuid", "title": "Formation React avancé", "relevance": 0.92 }
  ]
}
```

---

## Booking (RDV Public)

### `send-booking-confirmation`

Envoie un email de confirmation de RDV.

**JWT**: Non requis (webhook interne)

```typescript
POST /functions/v1/send-booking-confirmation
{
  "bookingId": "uuid",
  "guestEmail": "guest@example.com",
  "hostName": "Jean Dupont",
  "dateTime": "2026-01-20T14:00:00Z",
  "duration": 30,
  "location": "Visio Google Meet"
}
```

---

### `send-booking-reminder`

Envoie un rappel de RDV (24h et 1h avant).

**JWT**: Non requis (CRON)

```typescript
POST /functions/v1/send-booking-reminder
{ "hoursBefor": 24 }  // 24 ou 1

// Response
{ "success": true, "remindersSent": 12 }
```

---

## Knowledge Base

### `kb-semantic-search`

Recherche sémantique dans la base de connaissances.

**JWT**: Requis

```typescript
POST /functions/v1/kb-semantic-search
{
  "query": "comment configurer l'authentification 2FA",
  "limit": 10,
  "categoryId": "uuid"  // optionnel
}

// Response
{
  "success": true,
  "results": [
    { "articleId": "uuid", "title": "Guide 2FA", "relevance": 0.94 }
  ],
  "aiSummary": "Pour configurer le 2FA..."
}
```

---

### `kb-ai-assist`

Assistance IA pour rédaction d'articles KB.

**JWT**: Requis

```typescript
POST /functions/v1/kb-ai-assist
{
  "action": "improve",  // improve, summarize, translate, suggest_tags
  "content": "Contenu de l'article...",
  "language": "fr"
}
```

---

## Contrats (DocuSeal)

### `docuseal-create-signature`

Crée une demande de signature électronique.

**JWT**: Requis

```typescript
POST /functions/v1/docuseal-create-signature
{
  "contratId": "uuid",
  "signataires": [
    { "email": "client@example.com", "nom": "Client", "role": "signataire" }
  ],
  "callbackUrl": "https://..."
}

// Response
{
  "success": true,
  "signatureRequestId": "docuseal-id",
  "signingUrl": "https://docuseal.co/sign/..."
}
```

---

### `docuseal-webhook`

Webhook DocuSeal pour événements de signature.

**JWT**: Non requis (webhook externe)

```typescript
POST /functions/v1/docuseal-webhook
// Headers: X-DocuSeal-Signature

{
  "event": "submission.completed",
  "data": {
    "submission_id": "xxx",
    "status": "completed"
  }
}
```

---

### `contract-ai-assist`

Assistance IA pour rédaction de clauses contractuelles.

**JWT**: Requis

```typescript
POST /functions/v1/contract-ai-assist
{
  "action": "generate",  // generate, review, simplify
  "clauseType": "confidentialite",
  "context": "Contrat SaaS B2B secteur santé"
}
```

---

### `document-ai-assist`

Assistant IA de la GED : résumé, reformulation, classification DPO/RSSI, extraction d'actions. Mode dégradé `unconfigured` si Azure OpenAI absent (voir `docs/DOCUMENTS_AI_TECH_GUIDE.md`).

**JWT**: Requis · Rate limit : 20 req/min/utilisateur

```typescript
POST /functions/v1/document-ai-assist
{
  "action": "summarize",  // summarize, rewrite, classify, extract_actions
  "content": "<p>Contenu du document…</p>",
  "documentName": "CR réunion",     // optionnel
  "tone": "formal"                  // optionnel (rewrite) : formal, concise, simplified
}

// Response (ok)
{ "status": "ok", "configured": true, "action": "summarize", "result": "…", "model": "…" }

// Response (backend IA non configuré — HTTP 200)
{ "status": "unconfigured", "configured": false, "message": "…" }
```

---

## Pulse (Communication)

### `pulse-ai-chat`

Chat IA dans Pulse pour questions/réponses.

**JWT**: Requis

```typescript
POST /functions/v1/pulse-ai-chat
{
  "conversationId": "uuid",
  "message": "Résume les dernières discussions sur le projet X"
}

// Response
{
  "success": true,
  "response": "Les discussions récentes portent sur..."
}
```

---

### `pulse-ai-summarize`

Résumé IA d'une conversation Pulse.

**JWT**: Requis

```typescript
POST /functions/v1/pulse-ai-summarize
{ "conversationId": "uuid" }

// Response
{
  "success": true,
  "summary": "Cette conversation traite de...",
  "keyPoints": ["Point 1", "Point 2"],
  "actionItems": ["Action 1"]
}
```

---

### `pulse-search`

Recherche dans les conversations Pulse.

**JWT**: Requis

```typescript
POST /functions/v1/pulse-search
{
  "query": "budget projet formation",
  "limit": 20
}
```

---

### `pulse-notify`

Notifie les participants d'une conversation.

**JWT**: Non requis (interne)

```typescript
POST /functions/v1/pulse-notify
{
  "conversationId": "uuid",
  "messageId": "uuid",
  "excludeUserId": "uuid"
}
```

---

### `pulse-ai-editor`

Assistance IA pour rédaction de messages.

**JWT**: Requis

```typescript
POST /functions/v1/pulse-ai-editor
{
  "action": "improve",  // improve, translate, summarize
  "text": "Texte à améliorer..."
}
```

---

### `webrtc-signaling`

Signaling WebRTC pour visioconférence Pulse.

**JWT**: Requis

```typescript
WebSocket / functions / v1 / webrtc - signaling
// Messages: offer, answer, ice-candidate
```

---

## Live Chat

### `live-chat-ai-respond`

Génère une réponse IA pour le live chat.

**JWT**: Non requis (widget)

```typescript
POST /functions/v1/live-chat-ai-respond
{
  "sessionId": "uuid",
  "mode": "suggest"  // "auto" ou "suggest"
}

// Response
{
  "success": true,
  "suggestions": [
    { "content": "Je vous envoie notre grille tarifaire.", "confidence": 0.92 }
  ]
}
```

---

## Calendrier

### `calendar-feed`

Génère un flux iCal pour abonnement externe.

**JWT**: Non requis (token dans URL)

```typescript
GET /functions/v1/calendar-feed?token=xxx

// Response: text/calendar
BEGIN:VCALENDAR
...
END:VCALENDAR
```

---

### `calendar-ai-create`

Crée un événement calendrier avec IA.

**JWT**: Requis

```typescript
POST /functions/v1/calendar-ai-create
{
  "prompt": "RDV avec Hôpital Saint-Louis mardi prochain 14h",
  "calendarId": "uuid"
}

// Response
{
  "success": true,
  "event": {
    "title": "RDV Hôpital Saint-Louis",
    "start": "2026-01-28T14:00:00Z",
    "end": "2026-01-28T15:00:00Z"
  }
}
```

---

### `sync-calendar-subscription`

Synchronise un calendrier externe (iCal URL).

**JWT**: Requis

```typescript
POST /functions/v1/sync-calendar-subscription
{ "subscriptionId": "uuid" }
```

---

### `import-ics-events`

Importe des événements depuis un fichier ICS.

**JWT**: Requis

```typescript
POST /functions/v1/import-ics-events
{
  "calendarId": "uuid",
  "icsContent": "BEGIN:VCALENDAR..."
}
```

---

## OAuth & Intégrations

### `oauth-google-init`

Initie le flux OAuth Google.

**JWT**: Requis

```typescript
POST /functions/v1/oauth-google-init
{ "scopes": ["calendar", "gmail"] }

// Response
{ "authUrl": "https://accounts.google.com/..." }
```

---

### `oauth-google-callback`

Callback OAuth Google.

**JWT**: Non requis (redirect)

```typescript
GET /functions/v1/oauth-google-callback?code=xxx&state=xxx
```

---

### `oauth-google-refresh`

Rafraîchit un token Google expiré.

**JWT**: Requis

```typescript
POST /functions/v1/oauth-google-refresh
{ "accountId": "uuid" }
```

---

## Facturation

### `generate-invoice-pdf`

Génère un PDF de facture.

**JWT**: Requis

```typescript
POST /functions/v1/generate-invoice-pdf
{ "factureId": "uuid" }

// Response
{
  "success": true,
  "pdfUrl": "https://storage.../facture_2026-001.pdf"
}
```

---

### `generate-quote-pdf`

Génère un PDF de devis.

**JWT**: Requis

```typescript
POST /functions/v1/generate-quote-pdf
{ "devisId": "uuid" }
```

---

### `export-fec`

Exporte les données comptables au format FEC.

**JWT**: Requis (Admin)

```typescript
POST /functions/v1/export-fec
{
  "annee": 2025,
  "format": "txt"
}

// Response
{ "downloadUrl": "https://storage.../FEC_2025.txt" }
```

---

### `send-invoice-reminders`

Envoie des rappels pour factures impayées.

**JWT**: Non requis (CRON)

```typescript
// Déclenché quotidiennement
// Response
{ "remindersSent": 5, "overdueCount": 12 }
```

---

### `predict-cashflow`

Prédit le cashflow futur avec IA.

**JWT**: Requis

```typescript
POST /functions/v1/predict-cashflow
{ "months": 6 }

// Response
{
  "success": true,
  "predictions": [
    { "month": "2026-02", "revenue": 125000, "expenses": 95000, "balance": 30000 }
  ]
}
```

---

## Recrutement

### `parse-cv-with-ai`

Parse un CV avec GPT-5.

**JWT**: Requis

```typescript
POST /functions/v1/parse-cv-with-ai
{
  "documentId": "uuid",
  "jobOfferId": "uuid"  // optionnel pour scoring
}

// Response
{
  "success": true,
  "parsed": {
    "nom": "Dupont",
    "prenom": "Jean",
    "competences": ["React", "TypeScript"],
    "experience_totale_annees": 5,
    "score_adequation": 85
  }
}
```

---

## RGPD

### `rgpd-export-data`

Exporte les données personnelles d'un utilisateur.

**JWT**: Requis (Admin)

```typescript
POST /functions/v1/rgpd-export-data
{
  "userId": "uuid",
  "format": "json",
  "includeAuditLog": true
}

// Response
{
  "downloadUrl": "https://storage.../export_rgpd.json",
  "expiresAt": "2026-02-01T00:00:00Z"
}
```

---

## Visio & Transcription

### `transcribe-audio`

Transcrit un fichier audio avec Azure Speech.

**JWT**: Requis

```typescript
POST /functions/v1/transcribe-audio
{
  "audioUrl": "https://storage.../recording.mp3",
  "language": "fr-FR"
}

// Response
{
  "success": true,
  "transcription": "Texte transcrit...",
  "duration": 1234
}
```

---

### `generate-visio-summary`

Génère un résumé de visioconférence.

**JWT**: Requis

```typescript
POST /functions/v1/generate-visio-summary
{ "transcriptionId": "uuid" }

// Response
{
  "summary": "Points clés de la réunion...",
  "actionItems": ["Action 1", "Action 2"],
  "participants": ["Jean", "Marie"]
}
```

---

### `visio-transcription-session`

Gère une session de transcription en temps réel.

**JWT**: Requis

```typescript
WebSocket / functions / v1 / visio - transcription - session
// Messages: audio chunks base64
```

---

## Notifications

### `send-push-notification`

Envoie une notification push Web Push.

**JWT**: Non requis (interne)

```typescript
POST /functions/v1/send-push-notification
{
  "userId": "uuid",
  "title": "Nouveau message",
  "body": "Vous avez reçu un email de...",
  "url": "/emails?thread=uuid"
}
```

---

### `create-in-app-notification`

Crée une notification in-app.

**JWT**: Requis

```typescript
POST /functions/v1/create-in-app-notification
{
  "userId": "uuid",
  "type": "task_assigned",
  "title": "Nouvelle tâche assignée",
  "data": { "taskId": "uuid" }
}
```

---

### `daily-task-reminder`

Envoie les rappels de tâches quotidiens.

**JWT**: Non requis (CRON)

```typescript
// Déclenché à 8h tous les jours
// Response
{ "remindersSent": 45, "usersNotified": 12 }
```

---

## Administration

### `admin-create-user`

Crée un utilisateur (admin uniquement).

**JWT**: Requis (Admin)

```typescript
POST /functions/v1/admin-create-user
{
  "email": "nouveau@example.com",
  "password": "temporary123",
  "nom": "Dupont",
  "prenom": "Jean",
  "role": "commercial"
}
```

---

### `admin-reset-user-password`

Réinitialise le mot de passe d'un utilisateur.

**JWT**: Requis (Admin)

```typescript
POST /functions/v1/admin-reset-user-password
{
  "userId": "uuid",
  "newPassword": "temporary456"
}
```

---

### `generate-2fa-secret`

Génère un secret 2FA TOTP.

**JWT**: Requis

```typescript
POST /functions/v1/generate-2fa-secret

// Response
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "otpauth://totp/Marque:user@example.com?..."
}
```

---

### `ip-validator`

Valide une adresse IP (whitelist/blacklist).

**JWT**: Non requis

```typescript
POST /functions/v1/ip-validator
{ "ip": "192.168.1.1" }

// Response
{ "allowed": true, "reason": "whitelisted" }
```

---

## Utilitaires & Maintenance

### `cleanup-all-suggestions`

Nettoie toutes les suggestions IA obsolètes.

**JWT**: Requis (Admin)

```typescript
POST /functions/v1/cleanup-all-suggestions
{ "olderThanDays": 30 }
```

---

### `resync-empty-emails`

Resynchronise les emails vides (erreurs précédentes).

**JWT**: Requis (Admin)

```typescript
POST / functions / v1 / resync - empty - emails
```

---

### `complete-team-email-mappings`

Complète les mappings email → équipe.

**JWT**: Requis (Admin)

```typescript
POST / functions / v1 / complete - team - email - mappings
```

---

### `backfill-contacts-from-ai-data`

Remplit les contacts depuis les données IA extraites.

**JWT**: Requis (Admin)

```typescript
POST / functions / v1 / backfill - contacts - from - ai - data
```

---

## Visioconférence & Transcription

### `azure-transcribe-audio`

Transcrit un fichier audio via Azure Speech Services.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/azure-transcribe-audio
{
  "audioUrl": "https://storage.../audio.webm",
  "language": "fr-FR"
}

// Response
{
  "success": true,
  "transcription": "Bonjour, bienvenue dans cette réunion...",
  "duration": 45.2,
  "confidence": 0.94
}
```

---

### `visio-transcription-session`

Gère une session de transcription en temps réel pour la visioconférence.

**JWT**: Requis

```typescript
// Request
POST /functions/v1/visio-transcription-session
{
  "action": "start" | "stop" | "status",
  "roomId": "uuid",
  "language": "fr-FR"
}

// Response
{
  "success": true,
  "sessionId": "uuid",
  "status": "active"
}
```

---

### `webrtc-signaling`

Serveur de signaling pour les connexions WebRTC (visioconférence).

**JWT**: Requis

```typescript
// Request
POST /functions/v1/webrtc-signaling
{
  "type": "offer" | "answer" | "ice-candidate",
  "roomId": "uuid",
  "targetPeerId": "uuid",
  "payload": { ... }
}

// Response
{
  "success": true,
  "relayed": true
}
```

---

## Codes d'Erreur

| Code | Description           |
| ---- | --------------------- |
| 200  | Succès                |
| 400  | Requête invalide      |
| 401  | Non authentifié       |
| 403  | Non autorisé          |
| 404  | Ressource non trouvée |
| 429  | Rate limit dépassé    |
| 500  | Erreur serveur        |

### Format d'Erreur

```json
{
  "error": "Description de l'erreur",
  "code": "ERROR_CODE",
  "details": {}
}
```

---

## Rate Limiting

| Type            | Limite      |
| --------------- | ----------- |
| Par utilisateur | 100 req/min |
| Par IP          | 200 req/min |
| GPT-5           | 20 req/min  |

---

_Documentation mise à jour en février 2026 - 125 Edge Functions documentées_
