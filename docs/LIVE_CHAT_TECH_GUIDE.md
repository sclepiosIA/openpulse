# Guide Technique - Module Live Chat

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

## Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Composants](#composants)
- [Widget Embeddable](#widget-embeddable)
- [Tables de Base de Données](#tables-de-base-de-données)
- [Edge Functions](#edge-functions)
- [Réponses IA](#réponses-ia)

---

## Vue d'ensemble

Le module Live Chat permet la communication en temps réel avec les visiteurs :

| Fonctionnalité | Description |
|----------------|-------------|
| **Widget embeddable** | Script à intégrer sur sites externes |
| **Sessions en temps réel** | WebSocket via Supabase Realtime |
| **Réponses IA** | Suggestions automatiques GPT-5 |
| **Transfert agent** | Escalade vers opérateur humain |
| **Historique** | Conservation des conversations |
| **Notifications** | Alertes nouvelles conversations |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LIVE CHAT MODULE                         │
├─────────────────────────────────────────────────────────────┤
│  Routes: /live-chat (dashboard opérateur)                    │
│  Widget: Intégré via composants React                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────┐       ┌───────────────────────────┐  │
│  │   Site Client     │       │    Dashboard Opérateur    │  │
│  │  ┌─────────────┐  │       │  ┌─────────────────────┐  │  │
│  │  │   Widget    │  │◄─────►│  │  Liste Sessions     │  │  │
│  │  │   Chat      │  │  WS   │  │  Conversation View  │  │  │
│  │  └─────────────┘  │       │  │  Réponses Suggérées │  │  │
│  └───────────────────┘       │  └─────────────────────┘  │  │
│                              └───────────────────────────┘  │
│                                       │                      │
│                                       ▼                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Supabase Realtime                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│         ┌────────────────────┼────────────────────┐         │
│         ▼                    ▼                    ▼         │
│  ┌───────────┐      ┌───────────────┐     ┌───────────┐    │
│  │ Sessions  │      │   Messages    │     │   IA      │    │
│  │  (DB)     │      │    (DB)       │     │ (GPT-5)   │    │
│  └───────────┘      └───────────────┘     └───────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Composants

### Dashboard Opérateur (`src/components/live-chat/`)

| Composant | Description |
|-----------|-------------|
| `LiveChatDashboard.tsx` | Interface principale opérateur |
| `SessionsList.tsx` | Liste des sessions actives |
| `SessionItem.tsx` | Résumé d'une session |
| `ConversationPanel.tsx` | Zone de conversation |
| `MessageBubble.tsx` | Bulle de message |
| `OperatorInput.tsx` | Zone de saisie opérateur |
| `AISuggestions.tsx` | Suggestions de réponse IA |
| `VisitorInfo.tsx` | Informations visiteur |
| `TransferDialog.tsx` | Transfert à un autre agent |

### Widget (`src/components/live-chat/widget/`)

| Composant | Description |
|-----------|-------------|
| `ChatWidget.tsx` | Widget complet (standalone) |
| `WidgetButton.tsx` | Bouton d'ouverture |
| `WidgetWindow.tsx` | Fenêtre de chat |
| `WidgetMessage.tsx` | Message dans widget |
| `WidgetInput.tsx` | Input visiteur |

---

## Widget Embeddable

### Intégration Client

Le widget est intégré via les composants React. Pour l'intégrer sur un site externe, utilisez le code suivant:

```html
<!-- Ajouter avant </body> -->
<script>
  (function(w, d, s, o, f, js, fjs) {
    w['MarqueChat'] = o;
    w[o] = w[o] || function() { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s); fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1;
    fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'marque', 'https://gestion.exploitant.example.org/assets/chat-widget.js'));
  
  marque('init', {
    apiKey: 'pk_live_xxxx',
    position: 'bottom-right',
    primaryColor: '#3B82F6',
    greeting: 'Bonjour ! Comment puis-je vous aider ?'
  });
</script>
```

### Configuration Options

```typescript
interface WidgetConfig {
  apiKey: string;           // Clé API publique
  position: 'bottom-right' | 'bottom-left';
  primaryColor: string;     // Couleur principale
  greeting: string;         // Message d'accueil
  placeholder: string;      // Placeholder input
  language: 'fr' | 'en';
  autoOpen: boolean;        // Ouvrir automatiquement
  autoOpenDelay: number;    // Délai avant auto-open (ms)
  requireEmail: boolean;    // Demander email avant chat
}
```

### API JavaScript

```javascript
// Ouvrir le widget
marque('open');

// Fermer le widget
marque('close');

// Envoyer un message programmatiquement
marque('sendMessage', 'Bonjour !');

// Identifier le visiteur
marque('identify', {
  email: 'user@example.com',
  name: 'Jean Dupont',
  company: 'ACME Corp'
});

// Écouter les événements
marque('on', 'message:received', (message) => {
  console.log('Nouveau message:', message);
});

marque('on', 'session:started', (session) => {
  console.log('Session démarrée:', session.id);
});
```

---

## Tables de Base de Données

### `live_chat_sessions`

```sql
CREATE TABLE live_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Visiteur
  visitor_id TEXT NOT NULL, -- ID anonyme généré côté client
  visitor_email TEXT,
  visitor_name TEXT,
  visitor_company TEXT,
  
  -- Tracking
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  country TEXT,
  city TEXT,
  
  -- Opérateur assigné
  operator_id UUID REFERENCES profiles,
  
  -- Statut
  status TEXT DEFAULT 'waiting', -- waiting, active, closed, transferred
  
  -- Dates
  started_at TIMESTAMPTZ DEFAULT now(),
  first_response_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Métriques
  message_count INTEGER DEFAULT 0,
  response_time_seconds INTEGER,
  
  -- Satisfaction
  rating INTEGER, -- 1-5
  feedback TEXT,
  
  -- Liaison CRM (optionnel)
  etablissement_id UUID REFERENCES etablissements,
  contact_id UUID REFERENCES contacts,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `live_chat_messages`

```sql
CREATE TABLE live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES live_chat_sessions NOT NULL,
  
  -- Expéditeur
  sender_type TEXT NOT NULL, -- visitor, operator, system, ai
  sender_id TEXT, -- visitor_id ou operator uuid
  
  -- Contenu
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text', -- text, image, file, typing
  
  -- Métadonnées
  metadata JSONB, -- pour fichiers: {filename, size, url}
  
  -- IA
  is_ai_generated BOOLEAN DEFAULT false,
  ai_confidence NUMERIC,
  
  -- Lecture
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Edge Functions

### `live-chat-init`

Initialise une session de chat.

```typescript
POST /functions/v1/live-chat-init
{
  "apiKey": "pk_live_xxxx",
  "visitorId": "visitor_abc123",
  "pageUrl": "https://client-site.com/pricing",
  "userAgent": "Mozilla/5.0..."
}

// Response
{
  "success": true,
  "sessionId": "uuid",
  "greeting": "Bonjour ! Comment puis-je vous aider ?"
}
```

### `live-chat-message`

Envoie un message.

```typescript
POST /functions/v1/live-chat-message
{
  "sessionId": "uuid",
  "senderType": "visitor",
  "content": "Je voudrais des informations sur vos tarifs"
}

// Response
{
  "success": true,
  "messageId": "uuid",
  "aiSuggestion": {
    "content": "Nos tarifs dépendent de la taille de votre établissement...",
    "confidence": 0.87
  }
}
```

### `live-chat-ai-respond`

Génère une réponse IA (mode automatique ou suggestion).

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
    {
      "content": "Je vous envoie notre grille tarifaire par email.",
      "confidence": 0.92
    },
    {
      "content": "Souhaitez-vous planifier une démonstration ?",
      "confidence": 0.85
    }
  ]
}
```

---

## Réponses IA

### Configuration GPT-5

```typescript
const LIVE_CHAT_SYSTEM_PROMPT = `
Tu es un assistant commercial pour OpenPulse, une solution de gestion pour établissements de santé.

Contexte de la conversation :
- Page visitée : {pageUrl}
- Messages précédents : {history}

Règles :
- Réponds de manière concise et professionnelle
- Si tu ne peux pas répondre, propose de transférer à un humain
- Ne donne jamais de tarifs précis sans validation
- Propose des démos ou RDV quand approprié
`;

const azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
  body: JSON.stringify({
    messages: [
      { role: "system", content: LIVE_CHAT_SYSTEM_PROMPT },
      ...conversationHistory,
      { role: "user", content: visitorMessage }
    ],
    max_completion_tokens: 500,
    reasoning_effort: "low",
    verbosity: "low"
  }),
});
```

### Mode Automatique vs Suggestions

| Mode | Description | Usage |
|------|-------------|-------|
| `auto` | L'IA répond directement au visiteur | Heures non ouvrées, FAQ simple |
| `suggest` | L'IA suggère, l'opérateur valide | Heures ouvrées, questions complexes |

---

## Temps Réel

### Abonnement Supabase

```typescript
// Dashboard opérateur
useEffect(() => {
  const channel = supabase
    .channel('live-chat-operator')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'live_chat_sessions',
        filter: `status=eq.waiting`
      },
      (payload) => {
        // Nouvelle session en attente
        toast('Nouveau visiteur !');
        refetchSessions();
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'live_chat_messages'
      },
      (payload) => {
        // Nouveau message
        const message = payload.new as LiveChatMessage;
        if (message.sender_type === 'visitor') {
          addMessage(message);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## Métriques

### KPIs Dashboard

| Métrique | Description |
|----------|-------------|
| Sessions actives | Conversations en cours |
| Temps de réponse moyen | Première réponse opérateur |
| Taux de résolution | Sessions résolues vs transférées |
| Satisfaction | Note moyenne 1-5 |
| Sessions / jour | Volume de conversations |

---

*Documentation mise à jour en mars 2026 — v1.9.0*
