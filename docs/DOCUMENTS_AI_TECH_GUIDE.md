# Assistant IA Documents — Guide technique & déploiement

> Module : GED / Éditeur de documents · Edge function : `document-ai-assist`
> Backend IA : Azure OpenAI (GPT-5) — **aucun secret côté frontend**.

## 1. Vue d'ensemble

Le panneau « Assistant IA » de l'éditeur de documents offre quatre actions :

| Action            | Description                                                        | Sortie                       |
| ----------------- | ------------------------------------------------------------------ | ---------------------------- |
| `summarize`       | Résumé structuré (3–8 phrases) du document                         | Texte brut (`result`)        |
| `rewrite`         | Reformulation selon un ton (`formal` \| `concise` \| `simplified`) | Texte brut (`result`)        |
| `classify`        | Classification DPO (RGPD) + criticité RSSI                         | JSON typé (`classification`) |
| `extract_actions` | Extraction des actions/tâches avec responsable et échéance         | JSON typé (`actions[]`)      |

### Chaîne d'appel

```
DocumentAiPanel.tsx (UI, aside repliable)
  → src/services/documents/documentAiAssist.ts   (client typé, mode dégradé)
    → supabase.functions.invoke('document-ai-assist')   (JWT utilisateur)
      → supabase/functions/document-ai-assist/index.ts  (edge function Deno)
        → Azure OpenAI (secrets exclusivement côté serveur)
```

## 2. États `configured` / `unconfigured`

La fonctionnalité est **dégradable par conception** : l'UI reste utilisable sur
un déploiement sans backend IA.

| Situation                                         | Réponse serveur                                              | Comportement client         |
| ------------------------------------------------- | ------------------------------------------------------------ | --------------------------- |
| Secrets Azure présents                            | `200 { status: "ok", configured: true, … }`                  | Résultat affiché            |
| Secrets Azure absents                             | `200 { status: "unconfigured", configured: false, message }` | Bandeau « non configuré »   |
| Edge function non déployée (404)                  | erreur invoke 404                                            | Traité comme `unconfigured` |
| Backend injoignable (`Failed to send a request…`) | erreur réseau                                                | Traité comme `unconfigured` |
| Erreur serveur réelle (500, erreur métier)        | erreur / `{ error }`                                         | `status: 'error'` + toast   |

Points clés :

- Le serveur répond **200** (et non 5xx) quand Azure n'est pas configuré, pour
  distinguer « pas configuré » (état produit) d'« en panne » (erreur).
- Le client (`callDocumentAiAssist`) **ne lève jamais** pour un backend
  absent : il normalise en `{ status: 'unconfigured' }` (`isBackendMissingError`).
- Le flag `VITE_DOCUMENTS_AI_PANEL` (défaut : `on`) permet de masquer
  entièrement le point d'entrée UI (`src/config/documentsAi.ts`). Ce n'est
  **pas** un secret, uniquement un interrupteur d'affichage.

## 3. Sécurité

- **JWT obligatoire** : `verify_jwt = true` dans `supabase/config.toml` +
  `validateUserAuth(req)` dans le handler _avant_ toute lecture du body et
  tout appel Azure. Pas d'usage anonyme possible d'Azure OpenAI.
- **Aucun secret front** : `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_API_KEY`
  sont lus via `Deno.env.get()` uniquement dans l'edge function. Aucune
  variable `VITE_*` ne contient de clé.
- **Anti prompt-injection** :
  - `sanitizeForAI(content, { maxLength: 24000 })` — nettoyage + troncature ;
  - `detectPromptInjection(content)` + `logSecurityEvent` (journalisation des
    tentatives, la requête n'est pas bloquée mais tracée) ;
  - `wrapUserContent(…, "DOCUMENT_CONTENT")` — le contenu utilisateur est
    encadré de balises XML et le prompt système impose d'**ignorer toute
    instruction** contenue dans ces balises.
- **Validation d'entrée** : action whitelistée
  (`summarize|rewrite|classify|extract_actions`), contenu requis → 400 sinon.
- **Erreurs sanitisées** : `buildErrorResponse('document-ai-assist', …)` — pas
  de stack trace ni de détail interne renvoyé au client.
- **CORS** : `getCorsHeaders(origin)` (liste d'origines autorisées partagée).

## 4. Contrat d'API

```typescript
POST /functions/v1/document-ai-assist
Authorization: Bearer <jwt-utilisateur>

// Requête
{
  "action": "summarize" | "rewrite" | "classify" | "extract_actions",
  "content": "<p>Contenu HTML ou texte…</p>",   // requis, tronqué à 24 000 caractères
  "documentName": "CR réunion",                 // optionnel
  "tone": "formal" | "concise" | "simplified"   // optionnel, rewrite uniquement (défaut: formal)
}

// Réponses
// summarize / rewrite
{ "status": "ok", "configured": true, "action": "summarize", "result": "…", "model": "…" }

// classify
{
  "status": "ok", "configured": true, "action": "classify",
  "classification": {
    "dpo_level": "public" | "interne" | "confidentiel" | "donnees_sante",
    "rssi_level": "faible" | "modere" | "eleve" | "critique",
    "rationale": "…",
    "recommendations": ["…"]
  },
  "model": "…"
}

// extract_actions
{
  "status": "ok", "configured": true, "action": "extract_actions",
  "actions": [{ "action": "…", "owner": "… | null", "due_date": "… | null" }],
  "model": "…"
}

// Backend IA non configuré (HTTP 200)
{ "status": "unconfigured", "configured": false, "message": "…" }
```

Appel Azure (pattern sanctuarisé GPT-5, cf. `docs/ARCHITECTURE_RULES.md`) :
`max_completion_tokens: 4000` au premier niveau, `reasoning_effort`
(`medium` pour `classify`, `low` sinon), timeout 90 s, retry unique sur 429.

## 5. Déploiement & secrets

### 5.1 Supabase Edge Functions (déploiement standard)

Les secrets sont stockés **uniquement** dans Supabase (jamais dans le repo,
jamais dans un `.env` front) :

```bash
# 1. Configurer les secrets (une fois par projet)
supabase secrets set \
  AZURE_OPENAI_ENDPOINT="https://VOTRE_INSTANCE.openai.azure.com/openai/deployments/gpt-5/chat/completions?api-version=2025-01-01-preview" \
  AZURE_OPENAI_API_KEY="<clé-azure>" \
  --project-ref <project-ref>

# 2. Déployer la fonction
supabase functions deploy document-ai-assist --project-ref <project-ref>

# 3. Vérifier
supabase secrets list --project-ref <project-ref>   # les 2 clés doivent apparaître
```

⚠️ `AZURE_OPENAI_ENDPOINT` doit être l'**URL complète** du déploiement chat
completions (avec `deployments/<nom>` et `api-version`), pas seulement le
domaine de la ressource.

### 5.2 Auto-hébergé / OVH / on-premise

Renseigner les mêmes variables dans l'environnement du runtime Edge
(cf. `docs/OVH_DEPLOYMENT.md` §variables, `docs/QUICK_START_ON_PREMISE.md`) :

```env
AZURE_OPENAI_ENDPOINT=https://votre-instance.openai.azure.com/openai/deployments/gpt-5/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=***
```

### 5.3 Frontend (optionnel)

```env
# .env / variables de build — PAS un secret
VITE_DOCUMENTS_AI_PANEL=on   # 'off' pour masquer le panneau IA documents
```

### 5.4 Checklist de mise en service

- [ ] `AZURE_OPENAI_ENDPOINT` défini dans Supabase secrets (URL complète)
- [ ] `AZURE_OPENAI_API_KEY` défini dans Supabase secrets
- [ ] `supabase functions deploy document-ai-assist` exécuté
- [ ] `verify_jwt = true` présent pour `[functions.document-ai-assist]` dans `supabase/config.toml`
- [ ] Test manuel : bouton « Résumer » sur un document → résultat (ou bandeau
      « non configuré » si secrets absents, mais jamais d'erreur brute)
- [ ] Aucun secret Azure dans le bundle front (`grep -r AZURE_OPENAI dist/` vide)

### 5.5 Rotation de la clé Azure

```bash
supabase secrets set AZURE_OPENAI_API_KEY="<nouvelle-clé>" --project-ref <project-ref>
# Les edge functions relisent l'environnement à la prochaine invocation (cold start).
# Pas de redéploiement nécessaire, mais on peut forcer :
supabase functions deploy document-ai-assist --project-ref <project-ref>
```

## 6. Tests

| Suite                          | Fichier                                                | Commande                                                                                           |
| ------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Edge function (Deno, 18 tests) | `supabase/functions/document-ai-assist/index.test.ts`  | `deno test --allow-net --allow-env --allow-read --no-check supabase/functions/document-ai-assist/` |
| Client typé (Vitest, 13 tests) | `src/services/documents/documentAiAssist.test.ts`      | `npx vitest run src/services/documents/documentAiAssist.test.ts`                                   |
| Panneau UI (Vitest, 11 tests)  | `src/components/documents/ai/DocumentAiPanel.test.tsx` | `npx vitest run src/components/documents/ai/DocumentAiPanel.test.tsx`                              |

Les tests edge suivent la convention repo (cf. `contract-ai-assist`) :
invariants de source (ordre auth → body → Azure, garde `unconfigured` avant
l'appel Azure, absence de secret en dur) + tests fonctionnels des helpers
exportés (`buildUserPrompt`, `parseJsonResult`) avec `Deno.listen`/`fetch`
mockés — aucun port ouvert, aucun appel réseau réel.

## 7. Dépannage

| Symptôme                                                     | Cause probable                                                      | Correctif                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Bandeau « non configuré » alors que les secrets sont définis | Secrets définis après le dernier cold start, ou mauvais project-ref | Redéployer la fonction ; vérifier `supabase secrets list`                       |
| `Erreur Azure: 401`                                          | Clé API invalide/expirée                                            | Régénérer la clé dans le portail Azure, `supabase secrets set`                  |
| `Erreur Azure: 404`                                          | `AZURE_OPENAI_ENDPOINT` incomplet (domaine seul)                    | Utiliser l'URL complète du déploiement chat completions                         |
| `Timeout Azure (90s)`                                        | Document trop long / instance saturée                               | Réduire le contenu ; vérifier la capacité du déploiement Azure                  |
| `Classification IA invalide`                                 | Le modèle n'a pas répondu en JSON                                   | Réessayer ; vérifier que le déploiement cible bien GPT-5 (suivi du format JSON) |
