import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit, Key, Loader2, ShieldOff, UserX } from "lucide-react";
import { rolesConfig, teamsConfig, type AppRole, type UserFormData } from "../GestionUtilisateurs.config";
import type { ProfileWithRole } from "@/hooks/profile/useProfilesWithRoles";
import type { EditingUser } from "@/types/ui-states";
import { EmailAccountsSection } from "./EmailAccountsSection";

interface RoleInfo {
  icon: React.ElementType;
  team: keyof typeof teamsConfig;
  color: string;
  bgColor: string;
  label: string;
}

interface Props {
  user: ProfileWithRole;
  getRoleInfo: (role: string) => RoleInfo;
  disablingUserId: string | null;
  editingUser: EditingUser;
  setEditingUser: (u: EditingUser) => void;
  formData: UserFormData;
  setFormData: (d: UserFormData) => void;
  updateProfilePending: boolean;
  onToggleStatus: (u: ProfileWithRole) => void;
  onOpenResetPassword: (u: ProfileWithRole) => void;
  onDisableUser: (u: ProfileWithRole) => void;
  onEdit: (u: ProfileWithRole) => void;
  onEditSubmit: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
}

export function UserTableRow({
  user,
  getRoleInfo,
  disablingUserId,
  editingUser,
  setEditingUser,
  formData,
  setFormData,
  updateProfilePending,
  onToggleStatus,
  onOpenResetPassword,
  onDisableUser,
  onEdit,
  onEditSubmit,
  onDelete,
}: Props) {
  const roleInfo = getRoleInfo(user.role);
  const teamInfo = teamsConfig[roleInfo.team];
  const RoleIcon = roleInfo.icon;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{user.prenom} {user.nom}</div>
        <div className="text-xs text-muted-foreground sm:hidden">{user.email}</div>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-sm">{user.email}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`${roleInfo.color} ${roleInfo.bgColor}`}>
          <RoleIcon className="h-3 w-3 mr-1" />
          {roleInfo.label}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={`${teamInfo.color} ${teamInfo.bgColor}`}>
          {teamInfo.label}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex items-center gap-2">
          <Switch checked={user.actif} onCheckedChange={() => onToggleStatus(user)} />
          <span className={`text-xs ${user.actif ? "text-green-600" : "text-red-600"}`}>
            {user.actif ? "Actif" : "Inactif"}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          {/* Reset password */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenResetPassword(user)}
            title="Réinitialiser le mot de passe"
            aria-label="Clé"
          >
            <Key className="w-4 h-4" />
          </Button>

          {/* Disable + logout */}
          {user.actif && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Désactiver et déconnecter"
                  disabled={disablingUserId === user.id}
                  className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                  aria-label="Chargement"
                >
                  {disablingUserId === user.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldOff className="w-4 h-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Désactiver et déconnecter {user.prenom} {user.nom} ?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <span className="block">Cette action va :</span>
                    <span className="block">• Désactiver le compte immédiatement</span>
                    <span className="block">• Déconnecter toutes les sessions et appareils</span>
                    <span className="block">• Supprimer les notifications push</span>
                    <span className="block">• Supprimer les entrées de présence</span>
                    <span className="block">• Désactiver la synchronisation email</span>
                    <span className="block font-medium text-foreground mt-2">Le compte pourra être réactivé ultérieurement.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDisableUser(user)} className="bg-amber-600 text-white hover:bg-amber-700">
                    <ShieldOff className="w-4 h-4 mr-2" />
                    Désactiver et déconnecter
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Edit dialog */}
          <Dialog open={editingUser?.id === user.id} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => onEdit(user)} aria-label="Modifier">
                <Edit className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Modifier {user.prenom} {user.nom}</DialogTitle>
              </DialogHeader>
              <form onSubmit={onEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-prenom">Prénom</Label>
                    <Input
                      id="edit-prenom"
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-nom">Nom</Label>
                    <Input
                      id="edit-nom"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-role">Rôle & Équipe</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value as AppRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(rolesConfig).map(([key, config]) => {
                        const Icon = config.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${config.color}`} />
                              <span>{config.label}</span>
                              <Badge variant="outline" className={`ml-2 text-xs ${config.color} ${config.bgColor}`}>
                                {teamsConfig[config.team].label}
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-actif"
                    checked={formData.actif}
                    onCheckedChange={(checked) => setFormData({ ...formData, actif: checked })}
                  />
                  <Label htmlFor="edit-actif">Compte actif</Label>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={updateProfilePending}>
                    {updateProfilePending ? "Mise à jour..." : "Enregistrer"}
                  </Button>
                </div>
              </form>

              {editingUser && (
                <EmailAccountsSection
                  profileId={editingUser.id}
                  prenom={editingUser.prenom}
                  nom={editingUser.nom}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Offboarding */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Offboarding" aria-label="Désactiver l'utilisateur">
                <UserX className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Offboarding de {user.prenom} {user.nom} ?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">Ce processus va :</span>
                  <span className="block">• Désactiver le compte (connexion impossible)</span>
                  <span className="block">• Supprimer les calendriers et partages</span>
                  <span className="block">• Réassigner les tâches en cours</span>
                  <span className="block">• Désactiver la synchronisation email</span>
                  <span className="block font-medium text-foreground">Les documents RH et dossiers sont conservés.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(user.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <UserX className="w-4 h-4 mr-2" />
                  Confirmer l'offboarding
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
