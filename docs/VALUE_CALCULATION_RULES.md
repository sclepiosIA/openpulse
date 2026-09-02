# 📐 Règles de Calcul de la Valeur des Établissements

## Logique de Priorité (IDENTIQUE SQL + TypeScript)

### Priorité 1 : Palliers "Au succès"
Si `type_offre = "Au succès"` ET `pallier_vise` ET `tarifs_palliers` → utiliser le **montant annuel direct** du pallier

**Source :** Champ JSONB `tarifs_palliers` contenant les tarifs annuels par pallier

**Structure `tarifs_palliers` :**
```json
{
  "palier1": 32371,
  "palier2": 64743,
  "palier3": 97114,
  "palier4": 129486
}
```

**Mapping :** 
- `pallier_vise = "Pallier 2"` → clé `"palier2"` → **64 743 €/an**

**Exemple :** CH Alexandra Lepève
- Type: Au succès
- Pallier visé: Pallier 2
- CA annuel: **64 743 €** (tarif direct, pas de multiplication)

### Priorité 2 : Modèle Statique
Si `modele_statique_succes` contient un nombre valide → utiliser cette valeur directement

**Exemple :** `"65000"` → **65 000 €**

**Validation :** La valeur doit être un nombre (regex : `^[0-9]+\.?[0-9]*$`)

### Priorité 3 : Estimation Standard
Si seulement `nombre_passages_urgences_annuel` → multiplier par **2.0**

**Exemple :** 50 000 passages × 2 = **100 000 €**

### Priorité 4 : Aucune Donnée
Valeur = **0 €**

---

## 📊 Définitions des métriques

### Prospects Purs
- **Définition** : Établissements avec statut = "Prospect" uniquement
- **Exclus** : Tous les autres statuts (Contacté, RDV pris, etc.)
- **Méthode de calcul** : `COUNT(*)` où `statut = 'Prospect'`

### Pipeline Commercial
- **Définition** : Établissements en phase commerciale active
- **Inclus** : Prospect, Contacté, Attente RDV, RDV pris, Attente post RDV, Dans les RDV, Etude émise, Dans les RDV post EME, Négociation, Contractualisation, Vendu
- **⚠️ EXCLUS** : Contractuel, Conformité, Déploiement, Formation, Go-Live, Production, Refus, Reporté, **Bloqué**
- **Méthode de calcul** : `COUNT(*)` où `statut IN (liste des statuts ci-dessus)`
- **Important** : Les établissements bloqués sont **exclus du pipeline** et comptabilisés séparément

### CA Potentiel Total
- **Définition** : Valeur totale de TOUS les établissements (incluant prospects, pipeline, contractuels, production, **et bloqués**)
- **Méthode de calcul** : `SUM(calculateEtablissementValue(etab))` pour tous les établissements

### CA Pipeline
- **Définition** : Valeur des établissements en phase commerciale uniquement
- **Inclus** : Même liste que "Pipeline Commercial"
- **⚠️ EXCLUS** : Contractuels, Production, Refus, Reporté, **Bloqué**
- **Méthode de calcul** : `SUM(calculateEtablissementValue(etab))` pour établissements dans le pipeline (hors bloqués)

### Établissements Bloqués
- **Définition** : Établissements avec statut = "Bloqué" (blocage automatique suite à une tâche bloquée ou blocage manuel)
- **Traçabilité** : Raison du blocage enregistrée dans le champ `notes` avec date
- **Valeur** : Conservée dans `valeur_bloquee` pour suivi, mais **exclue du CA pipeline**
- **Affichage** : Section séparée dans l'interface utilisateur

---

## Implémentation

### SQL
Fonction : `public.get_dashboard_overview()`

Fichier : `supabase/migrations/00000000000000_initial_schema.sql` (création initiale), itérations `20250905230622_*` puis `20251110083440_*`.

### TypeScript
Fonction : `calculateEtablissementValue(etablissement: any): number`

Fichier : `src/lib/valueCalculations.ts`

**Utilisé dans :**
- `src/pages/Dashboard.tsx` (ligne 118)
- `src/components/ProspectStatsDashboard.tsx` (lignes 119, 152, 176, 193, 210)
- `src/hooks/useEmailDashboardStats.ts` (ligne 23)

---

## Cohérence Garantie

✅ **Calculs de valeur** : Logique identique partout (SQL = TypeScript)

✅ **Définitions claires** : Chaque composant a un rôle spécifique

✅ **Sources de données** : Documentées et cohérentes

✅ **Libellés** : Descriptifs et non ambigus

✅ **Valeurs nettoyées** : Valeurs texte comme "Succès+12" supprimées

---

## Validation

Pour vérifier la cohérence des calculs :

1. **Dashboard** : Vérifier que CA total = valeur_totale
2. **ProspectStatsDashboard** : Vérifier que CA pipeline = somme des établissements filtrés
3. **Console logs** : Activer les logs en développement pour voir les calculs détaillés

**Test SQL :**
```sql
SELECT 
  total_etablissements,
  total_prospects,
  total_pipeline,
  valeur_totale,
  valeur_pipeline
FROM get_dashboard_overview();
```

**Résultat attendu :**
- `total_etablissements` : 62
- `total_prospects` : 34 (statut = 'Prospect')
- `total_pipeline` : ~58 (tous sauf Contractuel/Déploiement/Production)
- `valeur_totale` : ~8 173 000 € (tous établissements)
- `valeur_pipeline` : ~7 500 000 € (pipeline commercial)

---

## Cohérence Automatique du Type d'Offre

### Règle
Si un établissement possède :
- `tarifs_palliers` (JSONB défini)
- `pallier_vise` (texte défini)

Alors son `type_offre` DOIT OBLIGATOIREMENT être "Au succès".

### Application
✅ **Trigger SQL automatique** : Garantit la cohérence à l'insertion/mise à jour  
✅ **Correction rétroactive** : Appliquée le 2025-11-12 sur 2 établissements  
✅ **Logique de calcul** : `calculateEtablissementValue()` respecte cette règle (Priorité 1)

### Impact sur les calculs
Priorité 1 : Palliers "Au succès" → valeur = `tarifs_palliers[pallier_vise]`
- CH de Lens : 74 529 € (Pallier 2)
- Hôpital Sainte-Camille : 27 318 € (Pallier 2)

### Trigger SQL
```sql
CREATE TRIGGER trigger_ensure_type_offre_au_succes
  BEFORE INSERT OR UPDATE ON etablissements
  FOR EACH ROW
  EXECUTE FUNCTION ensure_type_offre_au_succes();
```

---

## Maintenance

⚠️ **IMPORTANT** : Si vous modifiez la logique de calcul :

1. **Modifier les deux fichiers simultanément** :
   - SQL : `get_dashboard_overview()`
   - TypeScript : `calculateEtablissementValue()`

2. **Tester la cohérence** :
   - Comparer les résultats SQL vs TypeScript
   - Vérifier que tous les composants affichent les mêmes valeurs

3. **Mettre à jour cette documentation**

---

## Historique

- **2025-11-12** : Ajout trigger automatique `ensure_type_offre_au_succes()` + correction rétroactive (2 établissements)
- **2025-11-10** : Unification des calculs SQL/TypeScript, ajout `total_pipeline` et `valeur_pipeline`
- **2025-11-10** : Nettoyage des valeurs "Succès+12" problématiques
- **2025-11-10** : Création de la fonction utilitaire `calculateEtablissementValue()`
