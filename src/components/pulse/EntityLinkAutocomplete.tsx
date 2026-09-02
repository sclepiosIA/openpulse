import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useEntitySearch, type EntityResult, type EntityType } from '@/hooks/search/useEntitySearch';
import { Loader2, Building2, CheckSquare, User, Users, Calendar, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntityFilterType } from '@/hooks/ui/useSlashCommands';

interface EntityLinkAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (entity: EntityResult) => void;
  onClose: () => void;
  visible: boolean;
  filter?: EntityFilterType;
}

const TYPE_LABELS: Record<EntityType, string> = {
  etablissement: 'Établissements',
  tache: 'Tâches',
  contact: 'Contacts',
  groupe: 'Groupes',
  evenement: 'Événements',
  partenaire: 'Partenaires',
};

const TYPE_ICONS: Record<EntityType, React.ElementType> = {
  etablissement: Building2,
  tache: CheckSquare,
  contact: User,
  groupe: Users,
  evenement: Calendar,
  partenaire: Handshake,
};

export function EntityLinkAutocomplete({
  query,
  position,
  onSelect,
  onClose,
  visible,
  filter = 'all',
}: EntityLinkAutocompleteProps) {
  const { results, allResults, hasResults, isSearching } = useEntitySearch(query);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter results based on filter prop
  const filteredAllResults = useMemo(() => {
    if (filter === 'all') return allResults;
    return allResults.filter(r => r.type === filter);
  }, [allResults, filter]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredAllResults.length, query]);

  // Close on click outside
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible || filteredAllResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredAllResults.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredAllResults.length) % filteredAllResults.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        onSelect(filteredAllResults[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [visible, filteredAllResults, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!visible) return null;

  const showPlaceholder = query.length < 2;
  const filteredHasResults = filteredAllResults.length > 0;
  const showNoResults = !isSearching && !showPlaceholder && !filteredHasResults;

  // Group results by type for display (applying filter)
  const groupedResults: { type: EntityType; items: EntityResult[] }[] = [];
  const types: EntityType[] = filter === 'all' 
    ? ['etablissement', 'tache', 'contact', 'groupe']
    : [filter as EntityType];
  
  types.forEach(type => {
    const items = results[`${type}s` as keyof typeof results] || 
                  (type === 'etablissement' ? results.etablissements : []);
    if (items.length > 0) {
      groupedResults.push({ type, items });
    }
  });

  let currentIndex = 0;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-popover border rounded-lg shadow-lg overflow-hidden animate-scale-in"
      style={{
        top: position.top,
        left: position.left,
        minWidth: 280,
        maxWidth: 380,
      }}
    >
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Lier une entité
        </span>
        {isSearching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      
      <div className="max-h-[320px] overflow-y-auto">
        {showPlaceholder && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Tapez au moins 2 caractères pour rechercher...
          </div>
        )}

        {showNoResults && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Aucun résultat pour "<span className="font-medium">{query}</span>"
          </div>
        )}

        {groupedResults.map(({ type, items }) => {
          const Icon = TYPE_ICONS[type];
          return (
            <div key={type}>
              <div className="px-3 py-1.5 bg-muted/20 flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {TYPE_LABELS[type]}
                </span>
              </div>
              {items.map((entity) => {
                const itemIndex = currentIndex++;
                const EntityIcon = entity.icon;
                return (
                  <button
                    key={`${entity.type}-${entity.id}`}
                    onClick={() => onSelect(entity)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      itemIndex === selectedIndex
                        ? "bg-accent/20 text-foreground"
                        : "hover:bg-accent/10 text-foreground"
                    )}
                  >
                    <EntityIcon className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{entity.name}</div>
                      {entity.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">
                          {entity.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
          naviguer
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
          sélectionner
        </span>
      </div>
    </div>
  );
}
