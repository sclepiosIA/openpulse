import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  ChevronDown,
  Plus,
  Star,
  Trash2,
  Users,
  User as UserIcon,
  Check,
  Save,
} from 'lucide-react';
import { useEntityViews, type EntityView, type EntityViewFilter, type EntityViewSort, type EntityViewType } from '@/hooks/views/useEntityViews';
import { useToast } from '@/hooks/shared/use-toast';
import { cn } from '@/lib/utils';

export interface ViewSwitcherProps {
  entity: string;
  /** État courant des filtres / tri / colonnes / type (pour création / mise à jour) */
  currentState: {
    filters: EntityViewFilter[];
    sort: EntityViewSort[];
    columns: string[];
    view_type: EntityViewType;
  };
  /** ID de la vue active (controlled). Si null => "Toutes" (état brut sans vue). */
  activeViewId: string | null;
  /** Callback quand l'utilisateur clique sur une vue : on doit appliquer ses filtres/sort/columns. */
  onApplyView: (view: EntityView | null) => void;
  className?: string;
}

/**
 * Sélecteur de vues sauvegardées (inspiration Twenty CRM).
 *
 * Permet à l'utilisateur de basculer entre ses vues, en créer de nouvelles
 * à partir de l'état courant, mettre à jour la vue active, supprimer,
 * partager avec l'équipe et définir une vue par défaut.
 */
export function ViewSwitcher({
  entity,
  currentState,
  activeViewId,
  onApplyView,
  className,
}: ViewSwitcherProps) {
  const { ownViews, sharedViews, views, createView, updateView, deleteView, setDefaultView, isMutating } = useEntityViews(entity);
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newShared, setNewShared] = useState(false);
  const [newDefault, setNewDefault] = useState(false);

  const activeView = views.find(v => v.id === activeViewId) ?? null;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const id = await createView({
        name,
        is_shared: newShared,
        is_default: newDefault,
        filters: currentState.filters,
        sort: currentState.sort,
        columns: currentState.columns,
        view_type: currentState.view_type,
      });
      toast({ title: 'Vue créée', description: `"${name}" est maintenant disponible.` });
      setCreateOpen(false);
      setNewName('');
      setNewShared(false);
      setNewDefault(false);
      const created = (await new Promise<EntityView | null>(resolve => {
        // attend la prochaine tick pour laisser React Query rafraîchir
        setTimeout(() => resolve(views.find(v => v.id === id) ?? null), 200);
      }));
      if (created) onApplyView(created);
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleUpdateCurrent = async () => {
    if (!activeView) return;
    try {
      await updateView({
        id: activeView.id,
        patch: {
          filters: currentState.filters,
          sort: currentState.sort,
          columns: currentState.columns,
          view_type: currentState.view_type,
        },
      });
      toast({ title: 'Vue mise à jour', description: `"${activeView.name}" reflète l'état courant.` });
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleDelete = async (view: EntityView) => {
    try {
      await deleteView(view.id);
      toast({ title: 'Vue supprimée' });
      if (activeViewId === view.id) onApplyView(null);
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleSetDefault = async (view: EntityView) => {
    try {
      await setDefaultView(view.id);
      toast({ title: 'Vue par défaut', description: `"${view.name}" sera chargée par défaut.` });
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <span className="truncate max-w-[180px]">
              {activeView ? activeView.name : 'Toutes'}
            </span>
            {activeView?.is_default && <Star className="h-3 w-3 fill-current" />}
            {activeView?.is_shared && <Users className="h-3 w-3" />}
            <Badge variant="secondary" className="ml-1">{views.length}</Badge>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 bg-popover">
          <DropdownMenuItem onClick={() => onApplyView(null)}>
            {activeViewId === null && <Check className="h-4 w-4 mr-2" />}
            <span className={cn(activeViewId !== null && 'ml-6')}>Toutes (sans filtre sauvegardé)</span>
          </DropdownMenuItem>

          {ownViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                <UserIcon className="h-3 w-3" /> Mes vues
              </DropdownMenuLabel>
              {ownViews.map(v => (
                <DropdownMenuItem
                  key={v.id}
                  onSelect={(e) => { e.preventDefault(); onApplyView(v); }}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {activeViewId === v.id ? <Check className="h-4 w-4" /> : <span className="w-4" />}
                    <span className="truncate">{v.name}</span>
                    {v.is_default && <Star className="h-3 w-3 fill-current text-amber-500" />}
                    {v.is_shared && <Users className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSetDefault(v); }}
                      className="text-muted-foreground hover:text-amber-500 p-1"
                      title="Définir par défaut"
                    >
                      <Star className={cn('h-3 w-3', v.is_default && 'fill-current text-amber-500')} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(v); }}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {sharedViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                <Users className="h-3 w-3" /> Vues partagées équipe
              </DropdownMenuLabel>
              {sharedViews.map(v => (
                <DropdownMenuItem
                  key={v.id}
                  onSelect={(e) => { e.preventDefault(); onApplyView(v); }}
                >
                  {activeViewId === v.id ? <Check className="h-4 w-4 mr-2" /> : <span className="w-6" />}
                  <span className="truncate">{v.name}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle vue à partir de l'état courant
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeView && activeView.user_id !== null && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUpdateCurrent}
          disabled={isMutating}
          title="Enregistrer l'état courant dans cette vue"
        >
          <Save className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle vue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">Nom</Label>
              <Input
                id="view-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Mes prospects chauds Q4"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="view-shared">Partager avec l'équipe</Label>
                <p className="text-xs text-muted-foreground">Tous les collègues pourront utiliser cette vue.</p>
              </div>
              <Switch id="view-shared" checked={newShared} onCheckedChange={setNewShared} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="view-default">Vue par défaut</Label>
                <p className="text-xs text-muted-foreground">Sera chargée automatiquement à l'ouverture de la page.</p>
              </div>
              <Switch id="view-default" checked={newDefault} onCheckedChange={setNewDefault} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || isMutating}>
              Créer la vue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
