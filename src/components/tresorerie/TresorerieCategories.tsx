import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2, FolderTree, Tag } from "lucide-react";
import { DragEndEvent } from '@dnd-kit/core';

import {
  CategoryTree,
  QONTO_CATEGORIES,
  sanitizeCode,
  type TresorerieCategory,
} from './tresorerieCategoryTree';
import { supabase } from "@/integrations/supabase/client";

export function TresorerieCategories() {
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<TresorerieCategory | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [addChildParent, setAddChildParent] = useState<TresorerieCategory | null>(null);
  const [childName, setChildName] = useState('');
  const [newCategory, setNewCategory] = useState({
    code: '',
    nom: '',
    type: 'depense',
    couleur: '#3b82f6',
    parent_id: null as string | null,
    actif: true,
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['tresorerie-categories-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_categories')
        .select('id, code, nom, type, niveau, parent_id, couleur, icone, ordre, actif, est_calculee, formule_calcul, created_at')
        .order('type')
        .order('niveau')
        .order('ordre');
      if (error) throw error;
      return (data || []) as TresorerieCategory[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (category: typeof newCategory) => {
      const { error } = await supabase
        .from('tresorerie_categories')
        .insert({
          code: category.code.toUpperCase(),
          nom: category.nom,
          type: category.type,
          couleur: category.couleur,
          parent_id: category.parent_id,
          actif: category.actif,
          niveau: category.parent_id ? 2 : 1,
          ordre: (categories?.length || 0) + 1,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Catégorie créée');
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories-full'] });
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories'] });
      setIsCreateDialogOpen(false);
      setNewCategory({ code: '', nom: '', type: 'depense', couleur: '#3b82f6', parent_id: null, actif: true });
    },
    onError: (error) => {
      toast.error('Erreur création', { description: sanitizeSupabaseError(error) });
    }
  });

  const createChildMutation = useMutation({
    mutationFn: async ({ parent, nom }: { parent: TresorerieCategory; nom: string }) => {
      const siblings = categories?.filter(c => c.parent_id === parent.id) || [];
      const code = `${parent.code}_${sanitizeCode(nom)}`;
      const { error } = await supabase
        .from('tresorerie_categories')
        .insert({
          code,
          nom,
          type: parent.type,
          couleur: parent.couleur,
          parent_id: parent.id,
          actif: true,
          niveau: parent.niveau + 1,
          ordre: siblings.length + 1,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sous-catégorie créée');
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories-full'] });
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories'] });
      setAddChildParent(null);
      setChildName('');
    },
    onError: (error) => {
      toast.error('Erreur création', { description: sanitizeSupabaseError(error) });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (category: TresorerieCategory) => {
      const { error } = await supabase
        .from('tresorerie_categories')
        .update({
          nom: category.nom,
          couleur: category.couleur,
          actif: category.actif,
        })
        .eq('id', category.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Catégorie mise à jour');
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories-full'] });
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories'] });
      setEditingCategory(null);
    },
    onError: (error) => {
      toast.error('Erreur mise à jour', { description: sanitizeSupabaseError(error) });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tresorerie_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Catégorie supprimée');
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories-full'] });
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories'] });
    },
    onError: (error) => {
      toast.error('Erreur suppression', { description: sanitizeSupabaseError(error) });
    }
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; parent_id: string | null; ordre: number; niveau: number }[]) => {
      await Promise.all(
        updates.map(u =>
          supabase
            .from('tresorerie_categories')
            .update({ parent_id: u.parent_id, ordre: u.ordre, niveau: u.niveau })
            .eq('id', u.id)
            .then(({ error }) => { if (error) throw error; })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories-full'] });
      queryClient.invalidateQueries({ queryKey: ['tresorerie-categories'] });
    },
    onError: (error) => {
      toast.error('Erreur déplacement', { description: sanitizeSupabaseError(error) });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !categories) return;

    const draggedId = active.id as string;
    const overId = over.id as string;
    const draggedCat = categories.find(c => c.id === draggedId);
    const overCat = categories.find(c => c.id === overId);
    if (!draggedCat || !overCat) return;

    // Prevent dropping a parent into its own descendants
    const isDescendant = (parentId: string, childId: string): boolean => {
      const child = categories.find(c => c.id === childId);
      if (!child?.parent_id) return false;
      if (child.parent_id === parentId) return true;
      return isDescendant(parentId, child.parent_id);
    };
    if (isDescendant(draggedId, overId)) return;

    const targetParentId = overCat.parent_id;
    const newNiveau = targetParentId
      ? (categories.find(c => c.id === targetParentId)?.niveau ?? 0) + 1
      : overCat.niveau === 0 ? 0 : overCat.niveau;

    // Get siblings in the target group (excluding dragged item)
    const isRoot = (c: TresorerieCategory) => !c.parent_id || !categories.some(p => p.id === c.parent_id);
    const targetSiblings = categories
      .filter(c => {
        if (c.id === draggedId) return false;
        if (targetParentId === null) return isRoot(c);
        return c.parent_id === targetParentId;
      })
      .sort((a, b) => a.ordre - b.ordre);

    // Find index of overCat in siblings, insert dragged item at that position
    const overIndex = targetSiblings.findIndex(c => c.id === overId);
    const newSiblings = [...targetSiblings];
    if (overIndex >= 0) {
      newSiblings.splice(overIndex, 0, draggedCat);
    } else {
      newSiblings.push(draggedCat);
    }

    // Build batch updates: reassign sequential ordre for all siblings
    const updates: { id: string; parent_id: string | null; ordre: number; niveau: number }[] = [];

    // Helper to recalculate niveau for descendants
    const recalcNiveau = (catId: string, parentNiveau: number) => {
      const children = categories.filter(c => c.parent_id === catId);
      for (const child of children) {
        updates.push({ id: child.id, parent_id: child.parent_id, ordre: child.ordre, niveau: parentNiveau + 1 });
        recalcNiveau(child.id, parentNiveau + 1);
      }
    };

    for (let i = 0; i < newSiblings.length; i++) {
      const s = newSiblings[i];
      const isMovedItem = s.id === draggedId;
      const parentId = isMovedItem ? targetParentId : s.parent_id;
      const niveau = isMovedItem ? newNiveau : s.niveau;
      if (s.ordre !== i + 1 || isMovedItem) {
        updates.push({ id: s.id, parent_id: parentId, ordre: i + 1, niveau });
      }
      // If moved item changed parent, recalculate children niveaux
      if (isMovedItem && draggedCat.parent_id !== targetParentId) {
        recalcNiveau(draggedId, newNiveau);
      }
    }

    // Also reorder old siblings if parent changed
    if (draggedCat.parent_id !== targetParentId) {
      const oldSiblings = categories
        .filter(c => c.id !== draggedId && c.parent_id === draggedCat.parent_id)
        .sort((a, b) => a.ordre - b.ordre);
      for (let i = 0; i < oldSiblings.length; i++) {
        if (oldSiblings[i].ordre !== i + 1) {
          updates.push({ id: oldSiblings[i].id, parent_id: oldSiblings[i].parent_id, ordre: i + 1, niveau: oldSiblings[i].niveau });
        }
      }
    }

    if (updates.length > 0) {
      reorderMutation.mutate(updates);
    }
  };

  const depenseCategories = categories?.filter(c => c.type === 'depense') || [];
  const revenuCategories = categories?.filter(c => c.type === 'recette') || [];

  const parentCategories = categories?.filter(c => c.niveau === 0 || c.niveau === 1) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Gestion des catégories</h2>
          <p className="text-muted-foreground">Configurez les catégories de revenus et dépenses</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle catégorie
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une catégorie</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input 
                  placeholder="DEP_NOUVEAU ou REV_NOUVEAU"
                  value={newCategory.code}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input 
                  placeholder="Nom de la catégorie"
                  value={newCategory.nom}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, nom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newCategory.type} onValueChange={(v) => setNewCategory(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="depense">Dépense</SelectItem>
                    <SelectItem value="revenu">Revenu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Catégorie parente (optionnel)</Label>
                <Select 
                  value={newCategory.parent_id || 'none'} 
                  onValueChange={(v) => setNewCategory(prev => ({ ...prev, parent_id: v === 'none' ? null : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune (catégorie racine)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune (catégorie racine)</SelectItem>
                    {parentCategories.filter(p => p.type === newCategory.type).map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="color"
                    className="w-16 h-10 p-1"
                    value={newCategory.couleur}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, couleur: e.target.value }))}
                  />
                  <span className="text-sm text-muted-foreground">{newCategory.couleur}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={newCategory.actif}
                  onCheckedChange={(v) => setNewCategory(prev => ({ ...prev, actif: v }))}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button onClick={() => createMutation.mutate(newCategory)} disabled={!newCategory.code || !newCategory.nom}>
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mapping Qonto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Mapping Qonto → Catégories internes
          </CardTitle>
          <CardDescription>
            Correspondance automatique lors de la synchronisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3">
            {QONTO_CATEGORIES.map(qc => {
              const mappedCode = getMappedCode(qc.value);
              const mappedCategory = categories?.find(c => c.code === mappedCode);
              return (
                <div key={qc.value} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{qc.label}</span>
                  <Badge variant="outline" style={{ borderColor: mappedCategory?.couleur || undefined }}>
                    {mappedCategory?.nom || mappedCode || 'Non mappé'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dépenses - Vue arborescente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-destructive" />
            Catégories de dépenses ({depenseCategories.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CategoryTree 
            categories={depenseCategories} 
            onEdit={setEditingCategory}
            onDelete={(id) => deleteMutation.mutate(id)}
            onAddChild={(parent) => { setAddChildParent(parent); setChildName(''); }}
            onDragEnd={handleDragEnd}
          />
        </CardContent>
      </Card>

      {/* Revenus - Vue arborescente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-success" />
            Catégories de revenus ({revenuCategories.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {revenuCategories.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune catégorie de revenu</p>
          ) : (
            <CategoryTree 
              categories={revenuCategories} 
              onEdit={setEditingCategory}
              onDelete={(id) => deleteMutation.mutate(id)}
              onAddChild={(parent) => { setAddChildParent(parent); setChildName(''); }}
              onDragEnd={handleDragEnd}
            />
          )}
        </CardContent>
      </Card>

      {/* Add Child Dialog */}
      <Dialog open={!!addChildParent} onOpenChange={(open) => { if (!open) { setAddChildParent(null); setChildName(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une sous-catégorie</DialogTitle>
          </DialogHeader>
          {addChildParent && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Sous-catégorie de <strong>{addChildParent.nom}</strong>
              </p>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input 
                  placeholder="Nom de la sous-catégorie"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && childName.trim()) {
                      createChildMutation.mutate({ parent: addChildParent, nom: childName.trim() });
                    }
                  }}
                />
              </div>
              {childName.trim() && (
                <p className="text-xs text-muted-foreground">
                  Code : <code className="bg-muted px-1 rounded">{addChildParent.code}_{sanitizeCode(childName)}</code>
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button 
              onClick={() => addChildParent && childName.trim() && createChildMutation.mutate({ parent: addChildParent, nom: childName.trim() })}
              disabled={!childName.trim() || createChildMutation.isPending}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la catégorie</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Code (non modifiable)</Label>
                <Input value={editingCategory.code} disabled />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input 
                  value={editingCategory.nom}
                  onChange={(e) => setEditingCategory(prev => prev ? { ...prev, nom: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="color"
                    className="w-16 h-10 p-1"
                    value={editingCategory.couleur || '#3b82f6'}
                    onChange={(e) => setEditingCategory(prev => prev ? { ...prev, couleur: e.target.value } : null)}
                  />
                  <span className="text-sm text-muted-foreground">{editingCategory.couleur}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={editingCategory.actif}
                  onCheckedChange={(v) => setEditingCategory(prev => prev ? { ...prev, actif: v } : null)}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={() => editingCategory && updateMutation.mutate(editingCategory)}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper pour obtenir le code mappé depuis une catégorie Qonto
function getMappedCode(qontoCategory: string): string | null {
  const mapping: Record<string, string> = {
    'office_rental': 'DEP_LOYER',
    'office_supplies': 'DEP_FOURNITURES',
    'software': 'DEP_LOGICIELS',
    'insurance': 'DEP_ASSURANCES',
    'telecom': 'DEP_TELECOM',
    'meal': 'DEP_REPAS',
    'bank_fee': 'DEP_FRAIS_BANCAIRES',
    'tax': 'DEP_TVA',
    'transport': 'DEP_DEPLACEMENT',
    'marketing': 'DEP_MARKETING',
    'salary': 'DEP_SALAIRES_NETS',
    'social_contribution': 'DEP_URSSAF',
    'utility': 'DEP_FOURNITURES',
    'subscription': 'DEP_LOGICIELS',
    'professional_services': 'DEP_FRAIS_JURIDIQUES',
    'education': 'DEP_FORMATION',
    'entertainment': 'DEP_DIVERS',
  };
  return mapping[qontoCategory] || null;
}
