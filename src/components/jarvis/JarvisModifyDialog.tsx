/**
 * JarvisModifyDialog - Dialog pour modifier une action avant approbation - Premium Immersive
 */

import { useState, useEffect } from 'react'
import {
  Pencil,
  Mail,
  CheckSquare,
  Building2,
  Calendar,
  Ticket,
  Save,
  X,
  Sparkles,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { JarvisPendingAction, JarvisActionData } from '@/types/jarvis'

interface JarvisModifyDialogProps {
  action: JarvisPendingAction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaveAndApprove: (actionId: string, modifications: Partial<JarvisActionData>) => Promise<void>
  isLoading?: boolean
}

const ACTION_CONFIG = {
  send_email: {
    icon: Mail,
    label: "Modifier l'email",
    color: 'text-sky-500',
    bg: 'bg-gradient-to-br from-sky-500/15 to-sky-500/5 ring-sky-500/20',
  },
  create_task: {
    icon: CheckSquare,
    label: 'Modifier la tâche',
    color: 'text-emerald-500',
    bg: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 ring-emerald-500/20',
  },
  update_status: {
    icon: Building2,
    label: 'Modifier le statut',
    color: 'text-purple-500',
    bg: 'bg-gradient-to-br from-purple-500/15 to-purple-500/5 ring-purple-500/20',
  },
  schedule_meeting: {
    icon: Calendar,
    label: 'Modifier la réunion',
    color: 'text-pink-500',
    bg: 'bg-gradient-to-br from-pink-500/15 to-pink-500/5 ring-pink-500/20',
  },
  close_ticket: {
    icon: Ticket,
    label: 'Modifier la clôture',
    color: 'text-amber-500',
    bg: 'bg-gradient-to-br from-amber-500/15 to-amber-500/5 ring-amber-500/20',
  },
}

export function JarvisModifyDialog({
  action,
  open,
  onOpenChange,
  onSaveAndApprove,
  isLoading = false,
}: JarvisModifyDialogProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (action?.proposed_action?.data) {
      setFormData(action.proposed_action.data as Record<string, unknown>)
    }
  }, [action])

  const handleSave = async () => {
    if (!action) return
    await onSaveAndApprove(action.id, formData as Partial<JarvisActionData>)
    onOpenChange(false)
  }

  const actionType = action?.proposed_action?.type
  const config = ACTION_CONFIG[actionType as keyof typeof ACTION_CONFIG] || {
    icon: Pencil,
    label: "Modifier l'action",
    color: 'text-primary',
    bg: 'bg-gradient-to-br from-primary/15 to-primary/5 ring-primary/20',
  }
  const Icon = config.icon

  const renderFormFields = () => {
    switch (actionType) {
      case 'send_email':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to" className="text-sm font-medium">
                Destinataire
              </Label>
              <Input
                id="to"
                value={(formData.to as string) || ''}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                placeholder="email@exemple.com"
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-sm font-medium">
                Sujet
              </Label>
              <Input
                id="subject"
                value={(formData.subject as string) || ''}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Sujet de l'email"
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body" className="text-sm font-medium">
                Contenu
              </Label>
              <Textarea
                id="body"
                value={(formData.body as string) || ''}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Corps de l'email..."
                rows={8}
                className="font-mono text-sm bg-muted/30 border-border/50"
              />
            </div>
          </div>
        )

      case 'create_task':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titre" className="text-sm font-medium">
                Titre de la tâche
              </Label>
              <Input
                id="titre"
                value={(formData.titre as string) || ''}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Titre de la tâche"
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                value={(formData.description as string) || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de la tâche..."
                rows={4}
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priorite" className="text-sm font-medium">
                  Priorité
                </Label>
                <Select
                  value={(formData.priorite as string) || 'moyenne'}
                  onValueChange={(value) => setFormData({ ...formData, priorite: value })}
                >
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basse">🟢 Basse</SelectItem>
                    <SelectItem value="moyenne">🟡 Moyenne</SelectItem>
                    <SelectItem value="haute">🟠 Haute</SelectItem>
                    <SelectItem value="urgente">🔴 Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_echeance" className="text-sm font-medium">
                  Échéance
                </Label>
                <Input
                  id="date_echeance"
                  type="date"
                  value={(formData.date_echeance as string)?.split('T')[0] || ''}
                  onChange={(e) => setFormData({ ...formData, date_echeance: e.target.value })}
                  className="bg-muted/30 border-border/50"
                />
              </div>
            </div>
          </div>
        )

      case 'update_status':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entity_type" className="text-sm font-medium">
                Type d'entité
              </Label>
              <Input
                id="entity_type"
                value={(formData.entity_type as string) || ''}
                disabled
                className="bg-muted/50 border-border/30 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_status" className="text-sm font-medium">
                Nouveau statut
              </Label>
              <Input
                id="new_status"
                value={(formData.new_status as string) || ''}
                onChange={(e) => setFormData({ ...formData, new_status: e.target.value })}
                placeholder="Nouveau statut"
                className="bg-muted/30 border-border/50"
              />
            </div>
          </div>
        )

      case 'schedule_meeting':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Titre de la réunion
              </Label>
              <Input
                id="title"
                value={(formData.title as string) || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Titre de la réunion"
                className="bg-muted/30 border-border/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time" className="text-sm font-medium">
                  Début
                </Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={(formData.start_time as string)?.slice(0, 16) || ''}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="bg-muted/30 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time" className="text-sm font-medium">
                  Fin
                </Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  value={(formData.end_time as string)?.slice(0, 16) || ''}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="bg-muted/30 border-border/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">
                Lieu
              </Label>
              <Input
                id="location"
                value={(formData.location as string) || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Salle de réunion ou lien visio"
                className="bg-muted/30 border-border/50"
              />
            </div>
          </div>
        )

      case 'close_ticket':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resolution_note" className="text-sm font-medium">
                Note de résolution
              </Label>
              <Textarea
                id="resolution_note"
                value={(formData.resolution_note as string) || ''}
                onChange={(e) => setFormData({ ...formData, resolution_note: e.target.value })}
                placeholder="Décrivez comment le ticket a été résolu..."
                rows={4}
                className="bg-muted/30 border-border/50"
              />
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-muted/50 mb-3">
              <Pencil className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Type d'action non reconnu</p>
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Premium Header */}
        <div className="relative overflow-hidden bg-marque-grille px-6 py-5">
          <motion.div
            className="absolute rounded-full blur-2xl opacity-20"
            style={{
              width: 60,
              height: 60,
              background: 'hsl(197 64% 60% / 0.3)',
              right: '15%',
              top: '20%',
            }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          <DialogHeader className="space-y-1.5 relative">
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className={cn('p-2 rounded-xl ring-1', config.bg)}>
                <Icon className={cn('h-5 w-5', config.color)} />
              </div>
              {config.label}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Modifiez les détails avant d'approuver l'action
            </DialogDescription>
          </DialogHeader>

          <svg
            className="absolute bottom-0 left-0 right-0 w-full h-3"
            viewBox="0 0 1440 20"
            preserveAspectRatio="none"
          >
            <path
              d="M0,10 C240,17 480,3 720,10 C960,17 1200,3 1440,10 L1440,20 L0,20 Z"
              fill="hsl(var(--background))"
            />
          </svg>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{renderFormFields()}</div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 gap-2 bg-gradient-to-t from-muted/30 to-transparent">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-border/50"
          >
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer et approuver
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
