import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Folder,
  Star,
  Flag,
  Inbox,
  Tag,
  Bookmark,
  Heart,
  Briefcase,
  Users,
  Zap,
} from 'lucide-react'
import type { EmailFolder } from '@/hooks/email/useEmailFolders'
import { useEmailFolders } from '@/hooks/email/useEmailFolders'

export const FOLDER_COLORS = [
  { value: 'primary', label: 'Primaire', className: 'bg-primary text-primary-foreground' },
  { value: 'accent', label: 'Accent', className: 'bg-accent text-accent-foreground' },
  { value: 'secondary', label: 'Neutre', className: 'bg-secondary text-secondary-foreground' },
  { value: 'destructive', label: 'Rouge', className: 'bg-destructive text-destructive-foreground' },
  { value: 'emerald', label: 'Vert', className: 'bg-emerald-500 text-white' },
  { value: 'amber', label: 'Ambre', className: 'bg-amber-500 text-white' },
  { value: 'sky', label: 'Ciel', className: 'bg-sky-500 text-white' },
  { value: 'violet', label: 'Violet', className: 'bg-violet-500 text-white' },
  { value: 'pink', label: 'Rose', className: 'bg-pink-500 text-white' },
] as const

export const FOLDER_ICONS = [
  { value: 'folder', Icon: Folder },
  { value: 'star', Icon: Star },
  { value: 'flag', Icon: Flag },
  { value: 'inbox', Icon: Inbox },
  { value: 'tag', Icon: Tag },
  { value: 'bookmark', Icon: Bookmark },
  { value: 'heart', Icon: Heart },
  { value: 'briefcase', Icon: Briefcase },
  { value: 'users', Icon: Users },
  { value: 'zap', Icon: Zap },
] as const

export function getFolderColorClass(color: string): string {
  return FOLDER_COLORS.find((c) => c.value === color)?.className ?? FOLDER_COLORS[0].className
}

export function getFolderIconComponent(icon: string | null | undefined) {
  const found = FOLDER_ICONS.find((i) => i.value === icon)
  return found?.Icon ?? Folder
}

interface EmailFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder?: EmailFolder | null
}

export function EmailFolderDialog({ open, onOpenChange, folder }: EmailFolderDialogProps) {
  const { createFolder, updateFolder } = useEmailFolders()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>('primary')
  const [icon, setIcon] = useState<string>('folder')

  useEffect(() => {
    if (open) {
      setName(folder?.name ?? '')
      setColor(folder?.color ?? 'primary')
      setIcon(folder?.icon ?? 'folder')
    }
  }, [open, folder])

  const isEdit = !!folder
  const isSubmitting = createFolder.isPending || updateFolder.isPending

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (isEdit && folder) {
      await updateFolder.mutateAsync({ id: folder.id, name: trimmed, color, icon })
    } else {
      await createFolder.mutateAsync({ name: trimmed, color, icon })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le dossier' : 'Nouveau dossier'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nom</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Urgent, Clients VIP, À relire…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) handleSubmit()
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all',
                    c.className,
                    color === c.value
                      ? 'ring-2 ring-ring ring-offset-2 scale-110'
                      : 'border-transparent'
                  )}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icône</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_ICONS.map((i) => {
                const IconCmp = i.Icon
                return (
                  <button
                    key={i.value}
                    type="button"
                    onClick={() => setIcon(i.value)}
                    className={cn(
                      'h-9 w-9 rounded-md border flex items-center justify-center transition-colors',
                      icon === i.value
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted/50 border-transparent hover:bg-muted'
                    )}
                    aria-label={i.value}
                  >
                    <IconCmp className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
