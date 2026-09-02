import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, UserPlus, Users, Trash2, Loader2 } from "lucide-react";
import { useDocumentShares, useShareDocument, useUnshareDocument, useUpdateDocumentShare } from "@/hooks/documents/useDocumentPermissions";
import { useUserGroups } from "@/hooks/documents/useUserGroups";
import { useAuth } from "@/hooks/shared/useAuth";
import type { DocumentWithRelations } from "@/types/documents";
import type { PermissionLevel } from "@/types/documents/permissions";
import { PERMISSION_LABELS } from "@/types/documents/permissions";
import { logDocumentAudit } from "@/hooks/documents/useDocumentAuditLog";
import { useProfileSearch } from "@/hooks/profile/useProfileSearch";

interface ShareDocumentDialogProps {
  document: DocumentWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDocumentDialog({ document, open, onOpenChange }: ShareDocumentDialogProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>("view");
  const [tab, setTab] = useState("users");

  const { data: shares = [], isLoading: sharesLoading } = useDocumentShares(document?.id ?? null);
  const { data: groups = [] } = useUserGroups();
  const shareMutation = useShareDocument();
  const unshareMutation = useUnshareDocument();
  const updateShareMutation = useUpdateDocumentShare();

  const { data: searchResults = [] } = useProfileSearch(searchQuery, {
    queryKey: 'search-profiles',
    includeUserId: true,
    excludeUserId: user?.id ?? null,
  });

  const handleShareUser = (authUserId: string) => {
    if (!document) return;
    if (shares.some(s => s.shared_with_user_id === authUserId)) return;
    shareMutation.mutate({
      documentId: document.id,
      documentName: document.name,
      userId: authUserId,
      permissionLevel: selectedPermission,
    });
    void logDocumentAudit(document.id, "shared", { target: "user", target_id: authUserId, level: selectedPermission });
    setSearchQuery("");
  };

  const handleShareGroup = (groupId: string) => {
    if (!document) return;
    if (shares.some(s => s.shared_with_group_id === groupId)) return;
    shareMutation.mutate({
      documentId: document.id,
      documentName: document.name,
      groupId,
      permissionLevel: selectedPermission,
    });
    void logDocumentAudit(document.id, "shared", { target: "group", target_id: groupId, level: selectedPermission });
  };

  const handleRemove = (shareId: string) => {
    if (!document) return;
    unshareMutation.mutate({ shareId, documentId: document.id });
    void logDocumentAudit(document.id, "permission_changed", { share_id: shareId, change: "removed" });
  };

  const handleUpdatePermission = (shareId: string, level: PermissionLevel) => {
    if (!document) return;
    updateShareMutation.mutate({ shareId, permissionLevel: level, documentId: document.id });
    void logDocumentAudit(document.id, "permission_changed", { share_id: shareId, new_level: level });
  };

  const getInitials = (nom: string | null, prenom: string | null) => {
    return `${(prenom || '')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Partager le document</DialogTitle>
          <DialogDescription className="truncate">
            {document?.name}
          </DialogDescription>
        </DialogHeader>

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
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedPermission} onValueChange={(v) => setSelectedPermission(v as PermissionLevel)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERMISSION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search results */}
            {searchQuery.length >= 2 && searchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                {searchResults.map(profile => profile.user_id ? (
                  <button
                    key={profile.id}
                    className="flex items-center gap-3 w-full p-2.5 hover:bg-accent/50 text-left transition-colors"
                    onClick={() => handleShareUser(profile.user_id!)}
                    disabled={shares.some(s => s.shared_with_user_id === profile.user_id)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(profile.nom, profile.prenom)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{profile.prenom} {profile.nom}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                    </div>
                    {shares.some(s => s.shared_with_user_id === profile.user_id) && (
                      <Badge variant="secondary" className="text-xs">Déjà partagé</Badge>
                    )}
                  </button>
                ) : null)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups" className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <Select value={selectedPermission} onValueChange={(v) => setSelectedPermission(v as PermissionLevel)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERMISSION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {groups.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Aucun groupe créé</p>
              ) : groups.map(group => {
                const alreadyShared = shares.some(s => s.shared_with_group_id === group.id);
                return (
                  <button
                    key={group.id}
                    className="flex items-center gap-3 w-full p-2.5 hover:bg-accent/50 text-left transition-colors"
                    onClick={() => handleShareGroup(group.id)}
                    disabled={alreadyShared}
                  >
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: group.color || '#6366f1' }}>
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.member_count} membre(s)</p>
                    </div>
                    {alreadyShared && <Badge variant="secondary" className="text-xs">Déjà partagé</Badge>}
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Current shares */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Partages actifs</h4>
          {sharesLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : shares.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">Aucun partage</p>
          ) : (
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {shares.map(share => (
                <div key={share.id} className="flex items-center gap-3 p-2.5">
                  {share.shared_with_user ? (
                    <>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(share.shared_with_user.nom, share.shared_with_user.prenom)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {share.shared_with_user.prenom} {share.shared_with_user.nom}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{share.shared_with_user.email}</p>
                      </div>
                    </>
                  ) : share.shared_with_group ? (
                    <>
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: share.shared_with_group.color || '#6366f1' }}>
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{share.shared_with_group.name}</p>
                        <Badge variant="outline" className="text-xs">Groupe</Badge>
                      </div>
                    </>
                  ) : null}
                  <Select
                    value={share.permission_level}
                    onValueChange={(v) => handleUpdatePermission(share.id, v as PermissionLevel)}
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PERMISSION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemove(share.id)} aria-label="Supprimer">
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
