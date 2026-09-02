import { useState } from 'react';
import { Crown, MoreHorizontal, Shield, UserMinus, UserPlus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/AuthProvider';
import { useRemovePulseConversationMember, useUpdatePulseConversationMemberRole } from '@/hooks/pulse/usePulseConversations';
import { cn } from '@/lib/utils';
import type { PulseConversation, PulsePresence } from '@/types/pulse';
import { AddMemberDialog } from './AddMemberDialog';

interface ConversationMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: PulseConversation;
  onlineUsers: PulsePresence[];
}

export function ConversationMembersSheet({
  open,
  onOpenChange,
  conversation,
  onlineUsers,
}: ConversationMembersSheetProps) {
  const { user } = useAuth();
  const removeMember = useRemovePulseConversationMember();
  const updateRole = useUpdatePulseConversationMemberRole();
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);

  const members = conversation.members || [];
  const currentUserMember = members.find(m => m.user_id === user?.id);
  const isAdmin = currentUserMember?.role === 'admin';

  const getInitials = (nom?: string, prenom?: string) => {
    if (!nom && !prenom) return '?';
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
  };

  const isOnline = (userId: string) => {
    return onlineUsers.some(u => u.user_id === userId && u.status === 'active');
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <Badge variant="default" className="gap-1">
            <Crown className="h-3 w-3" />
            Admin
          </Badge>
        );
      case 'guest':
        return (
          <Badge variant="secondary">
            Invité
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleRemoveMember = (userId: string) => {
    if (confirm('Retirer ce membre de la conversation ?')) {
      removeMember.mutate({
        conversationId: conversation.id,
        userId,
      });
    }
  };

  // Trier : admins en premier, puis par nom
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    const nameA = `${a.user?.prenom} ${a.user?.nom}`.toLowerCase();
    const nameB = `${b.user?.prenom} ${b.user?.nom}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Membres</SheetTitle>
          <SheetDescription>
            {members.length} membre{members.length > 1 ? 's' : ''} dans cette conversation
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
        {isAdmin && (
            <Button 
              className="w-full mb-4" 
              variant="outline"
              onClick={() => setShowAddMemberDialog(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Ajouter des membres
            </Button>
          )}

          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-1">
              {sortedMembers.map((member) => {
                const online = isOnline(member.user_id);
                const isCurrentUser = member.user_id === user?.id;

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.user?.avatar_url ?? undefined} />
                        <AvatarFallback>
                          {getInitials(member.user?.nom, member.user?.prenom)}
                        </AvatarFallback>
                      </Avatar>
                      {online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium truncate",
                          isCurrentUser && "text-primary"
                        )}>
                          {member.user?.prenom} {member.user?.nom}
                          {isCurrentUser && " (vous)"}
                        </span>
                        {getRoleBadge(member.role)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.user?.email}
                      </p>
                    </div>

                    {isAdmin && !isCurrentUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Plus d'options">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.role !== 'admin' && (
                            <DropdownMenuItem
                              onClick={() => updateRole.mutate({
                                conversationId: conversation.id,
                                userId: member.user_id,
                                role: 'admin',
                              })}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Promouvoir admin
                            </DropdownMenuItem>
                          )}
                          {member.role === 'admin' && (
                            <DropdownMenuItem
                              onClick={() => updateRole.mutate({
                                conversationId: conversation.id,
                                userId: member.user_id,
                                role: 'member',
                              })}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Rétrograder en membre
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRemoveMember(member.user_id)}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Retirer de la conversation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {isCurrentUser && !isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => handleRemoveMember(user.id)}
                      >
                        Quitter
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Add Member Dialog */}
        <AddMemberDialog
          open={showAddMemberDialog}
          onOpenChange={setShowAddMemberDialog}
          conversationId={conversation.id}
          existingMemberIds={members.map(m => m.user_id)}
        />
      </SheetContent>
    </Sheet>
  );
}
