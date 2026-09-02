# Gestion des Établissements Bloqués

## Comportement Automatique

### Blocage Automatique
Quand une tâche passe en statut "Bloqué", l'établissement associé est automatiquement bloqué.

**Trigger SQL** : `trigger_auto_block_on_task_blocked`
- Détecte le changement de statut d'une tâche vers "Bloqué"
- Met l'établissement en statut "Bloqué"
- Ajoute une note avec la date et le nom de la tâche bloquée

**Fonction appelée** : `auto_block_etablissement_on_task_blocked()`

### Exclusion du Pipeline
Les établissements bloqués sont automatiquement exclus :
- ❌ Du pipeline commercial actif
- ❌ Du calcul du CA pipeline
- ✅ Mais conservés dans les statistiques globales

## Affichage

### Section Dédiée
Une section "Établissements bloqués" est affichée sur :
- **Dashboard** : Vue d'ensemble des KPIs
- **Page Prospects** : Gestion commerciale
- **Page Établissements** : Liste complète

Cette section affiche :
- Nombre d'établissements bloqués
- Valeur totale bloquée (en euros)
- Liste détaillée avec :
  - Nom et ville de l'établissement
  - Raison du blocage
  - Date de blocage
  - Valeur potentielle
- Bouton "Débloquer" pour chaque établissement

### Carte KPI Dashboard
Une carte dédiée dans les métriques principales du Dashboard affiche :
- **Nombre** d'établissements bloqués (badge rouge)
- **Valeur totale bloquée** (montant en euros)
- Icône d'alerte (`AlertTriangle`)
- Lien vers la page Prospects pour action

## Déblocage

### Procédure
1. Cliquer sur le bouton "Débloquer" dans la section bloquée
2. Choisir le nouveau statut de l'établissement (liste des statuts commerciaux disponibles)
3. Saisir une raison de déblocage (champ obligatoire)
4. Confirmer l'opération

### Effet du Déblocage
- L'établissement repasse au statut choisi
- Le CA pipeline est recalculé automatiquement avec la valeur de l'établissement
- Une note de déblocage est ajoutée dans les notes de l'établissement avec :
  - Date du déblocage
  - Nouveau statut
  - Raison du déblocage

## Calcul de la Valeur Bloquée

La valeur d'un établissement bloqué est calculée selon les mêmes règles que pour les autres établissements :

1. **Priorité 1** : Palliers "Au succès" avec tarifs définis
2. **Priorité 2** : Modèle statique numérique
3. **Priorité 3** : Estimation 2€/passage aux urgences

Voir `docs/VALUE_CALCULATION_RULES.md` pour plus de détails.

## Exemples de Notes Automatiques

### Note de Blocage Automatique
```
🚫 [2025-01-15] Établissement bloqué automatiquement suite au blocage de la tâche : "Validation juridique du contrat"
```

### Note de Déblocage
```
✅ [2025-01-20] Établissement débloqué : passage en statut "Négociation"
Raison : Problème juridique résolu, contrat validé par le service légal
```

## Implémentation Technique

### Fichiers Concernés

#### Backend (SQL)
- **Trigger** : `trigger_auto_block_on_task_blocked` sur `public.taches`
- **Fonction** : `auto_block_etablissement_on_task_blocked()` dans `supabase/migrations/`

#### Frontend (React)
- **Hook** : `src/hooks/useUnblockEtablissement.ts` - Gestion du déblocage
- **Composant** : `src/components/BlockedEtablissementsSection.tsx` - Section bloquée
- **KPI Card** : `src/components/dashboard/HeroMetrics.tsx` - Carte métrique bloqués
- **Pages** : 
  - `src/pages/Dashboard.tsx`
  - `src/pages/Prospects.tsx`
  - `src/pages/Etablissements.tsx`

#### Hooks de Données
- `src/hooks/useDashboard.ts` - Récupération des stats (inclut `total_bloques`, `valeur_bloquee`)
- `src/hooks/useProspects.ts` - Exclusion automatique des bloqués du pipeline

### Tests Recommandés

#### Test 1 : Blocage Automatique
1. Créer ou sélectionner un établissement de test
2. Créer une tâche associée
3. Passer la tâche en statut "Bloqué"
4. ✅ Vérifier que l'établissement passe automatiquement en "Bloqué"
5. ✅ Vérifier que la note contient la raison du blocage

#### Test 2 : Section Bloquée Visible
1. ✅ Dashboard : Section "Établissements bloqués" visible
2. ✅ Prospects : Section "Établissements bloqués" visible
3. ✅ Etablissements : Section "Établissements bloqués" visible
4. ✅ La section affiche un état vide informatif si aucun établissement bloqué

#### Test 3 : Exclusion du CA Pipeline
1. Noter le CA Pipeline avant le blocage
2. Bloquer un établissement (via tâche)
3. ✅ Vérifier que le CA Pipeline a diminué
4. ✅ Vérifier que la carte KPI "Bloqués" affiche la valeur bloquée
5. ✅ Vérifier que l'établissement n'apparaît plus dans les listes "actives"

#### Test 4 : Déblocage Complet
1. Cliquer sur "Débloquer" dans la section bloquée
2. Choisir un nouveau statut (ex: "Prospect")
3. Saisir une raison de déblocage
4. ✅ Vérifier que l'établissement repasse dans le pipeline actif
5. ✅ Vérifier que le CA Pipeline augmente à nouveau
6. ✅ Vérifier qu'une note de déblocage est ajoutée

## Maintenance

### Vérification de la Cohérence des Données
```sql
-- Compter les établissements bloqués
SELECT COUNT(*) FROM public.etablissements WHERE statut = 'Bloqué';

-- Calculer la valeur bloquée totale
SELECT * FROM public.get_dashboard_overview();

-- Voir les notes de blocage
SELECT nom, notes FROM public.etablissements WHERE statut = 'Bloqué';
```

### Déblocage Manuel (SQL)
Si nécessaire, déblocage direct en SQL :
```sql
UPDATE public.etablissements 
SET 
  statut = 'Prospect',
  notes = CONCAT(
    COALESCE(notes || E'\n\n', ''),
    '✅ [', NOW()::DATE, '] Établissement débloqué manuellement via SQL'
  )
WHERE id = '<uuid_etablissement>';
```

## Sécurité

- Le trigger s'exécute automatiquement avec `SECURITY DEFINER`
- Les notes de blocage sont tracées avec horodatage
- Seuls les utilisateurs authentifiés peuvent débloquer via l'interface
- Les admins peuvent intervenir manuellement en SQL si nécessaire
