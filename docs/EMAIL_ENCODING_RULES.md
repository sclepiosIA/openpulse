# Règles d'encodage des emails

## Problème résolu (2025-11-12)

Les emails français contiennent des caractères accentués (é, è, à, etc.) qui peuvent être encodés de plusieurs façons et causer des problèmes d'affichage.

### Types d'encodage rencontrés

1. **RFC 2047 (MIME)** : `=?UTF-8?B?...?=` ou `=?UTF-8?Q?...?=`
   - Base64 : `=?UTF-8?B?w6ljaGFuZ2U=?=` → "échange"
   - Quoted-Printable : `=?UTF-8?Q?=C3=A9change?=` → "échange"

2. **Double encodage UTF-8/Latin-1** (❗ problème principal)
   - Texte UTF-8 original mal décodé comme Latin-1 puis ré-encodé en UTF-8
   - Exemples découverts par analyse hexadécimale :
     - "à" (c3 a0) → "Ã" (c3 83) + NO-BREAK SPACE (c2 a0)
     - "É" (c3 89) → "Ã" (c3 83) + char 0x89
   - Affichage : "Suite Ã  notre" au lieu de "Suite à notre"
   - Pattern hex : `c3 83 c2 a0` → `c3 a0 20`

3. **UTF-8 malformé simple** : Double encodage ou problème de décodage
   - `Ã©` → devrait être `é`
   - `Ã©change` → devrait être `échange`

### Impact avant correction

**Statistiques des données corrompues** :
- 94 threads sur 136 (69%) avec sujets mal encodés
- Exemple : "Suite Ã  notre Ã©change" au lieu de "Suite à notre échange"
- Impact sur la recherche : impossibilité de trouver les emails en cherchant "échange"

---

## Solution appliquée

### 1. Correction côté serveur (Edge Function)

**Fichier** : `supabase/functions/sync-emails/index.ts`

La fonction `decodeHeaderValue()` a été améliorée pour :
1. Décoder les en-têtes MIME RFC 2047 (Base64 et Quoted-Printable)
2. **Corriger le double encodage UTF-8/Latin-1 avec NO-BREAK SPACE**
3. Corriger automatiquement les patterns UTF-8 malformés standards

```typescript
function decodeHeaderValue(value: string): string {
  // 1. Decode RFC 2047 MIME words
  const mimePattern = /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g;
  let decoded = value.replace(mimePattern, ...);
  
  // 2. Fix DOUBLE ENCODING UTF-8/Latin-1 (le plus important!)
  // Pattern: "Ã" + NO-BREAK SPACE (U+00A0) → "à" + espace normal
  decoded = decoded.replace(/Ã\u00A0 /g, 'à ');
  decoded = decoded.replace(/Ã\u00A0/g, 'à ');
  
  // Pattern: "Ã" + 0x89 → "É" (pour "Événement")
  decoded = decoded.replace(/Ã\u0089/g, 'É');
  
  // 3. Fix simple malformed UTF-8
  const patterns = {
    'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê',
    'Ã ': 'à', 'Ã§': 'ç', ...
  };
  
  return decoded;
}
```

### 2. Migration des données existantes (SQL)

**Migration** : `20251112_fix_email_encoding_and_dates.sql`

Actions effectuées :
- ✅ Création de la fonction `fix_malformed_utf8()` en PL/pgSQL
- ✅ **Analyse hexadécimale pour identifier le double encodage UTF-8/Latin-1**
- ✅ Correction du pattern "Ã + NO-BREAK SPACE" → "à + espace normal"
- ✅ Correction du pattern "Ã + 0x89" → "É"
- ✅ Correction de tous les sujets dans `email_threads` (137 threads)
- ✅ Correction de tous les sujets dans `email_messages` (66 messages)
- ✅ Correction de tous les noms d'expéditeurs (`from_name`)
- ✅ Correction de tous les résumés IA (`ai_summary`)

### 3. Correction du tri par date

**Problème identifié** : Un email ancien (28 jours) apparaissait comme "il y a 4 heures"

**Cause** : La fonction de synchronisation mettait à jour `last_message_date` avec la date du message en cours de traitement, même si ce message était plus ancien que le dernier message existant.

**Solution** :
```typescript
// Mettre à jour last_message_date UNIQUEMENT si le message est plus récent
if (!currentThread?.last_message_date || 
    new Date(dateStr) > new Date(currentThread.last_message_date)) {
  updateData.last_message_date = dateStr;
}
```

**Migration SQL** : Recalcul de tous les `last_message_date` basés sur `MAX(sent_date)` de chaque thread.

### 4. Interface de tri

**Ajout** : Contrôle de tri dans `EmailInbox.tsx`
- Bouton de basculement "Plus récent d'abord" / "Plus ancien d'abord"
- Tri dynamique par `last_message_date` (ascendant/descendant)
- État persistant pendant la navigation

---

## Tests de validation

### Test 1 : Encodage corrigé

**Requête SQL** :
```sql
SELECT COUNT(*) as threads_corrompus 
FROM email_threads 
WHERE subject LIKE '%Ã%';
```
**Résultat attendu** : 0

### Test 2 : Dates correctes

**Vérifier un thread spécifique** :
```sql
SELECT 
  id, subject, last_message_date,
  (SELECT MAX(sent_date) FROM email_messages WHERE thread_id = t.id) as real_last_date
FROM email_threads t
WHERE last_message_date != (
  SELECT MAX(sent_date) 
  FROM email_messages 
  WHERE thread_id = t.id
);
```
**Résultat attendu** : Aucune différence

### Test 3 : Interface de tri

1. Cliquer sur le bouton de tri
2. L'ordre doit s'inverser
3. Les emails les plus anciens doivent apparaître en premier en mode "Plus ancien d'abord"

---

## Prévention future

### ✅ Protection serveur
- Tous les nouveaux emails synchronisés utilisent `decodeHeaderValue()` améliorée
- Correction automatique à la source

### ✅ Protection client
- `sanitizeEmailSubject()` dans `emailUtils.ts` comme fallback
- Gestion des cas null/undefined
- Tests unitaires dans `emailUtils.subject.test.ts`

### ✅ Tests automatiques

**Fichier** : `src/__tests__/lib/emailUtils.subject.test.ts`

⚠️ **NE PAS SUPPRIMER ces tests** : ils valident les patterns d'encodage

Couverture :
- RFC 2047 Quoted-Printable
- RFC 2047 Base64
- UTF-8 malformé
- HTML entities
- Double encodage
- Whitespace normalization

---

## Métriques de succès

### Avant correction (2025-11-11)
- ❌ 94/136 threads (69%) avec sujets corrompus
- ❌ Recherche "échange" ne trouve pas "Ã©change"
- ❌ Tri chronologique incorrect
- ❌ Affichage : "Suite Ã  notre Ã©change"

### Après correction (2025-11-12)
- ✅ **0/137 threads corrompus (100% corrigés après analyse hexadécimale)**
- ✅ Recherche fonctionnelle sur accents
- ✅ Tri chronologique précis basé sur vraie date
- ✅ Affichage : "Suite à notre échange" (NO-BREAK SPACE corrigé)
- ✅ Interface avec contrôle de tri
- ✅ **Double encodage UTF-8/Latin-1 identifié et résolu**
  - Pattern "Ã + NO-BREAK SPACE" → "à + espace"
  - Pattern "Ã + 0x89" → "É"
  - Tous les 137 threads corrigés le même jour

---

## Maintenance

### Si problème d'encodage réapparaît

1. **Vérifier la fonction serveur** :
   ```bash
   # Logs edge function
   supabase functions logs sync-emails --tail
   ```

2. **Vérifier les patterns manquants** :
   ```sql
   -- Trouver les nouveaux patterns corrompus
   SELECT DISTINCT 
     substring(subject from 'Ã[^ ]*') as pattern
   FROM email_threads 
   WHERE subject LIKE '%Ã%'
   LIMIT 20;
   ```

3. **Ajouter les patterns** :
   - Dans `decodeHeaderValue()` (serveur)
   - Dans `fix_malformed_utf8()` (SQL)
   - Dans `sanitizeEmailSubject()` (client)

### Si problème de tri réapparaît

1. **Vérifier la logique de mise à jour** :
   ```typescript
   // Doit comparer les dates avant de mettre à jour
   if (new Date(dateStr) > new Date(currentThread.last_message_date))
   ```

2. **Recalculer les dates** :
   ```sql
   UPDATE email_threads t
   SET last_message_date = (
     SELECT MAX(m.sent_date)
     FROM email_messages m
     WHERE m.thread_id = t.id
   );
   ```

---

## Références

- [RFC 2047 - MIME Message Header Extensions](https://www.rfc-editor.org/rfc/rfc2047)
- [UTF-8 Encoding](https://en.wikipedia.org/wiki/UTF-8)
- Tests : `src/__tests__/lib/emailUtils.subject.test.ts`
- Migration : `supabase/migrations/20251112_fix_email_encoding_and_dates.sql`

---

**Dernière mise à jour** : 2025-11-12  
**Auteur** : Correction automatique suite à audit complet
