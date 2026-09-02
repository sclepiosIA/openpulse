import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Building2, Users, Handshake, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMultiEntitySearch, type SearchResult, type EntityType } from '@/hooks/search/useMultiEntitySearch';
import { useAssignThreadWithParticipants, type Participant } from '@/hooks/email/useAssignThreadWithParticipants';
import { isMarqueEmail } from '@/lib/internalEmailConfig';

interface AssignThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  participants: Participant[];
  onAssigned?: () => void;
}

const ENTITY_CONFIG = {
  etablissement: {
    icon: Building2,
    label: 'Établissements',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  groupe: {
    icon: Users,
    label: 'Groupes',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  partenaire: {
    icon: Handshake,
    label: 'Partenaires',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
} as const;

export function AssignThreadDialog({
  open,
  onOpenChange,
  threadId,
  participants,
  onAssigned,
}: AssignThreadDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<SearchResult | null>(null);
  const [selectedParticipantEmails, setSelectedParticipantEmails] = useState<Set<string>>(
    () => new Set(
      participants
        .filter(p => !isMarqueEmail(p.email))
        .map(p => p.email.toLowerCase())
    )
  );

  const { results, isSearching, hasResults } = useMultiEntitySearch(searchQuery);
  const { assignThread, isAssigning } = useAssignThreadWithParticipants();

  // Filtrer les participants pour exclure les adresses génériques et internes OpenPulse
  const filteredParticipants = useMemo(() => {
    const genericPatterns = [
      /^noreply@/i,
      /^no-reply@/i,
      /^donotreply@/i,
      /^notification/i,
      /^mailer-daemon@/i,
      /^postmaster@/i,
    ];
    
    return participants.filter(p => {
      // Exclure les emails OpenPulse (équipe interne)
      if (isMarqueEmail(p.email)) return false;
      // Exclure les patterns génériques
      return !genericPatterns.some(pattern => pattern.test(p.email));
    });
  }, [participants]);

  const toggleParticipant = useCallback((email: string) => {
    const normalizedEmail = email.toLowerCase();
    setSelectedParticipantEmails(prev => {
      const next = new Set(prev);
      if (next.has(normalizedEmail)) {
        next.delete(normalizedEmail);
      } else {
        next.add(normalizedEmail);
      }
      return next;
    });
  }, []);

  const handleSelectEntity = useCallback((entity: SearchResult) => {
    setSelectedEntity(entity);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedEntity) return;

    const success = await assignThread({
      threadId,
      entityType: selectedEntity.type,
      entityId: selectedEntity.id,
      entityName: selectedEntity.name,
      participants: filteredParticipants,
      selectedParticipantEmails: Array.from(selectedParticipantEmails),
    });

    if (success) {
      onOpenChange(false);
      onAssigned?.();
      // Reset state
      setSearchQuery('');
      setSelectedEntity(null);
    }
  }, [selectedEntity, threadId, filteredParticipants, selectedParticipantEmails, assignThread, onOpenChange, onAssigned]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setSearchQuery('');
    setSelectedEntity(null);
  }, [onOpenChange]);

  const renderEntityGroup = (type: EntityType, items: SearchResult[]) => {
    if (items.length === 0) return null;
    
    const config = ENTITY_CONFIG[type];
    const Icon = config.icon;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-2 py-1">
          <Icon className={cn("h-3.5 w-3.5", config.color)} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {config.label}
          </span>
        </div>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelectEntity(item)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
              "hover:bg-accent focus:bg-accent focus:outline-none",
              selectedEntity?.id === item.id && "bg-accent ring-1 ring-primary"
            )}
          >
            <div className={cn("p-1.5 rounded", config.bgColor)}>
              <Icon className={cn("h-4 w-4", config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.name}</p>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Associer ce thread</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un établissement, groupe, partenaire..."
              className="pl-9"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Selected entity indicator */}
          {selectedEntity && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
              <Badge variant="outline" className={cn("gap-1", ENTITY_CONFIG[selectedEntity.type].bgColor)}>
                {(() => {
                  const Icon = ENTITY_CONFIG[selectedEntity.type].icon;
                  return <Icon className="h-3 w-3" />;
                })()}
                {selectedEntity.name}
              </Badge>
              <span className="text-xs text-muted-foreground">sélectionné</span>
            </div>
          )}

          {/* Search results */}
          {searchQuery.length >= 2 && (
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-3">
                {hasResults ? (
                  <>
                    {renderEntityGroup('etablissement', results.etablissements)}
                    {renderEntityGroup('groupe', results.groupes)}
                    {renderEntityGroup('partenaire', results.partenaires)}
                  </>
                ) : !isSearching ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun résultat pour "{searchQuery}"
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          )}

          {/* Participants to create as contacts */}
          {filteredParticipants.length > 0 && selectedEntity && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Créer comme contacts</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {filteredParticipants.map((participant) => {
                    const normalizedEmail = participant.email.toLowerCase();
                    const isSelected = selectedParticipantEmails.has(normalizedEmail);
                    
                    return (
                      <label
                        key={participant.email}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleParticipant(participant.email)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {participant.name || participant.email.split('@')[0]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {participant.email}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedEntity || isAssigning}
          >
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Association...
              </>
            ) : (
              'Associer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
