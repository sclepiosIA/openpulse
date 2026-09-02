import React, { useState, useMemo } from "react"
import { debug } from "@/lib/debug"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"

import { Users, Plus, Search, Filter, Shield, Briefcase, Headphones, Target, Loader2, RefreshCw, Eye, EyeOff, Copy } from "lucide-react"
import { rolesConfig, teamsConfig, type AppRole, type TeamType, type UserFormData } from "./GestionUtilisateurs.config"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { useProfilesWithRoles, type ProfileWithRole } from "@/hooks/profile/useProfilesWithRoles"
import { useCreateProfile, useUpdateProfile, useDeleteProfile } from "@/hooks/profile/useProfiles"
import { useAdminResetPassword, generateSecurePassword } from "@/hooks/auth/useAdminResetPassword"
import { useToast } from "@/hooks/shared/use-toast"
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { supabase } from "@/lib/supabaseBrowser";

import { AdminGuard } from "@/components/security/AdminGuard"
import { UnifiedPageHeader } from "@/components/layout/UnifiedPageHeader"
import { CollapsibleKPISection, KPIToggleButton } from "@/components/shared/CollapsibleKPISection"
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator"
import type { EditingUser, ResetPasswordUser } from "@/types/ui-states"
import { PageDataState } from "@/components/shared/PageDataState"
import { ResetPasswordDialog } from "./gestion-utilisateurs/ResetPasswordDialog"
import { UserTableRow } from "./gestion-utilisateurs/UserTableRow"

export default function GestionUtilisateurs() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<EditingUser>(null)
  const [formData, setFormData] = useState<UserFormData>({
    prenom: '',
    nom: '',
    email: '',
    role: 'commercial',
    password: '',
    actif: true
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  
  // États pour la réinitialisation du mot de passe
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState<ResetPasswordUser>(null)
  const [resetPassword, setResetPassword] = useState('')

  // État pour la désactivation avec déconnexion
  const [disablingUserId, setDisablingUserId] = useState<string | null>(null)

  const { data: profiles, isLoading } = useProfilesWithRoles()
  const createProfile = useCreateProfile()
  const updateProfile = useUpdateProfile()
  const deleteProfile = useDeleteProfile()
  const adminResetPassword = useAdminResetPassword()
  
  // Protection contre les rôles invalides
  const getRoleInfo = (role: string) => {
    return rolesConfig[role as AppRole] || { 
      label: role, 
      team: 'direction' as TeamType,
      color: "text-foreground dark:text-muted-foreground", 
      bgColor: "bg-gray-100 dark:bg-gray-900/30",
      icon: Users
    }
  }

  // Statistiques par équipe
  const teamStats = useMemo((): Record<TeamType, number> => {
    const stats: Record<TeamType, number> = {
      direction: 0,
      technique: 0,
      csm: 0,
      commercial: 0
    }
    
    if (!profiles) return stats
    
    profiles.forEach(profile => {
      const roleInfo = getRoleInfo(profile.role)
      stats[roleInfo.team]++
    })
    
    return stats
  }, [profiles])

  const filteredProfiles = useMemo(() => {
    return profiles?.filter(profile => {
      const matchesSearch = 
        profile.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.email.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesRole = roleFilter === "all" || profile.role === roleFilter
      
      const roleInfo = getRoleInfo(profile.role)
      const matchesTeam = teamFilter === "all" || roleInfo.team === teamFilter
      
      return matchesSearch && matchesRole && matchesTeam
    })
  }, [profiles, searchTerm, roleFilter, teamFilter])

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword(12)
    setFormData({ ...formData, password: newPassword })
  }

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(formData.password)
    toast({
      title: "Copié !",
      description: "Le mot de passe a été copié dans le presse-papier",
    })
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.prenom || !formData.nom || !formData.email || !formData.password) {
      toast({
        title: "Erreur",
        description: "Tous les champs obligatoires doivent être remplis",
        variant: "destructive"
      })
      return
    }

    if (formData.password.length < 8) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères",
        variant: "destructive"
      })
      return
    }

    setIsCreating(true)
    try {
      const { data: result, error: functionError } = await supabase.functions.invoke(
        'admin-create-user',
        {
          body: {
            email: formData.email,
            prenom: formData.prenom,
            nom: formData.nom,
            role: formData.role,
            password: formData.password
          }
        }
      )

      if (functionError) {
        throw new Error(functionError.message || "Erreur lors de la création de l'utilisateur")
      }

      if (result?.error) {
        throw new Error(result.error)
      }

      toast({
        title: "Utilisateur créé",
        description: `${formData.prenom} ${formData.nom} a été ajouté. Communiquez-lui son mot de passe initial.`,
      })

      setShowCreateDialog(false)
      resetForm()
      // Refresh data without full page reload
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } catch (error: unknown) {
      debug.error('Erreur lors de la création:', error)
      
      const errMsg = error instanceof Error ? error.message : '';
      let errorMessage = "Impossible de créer l'utilisateur"
      if (errMsg.includes('déjà utilisé')) {
        errorMessage = "Cet email est déjà utilisé"
      } else if (errMsg.includes('privilèges admin')) {
        errorMessage = "Vous devez être administrateur avec 2FA activé"
      } else if (errMsg) {
        errorMessage = errMsg
      }
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingUser || !formData.prenom || !formData.nom || !formData.email) {
      return
    }

    try {
      await updateProfile.mutateAsync({
        id: editingUser.id,
        data: {
          prenom: formData.prenom,
          nom: formData.nom,
          email: formData.email,
          role: formData.role,
          actif: formData.actif
        }
      })
      
      toast({
        title: "Utilisateur modifié",
        description: `${formData.prenom} ${formData.nom} a été mis à jour.`,
      })
      
      setEditingUser(null)
    } catch (error) {
      debug.error('Error updating profile:', error)
    }
  }

  const handleEdit = (user: ProfileWithRole) => {
    setEditingUser(user)
    setFormData({
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      role: user.role,
      password: '',
      actif: user.actif
    })
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProfile.mutateAsync(id)
    } catch (error) {
      debug.error('Error deleting profile:', error)
    }
  }

  const handleToggleStatus = async (user: ProfileWithRole) => {
    try {
      await updateProfile.mutateAsync({
        id: user.id,
        data: { actif: !user.actif }
      })
    } catch (error) {
      debug.error('Error updating user status:', error)
    }
  }

  const handleOpenResetPassword = (user: ProfileWithRole) => {
    setResetPasswordUser({ id: user.id, prenom: user.prenom, nom: user.nom, email: user.email })
    setResetPassword(generateSecurePassword(12))
    setShowResetPasswordDialog(true)
  }

  const handleDisableUser = async (user: ProfileWithRole) => {
    setDisablingUserId(user.id)
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-disable-user', {
        body: { target_profile_id: user.id }
      })

      if (error) throw new Error(error.message)
      if (result?.error) throw new Error(result.error)

      toast({
        title: "Compte désactivé",
        description: `${user.prenom} ${user.nom} a été désactivé et déconnecté de tous les appareils.`,
      })

      queryClient.invalidateQueries({ queryKey: ['profiles-with-roles'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } catch (error: unknown) {
      debug.error('Erreur désactivation utilisateur:', error)
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      })
    } finally {
      setDisablingUserId(null)
    }
  }

  const resetForm = () => {
    setFormData({
      prenom: '',
      nom: '',
      email: '',
      role: 'commercial',
      password: '',
      actif: true
    })
    setEditingUser(null)
    setShowPassword(false)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <PageDataState
          isLoading
          loadingLabel="Chargement des utilisateurs..."
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['profiles-with-roles'] })}
        >
          {null}
        </PageDataState>
      </div>
    )
  }

  return (
    <AdminGuard operationName="la gestion des utilisateurs" requireStrictAdmin={true}>
      <div className="w-full max-w-full overflow-x-hidden space-y-4 sm:space-y-6">
        {/* Header unifié */}
        <UnifiedPageHeader
          title="Gestion des utilisateurs"
          subtitle="Gérer les comptes, rôles et équipes"
          icon={Users}
          actions={
            <div className="flex items-center gap-2">
              <KPIToggleButton 
                storageKey="gestion-utilisateurs-stats-visible" 
                label="Stats"
                showIcon={true}
              />
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} size="sm" className="h-8">
                    <Plus className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Nouvel utilisateur</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
                    <DialogDescription>
                      Définissez un mot de passe initial que l'utilisateur devra changer à sa première connexion.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prenom">Prénom *</Label>
                        <Input
                          id="prenom"
                          value={formData.prenom}
                          onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nom">Nom *</Label>
                        <Input
                          id="nom"
                          value={formData.nom}
                          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Mot de passe initial *</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                            minLength={8}
                            className="pr-20"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setShowPassword(!showPassword)} aria-label="Masquer">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            {formData.password && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={handleCopyPassword} aria-label="Copier">
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGeneratePassword}
                          className="shrink-0"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Générer
                        </Button>
                      </div>
                      {formData.password && (
                        <PasswordStrengthIndicator password={formData.password} />
                      )}
                      <p className="text-xs text-muted-foreground">
                        L'utilisateur devra changer ce mot de passe à sa première connexion
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="role">Rôle & Équipe</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value as AppRole })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(rolesConfig).map(([key, config]) => {
                            const Icon = config.icon
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
                            )
                          })}
                        </SelectContent>
                      </Select>
                      {formData.role && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {teamsConfig[rolesConfig[formData.role].team].description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="actif"
                        checked={formData.actif}
                        onCheckedChange={(checked) => setFormData({ ...formData, actif: checked })}
                      />
                      <Label htmlFor="actif">Compte actif</Label>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Création...
                          </>
                        ) : "Créer"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          }
        />

        <div className="px-3 sm:px-4 lg:px-6 space-y-4 sm:space-y-6">

        {/* Stats par équipe - Collapsible */}
        <CollapsibleKPISection storageKey="gestion-utilisateurs-stats-visible" defaultOpen={true}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            {(Object.entries(teamsConfig) as [TeamType, typeof teamsConfig[TeamType]][]).map(([team, config]) => (
              <Card 
                key={team} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  teamFilter === team ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setTeamFilter(teamFilter === team ? 'all' : team)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
                      <p className="text-2xl font-bold">{teamStats[team] || 0}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      {team === 'direction' && <Shield className={`h-5 w-5 ${config.color}`} />}
                      {team === 'technique' && <Briefcase className={`h-5 w-5 ${config.color}`} />}
                      {team === 'csm' && <Headphones className={`h-5 w-5 ${config.color}`} />}
                      {team === 'commercial' && <Target className={`h-5 w-5 ${config.color}`} />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{config.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CollapsibleKPISection>

        {/* Filtres */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-2 w-full sm:w-auto">
                <Label htmlFor="search" className="text-xs">Rechercher</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Nom, prénom ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2 w-full sm:w-auto">
                <Label htmlFor="role-filter" className="text-xs">Rôle</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les rôles</SelectItem>
                    {Object.entries(rolesConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 w-full sm:w-auto">
                <Label htmlFor="team-filter" className="text-xs">Équipe</Label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {Object.entries(teamsConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSearchTerm("")
                  setRoleFilter("all")
                  setTeamFilter("all")
                }}
              >
                <Filter className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table utilisateurs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Utilisateurs ({filteredProfiles?.length || 0})
            </CardTitle>
            <CardDescription className="text-xs">
              Cliquez sur une carte d'équipe pour filtrer
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Équipe</TableHead>
                  <TableHead className="hidden md:table-cell">Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles?.map((user) => (
                  <UserTableRow
                    key={user.id}
                    user={user}
                    getRoleInfo={getRoleInfo}
                    disablingUserId={disablingUserId}
                    editingUser={editingUser}
                    setEditingUser={setEditingUser}
                    formData={formData}
                    setFormData={setFormData}
                    updateProfilePending={updateProfile.isPending}
                    onToggleStatus={handleToggleStatus}
                    onOpenResetPassword={handleOpenResetPassword}
                    onDisableUser={handleDisableUser}
                    onEdit={handleEdit}
                    onEditSubmit={handleEditSubmit}
                    onDelete={handleDelete}
                  />
                ))}
                
                {filteredProfiles?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucun utilisateur trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </div>

        {/* Dialog de réinitialisation de mot de passe */}
        <ResetPasswordDialog
          open={showResetPasswordDialog}
          onOpenChange={setShowResetPasswordDialog}
          user={resetPasswordUser}
          password={resetPassword}
          onPasswordChange={setResetPassword}
        />
      </div>
    </AdminGuard>
  )
}
