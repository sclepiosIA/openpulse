import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, UserPlus, Users, Trash2, Loader2, Globe, Lock } from "lucide-react";
import { useFolderPermissions, useSetFolderPermission, useRemoveFolderPermission } from "@/hooks/documents/useDocumentPermissions";
import { useUserGroups } from "@/hooks/documents/useUserGroups";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/shared/useAuth";
import { toast } from "sonner";
import type { DocumentFolder } from "@/types/folders";
import type { PermissionLevel } from "@/types/documents/permissions";
import { PERMISSION_LABELS } from "@/types/documents/permissions";
import { sanitizePostgrestValue } from '@/lib/sanitize';
import { supabase } from "@/integrations/supabase/client";

interface FolderPermissionsDialogProps {
  folder: DocumentFolder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FolderPermissionsDialog({ folder, open, onOpenChange }: FolderPermissionsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>("view");
  const [tab, setTab] = useState("users");
  const [isRestricted, setIsRestricted] = useState(false);
  const [isTogglingRestriction, setIsTogglingRestriction] = useState(false);

  const { data: permissions = [], isLoading } = useFolderPermissions(folder?.id ?? null);
  const { data: groups = [] } = useUserGroups();
  const addPermission = useSetFolderPermission();
  const removePermission = useRemoveFolderPermission();

  // Sync is_restricted state from folder
  useEffect(() => {
    if (folder) {
      setIsRestricted((folder as any).is_restricted ?? false);
    }
  }, [folder]);

  const { data: searchResults = [] } = useQuery({
    queryKey: ['search-profiles', searchQuery],
    enabled: searchQuery.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nom, prenom, email, avatar_url')
        .or(`nom.ilike.%${sanitizePostgrestValue(searchQuery)}%,prenom.ilike.%${sanitizePostgrestValue(searchQuery)}%,email.ilike.%${sanitizePostgrestValue(searchQuery)}%`)
        .neq('id', user?.id ?? '')
        .limit(10);
      return data || [];
    },
  });

  const handleToggleRestriction = async (checked: boolean) => {
    if (!folder) return;
    setIsTogglingRestriction(true);
    try {
      const { error } = await supabase
        .from('document_folders')
        .update({ is_restricted: checked } as any)
        .eq('id', folder.id);
      if (error) throw error;
      setIsRestricted(checked);
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] });
      toast.success(checked ? "Accès restreint activé" : "Dossier accessible à tous");
    } catch {
      toast.error("Erreur lors de la modification");
    } finally {
      setIsTogglingRestriction(false);
    }
  };

  const handleAddUser = (userId: string) => {
    if (!folder) return;
    if (permissions.some(p => p.user_id === userId)) return;
    addPermission.mutate({ folderId: folder.id, userId, accessLevel: selectedPermission });
    setSearchQuery("");
  };

  const handleAddGroup = (groupId: string) => {
    if (!folder) return;
    if (permissions.some(p => p.group_id === groupId)) return;
    addPermission.mutate({ folderId: folder.id, groupId, accessLevel: selectedPermission });
  };

  const handleRemove = (permissionId: string) => {
    if (!folder) return;
    removePermission.mutate({ permissionId, folderId: folder.id });
  };

  const getInitials = (nom: string | null, prenom: string | null) =>
    `${(prenom || '')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase() || '?';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permissions du dossier</DialogTitle>
          <DialogDescription className="truncate">{folder?.name}</DialogDescription>
        </DialogHeader>

        {/* Restriction toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            {isRestricted ? (
              <Lock className="h-5 w-5 text-destructive" />
            ) : (
              <Globe className="h-5 w-5 text-primary" />
            )}
            <div>
              <Label htmlFor="restrict-toggle" className="text-sm font-medium cursor-pointer">
                {isRestricted ? "Accès restreint" : "Accessible à tous"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {isRestricted
                  ? "Seuls les utilisateurs et groupes autorisés peuvent accéder à ce dossier"
                  : "Tous les utilisateurs authentifiés peuvent voir ce dossier"}
              </p>
            </div>
          </div>
          <Switch
            id="restrict-toggle"
            checked={isRestricted}
            onCheckedChange={handleToggleRestriction}
            disabled={isTogglingRestriction}
          />
        </div>

        {/* Permissions management - only show when restricted */}
        {isRestricted && (
          <>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="users" className="flex-1 gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Utilisateurs</span>
                </TabsTrigger>
                <TabsTrigger value="groups" className="flex-1 gap-1.5">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Groupes</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher un utilisateur..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={selectedPermission} onValueChange={v => setSelectedPermission(v as PermissionLevel)}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PERMISSION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {searchQuery.length >= 2 && searchResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                    {searchResults.map(profile => (
                      <button
                        key={profile.id}
                        className="flex items-center gap-3 w-full p-2.5 hover:bg-accent/50 text-left transition-colors"
                        onClick={() => handleAddUser(profile.id)}
                        disabled={permissions.some(p => p.user_id === profile.id)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(profile.nom, profile.prenom)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{profile.prenom} {profile.nom}</p>
                          <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="groups" className="space-y-4 mt-4">
                <Select value={selectedPermission} onValueChange={v => setSelectedPermission(v as PermissionLevel)}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERMISSION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {groups.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">Aucun groupe</p>
                  ) : groups.map(group => (
                    <button
                      key={group.id}
                      className="flex items-center gap-3 w-full p-2.5 hover:bg-accent/50 text-left transition-colors"
                      onClick={() => handleAddGroup(group.id)}
                      disabled={permissions.some(p => p.group_id === group.id)}
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: group.color || '#6366f1' }}>
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{group.name}</p>
                        <p className="text-xs text-muted-foreground">{group.member_count} membre(s)</p>
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* Current permissions */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Permissions actuelles</h4>
              {isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : permissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Aucune permission — seuls le propriétaire et les admins y ont accès</p>
              ) : (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {permissions.map(perm => (
                    <div key={perm.id} className="flex items-center gap-3 p-2.5">
                      {perm.user ? (
                        <>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(perm.user.nom, perm.user.prenom)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{perm.user.prenom} {perm.user.nom}</p>
                            <p className="text-xs text-muted-foreground truncate">{perm.user.email}</p>
                          </div>
                        </>
                      ) : perm.group ? (
                        <>
                          <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: perm.group.color || '#6366f1' }}>
                            <Users className="h-4 w-4 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{perm.group.name}</p>
                            <Badge variant="outline" className="text-xs">Groupe</Badge>
                          </div>
                        </>
                      ) : null}
                      <Badge variant="secondary" className="text-xs">{PERMISSION_LABELS[perm.access_level] || perm.access_level}</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemove(perm.id)} aria-label="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
