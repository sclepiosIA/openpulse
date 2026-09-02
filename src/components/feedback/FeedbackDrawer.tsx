import { useState, useEffect } from 'react'
import { debug } from '@/lib/debug'
import { useLocation } from 'react-router-dom'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useToast } from '@/hooks/shared/use-toast'
import { useAuth } from '@/components/AuthProvider'
import { uploadPublicFile } from '@/services/storage/publicUploads'
import { fromExtended } from '@/lib/supabaseTyped'
import { consoleCapture } from '@/lib/consoleCapture'
import {
  Bug,
  Lightbulb,
  HelpCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Image,
  Terminal,
  Send,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeedbackDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  screenshot: Blob | null
}

type FeedbackType = 'bug' | 'amelioration' | 'question' | 'autre'
type Priority = 'low' | 'medium' | 'high' | 'critical'

const feedbackTypes: {
  value: FeedbackType
  label: string
  icon: React.ElementType
  color: string
}[] = [
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-destructive' },
  { value: 'amelioration', label: 'Amélioration', icon: Lightbulb, color: 'text-amber-500' },
  { value: 'question', label: 'Question', icon: HelpCircle, color: 'text-blue-500' },
  { value: 'autre', label: 'Autre', icon: MessageSquare, color: 'text-muted-foreground' },
]

const priorities: { value: Priority; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'low', label: 'Basse', icon: Minus, color: 'text-muted-foreground' },
  { value: 'medium', label: 'Moyenne', icon: Info, color: 'text-blue-500' },
  { value: 'high', label: 'Haute', icon: AlertCircle, color: 'text-amber-500' },
  { value: 'critical', label: 'Critique', icon: AlertTriangle, color: 'text-destructive' },
]

export function FeedbackDrawer({ open, onOpenChange, screenshot }: FeedbackDrawerProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const location = useLocation()

  const [type, setType] = useState<FeedbackType>('bug')
  const [priority, setPriority] = useState<Priority>('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isLogsOpen, setIsLogsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)

  useEffect(() => {
    if (screenshot) {
      const url = URL.createObjectURL(screenshot)
      setScreenshotPreview(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setScreenshotPreview(null)
    }
  }, [screenshot])

  useEffect(() => {
    if (!open) {
      setType('bug')
      setPriority('medium')
      setTitle('')
      setDescription('')
      setIsLogsOpen(false)
    }
  }, [open])

  const logs = consoleCapture.getLogs()
  const errorLogs = consoleCapture.getErrorLogs()

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: 'Titre requis',
        description: 'Veuillez donner un titre à votre retour.',
        variant: 'destructive',
      })
      return
    }

    if (!user) {
      toast({
        title: 'Non connecté',
        description: 'Vous devez être connecté pour envoyer un feedback.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      let screenshotUrl: string | null = null

      if (screenshot) {
        const fileName = `${user.id}/${Date.now()}-feedback.png`
        try {
          const { publicUrl } = await uploadPublicFile(
            'feedback-screenshots',
            fileName,
            screenshot,
            {
              contentType: 'image/png',
              upsert: false,
            }
          )
          screenshotUrl = publicUrl
        } catch (uploadError) {
          debug.error('[FeedbackDrawer] Erreur upload screenshot:', uploadError)
        }
      }

      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        timestamp: new Date().toISOString(),
      }

      const { error: insertError } = await fromExtended('user_feedbacks').insert({
        user_id: user.id,
        type,
        priority,
        title: title.trim(),
        description: description.trim() || null,
        screenshot_url: screenshotUrl,
        current_route: location.pathname + location.search,
        console_logs: logs.length > 0 ? logs : null,
        browser_info: browserInfo,
      })

      if (insertError) {
        throw insertError
      }

      toast({
        title: 'Merci pour votre retour ! 🙏',
        description: 'Votre feedback a été envoyé avec succès.',
      })

      onOpenChange(false)
    } catch (error) {
      debug.error('[FeedbackDrawer] Erreur soumission:', error)
      toast({
        title: 'Erreur',
        description: "Impossible d'envoyer le feedback. Veuillez réessayer.",
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Donner un retour
          </DrawerTitle>
          <DrawerDescription>Signalez un bug ou suggérez une amélioration.</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            {/* Type de feedback */}
            <div className="space-y-2">
              <Label className="text-xs">Type de retour</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {feedbackTypes.map((ft) => {
                  const Icon = ft.icon
                  return (
                    <Button
                      key={ft.value}
                      type="button"
                      variant={type === ft.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setType(ft.value)}
                      className={cn(
                        'flex flex-col h-auto py-2 gap-0.5',
                        type === ft.value && 'ring-2 ring-primary'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', type !== ft.value && ft.color)} />
                      <span className="text-[10px]">{ft.label}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Priorité */}
            <div className="space-y-2">
              <Label className="text-xs">Priorité</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {priorities.map((p) => {
                  const Icon = p.icon
                  return (
                    <Button
                      key={p.value}
                      type="button"
                      variant={priority === p.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPriority(p.value)}
                      className={cn(
                        'flex items-center justify-center gap-1 h-8',
                        priority === p.value && 'ring-2 ring-primary'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', priority !== p.value && p.color)} />
                      <span className="text-[10px]">{p.label}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Titre */}
            <div className="space-y-1.5">
              <Label htmlFor="feedback-title-mobile" className="text-xs">
                Titre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="feedback-title-mobile"
                placeholder="Décrivez brièvement..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="h-9"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="feedback-description-mobile" className="text-xs">
                Description (optionnel)
              </Label>
              <Textarea
                id="feedback-description-mobile"
                placeholder="Plus de détails..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Aperçu capture d'écran */}
            {screenshotPreview && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Image className="h-3.5 w-3.5" />
                  Capture d'écran
                </Label>
                <div className="relative rounded-lg border overflow-hidden bg-muted">
                  <img
                    src={screenshotPreview}
                    alt="Capture d'écran"
                    className="w-full h-24 object-cover object-top"
                  />
                  <div className="absolute bottom-1 right-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                      Jointe auto.
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Logs console (collapsible) */}
            <Collapsible open={isLogsOpen} onOpenChange={setIsLogsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between px-2 h-8"
                >
                  <span className="flex items-center gap-1.5 text-xs">
                    <Terminal className="h-3.5 w-3.5" />
                    Logs ({logs.length})
                    {errorLogs.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        {errorLogs.length}
                      </Badge>
                    )}
                  </span>
                  {isLogsOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1.5 rounded-lg bg-muted p-2 max-h-32 overflow-auto font-mono text-[10px]">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground">Aucun log</p>
                  ) : (
                    logs.slice(-10).map((log, i) => {
                      const time = new Date(log.timestamp).toLocaleTimeString('fr-FR')
                      const levelColors = {
                        log: 'text-foreground',
                        info: 'text-blue-500',
                        warn: 'text-amber-500',
                        error: 'text-destructive',
                      }
                      return (
                        <div
                          key={`${log.timestamp}-${i}`}
                          className={cn('mb-0.5 truncate', levelColors[log.level])}
                        >
                          <span className="text-muted-foreground">[{time}]</span>{' '}
                          {log.args.join(' ').substring(0, 50)}
                        </div>
                      )
                    })
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        <DrawerFooter className="pt-2 border-t">
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1 h-10"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 h-10 bg-amber-600 hover:bg-amber-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="mr-1.5 h-4 w-4" />
                  Envoyer
                </>
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
