import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import {
  Loader2,
  Languages,
  Lightbulb,
  CheckCheck,
  Video,
  Sparkles,
  PenLine,
  Wand2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { EmailVisioInviteDialog } from './EmailVisioInviteDialog'
import { TranslationPreviewDialog } from './TranslationPreviewDialog'

interface ThreadParticipant {
  email: string
  name?: string
}

interface ThreadMessage {
  from_name?: string
  from_address: string
  body_text?: string
  sent_date: string
}

interface EmailAIAssistantProps {
  text: string
  onTextUpdate: (newText: string) => void
  etablissementId?: string
  onAnimationStateChange?: (isAnimating: boolean, isProcessing: boolean) => void
  threadParticipants?: ThreadParticipant[]
  threadSubject?: string
  threadMessages?: ThreadMessage[]
  onIcsGenerated?: (icsContent: string) => void
}

export function EmailAIAssistant({
  text,
  onTextUpdate,
  etablissementId,
  onAnimationStateChange,
  threadParticipants = [],
  threadSubject = '',
  threadMessages = [],
  onIcsGenerated,
}: EmailAIAssistantProps) {
  const [processing, setProcessing] = useState(false)
  const [operationType, setOperationType] = useState<
    'reformulate' | 'translate' | 'suggest' | 'correct' | 'helpwrite' | null
  >(null)
  const [showDirectionInput, setShowDirectionInput] = useState(false)
  const [replyDirection, setReplyDirection] = useState('')
  const [isGeneratingReply, setIsGeneratingReply] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showVisioDialog, setShowVisioDialog] = useState(false)
  const [senderName, setSenderName] = useState<string>('')
  const [senderFonction, setSenderFonction] = useState<string>('')
  const [translationPreview, setTranslationPreview] = useState<{
    original: string
    translated: string
    targetLang: string
  } | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  // Load user profile for sender identity
  useEffect(() => {
    if (!user?.id) return
    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('prenom, nom, fonction')
          .eq('user_id', user.id)
          .maybeSingle()
        if (data) {
          const fullName = [data.prenom, data.nom].filter(Boolean).join(' ')
          if (fullName) setSenderName(fullName)
          if (data.fonction) setSenderFonction(data.fonction)
        }
      } catch {
        // Non-blocking
      }
    }
    loadProfile()
  }, [user?.id])

  const handleReformulate = async (style: 'professional' | 'concise' | 'friendly') => {
    if (!text.trim()) {
      toast({
        title: 'Erreur',
        description: "Veuillez d'abord saisir du texte",
        variant: 'destructive',
      })
      return
    }

    setProcessing(true)
    setOperationType('reformulate')
    onAnimationStateChange?.(false, true)

    try {
      const { data, error } = await supabase.functions.invoke('reformulate-email', {
        body: { text, style, sender_name: senderName || undefined },
      })

      if (error) throw error

      onAnimationStateChange?.(true, false)
      await new Promise((resolve) => setTimeout(resolve, 150))

      onTextUpdate(data.reformulated_text)

      await new Promise((resolve) => setTimeout(resolve, 800))
      onAnimationStateChange?.(false, false)

      toast({
        title: 'Texte reformulé',
        description: `Style appliqué: ${style === 'professional' ? 'Professionnel' : style === 'concise' ? 'Concis' : 'Convivial'}`,
      })
    } catch (error: unknown) {
      onAnimationStateChange?.(false, false)
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
      setOperationType(null)
    }
  }

  const handleTranslate = async (targetLang: string) => {
    if (!text.trim()) {
      toast({
        title: 'Erreur',
        description: "Veuillez d'abord saisir du texte",
        variant: 'destructive',
      })
      return
    }

    setProcessing(true)
    setOperationType('translate')
    onAnimationStateChange?.(false, true)

    try {
      const { data, error } = await supabase.functions.invoke('translate-email', {
        body: { text, target_language: targetLang },
      })

      if (error) throw error

      onAnimationStateChange?.(false, false)

      setTranslationPreview({
        original: text,
        translated: data.translated_text,
        targetLang,
      })

      toast({
        title: 'Traduction prête',
        description: 'Choisissez comment utiliser la traduction',
      })
    } catch (error: unknown) {
      onAnimationStateChange?.(false, false)
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
      setOperationType(null)
    }
  }

  const handleUseTranslationOnly = () => {
    if (translationPreview) {
      onAnimationStateChange?.(true, false)
      setTimeout(() => {
        onTextUpdate(translationPreview.translated)
        setTimeout(() => onAnimationStateChange?.(false, false), 800)
      }, 150)
    }
  }

  const handleUseBothVersions = () => {
    if (translationPreview) {
      const langNames: Record<string, string> = {
        en: 'English',
        es: 'Español',
        de: 'Deutsch',
        it: 'Italiano',
        pt: 'Português',
      }
      const langName =
        langNames[translationPreview.targetLang] || translationPreview.targetLang.toUpperCase()

      const combinedText = `🇫🇷 **Français:**\n\n${translationPreview.original}\n\n---\n\n${langName === 'English' ? '🇬🇧' : '🌐'} **${langName}:**\n\n${translationPreview.translated}`

      onAnimationStateChange?.(true, false)
      setTimeout(() => {
        onTextUpdate(combinedText)
        setTimeout(() => onAnimationStateChange?.(false, false), 800)
      }, 150)
    }
  }

  const handleCorrectSpelling = async () => {
    if (!text.trim()) {
      toast({
        title: 'Erreur',
        description: "Veuillez d'abord saisir du texte",
        variant: 'destructive',
      })
      return
    }

    setProcessing(true)
    setOperationType('correct')
    onAnimationStateChange?.(false, true)

    try {
      const { data, error } = await supabase.functions.invoke('correct-spelling-email', {
        body: { text },
      })

      if (error) throw error

      onAnimationStateChange?.(true, false)
      await new Promise((resolve) => setTimeout(resolve, 150))

      onTextUpdate(data.corrected_text)

      await new Promise((resolve) => setTimeout(resolve, 800))
      onAnimationStateChange?.(false, false)

      toast({
        title: 'Texte corrigé',
        description: 'Orthographe et grammaire vérifiées',
      })
    } catch (error: unknown) {
      onAnimationStateChange?.(false, false)
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
      setOperationType(null)
    }
  }

  const handleHelpMeWrite = async (
    action:
      | 'professionalize'
      | 'enrich'
      | 'generate_reply'
      | 'generate_new'
      | 'shorten'
      | 'elaborate',
    direction?: string
  ) => {
    const isGenerate = action === 'generate_reply' || action === 'generate_new'
    if (!isGenerate && !text.trim()) {
      toast({
        title: 'Erreur',
        description: "Veuillez d'abord saisir du texte",
        variant: 'destructive',
      })
      return
    }

    if (action === 'generate_reply' && threadMessages.length === 0) {
      // Fallback automatique : sans fil, on rédige un email initial
      action = 'generate_new'
    }

    setProcessing(true)
    setOperationType('helpwrite')
    onAnimationStateChange?.(false, true)

    if (isGenerate) setIsGeneratingReply(true)

    try {
      const { data, error } = await supabase.functions.invoke('help-me-write-email', {
        body: {
          draft_body: text || undefined,
          subject: threadSubject || undefined,
          action,
          thread_messages: threadMessages.length > 0 ? threadMessages : undefined,
          thread_subject: threadSubject || undefined,
          etablissement_id: etablissementId || undefined,
          recipient_emails: threadParticipants.map((p) => p.email).filter(Boolean),
          sender_name: senderName || undefined,
          sender_fonction: senderFonction || undefined,
          reply_direction: direction || undefined,
        },
      })

      if (error) throw error

      onAnimationStateChange?.(true, false)
      await new Promise((resolve) => setTimeout(resolve, 150))

      onTextUpdate(data.content)

      await new Promise((resolve) => setTimeout(resolve, 800))
      onAnimationStateChange?.(false, false)

      const actionLabels: Record<string, string> = {
        professionalize: 'Texte professionnalisé',
        enrich: 'Texte enrichi',
        generate_reply: 'Réponse générée',
        generate_new: 'Email initial rédigé',
        shorten: 'Texte raccourci',
        elaborate: 'Texte développé',
      }

      toast({
        title: actionLabels[action] || 'Texte amélioré',
        description: "L'IA a amélioré votre brouillon",
      })
    } catch (error: unknown) {
      onAnimationStateChange?.(false, false)
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
      setOperationType(null)
      setIsGeneratingReply(false)
      setShowDirectionInput(false)
    }
  }

  const handleGetSuggestions = async () => {
    if (!etablissementId) {
      toast({
        title: 'Information',
        description: 'Les suggestions contextuelles nécessitent un établissement lié',
        variant: 'default',
      })
      return
    }

    setProcessing(true)
    setOperationType('suggest')
    try {
      const { data, error } = await supabase.functions.invoke('suggest-email-content', {
        body: { etablissement_id: etablissementId, context: text },
      })

      if (error) throw error

      setSuggestions(data.suggestions || [])
      setShowSuggestions(true)
      toast({
        title: 'Suggestions générées',
        description: `${data.suggestions?.length || 0} suggestions disponibles`,
      })
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
      setOperationType(null)
    }
  }

  const insertSuggestion = (suggestion: string) => {
    const updatedText = text ? `${text}\n\n${suggestion}` : suggestion
    onTextUpdate(updatedText)
    setShowSuggestions(false)
    toast({
      title: 'Suggestion insérée',
    })
  }

  const handleVisioInvitation = (editorHtml: string, icsContent?: string, richHtml?: string) => {
    const updatedText = text ? `${text}\n\n${editorHtml}` : editorHtml
    onTextUpdate(updatedText)

    if (icsContent && onIcsGenerated) {
      onIcsGenerated(icsContent)
    }

    // Store rich HTML for SMTP send via custom event
    if (richHtml) {
      window.dispatchEvent(new CustomEvent('visio-rich-html', { detail: richHtml }))
    }

    toast({
      title: 'Invitation insérée',
      description: icsContent
        ? "L'invitation visio avec fichier calendrier a été ajoutée"
        : "L'invitation visio a été ajoutée à votre message",
    })
  }

  const isWriteProcessing =
    processing && (operationType === 'helpwrite' || operationType === 'reformulate')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* Rédiger avec l'IA — merged Help me write + Reformuler */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={processing}
              className="h-8 gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl backdrop-blur-sm font-medium"
            >
              {isWriteProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Rédiger avec l'IA
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="flex items-center gap-2">
              <PenLine className="h-3.5 w-3.5" />
              Rédaction
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleHelpMeWrite('professionalize')}>
                <span className="flex flex-col">
                  <span className="font-medium">Professionnaliser</span>
                  <span className="text-xs text-muted-foreground">Ton formel et structuré</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleHelpMeWrite('enrich')}>
                <span className="flex flex-col">
                  <span className="font-medium">Enrichir</span>
                  <span className="text-xs text-muted-foreground">
                    Formules, contexte, transitions
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleHelpMeWrite('elaborate')}>
                <span className="flex flex-col">
                  <span className="font-medium">Développer</span>
                  <span className="text-xs text-muted-foreground">
                    Plus de détails et d'explications
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleHelpMeWrite('shorten')}>
                <span className="flex flex-col">
                  <span className="font-medium">Raccourcir</span>
                  <span className="text-xs text-muted-foreground">
                    Garder l'essentiel uniquement
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <Wand2 className="h-3.5 w-3.5" />
              Reformulation
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleReformulate('professional')}>
                <span className="flex flex-col">
                  <span className="font-medium">Plus professionnel</span>
                  <span className="text-xs text-muted-foreground">Ton sérieux et respectueux</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleReformulate('concise')}>
                <span className="flex flex-col">
                  <span className="font-medium">Plus concis</span>
                  <span className="text-xs text-muted-foreground">Direct et sans répétitions</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleReformulate('friendly')}>
                <span className="flex flex-col">
                  <span className="font-medium">Plus convivial</span>
                  <span className="text-xs text-muted-foreground">Chaleureux et accessible</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <>
              <DropdownMenuSeparator />
              {showDirectionInput ? (
                <div className="px-2 py-2 space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    ✨{' '}
                    {threadMessages.length > 0 ? 'Générer une réponse' : 'Rédiger un email initial'}
                  </p>
                  <input
                    type="text"
                    autoFocus
                    value={replyDirection}
                    onChange={(e) => setReplyDirection(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter' && !isGeneratingReply) {
                        e.preventDefault()
                        handleHelpMeWrite(
                          threadMessages.length > 0 ? 'generate_reply' : 'generate_new',
                          replyDirection
                        )
                        setReplyDirection('')
                      }
                      if (e.key === 'Escape' && !isGeneratingReply) {
                        setShowDirectionInput(false)
                        setReplyDirection('')
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    disabled={isGeneratingReply}
                    placeholder={
                      threadMessages.length > 0
                        ? 'Ex: accepter, demander un délai...'
                        : 'Ex: prise de contact, proposer un rdv...'
                    }
                    className="w-full text-sm px-2 py-1.5 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs flex-1"
                      disabled={isGeneratingReply}
                      onClick={() => {
                        handleHelpMeWrite(
                          threadMessages.length > 0 ? 'generate_reply' : 'generate_new',
                          replyDirection
                        )
                        setReplyDirection('')
                      }}
                    >
                      {isGeneratingReply ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Génération...
                        </>
                      ) : (
                        'Générer'
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={isGeneratingReply}
                      onClick={() => {
                        setShowDirectionInput(false)
                        setReplyDirection('')
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setShowDirectionInput(true)
                  }}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">
                      ✨{' '}
                      {threadMessages.length > 0
                        ? 'Générer une réponse'
                        : 'Rédiger un email initial'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Cliquez pour indiquer l'orientation
                    </span>
                  </span>
                </DropdownMenuItem>
              )}
            </>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Corriger — standalone quick action */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCorrectSpelling}
          disabled={processing}
          className="h-8 gap-2 bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50 rounded-xl backdrop-blur-sm"
        >
          {processing && operationType === 'correct' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4" />
          )}
          Corriger
        </Button>

        {/* Traduire */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={processing}
              className="h-8 gap-2 bg-blue-50/80 hover:bg-blue-100/80 text-blue-700 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50 rounded-xl backdrop-blur-sm"
            >
              {processing && operationType === 'translate' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Languages className="h-4 w-4" />
              )}
              Traduire
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Langue cible</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleTranslate('en')}>🇬🇧 Anglais</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTranslate('es')}>🇪🇸 Espagnol</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTranslate('de')}>🇩🇪 Allemand</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTranslate('it')}>🇮🇹 Italien</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Visio */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowVisioDialog(true)}
          disabled={processing}
          className="h-8 gap-2 bg-cyan-50/80 hover:bg-cyan-100/80 text-cyan-700 dark:bg-cyan-950/30 dark:hover:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-800/50 rounded-xl backdrop-blur-sm"
        >
          <Video className="h-4 w-4" />
          Inviter à une visio
        </Button>

        {/* Suggestions */}
        {etablissementId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGetSuggestions}
            disabled={processing}
            className="h-8 gap-2 bg-amber-50/80 hover:bg-amber-100/80 text-amber-700 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50 rounded-xl backdrop-blur-sm"
          >
            {processing && operationType === 'suggest' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
            Suggestions
          </Button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Suggestions contextuelles
          </h4>
          <div className="space-y-2">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="p-2 rounded border bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => insertSuggestion(suggestion)}
              >
                <p className="text-sm">{suggestion}</p>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setShowSuggestions(false)}
          >
            Masquer
          </Button>
        </Card>
      )}

      <EmailVisioInviteDialog
        open={showVisioDialog}
        onOpenChange={setShowVisioDialog}
        threadParticipants={threadParticipants}
        threadSubject={threadSubject}
        threadMessages={threadMessages}
        onInvitationGenerated={handleVisioInvitation}
      />

      <TranslationPreviewDialog
        open={!!translationPreview}
        onOpenChange={(open) => !open && setTranslationPreview(null)}
        originalText={translationPreview?.original || ''}
        translatedText={translationPreview?.translated || ''}
        targetLanguage={translationPreview?.targetLang || 'en'}
        onUseTranslation={handleUseTranslationOnly}
        onUseBoth={handleUseBothVersions}
      />
    </div>
  )
}
