import { useState } from 'react';
import { debug } from '@/lib/debug';
import { MessageSquarePlus, Search, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useCreatePulseConversation, usePulseConversations } from '@/hooks/pulse/usePulseConversations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PulsePresence } from '@/types/pulse';
import { fetchProfilesLiteWithEmail } from "@/services/profile/profilesLite";
interface StartDMButtonProps {
  onlineUsers: PulsePresence[];
  onConversationCreated: (conversationId: string) => void;
}

export function StartDMButton({ onlineUsers, onConversationCreated }: StartDMButtonProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: currentProfile } = useCurrentProfile();
  const { data: conversations } = usePulseConversations();
  const createConversation = useCreatePulseConversation();

  // Récupérer tous les profils de l'équipe
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['pulse-team-profiles'],
    queryFn: fetchProfilesLiteWithEmail,
    enabled: open,
  });

  const getInitials = (prenom?: string | null, nom?: string | null) => {
    const first = prenom?.[0] || '';
    const last = nom?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const isOnline = (userId: string) => {
    return onlineUsers.some(u => u.user_id === userId && u.status === 'active');
  };

  // Filtrer les profils (exclure l'utilisateur actuel et filtrer par recherche)
  const filteredProfiles = profiles?.filter(profile => {
    if (profile.id === currentProfile?.id) return false;
    if (!search) return true;
    
    const fullName = `${profile.prenom || ''} ${profile.nom || ''}`.toLowerCase();
    const email = (profile.email || '').toLowerCase();
    const searchLower = search.toLowerCase();
    
    return fullName.includes(searchLower) || email.includes(searchLower);
  }) || [];

  // Trouver si un DM existe déjà avec cet utilisateur
  const findExistingDM = (userId: string) => {
    return conversations?.find(conv => {
      const metadata = conv.metadata as Record<string, unknown> | null;
      if (metadata?.type !== 'dm') return false;
      const participants = metadata.participants as string[] | undefined;
      return participants?.includes(userId) && participants?.includes(currentProfile?.id || '');
    });
  };

  const handleStartDM = async (profile: { id: string; nom: string | null; prenom: string | null }) => {
    // Vérifier si un DM existe déjà
    const existingDM = findExistingDM(profile.id);
    if (existingDM) {
      onConversationCreated(existingDM.id);
      setOpen(false);
      setSearch('');
      return;
    }

    // Créer un nouveau DM
    const displayName = `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Conversation';
    
    try {
      const result = await createConversation.mutateAsync({
        name: displayName,
        visibility: 'private',
        metadata: {
          type: 'dm',
          participants: [currentProfile?.id, profile.id],
        },
        member_ids: [profile.id],
      });
      
      if (result?.id) {
        onConversationCreated(result.id);
        toast.success(`Conversation avec ${displayName} créée`);
      }
      setOpen(false);
      setSearch('');
    } catch (error) {
      debug.error('Error creating DM:', error);
      toast.error('Erreur lors de la création de la conversation');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Nouveau message direct">
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau message direct</DialogTitle>
          <DialogDescription>
            Sélectionnez un membre de l'équipe pour démarrer une conversation
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un membre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Liste des membres */}
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`start-dm-skeleton-${i}`} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <UserCircle className="h-12 w-12 mb-2 opacity-30" />
                <p className="text-sm">
                  {search ? 'Aucun membre trouvé' : 'Aucun membre disponible'}
                </p>
              </div>
            ) : (
              <div className="space-y-1 p-1">
                {filteredProfiles.map((profile) => {
                  const online = isOnline(profile.id);
                  const existingDM = findExistingDM(profile.id);
                  
                  return (
                    <button
                      key={profile.id}
                      onClick={() => handleStartDM(profile)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                        "hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(profile.prenom, profile.nom)}
                          </AvatarFallback>
                        </Avatar>
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-sm truncate">
                          {profile.prenom} {profile.nom}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {profile.email}
                        </p>
                      </div>
                      {existingDM && (
                        <span className="text-xs text-muted-foreground">
                          Ouvrir
                        </span>
                      )}
                      {online && !existingDM && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          En ligne
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
