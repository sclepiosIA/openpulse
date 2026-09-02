/**
 * JarvisMemoryManager - Interface de gestion de la mémoire persistante de Jarvis
 * 
 * Permet aux utilisateurs de visualiser, ajouter, modifier et supprimer
 * les informations mémorisées par Jarvis.
 */

import { useState } from 'react';
import { useJarvisMemory, MemoryCategory } from '@/hooks/jarvis/useJarvisMemory';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/shared/use-toast';
import {
  Brain,
  Plus,
  Trash2,
  Heart,
  Lightbulb,
  MessageSquare,
  Settings2,
  Star,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JarvisUserMemoryRow } from '@/types/supabase-extensions';

const CATEGORY_CONFIG: Record<MemoryCategory, {
  label: string;
  description: string;
  icon: typeof Brain;
  color: string;
}> = {
  preference: {
    label: 'Préférences',
    description: 'Comment Jarvis doit se comporter ou répondre',
    icon: Heart,
    color: 'text-pink-500'
  },
  fact: {
    label: 'Faits',
    description: 'Informations factuelles vous concernant',
    icon: Lightbulb,
    color: 'text-yellow-500'
  },
  instruction: {
    label: 'Instructions',
    description: 'Directives permanentes à suivre',
    icon: MessageSquare,
    color: 'text-blue-500'
  },
  context: {
    label: 'Contexte',
    description: 'Contexte actuel de travail',
    icon: Settings2,
    color: 'text-green-500'
  }
};

interface AddMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { category: MemoryCategory; key: string; value: string; importance: number }) => Promise<void>;
  isAdding: boolean;
  defaultCategory?: MemoryCategory;
}

function AddMemoryDialog({ open, onOpenChange, onAdd, isAdding, defaultCategory = 'preference' }: AddMemoryDialogProps) {
  const [category, setCategory] = useState<MemoryCategory>(defaultCategory);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [importance, setImportance] = useState(3);

  const handleSubmit = async () => {
    if (!key.trim() || !value.trim()) return;
    
    await onAdd({ category, key: key.trim(), value: value.trim(), importance });
    setKey('');
    setValue('');
    setImportance(3);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Ajouter une mémoire
          </DialogTitle>
          <DialogDescription>
            Ajoutez une information que Jarvis doit retenir pour personnaliser ses réponses.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Catégorie</label>
            <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CATEGORY_CONFIG) as [MemoryCategory, typeof CATEGORY_CONFIG.preference][]).map(([cat, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={cat} value={cat}>
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", config.color)} />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Clé / Sujet</label>
            <Input
              placeholder="Ex: Nom préféré, Email de travail, Ton de réponse..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Valeur / Information</label>
            <Textarea
              placeholder="Ex: Appelle-moi Jean, toujours utiliser un ton professionnel..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Importance (1-5)</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <Button
                  key={level}
                  variant={importance >= level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setImportance(level)}
                  className="w-10 h-10"
                >
                  <Star className={cn(
                    "h-4 w-4",
                    importance >= level ? "fill-current" : ""
                  )} />
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Plus l'importance est élevée, plus Jarvis priorisera cette information.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!key.trim() || !value.trim() || isAdding}
          >
            {isAdding ? 'Ajout...' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MemoryCardProps {
  memory: JarvisUserMemoryRow;
  onDelete: (key: string) => Promise<void>;
  isDeleting: boolean;
}

function MemoryCard({ memory, onDelete, isDeleting }: MemoryCardProps) {
  const config = CATEGORY_CONFIG[memory.category as MemoryCategory] || CATEGORY_CONFIG.context;
  const Icon = config.icon;
  
  return (
    <Card className="group relative hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn("p-2 rounded-lg bg-muted shrink-0", config.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">{memory.key}</h4>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: memory.importance }).map((_, i) => (
                    <Star key={`mem-star-${memory.id}-${i}`} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{memory.value}</p>
              <p className="text-xs text-muted-foreground/70 mt-2">
                Modifié le {new Date(memory.updated_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Supprimer">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette mémoire ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Jarvis oubliera définitivement "{memory.key}". Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(memory.key)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? 'Suppression...' : 'Supprimer'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export function JarvisMemoryManager() {
  const { toast } = useToast();
  const {
    memories,
    isLoading,
    addMemory,
    deleteMemory,
    clearCategory,
    getMemoriesByCategory,
    isAdding,
    isDeleting
  } = useJarvisMemory();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<MemoryCategory>('preference');

  const handleAddMemory = async (data: { category: MemoryCategory; key: string; value: string; importance: number }) => {
    try {
      await addMemory(data);
      toast({
        title: "Mémoire ajoutée",
        description: `Jarvis se souviendra de "${data.key}"`,
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDeleteMemory = async (key: string) => {
    try {
      await deleteMemory(key);
      toast({
        title: "Mémoire supprimée",
        description: `Jarvis a oublié "${key}"`,
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleClearCategory = async (category: MemoryCategory) => {
    try {
      await clearCategory(category);
      toast({
        title: "Catégorie vidée",
        description: `Toutes les mémoires de type "${CATEGORY_CONFIG[category].label}" ont été supprimées`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de vider cette catégorie",
        variant: "destructive"
      });
    }
  };

  const currentMemories = getMemoriesByCategory(activeCategory);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={`mem-tab-${i}`} className="h-10 w-28" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={`mem-card-${i}`} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Mémoire de Jarvis</h3>
            <p className="text-sm text-muted-foreground">
              {memories?.length || 0} élément{(memories?.length || 0) > 1 ? 's' : ''} mémorisé{(memories?.length || 0) > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Ajouter</span>
        </Button>
      </div>

      {/* Tabs par catégorie */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as MemoryCategory)}>
        <TabsList className="grid w-full grid-cols-4">
          {(Object.entries(CATEGORY_CONFIG) as [MemoryCategory, typeof CATEGORY_CONFIG.preference][]).map(([cat, config]) => {
            const Icon = config.icon;
            const count = getMemoriesByCategory(cat).length;
            
            return (
              <TabsTrigger key={cat} value={cat} className="gap-1.5">
                <Icon className={cn("h-4 w-4", config.color)} />
                <span className="hidden sm:inline">{config.label}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs h-5 min-w-5 px-1.5">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.entries(CATEGORY_CONFIG) as [MemoryCategory, typeof CATEGORY_CONFIG.preference][]).map(([cat, config]) => (
          <TabsContent key={cat} value={cat} className="space-y-4 mt-4">
            {/* Description de la catégorie */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{config.description}</p>
              {currentMemories.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Tout effacer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Vider cette catégorie ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Toutes les mémoires de type "{config.label}" seront définitivement supprimées. 
                        Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleClearCategory(cat)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Vider la catégorie
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Liste des mémoires */}
            {currentMemories.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className={cn("p-3 rounded-full bg-muted mb-4", config.color)}>
                    <config.icon className="h-6 w-6" />
                  </div>
                  <h4 className="font-medium mb-1">Aucune mémoire</h4>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Ajoutez des {config.label.toLowerCase()} pour personnaliser les réponses de Jarvis.
                  </p>
                  <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une mémoire
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {currentMemories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onDelete={handleDeleteMemory}
                    isDeleting={isDeleting}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Dialog d'ajout */}
      <AddMemoryDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddMemory}
        isAdding={isAdding}
        defaultCategory={activeCategory}
      />

      {/* Info box */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Comment ça fonctionne ?</p>
            <p>
              Les mémoires sont automatiquement injectées dans chaque conversation avec Jarvis. 
              Plus l'importance est élevée, plus Jarvis priorisera cette information dans ses réponses.
              Jarvis peut aussi apprendre automatiquement de vos conversations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
