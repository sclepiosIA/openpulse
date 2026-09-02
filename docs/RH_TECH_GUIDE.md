# 🔧 Guide Technique - Module RH

> **Version** : 1.9.0 | **Dernière mise à jour** : Mars 2026  
> **Stack** : React + TypeScript + TanStack Query + Supabase  
> **Audience** : Développeurs, DevOps, Administrateurs techniques

---

## 📑 Table des matières

1. [Architecture](#architecture)
2. [Structure des données](#structure-des-données)
3. [Hooks personnalisés](#hooks-personnalisés)
4. [Composants UI](#composants-ui)
5. [Logique métier](#logique-métier)
6. [Intégration Trésorerie](#intégration-trésorerie)
7. [Optimisations](#optimisations)
8. [Sécurité](#sécurité)
9. [Tests](#tests)
10. [Déploiement](#déploiement)

---

## 🏗️ Architecture

### Stack technique

```
Frontend:
- React 18.3+
- TypeScript 5.0+
- TanStack Query (React Query) 5.x
- TanStack Virtual (pour tableaux longs)
- Tailwind CSS 3.x
- Shadcn/ui (composants)

Backend:
- Supabase (PostgreSQL 15+)
- Row Level Security (RLS)
- Edge Functions (Deno)
- Realtime subscriptions
```

### Arborescence des fichiers

```
src/
├── pages/
│   └── RH.tsx                         # Page principale avec onglets
├── components/rh/
│   ├── RHDashboard.tsx                # Vue d'ensemble + KPIs
│   ├── RHSalairesTable.tsx            # Tableau éditable des salaires
│   ├── RHSalaireDetail.tsx            # Modal détail d'un salaire
│   ├── RHObjectifsCA.tsx              # Gestion objectifs CA
│   ├── RHPlanningAbsences.tsx         # Calendrier absences
│   ├── RHFicheEmploye.tsx             # Fiche individuelle
│   ├── RHExportPaie.tsx               # Exports CSV/Excel
│   ├── RHTresorerieWidget.tsx         # Widget solde trésorerie
│   └── RHReconciliation.tsx           # Sync RH↔Trésorerie
├── hooks/
│   ├── useRHSalaires.ts               # CRUD salaires
│   ├── useRHObjectifs.ts              # CRUD objectifs
│   ├── useRHAbsences.ts               # CRUD absences
│   ├── useRHKPIs.ts                   # Calcul KPIs
│   ├── useKeyboardShortcuts.ts        # Raccourcis clavier
│   └── useNavigationShortcuts.ts      # Navigation onglets
└── lib/
    └── rh/
        ├── calculateSalary.ts         # Calculs salaires + cotisations
        └── exportUtils.ts             # Utilitaires export CSV/Excel
```

---

## 💾 Structure des données

### Tables Supabase

#### 1. `rh_salaires_mensuels`

```sql
CREATE TABLE public.rh_salaires_mensuels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mois DATE NOT NULL, -- Premier jour du mois (ex: 2025-01-01)
  salaire_brut DECIMAL(15,2) NOT NULL,
  salaire_net DECIMAL(15,2) NOT NULL,
  cotisations_patronales DECIMAL(15,2) NOT NULL,
  cotisations_salariales DECIMAL(15,2) NOT NULL,
  primes DECIMAL(15,2) DEFAULT 0,
  heures_supplementaires DECIMAL(15,2) DEFAULT 0,
  statut TEXT DEFAULT 'prevu', -- 'prevu', 'paye', 'en_cours'
  date_paiement DATE, -- Date réelle de virement
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, mois) -- Un seul salaire par employé et par mois
);

-- Index pour performances
CREATE INDEX idx_rh_salaires_profile ON rh_salaires_mensuels(profile_id);
CREATE INDEX idx_rh_salaires_mois ON rh_salaires_mensuels(mois DESC);
CREATE INDEX idx_rh_salaires_statut ON rh_salaires_mensuels(statut);
```

**Contraintes métier** :
- `salaire_brut > 0` : Validé en TypeScript + Check constraint
- `cotisations_patronales = salaire_brut * 0.45` : Calculé automatiquement
- `cotisations_salariales = salaire_brut * 0.24` : Calculé automatiquement
- `salaire_net = salaire_brut - cotisations_salariales + primes + heures_supplementaires`

---

#### 2. `rh_objectifs_ca`

```sql
CREATE TABLE public.rh_objectifs_ca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  annee INTEGER NOT NULL, -- 2025
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  objectif_ca DECIMAL(15,2) NOT NULL,
  ca_realise DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, annee, trimestre)
);

-- Index
CREATE INDEX idx_rh_objectifs_profile ON rh_objectifs_ca(profile_id);
CREATE INDEX idx_rh_objectifs_periode ON rh_objectifs_ca(annee DESC, trimestre DESC);
```

**Calcul du taux d'atteinte** :
```typescript
const taux = (ca_realise / objectif_ca) * 100;
```

---

#### 3. `rh_absences`

```sql
CREATE TABLE public.rh_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  type_absence TEXT NOT NULL, -- 'conges_payes', 'maladie', 'rtt', 'formation', 'non_justifie'
  motif TEXT,
  statut TEXT DEFAULT 'en_attente', -- 'en_attente', 'validee', 'refusee'
  validee_par UUID REFERENCES profiles(id),
  validee_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (date_fin >= date_debut)
);

-- Index
CREATE INDEX idx_rh_absences_profile ON rh_absences(profile_id);
CREATE INDEX idx_rh_absences_dates ON rh_absences(date_debut, date_fin);
CREATE INDEX idx_rh_absences_type ON rh_absences(type_absence);
```

**Calcul de la durée** :
```typescript
const duree = (date_fin - date_debut) + 1; // +1 pour inclure les deux dates
```

---

### Types TypeScript

#### Interface `RHSalaire`

```typescript
export interface RHSalaire {
  id: string;
  profile_id: string;
  mois: string; // Format: 'YYYY-MM-DD' (premier jour du mois)
  salaire_brut: number;
  salaire_net: number;
  cotisations_patronales: number;
  cotisations_salariales: number;
  primes?: number;
  heures_supplementaires?: number;
  statut?: 'prevu' | 'paye' | 'en_cours';
  date_paiement?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  profiles?: {
    prenom: string;
    nom: string;
    email: string;
    photo_url?: string;
  };
}
```

#### Interface `RHObjectif`

```typescript
export interface RHObjectif {
  id: string;
  profile_id: string;
  annee: number;
  trimestre: 1 | 2 | 3 | 4;
  objectif_ca: number;
  ca_realise?: number;
  notes?: string;
  created_at?: string;
  profiles?: {
    prenom: string;
    nom: string;
    email: string;
  };
}
```

#### Interface `RHAbsence`

```typescript
export interface RHAbsence {
  id: string;
  profile_id: string;
  date_debut: string;
  date_fin: string;
  type_absence: 'conges_payes' | 'maladie' | 'rtt' | 'formation' | 'non_justifie';
  motif?: string;
  statut: 'en_attente' | 'validee' | 'refusee';
  validee_par?: string;
  validee_le?: string;
  created_at?: string;
  updated_at?: string;
  profiles?: {
    prenom: string;
    nom: string;
    email: string;
  };
}
```

---

## 🎣 Hooks personnalisés

### 1. `useRHSalaires`

**Chemin** : `src/hooks/useRHSalaires.ts`

**Responsabilité** : CRUD complet des salaires avec optimistic updates.

#### Signature

```typescript
export function useRHSalaires(mois?: string): {
  salaires: RHSalaire[] | undefined;
  isLoading: boolean;
  createSalaire: (salaire: Omit<RHSalaire, 'id'>) => Promise<RHSalaire>;
  updateSalaire: (salaire: Partial<RHSalaire> & { id: string }) => Promise<RHSalaire>;
  deleteSalaire: (id: string) => Promise<void>;
}
```

#### Exemple d'utilisation

```typescript
const { salaires, updateSalaire } = useRHSalaires('2025-01');

const handleEdit = async () => {
  await updateSalaire({
    id: 'uuid-123',
    salaire_brut: 4500,
    // Les cotisations seront recalculées automatiquement
  });
};
```

#### Optimistic updates

```typescript
onMutate: async (newSalaire) => {
  // Annuler les requêtes en cours
  await queryClient.cancelQueries({ queryKey: ['rh-salaires'] });
  
  // Sauvegarder l'état actuel
  const previousSalaires = queryClient.getQueryData(['rh-salaires', mois]);
  
  // Mettre à jour optimistiquement
  queryClient.setQueryData(['rh-salaires', mois], (old: RHSalaire[]) =>
    old.map((s) => s.id === newSalaire.id ? { ...s, ...newSalaire } : s)
  );

  return { previousSalaires };
},
onError: (_, __, context) => {
  // Rollback en cas d'erreur
  if (context?.previousSalaires) {
    queryClient.setQueryData(['rh-salaires', mois], context.previousSalaires);
  }
},
```

**Avantages** :
- ✅ Interface réactive instantanément
- ✅ Pas de flash de chargement
- ✅ Rollback automatique en cas d'erreur réseau

---

### 2. `useRHKPIs`

**Chemin** : `src/hooks/useRHKPIs.ts`

**Responsabilité** : Calcul des indicateurs clés de performance.

#### Signature

```typescript
export function useRHKPIs(mois?: string): {
  kpis: {
    effectif_total: number;
    effectif_actif: number;
    masse_salariale_mensuelle: number;
    masse_salariale_annuelle: number;
    taux_atteinte_objectifs: number;
    taux_absenteisme: number;
  } | undefined;
  isLoading: boolean;
}
```

#### Implémentation des calculs

```typescript
// 1. Effectif
const { count: effectif_total } = await supabase
  .from('profiles')
  .select('*', { count: 'exact', head: true })
  .eq('est_actif', true);

// 2. Masse salariale
const { data: salaires } = await supabase
  .from('rh_salaires_mensuels')
  .select('salaire_brut')
  .eq('mois', moisActuel);

const masse_salariale_mensuelle = salaires?.reduce((sum, s) => sum + s.salaire_brut, 0) || 0;
const masse_salariale_annuelle = masse_salariale_mensuelle * 12;

// 3. Taux d'atteinte des objectifs
const { data: objectifs } = await supabase
  .from('rh_objectifs_ca')
  .select('objectif_ca, ca_realise')
  .eq('annee', currentYear)
  .eq('trimestre', currentTrimestre);

const totalObjectif = objectifs?.reduce((sum, o) => sum + o.objectif_ca, 0) || 0;
const totalRealise = objectifs?.reduce((sum, o) => sum + (o.ca_realise || 0), 0) || 0;
const taux_atteinte_objectifs = totalObjectif > 0 ? (totalRealise / totalObjectif) * 100 : 0;

// 4. Taux d'absentéisme
const { data: absences } = await supabase
  .from('rh_absences')
  .select('date_debut, date_fin')
  .gte('date_debut', debutMois)
  .lte('date_fin', finMois);

const joursAbsence = absences?.reduce((sum, a) => {
  const debut = new Date(a.date_debut);
  const fin = new Date(a.date_fin);
  const duree = Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return sum + duree;
}, 0) || 0;

const joursOuvres = effectif_total * 22; // 22 jours ouvrés par mois
const taux_absenteisme = joursOuvres > 0 ? (joursAbsence / joursOuvres) * 100 : 0;
```

**Configuration du cache** :

```typescript
queryFn: { /* calculs */ },
staleTime: 5 * 60 * 1000, // Cache 5 minutes
refetchOnMount: false,
gcTime: 10 * 60 * 1000, // Garde en cache 10 minutes après non-utilisation
```

---

### 3. `useKeyboardShortcuts`

**Chemin** : `src/hooks/useKeyboardShortcuts.ts`

**Responsabilité** : Gérer les raccourcis clavier globaux.

#### Signature

```typescript
export function useKeyboardShortcuts(
  shortcuts: Array<{
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    description: string;
    callback: () => void;
  }>
): void;
```

#### Exemple d'utilisation

```typescript
useKeyboardShortcuts([
  {
    key: 's',
    ctrl: true,
    description: 'Sauvegarder',
    callback: () => handleSave(),
  },
  {
    key: 'e',
    ctrl: true,
    description: 'Exporter',
    callback: () => handleExport(),
  },
]);
```

#### Implémentation interne

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
        event.preventDefault();
        shortcut.callback();
        break;
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [shortcuts]);
```

**Support navigateurs** :
- ✅ Chrome, Firefox, Edge : Complet
- ✅ Safari : Partiel (⌘ au lieu de Ctrl)

---

## 🎨 Composants UI

### 1. `RHSalairesTable`

**Chemin** : `src/components/rh/RHSalairesTable.tsx`

**Props** : Aucune (utilise le hook `useRHSalaires` en interne)

**Fonctionnalités** :
- ✅ Édition inline (double-clic)
- ✅ Mode édition global (icône crayon)
- ✅ Tri par colonne
- ✅ Filtrage par mois
- ✅ Skeleton loaders pendant le chargement
- ✅ Message d'état vide informatif

#### Structure

```tsx
<Card>
  <CardHeader>
    <CardTitle>Salaires mensuels</CardTitle>
    <Input type="month" value={selectedMonth} onChange={...} />
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>...</TableHeader>
      <TableBody>
        {salaires.map(salaire => (
          <TableRow key={salaire.id}>
            <TableCell>{salaire.profiles.prenom} {salaire.profiles.nom}</TableCell>
            <TableCell>
              {editingId === salaire.id ? (
                <Input type="number" value={editValues.salaire_brut} onChange={...} />
              ) : (
                formatCurrency(salaire.salaire_brut)
              )}
            </TableCell>
            {/* ... autres colonnes */}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

#### Édition inline

```typescript
const handleEdit = (salaire: RHSalaire) => {
  setEditingId(salaire.id);
  setEditValues({
    salaire_brut: salaire.salaire_brut,
    primes: salaire.primes || 0,
    heures_supplementaires: salaire.heures_supplementaires || 0,
  });
};

const handleSave = async (id: string) => {
  const brut = parseFloat(editValues.salaire_brut);
  const cotisationsSalariales = brut * 0.23;
  const cotisationsPatronales = brut * 0.45;
  const salaireNet = brut - cotisationsSalariales + (editValues.primes || 0) + (editValues.heures_supplementaires || 0);

  await updateSalaire({
    id,
    salaire_brut: brut,
    salaire_net: salaireNet,
    cotisations_salariales: cotisationsSalariales,
    cotisations_patronales: cotisationsPatronales,
    primes: editValues.primes > 0 ? editValues.primes : undefined,
    heures_supplementaires: editValues.heures_supplementaires > 0 ? editValues.heures_supplementaires : undefined,
  });

  setEditingId(null);
  setEditValues({});
};
```

---

### 2. `RHDashboard`

**Chemin** : `src/components/rh/RHDashboard.tsx`

**Responsabilité** : Afficher les KPIs et widgets.

#### Structure

```tsx
<div className="space-y-6">
  {/* KPIs */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <Card>
      <CardHeader>
        <CardTitle>Effectif actif</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{kpis.effectif_total}</p>
      </CardContent>
    </Card>
    {/* ... 3 autres KPI cards */}
  </div>

  {/* Widgets */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <RHTresorerieWidget />
    <RHReconciliation />
  </div>
</div>
```

#### États de chargement

```typescript
if (isLoading) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-10 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## ⚙️ Logique métier

### Calcul automatique des salaires

**Fichier** : `src/lib/rh/calculateSalary.ts`

```typescript
export interface SalaireCalcul {
  brut: number;
  net: number;
  cotisationsPatronales: number;
  cotisationsSalariales: number;
  primes: number;
  heuresSupp: number;
  totalCout: number; // Coût total employeur
}

export function calculateSalaire(
  salaireBrut: number,
  primes: number = 0,
  heuresSupp: number = 0
): SalaireCalcul {
  // Cotisations patronales : 45% du brut
  const cotisationsPatronales = Math.round(salaireBrut * 0.45 * 100) / 100;
  
  // Cotisations salariales : 24% du brut
  const cotisationsSalariales = Math.round(salaireBrut * 0.24 * 100) / 100;
  
  // Salaire net
  const net = Math.round((salaireBrut - cotisationsSalariales + primes + heuresSupp) * 100) / 100;
  
  // Coût total pour l'employeur
  const totalCout = Math.round((salaireBrut + cotisationsPatronales + primes + heuresSupp) * 100) / 100;
  
  return {
    brut: salaireBrut,
    net,
    cotisationsPatronales,
    cotisationsSalariales,
    primes,
    heuresSupp,
    totalCout,
  };
}
```

**Utilisation** :

```typescript
const salaire = calculateSalaire(4200, 200, 150);
console.log(salaire);
// {
//   brut: 4200,
//   net: 3542,
//   cotisationsPatronales: 1890,
//   cotisationsSalariales: 1008,
//   primes: 200,
//   heuresSupp: 150,
//   totalCout: 6440
// }
```

---

## 🔗 Intégration Trésorerie

### Synchronisation automatique

**Trigger PostgreSQL** : défini initialement dans `supabase/migrations/00000000000000_initial_schema.sql` (fonction `sync_rh_to_tresorerie`, itérée dans les migrations `20251122121412_*` et `20251122121912_*`).

```sql
CREATE OR REPLACE FUNCTION sync_rh_to_tresorerie()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_nom TEXT;
  v_categorie_id UUID;
BEGIN
  -- Récupérer le nom de l'employé
  SELECT nom INTO v_profile_nom FROM profiles WHERE id = NEW.profile_id;
  
  -- Récupérer l'ID de la catégorie "Salaires nets"
  SELECT id INTO v_categorie_id 
  FROM tresorerie_categories 
  WHERE code = 'DEP_SALAIRES_NETS' 
  LIMIT 1;
  
  -- Créer ou mettre à jour la dépense dans trésorerie
  INSERT INTO tresorerie_depenses (
    nom, 
    montant, 
    date_prevue, 
    categorie_id, 
    est_recurrent, 
    source, 
    source_id
  )
  VALUES (
    'Salaire ' || v_profile_nom,
    NEW.salaire_net,
    NEW.mois,
    v_categorie_id,
    TRUE,
    'rh_salaires',
    NEW.id::TEXT
  )
  ON CONFLICT (source_id, source) 
  DO UPDATE SET 
    montant = EXCLUDED.montant,
    date_prevue = EXCLUDED.date_prevue,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Attacher le trigger
CREATE TRIGGER trigger_sync_rh_to_tresorerie
  AFTER INSERT OR UPDATE ON rh_salaires_mensuels
  FOR EACH ROW
  EXECUTE FUNCTION sync_rh_to_tresorerie();
```

**Avantages** :
- ✅ Synchronisation en temps réel
- ✅ Pas de code côté client
- ✅ Garantie de cohérence des données

---

### Composant de réconciliation

**Fichier** : `src/components/rh/RHReconciliation.tsx`

```typescript
export function RHReconciliation() {
  const { data: ecarts, isLoading } = useQuery({
    queryKey: ['rh-reconciliation'],
    queryFn: async () => {
      // Compter les salaires RH
      const { count: nbSalaires } = await supabase
        .from('rh_salaires_mensuels')
        .select('*', { count: 'exact', head: true });

      // Compter les dépenses sync
      const { count: nbDepenses } = await supabase
        .from('tresorerie_depenses')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'rh_salaires');

      return {
        total_salaires: nbSalaires || 0,
        total_depenses: nbDepenses || 0,
        ecart: (nbSalaires || 0) - (nbDepenses || 0),
        statut: nbSalaires === nbDepenses ? 'sync' : 'ecart',
      };
    },
    staleTime: 1 * 60 * 1000, // Cache 1 minute
  });

  const handleSync = async () => {
    toast.info("Synchronisation en cours...");
    
    const { data, error } = await supabase.functions.invoke('generate-recurring-expenses', {
      body: { force: true }
    });
    
    if (error) {
      toast.error(`Erreur: ${error.message}`);
    } else {
      toast.success(`✓ ${data?.depenses_created || 0} dépenses synchronisées`);
      queryClient.invalidateQueries({ queryKey: ['rh-reconciliation'] });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réconciliation RH ↔ Trésorerie</CardTitle>
      </CardHeader>
      <CardContent>
        {ecarts?.statut === 'sync' ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span>Synchronisé ({ecarts.total_salaires} salaires)</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              <span>Écart détecté : {ecarts?.ecart} lignes</span>
            </div>
            <Button onClick={handleSync} size="sm">
              Synchroniser maintenant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## ⚡ Optimisations

### 1. Optimistic updates

Déjà implémenté dans `useRHSalaires` (voir section Hooks).

**Gain de performance** :
- Interface réactive en **< 50ms**
- Pas de rechargement visible
- Rollback en cas d'erreur réseau

---

### 2. Cache React Query

**Configuration globale** : `src/lib/queryClient.ts`

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes par défaut
      gcTime: 10 * 60 * 1000, // Garde en cache 10 minutes
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

**Configuration par hook** :

```typescript
// Données critiques : cache court
useQuery({
  queryKey: ['rh-salaires', mois],
  staleTime: 1 * 60 * 1000, // 1 minute
  refetchOnMount: true,
});

// Données statiques : cache long
useQuery({
  queryKey: ['rh-kpis'],
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnMount: false,
});
```

---

### 3. Virtualisation des longs tableaux (à venir)

**Problème** : Avec 100+ lignes de salaires, le DOM devient lourd.

**Solution** : `@tanstack/react-virtual`

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);

const rowVirtualizer = useVirtualizer({
  count: salaires.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 60, // Hauteur estimée d'une ligne
});

return (
  <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
    <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const salaire = salaires[virtualRow.index];
        return (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <TableRow>{/* Contenu */}</TableRow>
          </div>
        );
      })}
    </div>
  </div>
);
```

**Gains** :
- ✅ Rendu de 10-20 lignes visibles seulement
- ✅ Performance constante même avec 1000+ lignes
- ✅ Scroll fluide

---

## 🔒 Sécurité

### Row Level Security (RLS)

#### 1. Salaires

```sql
-- Policy: Admins voient tout
CREATE POLICY "rh_salaires_admin_all"
ON rh_salaires_mensuels
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
  )
);

-- Policy: Employés voient leur propre salaire
CREATE POLICY "rh_salaires_employee_own"
ON rh_salaires_mensuels
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
);

-- Policy: Managers RH ont accès lecture seule
CREATE POLICY "rh_salaires_manager_read"
ON rh_salaires_mensuels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager_rh')
  )
);
```

#### 2. Objectifs CA

```sql
-- Policy: Admins et Managers peuvent gérer
CREATE POLICY "rh_objectifs_admin_manager_all"
ON rh_objectifs_ca
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager_rh', 'csm')
  )
);

-- Policy: Employés voient leurs propres objectifs
CREATE POLICY "rh_objectifs_employee_own"
ON rh_objectifs_ca
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
);
```

#### 3. Absences

```sql
-- Policy: Admins et Managers gèrent tout
CREATE POLICY "rh_absences_admin_manager_all"
ON rh_absences
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager_rh')
  )
);

-- Policy: Employés créent et voient leurs propres absences
CREATE POLICY "rh_absences_employee_own"
ON rh_absences
FOR ALL
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
);
```

---

### Validation des données

**Côté client** : Zod schemas

```typescript
import { z } from 'zod';

export const salaireSchema = z.object({
  profile_id: z.string().uuid(),
  mois: z.string().regex(/^\d{4}-\d{2}-01$/), // Format: YYYY-MM-01
  salaire_brut: z.number().positive().max(1000000), // Max 1M€
  primes: z.number().min(0).optional(),
  heures_supplementaires: z.number().min(0).optional(),
});

// Utilisation
const handleCreate = async (data: unknown) => {
  const validated = salaireSchema.parse(data); // Throws si invalide
  await createSalaire(validated);
};
```

**Côté serveur** : Check constraints SQL

```sql
ALTER TABLE rh_salaires_mensuels
  ADD CONSTRAINT salaire_brut_positif CHECK (salaire_brut > 0),
  ADD CONSTRAINT salaire_net_positif CHECK (salaire_net > 0),
  ADD CONSTRAINT cotisations_coherentes CHECK (cotisations_salariales < salaire_brut);
```

---

## 🧪 Tests

### Tests unitaires (Vitest)

**Fichier** : `src/lib/rh/calculateSalary.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateSalaire } from './calculateSalary';

describe('calculateSalaire', () => {
  it('calcule correctement un salaire basique', () => {
    const result = calculateSalaire(4200, 0, 0);
    
    expect(result.brut).toBe(4200);
    expect(result.cotisationsPatronales).toBe(1890); // 45%
    expect(result.cotisationsSalariales).toBe(1008); // 24%
    expect(result.net).toBe(3192); // 4200 - 1008
    expect(result.totalCout).toBe(6090); // 4200 + 1890
  });

  it('ajoute les primes au net', () => {
    const result = calculateSalaire(4200, 200, 0);
    
    expect(result.net).toBe(3392); // 3192 + 200
  });

  it('arrondit correctement les centimes', () => {
    const result = calculateSalaire(4123.45, 0, 0);
    
    expect(result.cotisationsPatronales).toBe(1855.55);
    expect(result.cotisationsSalariales).toBe(989.63);
    expect(result.net).toBe(3133.82);
  });
});
```

**Exécution** :

```bash
npm run test
```

---

### Tests d'intégration (Playwright)

**Fichier** : `e2e/rh/salaires.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Module RH - Salaires', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Naviguer vers RH
    await page.goto('/rh');
    await page.click('text=Salaires');
  });

  test('affiche le tableau des salaires', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCountGreaterThan(0);
  });

  test('édite un salaire inline', async ({ page }) => {
    // Double-cliquer sur le champ "Salaire brut"
    await page.locator('table tbody tr:first-child td:nth-child(2)').dblclick();
    
    // Champ devient éditable
    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible();
    
    // Modifier la valeur
    await input.fill('4500');
    await input.press('Enter');
    
    // Toast de confirmation
    await expect(page.locator('text=Salaire mis à jour')).toBeVisible();
  });

  test('crée un nouveau salaire', async ({ page }) => {
    await page.click('text=Ajouter un salaire');
    
    // Remplir le formulaire
    await page.selectOption('select[name="profile_id"]', { index: 1 });
    await page.fill('input[name="mois"]', '2025-03');
    await page.fill('input[name="salaire_brut"]', '4200');
    
    // Les cotisations doivent se calculer automatiquement
    await expect(page.locator('text=1,890.00€')).toBeVisible(); // Patronales
    await expect(page.locator('text=1,008.00€')).toBeVisible(); // Salariales
    
    await page.click('button:has-text("Créer")');
    
    // Toast + mise à jour du tableau
    await expect(page.locator('text=Salaire créé avec succès')).toBeVisible();
  });
});
```

**Exécution** :

```bash
npx playwright test
```

---

## 🚀 Déploiement

### Variables d'environnement

**Fichier** : `.env.production`

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

**⚠️ Sécurité** :
- Ne jamais commiter `.env` dans Git
- Utiliser des variables d'environnement sécurisées (Vercel, Netlify, etc.)

---

### Build de production

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer les tests
npm run test

# 3. Build de production
npm run build

# 4. Vérifier le bundle
npm run preview
```

**Optimisations Vite** :

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'tanstack-vendor': ['@tanstack/react-query', '@tanstack/react-virtual'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-tooltip'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
```

---

### Migrations Supabase

**Commande** :

```bash
supabase db push
```

**Ordre des migrations** :

1. `001_create_rh_tables.sql` - Création des tables
2. `002_create_rh_policies.sql` - Politiques RLS
3. `003_create_rh_triggers.sql` - Triggers de synchronisation
4. `004_create_rh_indexes.sql` - Index pour performances

**Rollback** :

```bash
supabase db reset --db-url <DATABASE_URL>
```

---

## 📞 Support technique

**Contact** : dev@votre-entreprise.com

**Documentation Supabase** : https://supabase.com/docs

**Documentation TanStack Query** : https://tanstack.com/query/latest

---

**© 2025 - Équipe technique - Tous droits réservés**
