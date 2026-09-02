# 🔒 CONFIGURATION SANCTUARISÉE AZURE GPT-5.4

⚠️ **CETTE CONFIGURATION EST LA RÉFÉRENCE OBLIGATOIRE POUR TOUTES LES FONCTIONS GPT-5.4**

⚠️ **NE PAS MODIFIER CETTE CONFIGURATION SANS VALIDER SUR LES FONCTIONS EMAIL**

---

## ✅ Configuration validée (GPT-5.4 - production depuis mars 2026)

### 1. Variables d'environnement

```typescript
const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');
```

**Secrets Supabase requis :**
- `AZURE_OPENAI_ENDPOINT` : URL complète du déploiement GPT-5.4 sur Azure (ex: `https://ia-interne-resource.cognitiveservices.azure.com/openai/deployments/gpt-5.4/chat/completions?api-version=2024-05-01-preview`)
- `AZURE_OPENAI_API_KEY` : Clé API Azure

---

### 2. Structure de l'appel Azure (PATTERN OBLIGATOIRE)

```typescript
// 1. Setup timeout avec AbortController (90s standard)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 90000);

let azureResponse: Response;
try {
  // 2. Fetch direct vers Azure
  azureResponse = await fetch(AZURE_OPENAI_ENDPOINT!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_OPENAI_API_KEY!,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      // ✅ PARAMÈTRES GPT-5 (AU PREMIER NIVEAU, PAS IMBRIQUÉS)
      max_completion_tokens: 3000,  // Ajuster selon besoin
      reasoning_effort: "minimal",   // "minimal" | "low" | "medium" | "high"
      verbosity: "low",              // "low" | "medium" | "high"
      
      // ✅ Optional: response_format pour forcer JSON
      response_format: { type: "json_object" }  // Seulement si besoin de JSON
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  
  // 3. Retry simple sur rate limit (429)
  if (azureResponse.status === 429) {
    console.warn('Azure rate limited, backing off 1s and retrying once...');
    await new Promise(r => setTimeout(r, 1000));
    azureResponse = await fetch(/* même config */);
  }
  
} catch (error: any) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    console.error('Azure request timeout (90s)');
    throw new Error('Azure request timeout (90s)');
  }
  throw error;
}

// 4. Validation de la réponse
if (!azureResponse.ok) {
  const errorText = await azureResponse.text();
  console.error('Azure OpenAI error:', azureResponse.status, errorText);
  throw new Error(`Azure OpenAI API error: ${azureResponse.status}`);
}

// 5. Extraction du contenu (SIMPLE)
const azureData = await azureResponse.json();
const content = azureData.choices?.[0]?.message?.content;

if (!content || typeof content !== 'string') {
  console.error('❌ Unexpected response format:', JSON.stringify(azureData, null, 2));
  throw new Error('No content in Azure response');
}

// 6. Parse JSON si nécessaire
let result;
if (response_format_was_used) {
  result = JSON.parse(content);
} else {
  result = content.trim();
}
```

---

## ⚙️ Paramètres GPT-5.4 détaillés

### `reasoning_effort` (au premier niveau)
- `"minimal"` : Très rapide, peu de raisonnement (~50-100 tokens reasoning)
- `"low"` : Raisonnement léger (~100-300 tokens)
- `"medium"` : Raisonnement équilibré (~300-800 tokens) - **défaut**
- `"high"` : Raisonnement approfondi (~800-2000 tokens)

**Recommandation :**
- Emails simples, corrections : `"minimal"` ou `"low"`
- Analyse complexe, insights : `"medium"` ou `"high"`

### `verbosity` (au premier niveau)
- `"low"` : Réponses concises
- `"medium"` : Réponses équilibrées - **défaut**
- `"high"` : Réponses détaillées

### `max_completion_tokens`
Limite de tokens de sortie (reasoning + output).

**Recommandation :**
- Texte court : 1000-2000
- Texte moyen : 2000-3000
- Analyse complexe : 3000-4000

---

## 📊 Fonctions validées utilisant cette config

✅ **correct-spelling-email** (lines 49-73)
- reasoning_effort: "low"
- verbosity: "low"
- max_completion_tokens: 4000

✅ **process-email-with-ai** (lines 207-239)
- reasoning_effort: "minimal"
- verbosity: "low"
- max_completion_tokens: 3000
- response_format: { type: "json_object" }

✅ **generate-ai-suggestions** (lines 217-243)
- reasoning_effort: "minimal"
- verbosity: "low"
- max_completion_tokens: 2000
- response_format: { type: "json_object" }

✅ **reformulate-email**
- Pattern identique

✅ **suggest-email-content**
- Pattern identique

✅ **translate-email**
- Pattern identique

---

## ❌ CE QU'IL NE FAUT **JAMAIS** FAIRE

### 1. ❌ Paramètres imbriqués (INCORRECT)
```typescript
// ❌ NE PAS FAIRE
{
  reasoning: { effort: "minimal" },  // FAUX
  text: { verbosity: "low" }         // FAUX
}
```

### 2. ❌ Wrapper de fonction complexe
```typescript
// ❌ NE PAS FAIRE
const doAzureCall = async (withResponseFormat = true) => {
  // Logique complexe avec conditions...
  // Parsing complexe...
}
```

**Pourquoi ?**
- Rend le code difficile à maintenir
- Multiplie les points de défaillance
- Rend le débogage difficile

### 3. ❌ Parsing JSON avec multiples fallbacks
```typescript
// ❌ NE PAS FAIRE (trop complexe)
if (firstChoice?.message?.content) {
  contentRaw = firstChoice.message.content;
} else if (firstChoice?.text) {
  contentRaw = firstChoice.text;
} else if (firstChoice?.message?.function_call?.arguments) {
  contentRaw = firstChoice.message.function_call.arguments;
} else if (Array.isArray(firstChoice?.message?.tool_calls)) {
  // ...encore plus de logique
}
```

**Pourquoi ?**
- Azure GPT-5.4 retourne TOUJOURS `choices[0].message.content`
- Les fallbacks cachent les vrais problèmes
- Complexité inutile

### 4. ❌ Omettre le timeout
```typescript
// ❌ NE PAS FAIRE
await fetch(AZURE_OPENAI_ENDPOINT, { /* pas de signal */ });
```

**Pourquoi ?**
- GPT-5.4 peut prendre 30-90s
- Sans timeout, la fonction peut bloquer indéfiniment
- Toujours utiliser AbortController avec 90s

### 5. ❌ Ne pas logger les erreurs
```typescript
// ❌ NE PAS FAIRE
if (!azureResponse.ok) {
  throw new Error('Error'); // Pas de détails !
}
```

**Pourquoi ?**
- Impossible de déboguer sans logs
- Toujours logger le status et le texte d'erreur

---

## 🎯 Checklist de validation

Avant de déployer une fonction GPT-5.4, vérifier :

- [ ] AbortController avec timeout de 90s
- [ ] Paramètres au premier niveau (`reasoning_effort`, `verbosity`)
- [ ] Pas de paramètres imbriqués (`reasoning: { effort }`)
- [ ] `max_completion_tokens` (pas `max_tokens`)
- [ ] Extraction simple du contenu : `choices[0].message.content`
- [ ] Retry sur 429 avec backoff de 1s
- [ ] Logs d'erreur avec status et texte
- [ ] CORS headers pour OPTIONS
- [ ] Validation du contenu avant parsing JSON

---

## 📖 Référence complète

Voir le template réutilisable : `supabase/functions/_shared/azure-gpt5-template.ts`

Pour toute question ou modification de cette config, contacter l'équipe backend.

---

## 🚀 GPT-5.4 comme modèle primaire

GPT-5.4 est désormais le modèle primaire pour toutes les fonctions IA.
Les anciens modèles (GPT-5 Mini, GPT-5.2) sont utilisés en fallback.

### Chaîne de fallback

- **Primaire** : GPT-5.4 (`AZURE_OPENAI_ENDPOINT`)
- **Fallback 1** : GPT-5 Mini (`AZURE_GPT5_MINI_ENDPOINT`) - pour tâches légères
- **Fallback 2** : GPT-5.2 (`AZURE_GPT52_ENDPOINT`) - Responses API

### Helper partagé

Utiliser le helper `supabase/functions/_shared/azure-gpt5-mini.ts` :

```typescript
import { callGpt5Mini } from "../_shared/azure-gpt5-mini.ts";

const { content, usage, model } = await callGpt5Mini(
  systemPrompt,
  userPrompt,
  { maxTokens: 2000, timeout: 30000, jsonOutput: false }
);

// 'model' retourne 'gpt-5.4', 'gpt-5-mini' ou 'gpt-5.2' selon ce qui est utilisé
```

### Jarvis Brain

Jarvis utilise GPT-5.4 en primaire via Chat Completions API, avec fallback vers
GPT-5.2 (Responses API ou Chat Completions) en cas de rate limit ou erreur.

---

**Dernière mise à jour :** 2026-03-06
**Modèle actuel :** GPT-5.4 (gpt-5.4, version 2026-03-05)
**Validé par :** Production (toutes fonctions IA migrées)
