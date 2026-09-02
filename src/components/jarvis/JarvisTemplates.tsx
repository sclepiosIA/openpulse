/**
 * JarvisTemplates - Gestionnaire de templates d'actions Jarvis - Premium Immersive
 *
 * Utilise les données réelles depuis la table jarvis_action_templates
 * Inclut la gestion de la mémoire persistante de Jarvis
 */

import { useState } from 'react'
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Mail,
  CheckSquare,
  Calendar,
  MessageSquare,
  Sparkles,
  Lock,
  Loader2,
  Brain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useJarvisTemplates, type JarvisTemplate } from '@/hooks/jarvis/useJarvisTemplates'
import { JarvisMemoryManager } from './JarvisMemoryManager'
import type { JarvisActionType } from '@/types/jarvis'

const ACTION_CONFIG = {
  send_email: {
    icon: Mail,
    label: 'Email',
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-gradient-to-br from-sky-500/15 to-sky-500/5',
  },
  create_task: {
    icon: CheckSquare,
    label: 'Tâche',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5',
  },
  schedule_meeting: {
    icon: Calendar,
    label: 'Réunion',
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-gradient-to-br from-pink-500/15 to-pink-500/5',
  },
  draft_response: {
    icon: MessageSquare,
    label: 'Brouillon',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-gradient-to-br from-purple-500/15 to-purple-500/5',
  },
}

export function JarvisTemplates() {
  const {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    useTemplate,
    duplicateTemplate,
    isCreating,
    isUpdating,
    isDeleting,
  } = useJarvisTemplates()

  const [selectedTemplate, setSelectedTemplate] = useState<JarvisTemplate | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<{
    name?: string
    description?: string
    action_type?: JarvisActionType
    template_data?: Record<string, string>
  }>({})

  const handleUseTemplate = async (template: JarvisTemplate) => {
    // V3a: `useTemplate` est une mutation retournée par useJarvisTemplates(), pas un hook React.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await useTemplate(template.id)
  }

  const handleCreateTemplate = () => {
    setEditForm({
      name: '',
      description: '',
      action_type: 'send_email',
      template_data: {},
    })
    setIsEditing(true)
    setSelectedTemplate(null)
  }

  const handleEditTemplate = (template: JarvisTemplate) => {
    // Ne pas permettre l'édition des templates système
    if (template.is_system) return

    setEditForm({
      name: template.name,
      description: template.description || '',
      action_type: template.action_type,
      template_data: template.template_data,
    })
    setIsEditing(true)
    setSelectedTemplate(template)
  }

  const handleSaveTemplate = async () => {
    if (!editForm.name || !editForm.action_type) return

    try {
      if (selectedTemplate) {
        await updateTemplate({
          id: selectedTemplate.id,
          name: editForm.name,
          description: editForm.description,
          template_data: editForm.template_data,
        })
      } else {
        await createTemplate({
          name: editForm.name,
          description: editForm.description,
          action_type: editForm.action_type,
          template_data: editForm.template_data || {},
        })
      }
      setIsEditing(false)
      setEditForm({})
      setSelectedTemplate(null)
    } catch (error) {
      // Error handled by hook
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteTemplate(templateId)
  }

  const handleDuplicateTemplate = async (template: JarvisTemplate) => {
    await duplicateTemplate(template.id)
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-muted/30 to-transparent">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24 mt-1" />
            </div>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={`jarvis-templates-skeleton-${i}`} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Onglets internes Templates / Mémoire */}
      <Tabs defaultValue="templates" className="h-full flex flex-col">
        <div className="px-4 pt-4 pb-2 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-primary/10">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="memory" className="gap-2 data-[state=active]:bg-primary/10">
              <Brain className="h-4 w-4" />
              Mémoire
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Contenu Templates */}
        <TabsContent value="templates" className="flex-1 flex flex-col mt-0 overflow-hidden">
          {/* Header Templates */}
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl ring-1 ring-primary/20">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Templates Jarvis</h3>
                <p className="text-xs text-muted-foreground">
                  {templates.length} templates disponibles
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleCreateTemplate}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nouveau
            </Button>
          </div>

          {/* Liste des templates */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {templates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Aucun template</p>
                  <p className="text-sm mt-1">
                    Créez votre premier template pour automatiser vos actions
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {templates.map((template, index) => {
                    const config =
                      ACTION_CONFIG[template.action_type as keyof typeof ACTION_CONFIG] ||
                      ACTION_CONFIG.send_email
                    const Icon = config.icon

                    return (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="group hover:border-primary/30 hover:shadow-md transition-all bg-card/80 border-border/50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2.5 mb-1.5">
                                  <div
                                    className={cn(
                                      'p-1.5 rounded-lg ring-1 ring-border/30',
                                      config.bg
                                    )}
                                  >
                                    <Icon className={cn('h-4 w-4', config.color)} />
                                  </div>
                                  <span className="font-semibold">{template.name}</span>
                                  <Badge variant="outline" className="text-[10px] border-border/50">
                                    {config.label}
                                  </Badge>
                                  {template.is_system && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="secondary" className="text-[10px] gap-1">
                                          <Lock className="h-2.5 w-2.5" />
                                          Système
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Template système non modifiable. Dupliquez-le pour le
                                        personnaliser.
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2.5 leading-relaxed">
                                  {template.description || 'Pas de description'}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {template.variables.slice(0, 3).map((v) => (
                                    <Badge
                                      key={v}
                                      variant="secondary"
                                      className="text-[10px] bg-muted/50 hover:bg-muted"
                                    >
                                      {`{{${v}}}`}
                                    </Badge>
                                  ))}
                                  {template.variables.length > 3 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{template.variables.length - 3}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 hover:bg-primary/10"
                                      onClick={() => handleUseTemplate(template)}
                                      aria-label="Copier"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Utiliser ce template</TooltipContent>
                                </Tooltip>

                                {template.is_system ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:bg-muted"
                                        onClick={() => handleDuplicateTemplate(template)}
                                        aria-label="Ajouter"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Dupliquer pour personnaliser</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 hover:bg-muted"
                                      onClick={() => handleEditTemplate(template)}
                                      aria-label="Modifier"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>

                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                          aria-label="Supprimer"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            Supprimer ce template ?
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            "{template.name}" sera définitivement supprimé. Cette
                                            action est irréversible.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteTemplate(template.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            {isDeleting ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              'Supprimer'
                                            )}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                            </div>
                            {template.usage_count > 0 && (
                              <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3" />
                                Utilisé {template.usage_count} fois
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Contenu Mémoire */}
        <TabsContent value="memory" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
              <JarvisMemoryManager />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Dialog d'édition */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate ? '✏️ Modifier le template' : '✨ Nouveau template'}
            </DialogTitle>
            <DialogDescription>
              Créez un modèle réutilisable pour vos actions Jarvis
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-medium">Nom du template</Label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Email de relance"
                className="bg-muted/30"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medium">Description</Label>
              <Input
                value={editForm.description || ''}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Ex: Relance commerciale standard"
                className="bg-muted/30"
              />
            </div>

            {!selectedTemplate && (
              <div className="space-y-2">
                <Label className="font-medium">Type d'action</Label>
                <Select
                  value={editForm.action_type}
                  onValueChange={(v) =>
                    setEditForm((prev) => ({ ...prev, action_type: v as JarvisActionType }))
                  }
                >
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_email">📧 Envoi email</SelectItem>
                    <SelectItem value="create_task">✅ Création tâche</SelectItem>
                    <SelectItem value="schedule_meeting">📅 Planification</SelectItem>
                    <SelectItem value="draft_response">✏️ Brouillon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(editForm.action_type === 'send_email' ||
              selectedTemplate?.action_type === 'send_email') && (
              <>
                <div className="space-y-2">
                  <Label className="font-medium">Sujet</Label>
                  <Input
                    value={editForm.template_data?.subject || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        template_data: { ...prev.template_data, subject: e.target.value },
                      }))
                    }
                    placeholder="Ex: Relance - {{sujet}}"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Corps du message</Label>
                  <Textarea
                    value={editForm.template_data?.body || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        template_data: { ...prev.template_data, body: e.target.value },
                      }))
                    }
                    placeholder="Utilisez {{variable}} pour les champs dynamiques"
                    rows={6}
                    className="bg-muted/30"
                  />
                </div>
              </>
            )}

            {(editForm.action_type === 'create_task' ||
              selectedTemplate?.action_type === 'create_task') && (
              <>
                <div className="space-y-2">
                  <Label className="font-medium">Titre de la tâche</Label>
                  <Input
                    value={editForm.template_data?.titre || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        template_data: { ...prev.template_data, titre: e.target.value },
                      }))
                    }
                    placeholder="Ex: Traiter {{ticket}}"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Description</Label>
                  <Textarea
                    value={editForm.template_data?.description || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        template_data: { ...prev.template_data, description: e.target.value },
                      }))
                    }
                    rows={4}
                    className="bg-muted/30"
                  />
                </div>
              </>
            )}

            {(editForm.action_type === 'schedule_meeting' ||
              selectedTemplate?.action_type === 'schedule_meeting') && (
              <>
                <div className="space-y-2">
                  <Label className="font-medium">Titre de la réunion</Label>
                  <Input
                    value={editForm.template_data?.title || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        template_data: { ...prev.template_data, title: e.target.value },
                      }))
                    }
                    placeholder="Ex: Démonstration {{produit}} - {{client}}"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Description</Label>
                  <Textarea
                    value={editForm.template_data?.description || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        template_data: { ...prev.template_data, description: e.target.value },
                      }))
                    }
                    rows={4}
                    className="bg-muted/30"
                  />
                </div>
              </>
            )}

            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-3.5 rounded-xl border border-primary/20">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Utilisez{' '}
                <code className="bg-background px-1.5 py-0.5 rounded font-mono text-primary">
                  {'{{variable}}'}
                </code>{' '}
                pour les champs dynamiques
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!editForm.name || isCreating || isUpdating}
              className="bg-primary hover:bg-primary/90"
            >
              {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedTemplate ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
