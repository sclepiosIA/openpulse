import { useState, useRef } from 'react'
import { debug } from '@/lib/debug'
import {
  Archive,
  Camera,
  Crown,
  Edit2,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  LogOut,
  MoreHorizontal,
  Save,
  Settings,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useUpdatePulseConversation,
  useArchivePulseConversation,
  useRemovePulseConversationMember,
  useUpdatePulseConversationMemberRole,
} from '@/hooks/pulse/usePulseConversations'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PulseConversation, PulsePresence } from '@/types/pulse'
import { AddMemberDialog } from './AddMemberDialog'
import { supabase } from '@/integrations/supabase/client'

interface ConversationSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: PulseConversation
  onlineUsers?: PulsePresence[]
}

// Generate a deterministic color based on string hash
function getAvatarColor(str: string): string {
  const colors = [
    'from-blue-400 to-blue-600',
    'from-emerald-400 to-emerald-600',
    'from-violet-400 to-violet-600',
    'from-amber-400 to-amber-600',
    'from-rose-400 to-rose-600',
    'from-cyan-400 to-cyan-600',
    'from-indigo-400 to-indigo-600',
    'from-teal-400 to-teal-600',
  ]

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ConversationSettingsSheet({
  open,
  onOpenChange,
  conversation,
  onlineUsers = [],
}: ConversationSettingsSheetProps) {
  const { user } = useAuth()
  const { data: currentProfile } = useCurrentProfile()
  const updateConversation = useUpdatePulseConversation()
  const archiveConversation = useArchivePulseConversation()
  const removeMember = useRemovePulseConversationMember()
  const updateRole = useUpdatePulseConversationMemberRole()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(conversation.name)
  const [description, setDescription] = useState(conversation.description || '')
  const [isPrivate, setIsPrivate] = useState(conversation.visibility === 'private')
  const [isEditing, setIsEditing] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    ((conversation.metadata as Record<string, unknown>)?.avatar_url as string) || null
  )

  const members = conversation.members || []
  const isCreator = conversation.created_by === currentProfile?.id
  const isRoleAdmin = members.some((m) => m.user_id === currentProfile?.id && m.role === 'admin')
  // Le créateur OU un admin peut modifier la conversation
  const canManage = isCreator || isRoleAdmin
  const metadata = conversation.metadata as Record<string, unknown> | null
  const type = metadata?.type as string | undefined
  const colorClass = getAvatarColor(conversation.name)

  const isOnline = (userId: string) => {
    return onlineUsers.some((u) => u.user_id === userId && u.status === 'active')
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo")
      return
    }

    setIsUploadingAvatar(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${conversation.id}-${Date.now()}.${fileExt}`
      const filePath = `pulse-avatars/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath)

      // Update conversation metadata with avatar
      const newMetadata = {
        ...((conversation.metadata as Record<string, unknown>) || {}),
        avatar_url: publicUrl,
      }

      await updateConversation.mutateAsync({
        id: conversation.id,
        metadata: newMetadata,
      } as any)

      setAvatarUrl(publicUrl)
      toast.success('Avatar mis à jour')
    } catch (error) {
      debug.error('Error uploading avatar:', error)
      toast.error("Erreur lors de l'upload de l'avatar")
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      const newMetadata = {
        ...((conversation.metadata as Record<string, unknown>) || {}),
        avatar_url: null,
      }

      await updateConversation.mutateAsync({
        id: conversation.id,
        metadata: newMetadata,
      } as any)

      setAvatarUrl(null)
      toast.success('Avatar supprimé')
    } catch (error) {
      debug.error('Error removing avatar:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleSave = () => {
    updateConversation.mutate(
      {
        id: conversation.id,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility: isPrivate ? 'private' : 'public',
      } as any,
      {
        onSuccess: () => {
          setIsEditing(false)
        },
      }
    )
  }

  const handleArchive = () => {
    archiveConversation.mutate(conversation.id, {
      onSuccess: () => {
        setShowArchiveDialog(false)
        onOpenChange(false)
      },
    })
  }

  const handleLeave = () => {
    if (!currentProfile?.id) return

    removeMember.mutate(
      {
        conversationId: conversation.id,
        userId: currentProfile.id,
      },
      {
        onSuccess: () => {
          setShowLeaveDialog(false)
          onOpenChange(false)
        },
      }
    )
  }

  const handleRemoveMember = (userId: string) => {
    if (confirm('Retirer ce membre de la conversation ?')) {
      removeMember.mutate({
        conversationId: conversation.id,
        userId,
      })
    }
  }

  const handleCancelEdit = () => {
    setName(conversation.name)
    setDescription(conversation.description || '')
    setIsPrivate(conversation.visibility === 'private')
    setIsEditing(false)
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <Badge variant="default" className="gap-1 h-5 text-xs">
            <Crown className="h-2.5 w-2.5" />
            Admin
          </Badge>
        )
      case 'guest':
        return (
          <Badge variant="secondary" className="h-5 text-xs">
            Invité
          </Badge>
        )
      default:
        return null
    }
  }

  // Sort members: admins first, then by name
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1
    if (a.role !== 'admin' && b.role === 'admin') return 1
    const nameA = `${a.user?.prenom} ${a.user?.nom}`.toLowerCase()
    const nameB = `${b.user?.prenom} ${b.user?.nom}`.toLowerCase()
    return nameA.localeCompare(nameB)
  })

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Gérer la conversation
            </SheetTitle>
            <SheetDescription>
              Avatar, membres et paramètres de "{conversation.name}"
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="py-6 space-y-6">
              {/* Avatar Section */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-primary" />
                  Avatar de la conversation
                </h4>

                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 ring-4 ring-background shadow-xl">
                      {avatarUrl ? (
                        <AvatarImage
                          src={avatarUrl}
                          alt={conversation.name}
                          className="object-cover"
                        />
                      ) : null}
                      <AvatarFallback
                        className={cn(
                          'text-2xl font-bold text-white bg-gradient-to-br',
                          colorClass
                        )}
                      >
                        {getInitials(conversation.name)}
                      </AvatarFallback>
                    </Avatar>

                    {canManage && (
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-white hover:bg-card/20"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          aria-label="Chargement"
                        >
                          {isUploadingAvatar ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                        </Button>
                        {avatarUrl && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-white hover:bg-card/20"
                            onClick={handleRemoveAvatar}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </div>

                  {canManage ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <ImagePlus className="h-4 w-4 mr-1" />
                        )}
                        {avatarUrl ? 'Changer' : 'Ajouter un avatar'}
                      </Button>
                      {avatarUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveAvatar}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">
                      {avatarUrl
                        ? 'Avatar personnalisé'
                        : "Seuls les admins peuvent modifier l'avatar"}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Edit mode or display mode */}
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-name">Nom de la conversation</Label>
                    <Input
                      id="conv-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nom de la conversation"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conv-description">Description (optionnelle)</Label>
                    <Textarea
                      id="conv-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Décrivez le sujet de cette conversation..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="space-y-0.5">
                      <Label htmlFor="visibility" className="text-sm font-medium">
                        Conversation privée
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {isPrivate
                          ? 'Visible uniquement par les membres'
                          : "Visible par toute l'équipe"}
                      </p>
                    </div>
                    <Switch id="visibility" checked={isPrivate} onCheckedChange={setIsPrivate} />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={!name.trim() || updateConversation.isPending}
                      className="flex-1"
                    >
                      {updateConversation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Enregistrer
                    </Button>
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/50 border">
                    <h4 className="font-semibold text-lg">{conversation.name}</h4>
                    {conversation.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {conversation.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background">
                        {conversation.visibility === 'private' ? (
                          <>
                            <EyeOff className="h-3 w-3" />
                            <span>Privée</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" />
                            <span>Publique</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background">
                        <Users className="h-3 w-3" />
                        <span>
                          {members.length} membre{members.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <Button variant="outline" onClick={() => setIsEditing(true)} className="w-full">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Modifier les paramètres
                    </Button>
                  )}
                </div>
              )}

              <Separator />

              {/* Members Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Membres ({members.length})
                  </h4>
                  {canManage && (
                    <Button size="sm" onClick={() => setShowAddMemberDialog(true)}>
                      <UserPlus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>

                <div className="space-y-1 max-h-[250px] overflow-y-auto rounded-lg border p-1">
                  {sortedMembers.map((member) => {
                    const online = isOnline(member.user_id)
                    const isCurrentUser = member.user_id === user?.id
                    const memberColorClass = getAvatarColor(
                      `${member.user?.prenom} ${member.user?.nom}`
                    )

                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            {member.user?.avatar_url ? (
                              <AvatarImage src={member.user.avatar_url} className="object-cover" />
                            ) : null}
                            <AvatarFallback
                              className={cn(
                                'text-xs font-semibold text-white bg-gradient-to-br',
                                memberColorClass
                              )}
                            >
                              {getInitials(
                                `${member.user?.prenom || ''} ${member.user?.nom || ''}`
                              )}
                            </AvatarFallback>
                          </Avatar>
                          {online && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-sm font-medium truncate',
                                isCurrentUser && 'text-primary'
                              )}
                            >
                              {member.user?.prenom} {member.user?.nom}
                              {isCurrentUser && ' (vous)'}
                            </span>
                            {getRoleBadge(member.role)}
                          </div>
                        </div>

                        {canManage && !isCurrentUser && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label="Plus d'options"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-[9999]">
                              {member.role !== 'admin' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateRole.mutate({
                                      conversationId: conversation.id,
                                      userId: member.user_id,
                                      role: 'admin',
                                    })
                                  }
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Promouvoir admin
                                </DropdownMenuItem>
                              )}
                              {member.role === 'admin' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateRole.mutate({
                                      conversationId: conversation.id,
                                      userId: member.user_id,
                                      role: 'member',
                                    })
                                  }
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
                                Retirer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <Separator />

              {/* Danger zone */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Actions</h4>

                {/* Leave conversation */}
                {!isCreator && (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    onClick={() => setShowLeaveDialog(true)}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Quitter la conversation
                  </Button>
                )}

                {/* Archive (admin only) */}
                {canManage && (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowArchiveDialog(true)}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archiver la conversation
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={showAddMemberDialog}
        onOpenChange={setShowAddMemberDialog}
        conversationId={conversation.id}
        existingMemberIds={members.map((m) => m.user_id)}
      />

      {/* Archive confirmation */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver cette conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              La conversation sera archivée et ne sera plus visible dans la liste. Les messages
              seront conservés et pourront être restaurés ultérieurement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={archiveConversation.isPending}
            >
              {archiveConversation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave confirmation */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitter cette conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous ne recevrez plus de notifications pour cette conversation. Un administrateur
              pourra vous réinviter ultérieurement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              className="bg-amber-600 text-white hover:bg-amber-700"
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Quitter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
