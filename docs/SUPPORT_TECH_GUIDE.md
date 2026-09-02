# Guide Technique - Module Support

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

Documentation technique complète du système de gestion des tickets support OpenPulse.

## Table des Matières

- [Vue d'Ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Schéma de Données](#schéma-de-données)
- [Flux de Création de Tickets](#flux-de-création-de-tickets)
- [Déduplication des Emails](#déduplication-des-emails)
- [Composants React](#composants-react)
- [Edge Functions](#edge-functions)

---

## Vue d'Ensemble

Le module Support centralise la gestion des demandes d'assistance :

- **Création automatique** de tickets depuis les emails support@exploitant.example.org
- **Liaison bidirectionnelle** ticket ↔ tâche établissement
- **Déduplication** via Message-ID pour éviter les doublons
- **KPIs** de performance support (temps de résolution, SLA...)
- **Notifications push** pour les nouvelles demandes

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMAIL ENTRANT                                 │
│              support@exploitant.example.org                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    sync-emails                                   │
│                                                                  │
│  1. Synchronise l'email depuis IMAP                             │
│  2. Détecte compte partagé (is_shared = true)                   │
│  3. Vérifie déduplication (email_message_id_registry)           │
│  4. Appelle create-support-ticket si nouveau                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                create-support-ticket                             │
│                                                                  │
│  1. Parse le contenu de l'email                                 │
│  2. Identifie l'établissement concerné                          │
│  3. Crée le ticket support                                      │
│  4. Crée la tâche liée dans l'établissement                     │
│  5. Envoie notification push aux admins/support                 │
│  6. Marque comme traité dans le registre                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RÉSULTAT                                    │
│                                                                  │
│  • support_tickets : nouveau ticket créé                        │
│  • taches : nouvelle tâche catégorie "Support"                  │
│  • push_subscriptions : notifications envoyées                  │
│  • email_message_id_registry : marqué processed_for_support     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schéma de Données

### `support_tickets`

Tickets de support.

```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Références
  email_thread_id UUID REFERENCES email_threads,
  etablissement_id UUID REFERENCES etablissements,
  tache_id UUID REFERENCES taches,  -- Liaison bidirectionnelle
  
  -- Contenu
  titre TEXT NOT NULL,
  description TEXT,
  
  -- Classification
  categorie TEXT,  -- Bug, Question, Demande, Incident
  priorite TEXT DEFAULT 'medium',  -- low, medium, high, critical
  statut TEXT DEFAULT 'open',  -- open, in_progress, waiting, resolved, closed
  
  -- SLA
  sla_deadline TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Assignation
  assigned_to UUID REFERENCES profiles,
  
  -- Métadonnées
  source TEXT DEFAULT 'email',  -- email, manual, api
  tags TEXT[],
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles
);

-- Index pour recherche
CREATE INDEX idx_support_tickets_status ON support_tickets(statut);
CREATE INDEX idx_support_tickets_etablissement ON support_tickets(etablissement_id);
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to);
```

### `email_message_id_registry`

Registre de déduplication.

```sql
CREATE TABLE email_message_id_registry (
  message_id TEXT PRIMARY KEY,  -- Email Message-ID header
  
  -- Source
  source_account_id UUID REFERENCES user_email_accounts,
  source_thread_id UUID REFERENCES email_threads,
  
  -- Flags de traitement
  processed_for_ai BOOLEAN DEFAULT false,
  processed_for_support BOOLEAN DEFAULT false,
  
  first_seen_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Flux de Création de Tickets

### 1. Réception Email

```typescript
// Dans sync-emails
if (account.is_shared && account.email_address.includes('support')) {
  // Vérifier déduplication
  const { data: existing } = await supabase
    .from('email_message_id_registry')
    .select('processed_for_support')
    .eq('message_id', email.messageId)
    .single();
  
  if (!existing?.processed_for_support) {
    // Créer ticket
    await supabase.functions.invoke('create-support-ticket', {
      body: {
        threadId: dbThreadId,
        messageId: email.messageId,
        subject: email.subject,
        fromAddress: email.from,
        content: email.body
      }
    });
  }
}
```

### 2. Création du Ticket

```typescript
// Dans create-support-ticket
async function createTicket(params: CreateTicketParams) {
  // 1. Identifier l'établissement
  const etablissement = await findEtablissementByEmail(params.fromAddress);
  
  // 2. Déterminer la priorité
  const priority = detectPriority(params.subject, params.content);
  
  // 3. Créer le ticket
  const { data: ticket } = await supabase
    .from('support_tickets')
    .insert({
      email_thread_id: params.threadId,
      etablissement_id: etablissement?.id,
      titre: params.subject,
      description: params.content,
      priorite: priority,
      sla_deadline: calculateSLA(priority)
    })
    .select()
    .single();
  
  // 4. Créer la tâche liée
  if (etablissement) {
    const { data: tache } = await supabase
      .from('taches')
      .insert({
        etablissement_id: etablissement.id,
        titre: `[Support] ${params.subject}`,
        description: params.content,
        categorie_id: await getSupportCategoryId(),
        priorite: priority,
        statut: 'a_faire'
      })
      .select()
      .single();
    
    // 5. Lier ticket et tâche
    await supabase
      .from('support_tickets')
      .update({ tache_id: tache.id })
      .eq('id', ticket.id);
  }
  
  // 6. Envoyer notifications
  await notifyAdmins(ticket);
  
  // 7. Marquer comme traité
  await supabase
    .from('email_message_id_registry')
    .upsert({
      message_id: params.messageId,
      processed_for_support: true,
      source_thread_id: params.threadId
    });
  
  return ticket;
}
```

### 3. Calcul SLA

```typescript
function calculateSLA(priority: string): Date {
  const now = new Date();
  const slaHours = {
    critical: 4,
    high: 8,
    medium: 24,
    low: 48
  };
  
  return addHours(now, slaHours[priority] || 24);
}
```

---

## Déduplication des Emails

### Problème

Quand un email arrive sur le compte partagé support@, plusieurs utilisateurs peuvent le synchroniser simultanément, créant des tickets en double.

### Solution

Le registre `email_message_id_registry` utilise le header `Message-ID` (unique par email RFC) comme clé primaire.

```typescript
// Pattern de déduplication
async function processWithDeduplication(messageId: string, action: string) {
  // Vérifier si déjà traité
  const { data: registry } = await supabase
    .from('email_message_id_registry')
    .select('message_id, processed_for_support, processed_for_sync, processed_for_classification')
    .eq('message_id', messageId)
    .single();
  
  const flagField = `processed_for_${action}`;
  
  if (registry?.[flagField]) {
    debug.log(`Message ${debug.maskId(messageId)} already processed for ${action}`);
    return null;
  }
  
  // Marquer comme en cours (upsert atomique)
  const { error } = await supabase
    .from('email_message_id_registry')
    .upsert({
      message_id: messageId,
      [flagField]: true
    }, {
      onConflict: 'message_id'
    });
  
  if (error?.code === '23505') {
    // Conflict = already being processed
    return null;
  }
  
  return true; // OK to process
}
```

---

## Composants React

### Structure

```
src/components/support/
├── SupportTicketList.tsx      # Liste filtrable
├── SupportTicketDetail.tsx    # Vue détaillée
├── SupportTicketCard.tsx      # Card dans la liste
├── SupportKPIs.tsx            # Métriques dashboard
├── SupportFilters.tsx         # Filtres avancés
└── CreateTicketDialog.tsx     # Création manuelle
```

### `SupportTicketList`

Liste principale avec filtres.

```typescript
interface SupportTicketListProps {
  filters: TicketFilters;
  onSelectTicket: (ticketId: string) => void;
}

function SupportTicketList({ filters, onSelectTicket }: SupportTicketListProps) {
  const { tickets, isLoading } = useSupportTickets(filters);
  
  return (
    <div className="space-y-4">
      <SupportKPIs tickets={tickets} />
      <SupportFilters value={filters} onChange={setFilters} />
      
      <div className="space-y-2">
        {tickets.map(ticket => (
          <SupportTicketCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => onSelectTicket(ticket.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

### `SupportKPIs`

Métriques de performance.

```typescript
interface KPIs {
  total: number;
  open: number;
  inProgress: number;
  avgResolutionTime: number;  // heures
  slaCompliance: number;      // pourcentage
  firstResponseTime: number;  // heures
}

function SupportKPIs({ tickets }: { tickets: Ticket[] }) {
  const kpis = useMemo(() => calculateKPIs(tickets), [tickets]);
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard title="Tickets ouverts" value={kpis.open} />
      <KPICard title="En cours" value={kpis.inProgress} />
      <KPICard 
        title="Temps résolution moyen" 
        value={`${kpis.avgResolutionTime}h`} 
      />
      <KPICard 
        title="Conformité SLA" 
        value={`${kpis.slaCompliance}%`}
        trend={kpis.slaCompliance >= 90 ? 'up' : 'down'}
      />
    </div>
  );
}
```

---

## Edge Functions

### `create-support-ticket`

Création automatique depuis email.

```typescript
// supabase/functions/create-support-ticket/index.ts

serve(async (req) => {
  const { threadId, messageId, subject, fromAddress, content } = await req.json();
  
  // 1. Déduplication
  const { data: existing } = await supabase
    .from('email_message_id_registry')
    .select('processed_for_support')
    .eq('message_id', messageId)
    .single();
  
  if (existing?.processed_for_support) {
    return new Response(JSON.stringify({ 
      success: true, 
      skipped: true,
      reason: 'Already processed' 
    }));
  }
  
  // 2. Trouver l'établissement
  const etablissement = await findEtablissementByEmail(supabase, fromAddress);
  
  // 3. Créer le ticket
  const { data: ticket } = await supabase
    .from('support_tickets')
    .insert({
      email_thread_id: threadId,
      etablissement_id: etablissement?.id,
      titre: cleanSubject(subject),
      description: extractDescription(content),
      priorite: detectPriority(subject, content),
      source: 'email'
    })
    .select()
    .single();
  
  // 4. Créer tâche liée
  if (etablissement) {
    const { data: tache } = await supabase
      .from('taches')
      .insert({
        etablissement_id: etablissement.id,
        titre: `[Support] ${ticket.titre}`,
        categorie_id: 'support-category-id',
        priorite: ticket.priorite
      })
      .select()
      .single();
    
    await supabase
      .from('support_tickets')
      .update({ tache_id: tache.id })
      .eq('id', ticket.id);
  }
  
  // 5. Notifications push
  await supabase.functions.invoke('send-push-notification', {
    body: {
      type: 'support_ticket',
      title: 'Nouveau ticket support',
      body: ticket.titre,
      url: `/support?ticket=${ticket.id}`
    }
  });
  
  // 6. Marquer comme traité
  await supabase
    .from('email_message_id_registry')
    .upsert({
      message_id: messageId,
      processed_for_support: true,
      source_thread_id: threadId
    });
  
  return new Response(JSON.stringify({ 
    success: true,
    ticketId: ticket.id 
  }));
});
```

---

## Configuration Compte Partagé

### Initialisation

```typescript
// supabase/functions/init-shared-email-account/index.ts

const SUPPORT_EMAIL = 'support@exploitant.example.org';
const SUPPORT_PASSWORD = Deno.env.get('SUPPORT_EMAIL_PASSWORD');

// Configuration OVH
const config = {
  email_address: SUPPORT_EMAIL,
  display_name: 'Support OpenPulse',
  imap_host: 'smtp.example.org',
  imap_port: 993,
  smtp_host: 'smtp.example.org',
  smtp_port: 587,
  is_shared: true,
  sync_enabled: true
};
```

### Accès Multi-Utilisateurs

Les comptes avec `is_shared = true` sont accessibles à tous les utilisateurs autorisés, permettant une gestion collaborative des tickets.

```sql
-- RLS pour comptes partagés
CREATE POLICY "Shared accounts visible to all authenticated"
ON user_email_accounts
FOR SELECT
USING (
  is_shared = true 
  OR user_id = auth.uid()
);
```

---

## Bonnes Pratiques

### Priorités

| Priorité | SLA | Critères |
|----------|-----|----------|
| Critical | 4h | Production down, perte de données |
| High | 8h | Fonctionnalité bloquante |
| Medium | 24h | Bug non bloquant |
| Low | 48h | Question, amélioration |

### Workflow

```
Open → In Progress → Waiting → Resolved → Closed
                        ↓
                   (Attente client)
```

### Liaison Bidirectionnelle

- Ticket → Tâche : `support_tickets.tache_id`
- Tâche → Ticket : Via JOIN ou recherche par établissement

---

*Guide mis à jour le 07/12/2025*
