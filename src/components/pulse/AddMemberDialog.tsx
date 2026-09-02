import { useState, useMemo } from 'react';
import { debug } from '@/lib/debug';
import { Search, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProfiles } from '@/hooks/profile/useProfiles';
import { useAddPulseConversationMember } from '@/hooks/pulse/usePulseConversations';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  existingMemberIds: string[];
}

export function AddMemberDialog({
  open,
  onOpenChange,
  conversationId,
  existingMemberIds,
}: AddMemberDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const { data: profiles = [], isLoading } = useProfiles();
  const addMember = useAddPulseConversationMember();

  // Filter out existing members and apply search
  const availableProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (existingMemberIds.includes(p.id)) return false;
      if (!search.trim()) return true;
      
      const searchLower = search.toLowerCase();
      const fullName = `${p.prenom || ''} ${p.nom || ''}`.toLowerCase();
      return (
        fullName.includes(searchLower) ||
        p.email?.toLowerCase().includes(searchLower)
      );
    });
  }, [profiles, existingMemberIds, search]);

  const getInitials = (prenom?: string, nom?: string) => {
    if (!prenom && !nom) return '?';
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
  };

  const toggleSelect = (profileId: string) => {
    setSelectedIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    
    setIsAdding(true);
    try {
      // Add members sequentially to avoid race conditions
      for (const userId of selectedIds) {
        await addMember.mutateAsync({ conversationId, userId });
      }
      setSelectedIds([]);
      setSearch('');
      onOpenChange(false);
    } catch (error) {
      debug.error('Error adding members:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setSelectedIds([]);
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter des membres</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9"
            />
          </div>

          {/* Profiles list */}
          <ScrollArea className="h-[300px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableProfiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? 'Aucun résultat' : 'Tous les membres sont déjà ajoutés'}
              </div>
            ) : (
              <div className="space-y-1">
                {availableProfiles.map((profile) => (
                  <label
                    key={profile.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.includes(profile.id)}
                      onCheckedChange={() => toggleSelect(profile.id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(profile.prenom, profile.nom)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {profile.prenom} {profile.nom}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {profile.email}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.length === 0 || isAdding}
          >
            {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Ajouter ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
