# 🤖 JARVIS 12.0 - Guide Technique

> **Assistant IA Personnel Autonome, Proactif et Gamifié - "Game Changer Edition"**
>
> Dernière mise à jour : Avril 2026 | Version 12.4 (P6→P10 + MCP)

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Outils disponibles](#outils-disponibles)
4. [Sécurité](#sécurité)
5. [Edge Functions](#edge-functions)
6. [Hooks Frontend](#hooks-frontend)
7. [Composants UI](#composants-ui)
8. [Streaming SSE](#streaming-sse)
9. [Base de données](#base-de-données)
10. [Tests](#tests)
11. [Nouveautés V12.0](#nouveautés-v120)

---

## Vue d'ensemble

JARVIS (Just A Rather Very Intelligent System) est l'assistant IA intégré de OpenPulse. Il permet aux utilisateurs d'interagir naturellement avec l'ensemble des fonctionnalités de la plateforme.

### Caractéristiques principales

| Fonctionnalité | Description |
|----------------|-------------|
| **190+ outils** | Actions CRM, RH, Trésorerie, Emails, Calendrier, Workflows, Catalogue, Rapports custom, Activity Feed, Churn, Forecasting, Signatures, Attribution, MCP, etc. |
| **Streaming temps réel** | Réponses token-by-token avec indicateur de réflexion |
| **RAG intégré** | Recherche sémantique dans la base de connaissances |
| **Sécurité multicouche** | Validation des inputs, 4 niveaux de risque, RBAC |
| **Mode Focus** | Contexte enrichi selon la page active |
| **Interface vocale** | Wake-word "Jarvis", TTS/STT bidirectionnel |
| **Mode autonome** | Auto-approbation des actions à haute confiance |
| **45+ hooks frontend** | Streaming, actions, préférences, voix, gamification, intelligence |
| **Raccourcis clavier** | Cmd/Ctrl+J pour ouvrir, Escape pour fermer |
| **Modal Premium** | Interface centrée 800px, design glassmorphism |
| **Intelligence Hub** | Briefing intelligent, score productivité, challenges |
| **Gamification** | Score, badges, défis hebdomadaires, série (streak) |
| **Email Intelligence** | Scoring priorité, sentiment, détection d'urgence |
| **Calendar Intelligence** | Analyse patterns, suggestions de créneaux |
| **Apprentissage collectif** | Patterns cross-utilisateurs anonymisés |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend React                            │
├─────────────────────────────────────────────────────────────────┤
│  JarvisLogoTrigger → JarvisAssistantPanel → JarvisConversation  │
│         ↓                    ↓                     ↓            │
│  useJarvis        useJarvisStreaming    useJarvisContextualActions
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Edge Functions                               │
├─────────────────────────────────────────────────────────────────┤
│  jarvis-brain-stream (streaming SSE)                            │
│         ↓                                                        │
│  jarvis-brain (orchestration + tool calling)                    │
│         ↓                                                        │
│  Tool Modules (50 fichiers, 190+ outils) + MCP Server bridge    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Azure OpenAI GPT-5                            │
└─────────────────────────────────────────────────────────────────┘
```

### Flux de données

1. **Utilisateur** → Envoie un message via l'interface
2. **useJarvisStreaming** → Appelle `jarvis-brain-stream`
3. **jarvis-brain-stream** → Streaming SSE vers Azure GPT-5
4. **GPT-5** → Génère réponse + appels d'outils (function calling)
5. **tools-executor** → Exécute les outils Supabase
6. **Frontend** → Affiche la réponse en temps réel

---

## Outils disponibles

### Vue d'ensemble des modules

| Module | Outils | Description |
|--------|--------|-------------|
| `crm-tools.ts` | 12 | Établissements, contacts, groupes, partenaires |
| `email-tools.ts` | 8 | Envoi, recherche, brouillons, threading |
| `calendar-tools.ts` | 7 | Événements, rappels, synchronisation externe |
| `task-tools.ts` | 6 | Création, assignation, complétion |
| `document-tools.ts` | 6 | Upload, analyse IA, résumé |
| `rh-tools.ts` | 5 | Collaborateurs, absences, salaires |
| `recruitment-tools.ts` | 5 | Candidats, parsing CV, offres |
| `treasury-tools.ts` | 5 | Revenus, dépenses, prévisions |
| `invoice-tools.ts` | 5 | Factures, devis, avoirs |
| `knowledge-base-tools.ts` | 4 | Recherche sémantique, articles |
| `reporting-tools.ts` | 4 | Rapports, exports, dashboards |
| `analytics-tools.ts` | 4 | Tendances, anomalies, corrélations |
| `automation-tools.ts` | 3 | Règles, tâches planifiées |
| `file-tools.ts` | 5 | Lister, déplacer, copier, supprimer |
| `utility-tools.ts` | 4 | Météo, calculs, conversions |
| `support-tools.ts` | 3 | Tickets, résolution |
| `booking-tools.ts` | 3 | Rendez-vous publics |
| `notification-tools.ts` | 2 | Push, alertes |
| `web-search-tools.ts` | 2 | Recherche web, extraction |
| `rd-tools.ts` | 3 | Sprints, user stories |
| `contract-tools.ts` | 2 | Contrats, signatures |
| `formation-tools.ts` | 2 | Sessions, certifications |
| **`automation-builder-tools.ts`** *(P6)* | 5 | `list_workflows_v2`, `get_workflow_runs`, `create_workflow_from_prompt`, `toggle_workflow`, `run_workflow_now` |
| **`catalogue-tools.ts`** *(P7)* | 3 | `list_catalogue_produits`, `get_catalogue_stats`, `manage_catalogue_produit` |
| **`custom-reports-tools.ts`** *(P8)* | 3 | `list_custom_reports`, `run_custom_report` (RPC `get_report_data`, 16 sources), `export_custom_report` |
| **`activity-feed-tools.ts`** *(P8)* | 2 | `get_activity_feed`, `pin_activity_event` |
| **`churn-tools.ts`** *(P9)* | 3 | `get_churn_risk_accounts`, `recompute_churn_risk`, `get_churn_account_detail` |
| **`forecasting-tools.ts`** *(P9)* | 2 | `get_sales_forecast`, `compare_forecast_vs_actual` |
| **`signature-tools.ts`** *(P10)* | 3 | `list_signature_requests`, `remind_signature`, `cancel_signature` |
| **`attribution-tools.ts`** *(P10)* | 1 | `get_attribution_analysis` (modèles time_decay/first_touch/last_touch/linear) |

> **Vocal (Realtime)** : 12 outils des phases P6→P10 sont exposés en mode voix dans `src/lib/jarvis-tools-definitions.ts` (notamment `get_churn_risk_accounts`, `get_sales_forecast`, `get_activity_feed`, `list_workflows_v2`, `list_catalogue_produits`, `run_custom_report`, `get_workflow_runs`, `get_churn_account_detail`, `compare_forecast_vs_actual`, `get_attribution_analysis`). Les actions sensibles (`create_workflow_from_prompt`, `run_workflow_now`, `cancel_signature`, `manage_catalogue_produit`, `recompute_churn_risk`) déclenchent une confirmation vocale via `SENSITIVE_VOICE_ACTIONS`.
>
> **MCP (Claude Desktop)** : les 22 outils P6→P10 sont enregistrés dans `supabase/functions/mcp-server/index.ts` (registre `STATIC_TOOLS`). Le routing `tools/call` est générique et délègue à `jarvis-brain` via `__MCP_TOOL_CALL__`.

### Exemples d'utilisation

```typescript
// Rechercher un établissement
{
  "name": "search_etablissement",
  "arguments": { "query": "CHU Lyon" }
}

// Créer une tâche
{
  "name": "create_task",
  "arguments": {
    "title": "Appeler Dr. Martin",
    "etablissement_id": "uuid",
    "due_date": "2026-02-05"
  }
}

// Envoyer un email
{
  "name": "send_email",
  "arguments": {
    "to": "contact@chu-nord.example.org",
    "subject": "Suivi déploiement",
    "body": "Bonjour..."
  }
}
```

---

## Sécurité

### Niveaux de risque

| Niveau | Description | Exemples |
|--------|-------------|----------|
| **safe** | Lecture seule | `query_database`, `search_knowledge_base` |
| **moderate** | Création/modification | `create_task`, `update_contact` |
| **sensitive** | Données sensibles | `send_email`, `delete_file` |
| **critical** | Admin uniquement | `delete_etablissement`, `manage_users` |

### Validation des inputs

```typescript
// Schéma de validation (security-validator.ts)
validateInput({
  type: 'email',
  value: userEmail,
  required: true
});

validateInput({
  type: 'uuid',
  value: etablissementId,
  required: true
});

// Protection SQL injection et XSS
sanitizeInput(userInput);
```

### RBAC (Role-Based Access Control)

```typescript
// Vérification avant exécution
validateToolSecurity(toolName, userRole, riskLevel);

// Rôles supportés
type AppRole = 'admin' | 'manager' | 'chef_projet' | 'csm' | 'commercial' | 'rh' | 'user';
```

---

## Edge Functions

### jarvis-brain-stream

Point d'entrée principal avec streaming SSE.

```typescript
// Endpoint
POST /functions/v1/jarvis-brain-stream

// Headers
Authorization: Bearer <user_token>
Content-Type: application/json

// Body
{
  "messages": [
    { "role": "user", "content": "Crée une tâche pour appeler le CHU Lyon" }
  ],
  "context": {
    "currentRoute": "/etablissements/uuid",
    "etablissementId": "uuid"
  }
}

// Response: text/event-stream
data: {"type":"content","delta":"Je vais"}
data: {"type":"content","delta":" créer une tâche..."}
data: {"type":"tool_call","name":"create_task","arguments":{...}}
data: {"type":"tool_result","result":{...}}
data: [DONE]
```

### Paramètres GPT-5

```typescript
{
  model: "gpt-5",
  messages: [...],
  tools: toolDefinitions,
  tool_choice: "auto",
  stream: true,
  // Paramètres GPT-5 (PREMIER NIVEAU, pas imbriqués)
  max_completion_tokens: 3000,
  reasoning_effort: "medium",  // minimal | low | medium | high
  verbosity: "medium"          // low | medium | high
}
```

### Gestion des erreurs

| Code | Erreur | Action |
|------|--------|--------|
| 429 | Rate limit | Retry automatique après 1s |
| 401 | Non authentifié | Redirection login |
| 500 | Erreur serveur | Message utilisateur |

---

## Hooks Frontend (12 hooks)

### useJarvis

Hook principal pour l'état global de Jarvis.

```typescript
const {
  isEnabled,      // Jarvis activé pour l'utilisateur
  pendingCount,   // Nombre de suggestions en attente
  settings,       // Préférences utilisateur
  updateSettings  // Mise à jour des préférences
} = useJarvis();
```

### useJarvisStreaming

Gestion du streaming SSE temps réel.

```typescript
const {
  isStreaming,     // En cours de génération
  currentContent,  // Contenu en cours (token par token)
  isDone,          // Streaming terminé
  error,           // Erreur éventuelle
  streamChat,      // Envoyer un message et streamer
  cancelStream,    // Annuler le streaming en cours
  resetStream      // Réinitialiser l'état
} = useJarvisStreaming();

// Exemple d'utilisation
const response = await streamChat('Crée une tâche', conversationHistory);
```

### useJarvisContextualActions

Actions contextuelles selon la route active (Mode Focus).

### useJarvisGamification (V12.0)

Système de gamification et progression.

```typescript
const {
  score,           // Score de productivité actuel
  badges,          // Badges débloqués
  level,           // Niveau utilisateur
  addScore,        // Ajouter des points
  challenges,      // Défis en cours
  streakDays,      // Série de jours actifs
  timeSaved        // Temps gagné en minutes
} = useJarvisGamification(userId);
```

### useJarvisEmailIntelligence (V12.0)

Intelligence email avancée.

```typescript
const {
  priorityEmails,    // Emails haute priorité
  sentimentAlerts,   // Alertes sentiment négatif
  suggestedReplies,  // Réponses suggérées
  analyzeThread      // Analyser un thread
} = useJarvisEmailIntelligence();
```

### useJarvisCalendarIntelligence (V12.0)

Intelligence calendrier.

```typescript
const {
  optimalSlots,      // Créneaux optimaux
  conflictAlerts,    // Alertes de conflits
  meetingPrep,       // Préparation réunion
  patterns           // Patterns détectés
} = useJarvisCalendarIntelligence();
```

### useJarvisCollectiveLearning (V12.0)

Apprentissage cross-utilisateur.

```typescript
const {
  insights,          // Insights collectifs
  bestPractices,     // Meilleures pratiques
  adoptionRate,      // Taux d'adoption
  contribute         // Contribuer un pattern
} = useJarvisCollectiveLearning();
```

Actions contextuelles selon la route active (Mode Focus).

```typescript
const {
  quickActions,   // Actions suggérées pour la page
  executeAction   // Exécuter une action
} = useJarvisContextualActions();

// Exemple d'action suggérée
{
  id: 'create-task',
  label: 'Créer une tâche',
  icon: '✅',
  prompt: 'Crée une tâche de suivi pour cet établissement'
}
```

### useJarvisKeyboardShortcuts

Raccourcis clavier globaux.

```typescript
useJarvisKeyboardShortcuts({
  isOpen,
  onToggle: () => setIsOpen(prev => !prev),
  onClose: () => setIsOpen(false),
  enabled: isEnabled
});

// Raccourcis
// Cmd/Ctrl + J : Ouvrir/fermer Jarvis
// Escape : Fermer Jarvis
```

### useJarvisPendingActions

Gestion des actions en attente de validation.

```typescript
const {
  pendingActions,  // Liste des actions en attente
  pendingCount,    // Nombre d'actions
  approveAction,   // Approuver une action
  rejectAction,    // Rejeter une action
  modifyAndApprove,// Modifier puis approuver
  submitFeedback,  // Soumettre un feedback
  isApproving,     // État de chargement
  isRejecting,
  isModifying
} = useJarvisPendingActions(userId);
```

### useJarvisPreferences

Préférences utilisateur Jarvis.

```typescript
const {
  preferences,      // Configuration actuelle
  updatePreferences,// Mettre à jour
  toggleEnabled,    // Activer/désactiver Jarvis
  toggleVoice,      // Activer/désactiver voix
  toggleProactiveMode, // Mode proactif
  isEnabled,
  isVoiceEnabled,
  isProactiveMode
} = useJarvisPreferences(userId);
```

### useJarvisVoice

Interface vocale bidirectionnelle (TTS + STT).

```typescript
const {
  isListening,    // Écoute active
  isSpeaking,     // Synthèse en cours
  startListening, // Démarrer reconnaissance vocale
  stopListening,  // Arrêter
  speak,          // Synthèse vocale (TTS)
  stopSpeaking,   // Arrêter la synthèse
  transcript,     // Texte reconnu
  error
} = useJarvisVoice({
  wakeWord: 'Jarvis',
  onWakeWord: () => {},
  onTranscript: (text) => {}
});
```

### useJarvisConversationPersistence

Persistance des conversations.

```typescript
const {
  conversations,        // Liste des conversations
  currentConversationId,// Conversation active
  loadConversation,     // Charger une conversation
  saveMessages,         // Sauvegarder les messages
  createConversation,   // Nouvelle conversation
  deleteConversation,   // Supprimer
  setCurrentConversation
} = useJarvisConversationPersistence();
```

### useJarvisLearning

Apprentissage adaptatif basé sur le feedback.

```typescript
const {
  approvalRate,      // Taux d'approbation (%)
  suggestedThreshold,// Seuil suggéré auto-approbation
  learningData,      // Données d'apprentissage
  recordFeedback     // Enregistrer un feedback
} = useJarvisLearning(userId);
```

### useJarvisProactive

Suggestions proactives temps réel.

```typescript
const {
  suggestions,      // Suggestions actives
  dismissSuggestion,// Ignorer une suggestion
  activeSuggestion, // Suggestion prioritaire
  isEnabled
} = useJarvisProactive({
  triggers: ['new_email', 'task_due', 'support_ticket']
});
```

### useJarvisFocus

Mode Focus contextuel selon la route.

```typescript
const {
  focusContext,   // Contexte actuel (établissement, email, etc.)
  focusPrompt,    // Prompt enrichi
  isFocused       // Mode focus actif
} = useJarvisFocus();
```

### useJarvisWorkflows

Workflows automatisés.

```typescript
const {
  workflows,       // Liste des workflows
  activeWorkflows, // En cours d'exécution
  createWorkflow,  // Créer un workflow
  executeWorkflow, // Exécuter
  pauseWorkflow    // Mettre en pause
} = useJarvisWorkflows(userId);
```

---

## Composants UI

### Arborescence

```
src/components/jarvis/
├── index.ts                    # Exports
├── JarvisAssistantPanel.tsx    # Panneau principal
├── JarvisConversation.tsx      # Affichage des messages
├── JarvisLogoTrigger.tsx       # Logo cliquable (trigger)
├── JarvisTriggerButton.tsx     # Bouton alternatif
├── JarvisActionCard.tsx        # Carte d'action suggérée
├── JarvisSourceBadge.tsx       # Badge source RAG
├── JarvisThinkingIndicator.tsx # Indicateur de réflexion
├── JarvisVoiceInterface.tsx    # Interface vocale
├── JarvisSettingsSheet.tsx     # Paramètres utilisateur
├── JarvisHistorySheet.tsx      # Historique des conversations
├── JarvisModifyDialog.tsx      # Dialogue de modification
├── JarvisTemplates.tsx         # Templates de prompts
├── JarvisAnalyticsDashboard.tsx# Dashboard analytics
├── JarvisFocusIndicator.tsx    # Indicateur mode focus
└── JarvisProactiveSuggestions.tsx # Suggestions proactives
```

### JarvisLogoTrigger

Logo OpenPulse cliquable dans la sidebar.

```tsx
<JarvisLogoTrigger 
  collapsed={sidebarCollapsed} // Adapte la taille
  className="custom-class"
/>

// Fonctionnalités
// - Animation pulse si suggestions en attente
// - Badge compteur de suggestions
// - Glow effect au survol
// - Responsive (collapsed: h-8 w-8, expanded: h-9 w-9)
```

### JarvisConversation

Affichage des messages avec Markdown.

```tsx
<JarvisConversation
  messages={messages}
  isStreaming={isStreaming}
  onRetry={handleRetry}
  onCopy={handleCopy}
/>

// Fonctionnalités
// - Rendu Markdown (react-markdown + remark-gfm)
// - Coloration syntaxique des blocs de code
// - Actions par message (copier, régénérer)
// - Indicateur de frappe
```

---

## Streaming SSE

### Pattern frontend

```typescript
async function streamChat(messages: Message[], onDelta: (text: string) => void) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/jarvis-brain-stream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages })
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parser ligne par ligne
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content') {
          onDelta(parsed.delta);
        }
      } catch { /* JSON incomplet */ }
    }
  }
}
```

### Pattern backend (AbortController)

```typescript
// Timeout de 90 secondes
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 90000);

try {
  const response = await fetch(AZURE_ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': AZURE_API_KEY },
    body: JSON.stringify({ messages, stream: true }),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  // Retry sur 429
  if (response.status === 429) {
    await new Promise(r => setTimeout(r, 1000));
    // Retry...
  }
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new Error('Timeout après 90s');
  }
  throw error;
}
```

---

## Base de données

### Tables principales

```sql
-- Conversations Jarvis
CREATE TABLE jarvis_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE jarvis_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES jarvis_conversations NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Paramètres utilisateur
CREATE TABLE jarvis_user_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles,
  is_enabled BOOLEAN DEFAULT true,
  voice_enabled BOOLEAN DEFAULT false,
  auto_suggestions BOOLEAN DEFAULT true,
  preferred_language TEXT DEFAULT 'fr',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics
CREATE TABLE jarvis_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles,
  tool_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies

```sql
-- Conversations : lecture/écriture par propriétaire
CREATE POLICY "Users can manage own conversations"
ON jarvis_conversations FOR ALL
USING (auth.uid() = user_id);

-- Messages : accès via conversation
CREATE POLICY "Users can manage messages in own conversations"
ON jarvis_messages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM jarvis_conversations
    WHERE id = conversation_id AND user_id = auth.uid()
  )
);
```

---

## Tests

### Tests unitaires (Deno)

```typescript
// supabase/functions/jarvis-brain/jarvis-tools_test.ts

Deno.test("Security Validator - Safe tools don't require confirmation", () => {
  const safeTools = ['query_database', 'search_knowledge_base', 'get_weather'];
  for (const tool of safeTools) {
    assertEquals(getRiskLevel(tool), 'safe');
  }
});

Deno.test("Input Validation - Email format", () => {
  assertThrows(() => validateInput({ type: 'email', value: 'invalid' }));
  validateInput({ type: 'email', value: 'test@example.com' }); // OK
});

Deno.test("Tool Registry - No duplicates", () => {
  const names = Object.keys(toolRegistry);
  assertEquals(names.length, new Set(names).size);
});
```

### Tests frontend (Vitest)

```typescript
// src/hooks/__tests__/useJarvis.test.tsx

describe('useJarvis', () => {
  it('should return enabled state', () => {
    const { result } = renderHook(() => useJarvis());
    expect(result.current.isEnabled).toBeDefined();
  });

  it('should update settings', async () => {
    const { result } = renderHook(() => useJarvis());
    await act(async () => {
      await result.current.updateSettings({ voice_enabled: true });
    });
    expect(result.current.settings.voice_enabled).toBe(true);
  });
});
```

---

## Métriques

| Métrique | Valeur |
|----------|--------|
| **Total outils** | 190+ |
| **Modules d'outils** | 50 fichiers |
| **Outils vocaux (Realtime)** | 32+ |
| **Outils MCP (Claude Desktop)** | 100+ (registre statique + bridge dynamique) |
| **Hooks frontend** | 45+ hooks |
| **Composants UI** | 50+ composants |
| **Edge Functions** | 30+ (jarvis-*) + `mcp-server` |
| **Tests unitaires** | `p6-p10-tools_test.ts` + `jarvisToolsDefinitions.test.ts` (8/8) |
| **Coverage sécurité** | 100% des outils (sensitivity + rolePermissions) |

---

## Nouveautés V12.0

### Phases 1-7 : Implémentées ✅

| Phase | Fonctionnalité | Statut |
|-------|----------------|--------|
| 1 | Intelligence Conversationnelle Avancée | ✅ |
| 2 | Proactivité Intelligente (Smart Briefing) | ✅ |
| 3 | Exécution Autonome Avancée | ✅ |
| 4 | Interface Immersive (PiP, Voice) | ✅ |
| 5 | Intelligence Collective | ✅ |
| 6 | Intégrations (Email, Calendar Intelligence) | ✅ |
| 7 | Gamification (Score, Badges, Challenges) | ✅ |

### Nouveaux Composants V12.0

- `JarvisSmartBriefing.tsx` - Briefing intelligent personnalisé
- `JarvisProductivityScore.tsx` - Score de productivité et stats
- `JarvisChallenges.tsx` - Défis hebdomadaires gamifiés
- `JarvisCollectiveInsights.tsx` - Insights cross-utilisateurs
- `JarvisBadges.tsx` - Système de badges
- `JarvisUnifiedPanel.tsx` - Panel unifié avec onglet Intelligence

### Nouvelles Edge Functions V12.0

- `jarvis-intelligent-briefing` - Briefing personnalisé
- `jarvis-anomaly-detector` - Détection d'anomalies
- `jarvis-collective-learning` - Apprentissage collectif
- `jarvis-gamification` - Scores et badges
- `jarvis-email-intelligence` - Intelligence email
- `jarvis-calendar-intelligence` - Intelligence calendrier

---

## Roadmap Future

- [ ] Support vocal streaming (Azure Speech realtime)
- [ ] Mode hors-ligne avec IndexedDB
- [ ] Tests E2E Playwright complets
- [ ] Multi-langue (EN, ES, DE)
- [ ] Intégration visioconférence

---

*Documentation JARVIS 12.0 "Game Changer Edition" - OpenPulse - Février 2026*
