# Guide Technique - Module Email

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

Documentation technique complète du système de messagerie OpenPulse.

## Table des Matières

- [Architecture Générale](#architecture-générale)
- [Schéma de Données](#schéma-de-données)
- [Synchronisation IMAP](#synchronisation-imap)
- [Envoi SMTP](#envoi-smtp)
- [Classification IA](#classification-ia)
- [Performance et Optimisation](#performance-et-optimisation)
- [Composants React](#composants-react)
- [Hooks](#hooks)
- [Edge Functions](#edge-functions)

---

## Architecture Générale

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND REACT                            │
├─────────────────────────────────────────────────────────────────┤
│  EmailListModern → EmailThread → EmailComposer → EmailReply     │
│       ↓                ↓              ↓            ↓            │
│  useEmailThreads  useMessages  useEmailSend  useEmailReply      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE EDGE FUNCTIONS                      │
├─────────────────────────────────────────────────────────────────┤
│  sync-emails          → IMAP Server                             │
│  send-email           → SMTP Server                             │
│  process-email-with-ai → Azure GPT-5                            │
│  generate-thread-title → Azure GPT-5                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE DATABASE                           │
├─────────────────────────────────────────────────────────────────┤
│  user_email_accounts  │  email_threads  │  email_messages       │
│  email_attachments    │  email_drafts   │  email_domain_mappings│
└─────────────────────────────────────────────────────────────────┘
```

---

## Schéma de Données

### Tables Principales

#### `user_email_accounts`

Comptes email synchronisés.

```sql
CREATE TABLE user_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  email_address TEXT NOT NULL,
  display_name TEXT,
  
  -- IMAP Configuration
  imap_host TEXT NOT NULL,
  imap_port INTEGER DEFAULT 993,
  imap_secure BOOLEAN DEFAULT true,
  
  -- SMTP Configuration
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER DEFAULT 587,
  smtp_secure BOOLEAN DEFAULT false,
  
  -- Credentials (chiffrés)
  encrypted_password TEXT NOT NULL,
  
  -- Sync State
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  
  -- Flags
  is_shared BOOLEAN DEFAULT false,  -- Compte partagé (ex: support@)
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `email_threads`

Fils de conversation groupés.

```sql
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email_account_id UUID REFERENCES user_email_accounts NOT NULL,
  thread_id TEXT NOT NULL,  -- ID technique pour groupage
  
  -- Contenu
  subject TEXT NOT NULL,
  ai_generated_title TEXT,  -- Titre IA (remplace RE:RE:TR:...)
  participants JSONB NOT NULL,
  
  -- Classification IA
  category TEXT,  -- Commercial, Support, Technique, Administratif...
  tags TEXT[],
  ai_confidence_score NUMERIC,
  ai_last_processed_at TIMESTAMPTZ,
  ai_extracted_data JSONB,
  ai_summary TEXT,
  
  -- Associations CRM
  etablissement_id UUID REFERENCES etablissements,
  groupe_id UUID REFERENCES groupes_etablissements,
  partenaire_id UUID REFERENCES partenaires,
  is_hors_etablissement BOOLEAN DEFAULT false,
  
  -- Compteurs
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  last_message_date TIMESTAMPTZ NOT NULL,
  
  -- Flags
  is_archived BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  priority priorite_tache,
  needs_manual_review BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_email_account_id, thread_id)
);
```

#### `email_messages`

Messages individuels.

```sql
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES email_threads NOT NULL,
  message_id TEXT NOT NULL UNIQUE,  -- Message-ID header
  imap_uid TEXT NOT NULL,
  
  -- Adresses
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses JSONB NOT NULL,
  cc_addresses JSONB,
  bcc_addresses JSONB,
  reply_to TEXT,
  
  -- Contenu
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  
  -- Références threading
  in_reply_to TEXT,
  reference_headers TEXT[],
  
  -- Dates
  sent_date TIMESTAMPTZ NOT NULL,
  received_date TIMESTAMPTZ NOT NULL,
  
  -- Flags
  is_read BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  attachments_count INTEGER DEFAULT 0,
  flags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX idx_email_messages_sent_date ON email_messages(sent_date DESC);
CREATE INDEX idx_email_messages_from ON email_messages(from_address);
```

#### `email_attachments`

Pièces jointes.

```sql
CREATE TABLE email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES email_messages NOT NULL,
  
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  
  -- Storage
  storage_bucket TEXT DEFAULT 'email-attachments',
  storage_path TEXT NOT NULL,
  downloaded BOOLEAN DEFAULT false,
  imap_part_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `email_domain_mappings`

Association domaine → entité CRM.

```sql
CREATE TABLE email_domain_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  
  -- Associations (mutuellement exclusives)
  etablissement_id UUID REFERENCES etablissements,
  groupe_id UUID REFERENCES groupes_etablissements,
  partenaire_id UUID REFERENCES partenaires,
  
  -- Métadonnées
  niveau_mapping TEXT,  -- 'etablissement', 'groupe', 'partenaire'
  confidence_level TEXT,
  verified BOOLEAN DEFAULT false,
  is_excluded BOOLEAN DEFAULT false,  -- Domaines à ignorer (gmail, yahoo...)
  prevent_auto BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles
);
```

---

## Synchronisation IMAP

### Flux de Synchronisation

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ CRON Job    │────▶│ Orchestrator │────▶│ sync-emails │
│ (hourly)    │     │              │     │             │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                    ┌───────────────────────────┘
                    ▼
    ┌───────────────────────────────────────────────┐
    │ Pour chaque compte (priorité: shared first)   │
    │                                               │
    │  1. Connexion TLS au serveur IMAP            │
    │  2. LOGIN avec credentials déchiffrés         │
    │  3. SELECT INBOX                              │
    │  4. UID SEARCH (depuis last_sync)            │
    │  5. FETCH headers + body pour chaque email   │
    │  6. Grouper par thread (References, In-Reply) │
    │  7. Upsert email_threads + email_messages    │
    │  8. Télécharger attachments vers Storage     │
    │  9. Générer titre IA si nouveau thread RE:   │
    │ 10. MAJ last_sync_at                         │
    └───────────────────────────────────────────────┘
```

### Configuration OVH vs Gmail

```typescript
// Détection automatique du type de serveur
const isGmail = account.imap_host.includes('gmail');
const isOVH = account.imap_host.includes('ovh');

// Mailboxes à synchroniser
const mailboxes = isGmail 
  ? ['INBOX', '[Gmail]/Sent Mail', '[Gmail]/Drafts']
  : ['INBOX', 'Sent', 'INBOX.Sent', 'Drafts'];

// Gestion des mailboxes manquantes
for (const mailbox of mailboxes) {
  try {
    await client.selectMailbox(mailbox);
    // ... sync logic
  } catch (error) {
    console.log(`Mailbox ${mailbox} not found, skipping`); // Edge Function Deno — console.log acceptable côté serveur
    continue;
  }
}
```

### Chiffrement des Mots de Passe

```typescript
// Chiffrement AES-256-GCM
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Deno.env.get('EMAIL_ENCRYPTION_KEY');

function encryptPassword(password: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptPassword(encrypted: string): string {
  const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

## Classification IA

### Processus de Classification

```
┌──────────────┐     ┌─────────────────────┐     ┌────────────────┐
│ Nouveau      │────▶│ process-email-with-ai│────▶│ Azure GPT-5    │
│ Thread       │     │                     │     │                │
└──────────────┘     └─────────────────────┘     └────────┬───────┘
                                                          │
                     ┌────────────────────────────────────┘
                     ▼
    ┌─────────────────────────────────────────────────────────┐
    │ Extraction :                                            │
    │  • Catégorie (Commercial, Support, Technique, Admin...) │
    │  • Tags (3-5 pertinents)                                │
    │  • Contacts (nom, email, fonction)                      │
    │  • Suggestions d'actions                                │
    │  • Résumé                                               │
    └─────────────────────────────────────────────────────────┘
                     │
                     ▼
    ┌─────────────────────────────────────────────────────────┐
    │ Mise à jour email_threads :                             │
    │  • category, tags, ai_confidence_score                  │
    │  • ai_extracted_data, ai_summary                        │
    │  • ai_last_processed_at                                 │
    └─────────────────────────────────────────────────────────┘
```

### Prompt de Classification

```typescript
const systemPrompt = `Tu es un assistant IA spécialisé dans la classification 
d'emails pour une entreprise de solutions de santé (OpenPulse).

Analyse l'email et extrait les informations suivantes au format JSON:
{
  "category": "Commercial|Support|Technique|Administratif|RH|Formation|Partenariat|Autre",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.0-1.0,
  "contacts": [
    {"name": "...", "email": "...", "function": "..."}
  ],
  "suggested_actions": [
    {"type": "create_task|schedule_call|send_document", "title": "...", "priority": "low|medium|high"}
  ],
  "summary": "Résumé en 1-2 phrases"
}

Catégories:
- Commercial: Prospects, tarification, contrats, négociations
- Support: Problèmes techniques, bugs, demandes d'aide
- Technique: Intégrations, configurations, déploiements
- Administratif: Facturation, comptabilité, RH admin
- Formation: Sessions, émargements, certifications
- Partenariat: Éditeurs, intégrateurs, revendeurs`;
```

### Génération de Titres

```typescript
const systemPrompt = `Tu génères des titres courts et lisibles pour des 
conversations email. Remplace les sujets comme "RE:RE:TR: Marque facturation 
Q4" par des titres clairs comme "Discussion facturation Q4".

Règles:
- Maximum 60 caractères
- Pas de préfixes RE:, TR:, FW:
- Titre descriptif du contenu
- En français`;
```

---

## Performance et Optimisation

### Contraintes Critiques

| Contrainte | Valeur | Raison |
|------------|--------|--------|
| `DEBOUNCE_AUTOCOMPLETE` | 300ms | Éviter stuttering lors de la frappe |
| `MAX_BATCH_SIZE` | 100 | Limiter le traitement par requête |
| `CHUNK_SIZE` | 50 | Éviter erreurs URL PostgREST |
| `MIN_LOAD_INTERVAL` | 500ms | Throttle infinite scroll |
| `MAX_PAGES` | 100 | Sécurité anti-boucle infinie |

### Optimisation des Requêtes

```typescript
// ❌ N+1 Query Problem
threads.map(thread => {
  const etablissement = useEtablissement(thread.etablissement_id);
  const messages = useMessages(thread.id);
  const attachments = useAttachments(thread.id);
});

// ✅ Batch Query avec useThreadsEnrichedData
const { data } = useThreadsEnrichedData(threadIds);
// Récupère établissements, messages, attachments en 1 requête
```

### Virtualisation de Liste

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function EmailList({ threads }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: threads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <EmailListItem 
            key={threads[virtualRow.index].id}
            thread={threads[virtualRow.index]}
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Composants React

### Hiérarchie des Composants

```
src/components/email/
├── EmailListModern.tsx        # Liste principale avec filtres
├── EmailListItemModern.tsx    # Item de liste avec actions rapides
├── EmailThread.tsx            # Vue conversation complète
├── EmailThreadHeader.tsx      # Header avec infos thread
├── EmailThreadActions.tsx     # Actions (répondre, archiver...)
├── EmailThreadMessages.tsx    # Liste des messages
├── EmailComposer.tsx          # Nouveau mail
├── EmailReply.tsx             # Réponse
├── EmailReplyAll.tsx          # Répondre à tous
├── EmailFilterChips.tsx       # Filtres modernes (pills)
├── EmailClassificationDashboard.tsx  # Dashboard classification
├── EmailListSkeleton.tsx      # Loading state
├── EmailListEmptyState.tsx    # État vide contextuel
└── MobileEmailListItem.tsx    # Version mobile optimisée
```

### Props Principales

```typescript
interface EmailListItemModernProps {
  thread: EmailThread;
  isSelected: boolean;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  enrichedData?: EnrichedThreadData;
}

interface EmailThreadProps {
  threadId: string;
  onBack: () => void;
  onArchive: () => void;
}

interface EmailComposerProps {
  accountId: string;
  onSend: () => void;
  onCancel: () => void;
  replyTo?: EmailMessage;
  defaultRecipients?: string[];
}
```

---

## Hooks

### `useEmailThreads`

Liste paginée des threads avec filtres.

```typescript
const {
  data,
  isLoading,
  hasNextPage,
  fetchNextPage,
  refetch
} = useEmailThreads({
  accountId: selectedAccountId,
  category: selectedCategory,
  isUnread: showUnreadOnly,
  search: searchQuery,
  etablissementId: filterEtablissement,
});
```

### `useThreadsEnrichedData`

Données enrichies pour une liste de threads.

```typescript
const { data: enrichedData } = useThreadsEnrichedData(threadIds);
// Retourne: { [threadId]: { etablissement, groupe, partenaire, contact } }
```

### `useEmailClassification`

Lancement de la classification IA.

```typescript
const { mutate: classify, isLoading } = useEmailClassification({
  batchSize: 100,
  processAll: false,
  onProgress: (progress) => debug.log(`${progress}% complete`),
});
```

---

## Edge Functions

### Liste Complète

| Fonction | Usage | JWT |
|----------|-------|-----|
| `sync-emails` | Synchronisation IMAP | Oui |
| `send-email` | Envoi SMTP | Oui |
| `send-email-reply` | Réponse à un thread | Oui |
| `process-email-with-ai` | Classification IA | Oui |
| `generate-thread-title` | Titre IA | Oui |
| `correct-spelling-email` | Correction ortho | Oui |
| `reformulate-email` | Reformulation | Oui |
| `translate-email` | Traduction | Oui |
| `suggest-email-content` | Suggestions | Oui |
| `detect-calendar-invitations` | Détection ICS | Oui |
| `auto-match-emails` | Association auto | Oui |
| `hourly-email-sync-and-analysis` | Orchestrateur CRON | Non |

---

## Troubleshooting

### Problèmes Courants

#### Emails non synchronisés

```typescript
// Vérifier les logs
const { data: logs } = await supabase
  .from('email_sync_log')
  .select('id, account_id, started_at, finished_at, status, error_message, emails_synced')
  .eq('account_id', accountId)
  .order('started_at', { ascending: false })
  .limit(10);

// Causes possibles:
// - Mot de passe expiré
// - Serveur IMAP injoignable
// - Quota dépassé
```

#### Classification IA échoue

```typescript
// Vérifier ai_processing_log
const { data: aiLogs } = await supabase
  .from('ai_processing_log')
  .select('id, processing_type, success, error_message, processing_duration_ms, processed_at')
  .eq('email_thread_id', threadId)
  .order('processed_at', { ascending: false });

// Causes possibles:
// - Timeout Azure (>90s)
// - Rate limit GPT-5
// - Email trop long
```

#### Performance dégradée

```typescript
// Vérifier les compteurs
debug.log('Thread count:', threads.length);
debug.log('Batch size:', MAX_BATCH_SIZE);

// Solutions:
// - Réduire MAX_BATCH_SIZE
// - Augmenter CHUNK_SIZE prudemment
// - Vérifier les index DB
```

---

*Guide mis à jour le 07/12/2025*
