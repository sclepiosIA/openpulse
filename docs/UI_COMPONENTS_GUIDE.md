# Guide des Composants UI - OpenPulse

Ce document documente les composants UI personnalisés basés sur shadcn/ui utilisés dans le projet.

## Table des Matières

1. [Design System](#design-system)
2. [Composants de Base](#composants-de-base)
3. [Composants de Formulaire](#composants-de-formulaire)
4. [Composants de Navigation](#composants-de-navigation)
5. [Composants de Données](#composants-de-données)
6. [Composants Métier](#composants-métier)
7. [Patterns et Conventions](#patterns-et-conventions)

---

## Design System

### Tokens CSS

Le projet utilise des tokens CSS sémantiques définis dans `index.css` :

```css
:root {
  --background: 210 25% 98%;
  --foreground: 222 47% 11%;
  --primary: 213 100% 36%;
  --primary-foreground: 0 0% 100%;
  --secondary: 210 20% 96%;
  --muted: 210 20% 94%;
  --accent: 45 93% 47%;
  --destructive: 0 84% 60%;
}

.dark {
  --background: 222 47% 8%;
  --foreground: 210 25% 98%;
  /* ... */
}
```

### Classes Tailwind Personnalisées

```css
/* Gradients */
.bg-gradient-primary { 
  @apply bg-gradient-to-r from-primary to-primary/80; 
}

/* Shadows */
.shadow-card { 
  @apply shadow-lg shadow-primary/5; 
}

/* Animations */
.animate-fade-in { 
  animation: fade-in 0.3s ease-out; 
}
```

---

## Composants de Base

### Button

**Chemin** : `src/components/ui/button.tsx`

**Variantes disponibles** :

| Variante | Description | Usage |
|----------|-------------|-------|
| `default` | Bouton principal bleu | Actions principales |
| `destructive` | Rouge pour suppression | Actions destructives |
| `outline` | Bordure sans fond | Actions secondaires |
| `secondary` | Gris neutre | Actions tertiaires |
| `ghost` | Transparent | Navigation, icônes |
| `link` | Style lien | Navigation textuelle |

**Tailles** :

| Taille | Dimensions | Usage |
|--------|------------|-------|
| `sm` | h-8, px-3 | Tableaux, listes |
| `default` | h-10, px-4 | Standard |
| `lg` | h-12, px-8 | CTAs principaux |
| `icon` | h-10, w-10 | Boutons icône seule |

**Exemple** :

```tsx
import { Button } from "@/components/ui/button";

// Bouton principal
<Button onClick={handleSubmit}>Enregistrer</Button>

// Bouton destructif avec icône
<Button variant="destructive" size="sm">
  <Trash className="mr-2 h-4 w-4" />
  Supprimer
</Button>

// Bouton loading
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Enregistrer
</Button>
```

---

### Card

**Chemin** : `src/components/ui/card.tsx`

**Sous-composants** :
- `Card` - Container principal
- `CardHeader` - En-tête avec titre
- `CardTitle` - Titre
- `CardDescription` - Description
- `CardContent` - Contenu
- `CardFooter` - Pied de carte

**Exemple** :

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Statistiques</CardTitle>
    <CardDescription>Aperçu du mois en cours</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenu */}
  </CardContent>
</Card>
```

---

### Badge

**Chemin** : `src/components/ui/badge.tsx`

**Variantes** :

| Variante | Couleur | Usage |
|----------|---------|-------|
| `default` | Primary | Standard |
| `secondary` | Gris | Métadonnées |
| `destructive` | Rouge | Erreurs, alertes |
| `outline` | Bordure | Filtres actifs |

**Variantes Métier Personnalisées** (dans `StatusBadge.tsx`) :

```tsx
// Statuts établissements
<StatusBadge status="Contractuel" />  // Vert
<StatusBadge status="Prospect" />     // Bleu
<StatusBadge status="Production" />   // Violet

// Priorités
<PriorityBadge priority="haute" />    // Rouge
<PriorityBadge priority="moyenne" />  // Orange
<PriorityBadge priority="basse" />    // Vert
```

---

### Dialog

**Chemin** : `src/components/ui/dialog.tsx`

**IMPORTANT** : Toujours inclure `aria-describedby` pour l'accessibilité.

**Exemple** :

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Ouvrir</Button>
  </DialogTrigger>
  <DialogContent aria-describedby="dialog-description">
    <DialogHeader>
      <DialogTitle>Titre du Dialog</DialogTitle>
      <DialogDescription id="dialog-description">
        Description pour l'accessibilité
      </DialogDescription>
    </DialogHeader>
    {/* Contenu */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Annuler
      </Button>
      <Button onClick={handleSubmit}>Confirmer</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Sheet (Drawer)

**Chemin** : `src/components/ui/sheet.tsx`

Utilisé pour les panneaux latéraux (navigation mobile, détails).

**Exemple** :

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" className="w-[400px]">
    <SheetHeader>
      <SheetTitle>Détails</SheetTitle>
    </SheetHeader>
    {/* Contenu */}
  </SheetContent>
</Sheet>
```

---

## Composants de Formulaire

### Input

**Chemin** : `src/components/ui/input.tsx`

```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="exemple@email.com"
    {...register("email")}
  />
  {errors.email && (
    <p className="text-sm text-destructive">{errors.email.message}</p>
  )}
</div>
```

---

### Select

**Chemin** : `src/components/ui/select.tsx`

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

<Select value={value} onValueChange={onChange}>
  <SelectTrigger>
    <SelectValue placeholder="Sélectionner..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

---

### Combobox (Autocomplete)

**Chemin** : `src/components/ui/combobox.tsx`

Composant combinant input + dropdown avec recherche.

**⚠️ Contrainte de Performance** : Debounce de 300ms obligatoire sur la recherche.

```tsx
import { Combobox } from "@/components/ui/combobox";

<Combobox
  options={options}
  value={selectedValue}
  onChange={setSelectedValue}
  placeholder="Rechercher..."
  searchPlaceholder="Taper pour rechercher..."
  emptyMessage="Aucun résultat"
  debounceMs={300} // OBLIGATOIRE
/>
```

---

### DatePicker

**Chemin** : `src/components/ui/date-picker.tsx`

```tsx
import { DatePicker } from "@/components/ui/date-picker";

<DatePicker
  date={selectedDate}
  onSelect={setSelectedDate}
  placeholder="Sélectionner une date"
/>
```

---

### Textarea

**Chemin** : `src/components/ui/textarea.tsx`

```tsx
import { Textarea } from "@/components/ui/textarea";

<Textarea
  placeholder="Saisissez votre message..."
  rows={4}
  {...register("message")}
/>
```

---

### Switch

**Chemin** : `src/components/ui/switch.tsx`

```tsx
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

<div className="flex items-center space-x-2">
  <Switch
    id="notifications"
    checked={enabled}
    onCheckedChange={setEnabled}
  />
  <Label htmlFor="notifications">Activer les notifications</Label>
</div>
```

---

## Composants de Navigation

### Tabs

**Chemin** : `src/components/ui/tabs.tsx`

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs defaultValue="overview" className="w-full">
  <TabsList>
    <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
    <TabsTrigger value="details">Détails</TabsTrigger>
    <TabsTrigger value="settings">Paramètres</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    {/* Contenu overview */}
  </TabsContent>
  <TabsContent value="details">
    {/* Contenu details */}
  </TabsContent>
</Tabs>
```

---

### Breadcrumb

**Chemin** : `src/components/ui/breadcrumb.tsx`

```tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Accueil</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/etablissements">Établissements</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>CHU Paris</BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

---

### Sidebar

**Chemin** : `src/components/layout/Sidebar.tsx`

Navigation principale de l'application.

**Sections** :
- Dashboard
- CRM (Établissements, Prospects, Pipeline)
- Communication (Emails, Pulse)
- Opérations (Tâches, Formations)
- Finance (Trésorerie, Facturation)
- RH (People)
- R&D
- Paramètres

---

## Composants de Données

### Table (DataTable)

**Chemin** : `src/components/ui/table.tsx` + `src/components/ui/data-table.tsx`

Tableau avec tri, pagination et actions.

```tsx
import { DataTable } from "@/components/ui/data-table";

<DataTable
  columns={columns}
  data={data}
  searchKey="nom"
  searchPlaceholder="Rechercher..."
/>
```

---

### Skeleton

**Chemin** : `src/components/ui/skeleton.tsx`

États de chargement.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton de texte
<Skeleton className="h-4 w-[250px]" />

// Skeleton de carte
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-[200px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-20 w-full" />
  </CardContent>
</Card>
```

---

### Empty State

**Chemin** : `src/components/ui/empty-state.tsx`

```tsx
import { EmptyState } from "@/components/ui/empty-state";

<EmptyState
  icon={FileX}
  title="Aucun résultat"
  description="Aucun établissement ne correspond à vos critères"
  action={
    <Button onClick={resetFilters}>Réinitialiser les filtres</Button>
  }
/>
```

---

## Composants Métier

### EmailComposer

**Chemin** : `src/components/email/EmailComposer.tsx`

Composant de rédaction d'emails avec :
- Éditeur TipTap
- Autocomplete destinataires (debounce 300ms)
- Pièces jointes
- Actions IA (correction, reformulation)

---

### TaskCard

**Chemin** : `src/components/taches/TaskCard.tsx`

Carte de tâche avec :
- Drag & drop
- Indicateur de priorité
- Badge de catégorie
- Actions rapides

---

### EtablissementCard

**Chemin** : `src/components/etablissement/EtablissementCard.tsx`

Carte d'établissement avec :
- Logo groupe
- Status badge
- Progress bar
- Contacts rapides

---

## Patterns et Conventions

### Accessibilité

1. **Labels** : Toujours associer un `<Label>` à chaque input
2. **ARIA** : Utiliser `aria-label` pour les boutons icône seule
3. **Focus** : Maintenir un ordre de focus logique
4. **Dialogs** : Toujours inclure `aria-describedby`

### Responsive

- Mobile first avec breakpoints Tailwind
- `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)
- Utiliser `Sheet` au lieu de `Dialog` sur mobile

### Performance

- Lazy loading avec `React.lazy()` pour les composants volumineux
- Debounce 300ms sur les inputs de recherche
- Virtualization pour les longues listes (`@tanstack/react-virtual`)

### Theming

- Utiliser les tokens CSS (`bg-background`, `text-foreground`)
- Jamais de couleurs hardcodées (`bg-blue-500` ❌)
- Support dark mode automatique

---

## Référence Rapide

| Composant | Import |
|-----------|--------|
| Button | `@/components/ui/button` |
| Card | `@/components/ui/card` |
| Dialog | `@/components/ui/dialog` |
| Sheet | `@/components/ui/sheet` |
| Input | `@/components/ui/input` |
| Select | `@/components/ui/select` |
| Table | `@/components/ui/table` |
| Tabs | `@/components/ui/tabs` |
| Badge | `@/components/ui/badge` |
| Toast | `sonner` |
