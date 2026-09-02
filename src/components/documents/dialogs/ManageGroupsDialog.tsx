import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, Trash2, Users, ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { useUserGroups, useCreateGroup, useDeleteGroup, useGroupMembers, useAddGroupMember, useRemoveGroupMember } from "@/hooks/documents/useUserGroups";
import { useAuth } from "@/hooks/shared/useAuth";
import type { UserGroupWithMembers } from "@/types/documents/permissions";
import { useProfileSearch } from "@/hooks/profile/useProfileSearch";

interface ManageGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageGroupsDialog({ open, onOpenChange }: ManageGroupsDialogProps) {
  const { user } = useAuth();
  const [selectedGroup, setSelectedGroup] = useState<UserGroupWithMembers | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const { data: groups = [], isLoading } = useUserGroups();
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const { data: members = [], isLoading: membersLoading } = useGroupMembers(selectedGroup?.id ?? null);
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();

  const { data: searchResults = [] } = useProfileSearch(memberSearch, { queryKey: 'search-profiles-groups' });

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    createGroup.mutate({ name: newGroupName.trim() });
    setNewGroupName("");
  };

  const handleDeleteGroup = (id: string) => {
    if (!window.confirm("Supprimer ce groupe ?")) return;
    deleteGroup.mutate(id);
    if (selectedGroup?.id === id) setSelectedGroup(null);
  };

  const handleAddMember = (userId: string) => {
    if (!selectedGroup) return;
    if (members.some(m => m.user_id === userId)) return;
    addMember.mutate({ groupId: selectedGroup.id, userId });
    setMemberSearch("");
  };

  const handleRemoveMember = (memberId: string) => {
    if (!selectedGroup) return;
    removeMember.mutate({ memberId, groupId: selectedGroup.id });
  };

  const getInitials = (nom: string | null, prenom: string | null) =>
    `${(prenom || '')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase() || '?';

  // Group detail view
  if (selectedGroup) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedGroup(null)} aria-label="Retour">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <DialogTitle>{selectedGroup.name}</DialogTitle>
                <DialogDescription>{selectedGroup.description || "Gérer les membres"}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Add member */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ajouter un membre..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {memberSearch.length >= 2 && searchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                {searchResults
                  .filter(p => !members.some(m => m.user_id === p.id))
                  .map(profile => (
                    <button
                      key={profile.id}
                      className="flex items-center gap-3 w-full p-2.5 hover:bg-accent/50 text-left transition-colors"
                      onClick={() => handleAddMember(profile.id)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(profile.nom, profile.prenom)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{profile.prenom} {profile.nom}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                      </div>
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Members list */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Membres ({members.length})
            </h4>
            {membersLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun membre</p>
            ) : (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {members.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(member.profile?.nom ?? null, member.profile?.prenom ?? null)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{member.profile?.prenom} {member.profile?.nom}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.profile?.email}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveMember(member.id)} aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Group list view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Groupes d'utilisateurs</DialogTitle>
          <DialogDescription>Gérez les groupes pour le partage de documents et dossiers</DialogDescription>
        </DialogHeader>

        {/* Create group */}
        <div className="flex gap-2">
          <Input
            placeholder="Nom du groupe..."
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
          />
          <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || createGroup.isPending} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Créer
          </Button>
        </div>

        {/* Groups list */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun groupe créé</p>
          </div>
        ) : (
          <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
            {groups.map(group => (
              <div
                key={group.id}
                className="flex items-center gap-3 p-3 hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => setSelectedGroup(group)}
              >
                <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: group.color || '#6366f1' }}>
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{group.name}</p>
                  {group.description && <p className="text-xs text-muted-foreground truncate">{group.description}</p>}
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">{group.member_count}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive shrink-0"
                  onClick={e => { e.stopPropagation(); handleDeleteGroup(group.id); }} aria-label="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
