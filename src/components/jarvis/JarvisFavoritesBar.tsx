/**
 * JarvisFavoritesBar - Barre de commandes favorites Jarvis
 * 
 * V11.0: Accès rapide aux commandes fréquentes avec raccourcis clavier
 */

import { useState, useEffect, useCallback } from 'react';
import { debug } from '@/lib/debug';
import { Star, Plus, X, Command, GripVertical, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/shared/useAuth';
import { useJarvisFavoritesMutations } from '@/hooks/jarvis/useJarvisFavoritesMutations';

import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { supabase } from "@/integrations/supabase/client";

interface FavoriteCommand {
  id: string;
  command: string;
  label: string;
  description: string | null;
  icon: string | null;
  shortcut_key: string | null;
  usage_count: number | null;
  order_index: number | null;
}

interface JarvisFavoritesBarProps {
  onCommandSelect: (command: string) => void;
  className?: string;
  compact?: boolean;
}

// Suggestions de commandes fréquentes
const SUGGESTED_COMMANDS = [
  { command: 'Génère mon briefing du matin', label: 'Briefing', icon: '☀️' },
  { command: 'Quelles sont mes tâches prioritaires ?', label: 'Tâches', icon: '✅' },
  { command: 'Résume mes emails non lus', label: 'Emails', icon: '📧' },
  { command: 'Montre le pipeline commercial', label: 'Pipeline', icon: '📊' },
  { command: 'Quel est le solde de trésorerie ?', label: 'Trésorerie', icon: '💰' },
];

export function JarvisFavoritesBar({ 
  onCommandSelect, 
  className,
  compact = false 
}: JarvisFavoritesBarProps) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCommand, setNewCommand] = useState({ command: '', label: '' });
  const mutations = useJarvisFavoritesMutations();

  // Charger les favoris
  useEffect(() => {
    if (!user?.id) return;
    
    const loadFavorites = async () => {
      const { data, error } = await supabase
        .from('jarvis_favorite_commands')
        .select('id, command, label, description, icon, shortcut_key, usage_count, order_index')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true });

      if (error) {
        debug.error('[JarvisFavorites] Error loading:', error);
      } else {
        setFavorites(data || []);
      }
      setIsLoading(false);
    };

    loadFavorites();
  }, [user?.id]);

  // Raccourcis clavier Alt+1, Alt+2, etc.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
          const fav = favorites.find(f => f.shortcut_key === String(num));
          if (fav) {
            e.preventDefault();
            handleSelect(fav);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [favorites]);

  // Sélectionner une commande
  const handleSelect = useCallback(async (fav: FavoriteCommand) => {
    onCommandSelect(fav.command);
    await mutations.incrementUsage(fav);
    setFavorites(prev => prev.map(f => 
      f.id === fav.id ? { ...f, usage_count: (f.usage_count || 0) + 1 } : f
    ));
  }, [onCommandSelect, mutations]);

  // Ajouter un favori
  const handleAddFavorite = async () => {
    if (!user?.id || !newCommand.command.trim() || !newCommand.label.trim()) return;

    const result = await mutations.addFavorite(
      user.id,
      { command: newCommand.command, label: newCommand.label },
      favorites.length
    );

    if (result) {
      setFavorites(prev => [...prev, result]);
      setNewCommand({ command: '', label: '' });
      setShowAddDialog(false);
    }
  };

  // Supprimer un favori
  const handleRemoveFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await mutations.removeFavorite(id);
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  // Réordonner les favoris
  const handleReorder = async (newOrder: FavoriteCommand[]) => {
    setFavorites(newOrder);
    await mutations.reorderFavorites(newOrder);
  };

  // Ajouter une suggestion
  const handleAddSuggestion = async (suggestion: typeof SUGGESTED_COMMANDS[0]) => {
    if (!user?.id) return;

    const result = await mutations.addFavorite(
      user.id,
      { command: suggestion.command, label: suggestion.label, icon: suggestion.icon },
      favorites.length
    );

    if (result) {
      setFavorites(prev => [...prev, result]);
    }
  };

  if (isLoading) return null;

  // Mode compact: juste les badges cliquables
  if (compact) {
    return (
      <div className={cn('flex items-center gap-1 flex-wrap', className)}>
        {favorites.slice(0, 5).map((fav) => (
          <Tooltip key={fav.id}>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="cursor-pointer hover:bg-primary/20 transition-colors text-xs"
                onClick={() => handleSelect(fav)}
              >
                {fav.icon || '⚡'} {fav.label}
                {fav.shortcut_key && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    Alt+{fav.shortcut_key}
                  </span>
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{fav.command}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Barre de favoris */}
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">Favoris</span>
        
        {favorites.length > 0 ? (
          <Reorder.Group
            axis="x"
            values={favorites}
            onReorder={handleReorder}
            className="flex items-center gap-1 flex-wrap flex-1"
          >
            <AnimatePresence mode="popLayout">
              {favorites.map((fav) => (
                <Reorder.Item
                  key={fav.id}
                  value={fav}
                  className="relative group"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 cursor-grab active:cursor-grabbing"
                          onClick={() => handleSelect(fav)}
                        >
                          <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-50 -ml-1" />
                          <span>{fav.icon || '⚡'}</span>
                          <span>{fav.label}</span>
                          {fav.shortcut_key && (
                            <kbd className="ml-1 text-[10px] bg-muted px-1 rounded">
                              Alt+{fav.shortcut_key}
                            </kbd>
                          )}
                          <button
                            onClick={(e) => handleRemoveFavorite(fav.id, e)}
                            className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs max-w-[200px]">{fav.command}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Utilisé {fav.usage_count || 0} fois
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        ) : (
          <p className="text-xs text-muted-foreground">
            Aucun favori. Ajoutez vos commandes fréquentes !
          </p>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={() => setShowAddDialog(true)} aria-label="Ajouter">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Suggestions si peu de favoris */}
      {favorites.length < 3 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground mr-1">Suggestions :</span>
          {SUGGESTED_COMMANDS.filter(s => !favorites.some(f => f.command === s.command))
            .slice(0, 3)
            .map((suggestion) => (
              <Button
                key={suggestion.command}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => handleAddSuggestion(suggestion)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {suggestion.icon} {suggestion.label}
              </Button>
            ))}
        </div>
      )}

      {/* Dialog d'ajout */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Ajouter une commande favorite
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Commande</label>
              <Input
                placeholder="Ex: Quelles sont mes tâches du jour ?"
                value={newCommand.command}
                onChange={(e) => setNewCommand(prev => ({ ...prev, command: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Label court</label>
              <Input
                placeholder="Ex: Tâches"
                value={newCommand.label}
                onChange={(e) => setNewCommand(prev => ({ ...prev, label: e.target.value }))}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Ce label apparaîtra sur le bouton (max 20 caractères)
              </p>
            </div>

            {favorites.length < 9 && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <Command className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Raccourci: <kbd className="bg-background px-1 rounded">Alt+{favorites.length + 1}</kbd>
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleAddFavorite}
              disabled={!newCommand.command.trim() || !newCommand.label.trim()}
            >
              Ajouter aux favoris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}