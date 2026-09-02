# 🔧 GUIDE DE DÉPANNAGE - RH & TRÉSORERIE

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

## Erreur : "Column est_actif does not exist"

**Cause** : Incohérence entre le nom de la colonne dans le code et la base de données.

**Solution** :
1. Vérifier la colonne réelle :
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name LIKE '%actif%';
   ```
2. Si la colonne est `actif`, corriger TOUS les fichiers :
   - `src/hooks/useRHKPIs.ts`
   - `src/lib/tresorerie/calculateAutomaticExpenses.ts`
   - `supabase/functions/generate-recurring-expenses/index.ts`

---

## Erreur : "Aucune donnée RH disponible"

**Cause** : Tables `rh_salaires_mensuels` vide.

**Solution** :
1. Exécuter le script SQL d'initialisation :
   ```bash
   psql $DATABASE_URL -f scripts/init_donnees_tresorerie.sql
   ```
2. Vérifier l'insertion :
   ```sql
   SELECT COUNT(*) FROM rh_salaires_mensuels;
   ```
3. Si toujours vide, vérifier que la table `profiles` contient des utilisateurs avec `actif = true`

**Diagnostic SQL** :
```sql
-- Vérifier les profils actifs
SELECT id, prenom, nom, actif, salaire_brut FROM profiles;

-- Si aucun profil actif, activer-les :
UPDATE profiles SET actif = true WHERE actif IS NULL OR actif = false;
```

---

## Erreur : "Duplicate key violation on tresorerie_solde"

**Cause** : Tentative d'insertion d'un solde pour une date déjà existante.

**Solution** : Utiliser `upsert` au lieu de `insert` :
```typescript
const { error } = await supabase
  .from('tresorerie_solde')
  .upsert(soldesToSave, {
    onConflict: 'date',
    ignoreDuplicates: false
  });
```

**Si l'erreur persiste** :
```sql
-- Vérifier les doublons
SELECT date, COUNT(*) 
FROM tresorerie_solde 
GROUP BY date 
HAVING COUNT(*) > 1;

-- Nettoyer les doublons (garder le plus récent)
DELETE FROM tresorerie_solde
WHERE id NOT IN (
  SELECT MAX(id) FROM tresorerie_solde GROUP BY date
);
```

---

## Page : Chargement infini

**Cause** : Boucle infinie dans un `useEffect` ou requête qui échoue silencieusement.

**Diagnostic** :
1. Ouvrir la console (F12)
2. Chercher des erreurs rouges
3. Vérifier les requêtes dans l'onglet "Network"
4. Activer "Pause on caught exceptions" dans Sources

**Solution** :
- Ajouter un `debug.log` dans le hook qui charge (voir `src/lib/debug.ts`)
- Vérifier que les dépendances du `useEffect` sont correctes
- Ajouter un timeout :
  ```typescript
  import { debug } from '@/lib/debug';
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      debug.error('⏱️ Timeout: données pas chargées en 5s');
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);
  ```

---

## Solde de trésorerie négatif

**Cause** : Plus de dépenses que de recettes.

**Solution** :
1. Vérifier que les recettes sont générées :
   ```sql
   SELECT COUNT(*) FROM tresorerie_recettes_mensuelles;
   ```
2. Si 0, aller sur `/tresorerie?tab=admin` et cliquer "Générer recettes"
3. Ajuster le solde initial dans `tresorerie_solde` si besoin :
   ```sql
   UPDATE tresorerie_solde 
   SET solde_debut = 100000, 
       solde_fin = 100000 + total_recettes - total_depenses
   WHERE date = DATE_TRUNC('month', CURRENT_DATE);
   ```

---

## Edge Function échoue

**Diagnostic** :
1. Aller sur le dashboard Supabase → Edge Functions
2. Consulter les logs de la fonction
3. Chercher les erreurs détaillées

**Causes fréquentes** :
- **Timeout (> 60s)** : Réduire le nombre de données traitées
- **Erreur de permissions RLS** : Vérifier les policies
- **Données manquantes** : Ajouter des fallbacks

**Solution pour timeout** :
```typescript
// Traiter par lots de 50 au lieu de tout d'un coup
for (let i = 0; i < items.length; i += 50) {
  const batch = items.slice(i, i + 50);
  await processBatch(batch);
}
```

---

## KPIs affichent "0" partout

**Cause** : Aucune donnée en base ou erreur dans les calculs.

**Diagnostic SQL** :
```sql
-- Vérifier toutes les tables
SELECT 
  'profiles' as table_name, COUNT(*) as count 
FROM profiles WHERE actif = true
UNION ALL
SELECT 'rh_salaires_mensuels', COUNT(*) FROM rh_salaires_mensuels
UNION ALL
SELECT 'tresorerie_recettes', COUNT(*) FROM tresorerie_recettes_mensuelles
UNION ALL
SELECT 'tresorerie_depenses', COUNT(*) FROM tresorerie_depenses
UNION ALL
SELECT 'tresorerie_solde', COUNT(*) FROM tresorerie_solde;
```

**Solution** :
- Si `profiles` = 0 : Créer des utilisateurs
- Si `rh_salaires_mensuels` = 0 : Exécuter `scripts/init_donnees_tresorerie.sql`
- Si `tresorerie_recettes` = 0 : Générer via Edge Function
- Si `tresorerie_solde` = 0 : Recalculer via admin

---

## Erreur : "Cannot read property 'map' of undefined"

**Cause** : Le hook retourne `undefined` au lieu d'un tableau.

**Solution** :
```typescript
// ❌ MAUVAIS
{data.map(item => ...)}

// ✅ BON
{data && data.length > 0 ? (
  data.map(item => ...)
) : (
  <p>Aucune donnée</p>
)}
```

---

## Génération de recettes échoue

**Erreur typique** :
```
Error: estabelissements without date_signature
```

**Solution** :
```sql
-- Trouver les établissements sans date
SELECT id, nom, statut, date_signature 
FROM etablissements 
WHERE statut = 'Production' 
  AND (date_signature IS NULL OR date_signature = '');

-- Ajouter une date fictive
UPDATE etablissements 
SET date_signature = '2024-01-01'
WHERE statut = 'Production' 
  AND date_signature IS NULL;
```

---

## Import CSV Banque échoue

**Erreur** : "Invalid date format"

**Solution** :
1. Vérifier le format de date dans le CSV : `DD/MM/YYYY` ou `YYYY-MM-DD`
2. Ajuster le parser dans `BanqueImport.tsx` :
   ```typescript
   const parseDate = (dateStr: string): string => {
     // Essayer plusieurs formats
     if (dateStr.includes('/')) {
       const [day, month, year] = dateStr.split('/');
       return `${year}-${month}-${day}`;
     }
     return dateStr; // Déjà au bon format
   };
   ```

---

## Logs utiles pour debugging

**Activer les logs détaillés** :
```typescript
import { debug } from '@/lib/debug';

// Utiliser debug.log (filtré en production, pas de fuite de données)
debug.log('🔍 Debug:', {
  currentMonth,
  cachedValue: cachedSalairesBruts,
  cacheAge: Date.now() - cacheTimestamp,
  data: salaires
});
```

**Vérifier les requêtes Supabase** :
```typescript
// ✅ Colonnes explicites (pas de select('*'))
const { data, error, count } = await supabase
  .from('profiles')
  .select('id, prenom, nom, actif, salaire_brut', { count: 'exact' })
  .eq('actif', true);

debug.log('Query result:', { data, error, count });
```

---

## Performance lente

**Diagnostic** :
1. Ouvrir Performance tab (F12)
2. Enregistrer pendant 10s
3. Chercher les fonctions qui prennent > 500ms

**Solutions** :
- Ajouter des index SQL :
  ```sql
  CREATE INDEX idx_salaires_mois ON rh_salaires_mensuels(mois);
  CREATE INDEX idx_depenses_date ON tresorerie_depenses(date_prevue);
  ```
- Utiliser les query presets centralisés :
  ```typescript
  import { queryPresets } from '@/hooks/useQueryPresets';

  const { data } = useQuery({
    queryKey: ['data', params],
    queryFn: fetchData,
    ...queryPresets.standard, // staleTime + gcTime pré-configurés
  });
  ```
- Paginer les résultats :
  ```typescript
  .range(0, 49) // Seulement 50 premiers
  ```

---

## Ressources

- **Supabase Dashboard** : Pour voir les logs et les données en temps réel
- **Sentry** : Pour tracker les erreurs en production
- **Console DevTools** : F12 → Console, Network, Performance
- **SQL Editor** : Dashboard Supabase → SQL Editor

## Contact

Si le problème persiste après avoir essayé ces solutions :
1. Copier l'erreur complète de la console
2. Noter les étapes pour reproduire
3. Vérifier les logs Edge Functions
4. Créer un ticket avec toutes ces informations
