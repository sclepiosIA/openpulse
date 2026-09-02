# Guide Technique - Module Trésorerie

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

## Architecture

### Stack technique
- **Frontend** : React + TypeScript + Vite
- **UI** : Tailwind CSS + shadcn/ui
- **State Management** : TanStack Query (React Query)
- **Backend** : Supabase (PostgreSQL + Edge Functions)
- **Import/Export** : SheetJS (xlsx)

### Structure des dossiers

```
src/
├── components/tresorerie/
│   ├── TresorerieDashboard.tsx
│   ├── TresorerieJour.tsx
│   ├── TresorerieRecettes.tsx
│   ├── TresoreriePrevi.tsx
│   ├── TresorerieAnalyse.tsx
│   ├── TresorerieHistoriqueBancaire.tsx
│   ├── TresorerieQontoSettings.tsx
│   ├── TresorerieAdmin.tsx
│   └── TresorerieTableExcel.tsx
├── hooks/
│   ├── useTresorerieRecettes.ts
│   ├── useTresoreriePrevi.ts
│   ├── useTresorerieKPIs.ts
│   └── useKeyboardShortcuts.ts
├── lib/tresorerie/
│   ├── calculateAutomaticExpenses.ts
│   ├── generateSchedule.ts
│   └── excelImport.ts
└── pages/
    └── Tresorerie.tsx
```

## Modèle de données

### Tables principales

#### tresorerie_recettes_mensuelles
```sql
CREATE TABLE tresorerie_recettes_mensuelles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID REFERENCES etablissements(id),
  mois DATE NOT NULL,
  montant_prevu DECIMAL(10,2),
  montant_facture DECIMAL(10,2),
  montant_paye DECIMAL(10,2),
  date_paiement_prevue DATE,
  date_paiement_reel DATE,
  statut TEXT CHECK (statut IN ('prevue', 'facturee', 'payee', 'en_retard')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### tresorerie_categories
```sql
CREATE TABLE tresorerie_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  type_flux TEXT CHECK (type_flux IN ('entree', 'sortie')),
  est_recurrent BOOLEAN DEFAULT FALSE,
  couleur TEXT,
  ordre INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### tresorerie_depenses_mensuelles
```sql
CREATE TABLE tresorerie_depenses_mensuelles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie_id UUID REFERENCES tresorerie_categories(id),
  mois DATE NOT NULL,
  montant_prevu DECIMAL(10,2),
  montant_reel DECIMAL(10,2),
  description TEXT,
  est_automatique BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### tresorerie_depenses_recurrentes
```sql
CREATE TABLE tresorerie_depenses_recurrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie_id UUID REFERENCES tresorerie_categories(id),
  nom TEXT NOT NULL,
  montant_mensuel DECIMAL(10,2) NOT NULL,
  jour_prevu INTEGER CHECK (jour_prevu >= 1 AND jour_prevu <= 31),
  date_debut DATE NOT NULL,
  date_fin DATE,
  est_actif BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Relations clés

```
etablissements
    ↓
tresorerie_recettes_mensuelles

tresorerie_categories
    ↓
tresorerie_depenses_mensuelles
    ↓
tresorerie_depenses_recurrentes
```

## Hooks personnalisés

### useTresorerieRecettes

**Responsabilités** :
- Récupération des recettes sur une période
- Fusion avec les recettes prévisionnelles générées
- Mise à jour optimiste des recettes

**Utilisation** :
```typescript
const { recettes, isLoading, updateRecette } = useTresorerieRecettes(
  dateDebut,
  dateFin
);
```

**Fonctionnalités clés** :
- **Optimistic Updates** : Les modifications sont appliquées immédiatement dans l'UI
- **Rollback automatique** : En cas d'erreur, l'état précédent est restauré
- **Cache intelligent** : gcTime de 10 minutes pour réduire les appels API

### useTresoreriePrevi

**Responsabilités** :
- Calcul des prévisions de trésorerie
- Génération du tableau Excel virtuel
- Gestion des catégories et soldes

**Utilisation** :
```typescript
const { categories, soldeMensuel, soldeTotal, isLoading } = useTresoreriePrevi(
  dateDebut,
  nombreMois
);
```

**Structure des données retournées** :
```typescript
categories: {
  id: string;
  nom: string;
  valeurs: { [mois: string]: number };
}[]

soldeMensuel: { [mois: string]: number }
soldeTotal: number
```

### useTresorerieKPIs

**Responsabilités** :
- Calcul des KPIs du Dashboard
- Agrégation des données multi-sources
- Détection d'alertes

**Utilisation** :
```typescript
const { kpis, isLoading } = useTresorerieKPIs();
```

**KPIs calculés** :
- Solde actuel
- Solde prévu à 3/6/12 mois
- Recettes du mois
- Dépenses du mois
- Alertes de solde négatif

## Fonctions de calcul

### calculateAutomaticExpenses

Calcule les charges automatiques à partir des données RH :

```typescript
export async function calculateAutomaticExpenses(
  mois: string
): Promise<{ salaires: number; chargesPatronales: number }> {
  // 1. Récupère les salaires du mois depuis rh_salaires_mensuels
  const { data: salairesData } = await supabase
    .from('rh_salaires_mensuels')
    .select('id, profile_id, mois, salaire_net, salaire_brut, cotisations_patronales, cotisations_salariales')
    .eq('mois', mois);

  // 2. Calcule les totaux
  const totalSalaires = salairesData.reduce(...);
  const totalCharges = salairesData.reduce(...);

  // 3. Fallback sur les profils actifs si aucune donnée RH
  if (!salairesData || salairesData.length === 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('salaire')
      .eq('est_actif', true);
    // Calcul estimé...
  }

  return { salaires: totalSalaires, chargesPatronales: totalCharges };
}
```

**Intégration** :
- Appelé automatiquement lors de la génération des dépenses récurrentes
- Mis à jour mensuellement via Edge Function
- Utilise les vraies données RH quand disponibles

### generateSchedule

Génère les échéanciers de paiement prévisionnels :

```typescript
export function generateAllPaymentSchedules(
  etablissements: Etablissement[],
  dateDebut: Date,
  dateFin: Date
): PaymentSchedule[] {
  return etablissements
    .filter(e => e.statut === 'Production')
    .flatMap(e => generateScheduleForEtablissement(e, dateDebut, dateFin));
}
```

**Logique** :
- Basé sur les dates de contrat et paliers tarifaires
- Génère les paiements mensuels attendus
- Prend en compte les dates de début/fin de contrat

## Edge Functions

### generate-recurring-expenses

**Endpoint** : `/functions/v1/generate-recurring-expenses`

**Méthode** : POST

**Body** :
```json
{
  "dateDebut": "2025-01-01",
  "dateFin": "2025-12-31"
}
```

**Logique** :
1. Récupère toutes les dépenses récurrentes actives
2. Pour chaque mois de la période :
   - Vérifie si la dépense existe déjà
   - Calcule les charges automatiques (salaires, etc.)
   - Insère les dépenses manquantes
3. Retourne le nombre de dépenses générées

**Déploiement** :
```bash
supabase functions deploy generate-recurring-expenses
```

### generate-monthly-receipts

**Endpoint** : `/functions/v1/generate-monthly-receipts`

**Méthode** : POST

**Body** :
```json
{
  "dateDebut": "2025-01-01",
  "dateFin": "2025-12-31"
}
```

**Logique** :
1. Récupère les établissements en Production
2. Pour chaque établissement :
   - Génère l'échéancier de paiement
   - Vérifie les recettes existantes
   - Insère les recettes prévisionnelles manquantes
3. Retourne le nombre de recettes générées

## Import Excel

### Structure du fichier

Le fichier Excel doit contenir 4 feuilles :
- **Recettes** : Recettes mensuelles par établissement
- **Categories** : Catégories de flux
- **Depenses** : Dépenses mensuelles
- **Depenses_Recurrentes** : Dépenses récurrentes

### Fonction d'import

```typescript
async function importTresorerieExcel(file: File): Promise<ImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer());
  
  // 1. Validation des feuilles
  const requiredSheets = ['Recettes', 'Categories', 'Depenses', 'Depenses_Recurrentes'];
  validateSheets(workbook, requiredSheets);
  
  // 2. Import des catégories (en premier pour les FK)
  const categories = await importCategories(workbook);
  
  // 3. Import des recettes
  const recettes = await importRecettes(workbook);
  
  // 4. Import des dépenses
  const depenses = await importDepenses(workbook);
  
  // 5. Import des dépenses récurrentes
  const depensesRecurrentes = await importDepensesRecurrentes(workbook);
  
  return {
    categories: categories.length,
    recettes: recettes.length,
    depenses: depenses.length,
    depensesRecurrentes: depensesRecurrentes.length,
  };
}
```

### Gestion des erreurs

- Validation des types de colonnes
- Vérification des FK (établissements, catégories)
- Rollback en cas d'erreur partielle
- Messages d'erreur détaillés par ligne

## Optimisations de performance

### Optimistic Updates

Tous les hooks utilisent les optimistic updates pour une UX fluide :

```typescript
onMutate: async (newData) => {
  // 1. Annuler les requêtes en cours
  await queryClient.cancelQueries({ queryKey: ['tresorerie-recettes'] });
  
  // 2. Sauvegarder l'état actuel
  const previousData = queryClient.getQueryData(['tresorerie-recettes']);
  
  // 3. Mettre à jour l'état optimiste
  queryClient.setQueryData(['tresorerie-recettes'], (old) => {
    // Appliquer la modification immédiatement
  });
  
  return { previousData };
},
onError: (err, newData, context) => {
  // Rollback en cas d'erreur
  queryClient.setQueryData(['tresorerie-recettes'], context.previousData);
},
onSettled: () => {
  // Revalider les données
  queryClient.invalidateQueries({ queryKey: ['tresorerie-recettes'] });
}
```

### Cache et gcTime

Configuration du cache React Query :

```typescript
const { data } = useQuery({
  queryKey: ['tresorerie-recettes', dateDebut, dateFin],
  queryFn: fetchRecettes,
  gcTime: 10 * 60 * 1000, // 10 minutes
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Avantages** :
- Réduit les appels API inutiles
- Améliore la réactivité de l'interface
- Conserve les données en mémoire entre les navigations

### Virtualisation

Pour les grands tableaux, utilisation de `@tanstack/react-virtual` :

```typescript
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 50,
  overscan: 5,
});
```

## Raccourcis clavier

Implémentation dans `useKeyboardShortcuts.ts` :

```typescript
export function useNavigationShortcuts(
  tabs: string[],
  activeTab: string,
  setActiveTab: (tab: string) => void
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt+1 à Alt+9 : Navigation directe
      if (event.altKey && !event.ctrlKey) {
        const num = parseInt(event.key);
        if (num >= 1 && num <= tabs.length) {
          event.preventDefault();
          setActiveTab(tabs[num - 1]);
        }
      }
      
      // Ctrl+Tab : Onglet suivant
      // Ctrl+Shift+Tab : Onglet précédent
      if (event.key === 'Tab' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const currentIndex = tabs.indexOf(activeTab);
        const nextIndex = event.shiftKey
          ? (currentIndex > 0 ? currentIndex - 1 : tabs.length - 1)
          : (currentIndex < tabs.length - 1 ? currentIndex + 1 : 0);
        setActiveTab(tabs[nextIndex]);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTab, setActiveTab]);
}
```

## Tests et validation

### Script de validation SQL

Voir `scripts/validation_donnees.sql` pour :
- Vérification de l'intégrité référentielle
- Détection d'incohérences
- Calcul de statistiques

### Tests fonctionnels

Tests fonctionnels à effectuer :
1. Tests d'import Excel
2. Tests de génération automatique
3. Tests de calcul des prévisions
4. Tests des Edge Functions

## Déploiement

### Prérequis

- Supabase CLI installé
- Variables d'environnement configurées
- Accès aux secrets Supabase

### Procédure

1. **Déployer les Edge Functions** :
```bash
supabase functions deploy generate-recurring-expenses
supabase functions deploy generate-monthly-receipts
```

2. **Exécuter les migrations** :
```bash
supabase db push
```

3. **Vérifier les RLS policies** :
```sql
-- Politique d'accès aux recettes
-- Les rôles sont vérifiés via user_roles (pas profiles.role)
CREATE POLICY "Admins can view recettes"
  ON tresorerie_recettes_mensuelles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
```

4. **Tester les fonctions** :
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-recurring-expenses \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dateDebut":"2025-01-01","dateFin":"2025-12-31"}'
```

### Monitoring

- Logs Edge Functions : Supabase Dashboard → Edge Functions → Logs
- Métriques de performance : React Query Devtools
- Erreurs client : Console du navigateur

## Maintenance

### Tâches régulières

**Quotidien** :
- Vérifier les logs d'erreur
- Surveiller les performances

**Hebdomadaire** :
- Vérifier l'intégrité des données
- Nettoyer les données obsolètes

**Mensuel** :
- Générer les dépenses récurrentes
- Archiver les données anciennes
- Mettre à jour les prévisions

### Dépannage

**Problèmes courants** :

1. **Edge Function timeout** :
   - Réduire la période de génération
   - Optimiser les requêtes SQL
   - Augmenter la taille de l'instance

2. **Incohérences de cache** :
   - Invalider manuellement les requêtes
   - Vérifier la configuration gcTime
   - Forcer un refresh des données

3. **Erreurs d'import** :
   - Vérifier le format Excel
   - Valider les UUID
   - Contrôler les contraintes FK

## Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [TanStack Query Docs](https://tanstack.com/query)
- [SheetJS Documentation](https://docs.sheetjs.com/)
- [Guide utilisateur](./TRESORERIE_USER_GUIDE.md)
- [Guide de déploiement](./DEPLOYMENT_GUIDE.md)
