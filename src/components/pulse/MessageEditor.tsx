import { useState, useRef, useCallback, KeyboardEvent, useEffect } from 'react'
import {
  Paperclip,
  Send,
  Sparkles,
  X,
  Slash,
  CheckSquare,
  Building2,
  User,
  Users,
  Calendar,
  BarChart3,
} from 'lucide-react'
import { safeStorage } from '@/lib/safeStorage'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

import { useSendPulseMessage, pulseMessageKeys } from '@/hooks/pulse/usePulseMessages'
import { usePulseMedia } from '@/hooks/pulse/usePulseMedia'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/shared/use-toast'
import { fromExtended } from '@/lib/supabaseTyped'
import { usePulseConversation } from '@/hooks/pulse/usePulseConversations'
import { usePulseAIEditor } from '@/hooks/pulse/usePulseAIEditor'
import { useVoiceDictation } from '@/hooks/voice/useVoiceDictation'
import {
  useCreatePulseEntityLinks,
  extractEntityLinksFromContent,
  type PendingEntityLink,
  type EntityType,
} from '@/hooks/pulse/usePulseEntityLinks'

import { MentionAutocomplete } from './MentionAutocomplete'
import { SlashCommandMenu } from './SlashCommandMenu'
import { EntityLinkAutocomplete } from './EntityLinkAutocomplete'

import { TaskCreatorModal } from './TaskCreatorModal'
import { EventCreatorModal } from './EventCreatorModal'
import { TodoCreatorModal } from './TodoCreatorModal'
import { PollCreatorModal } from './PollCreatorModal'
import { MessageEditorToolbar } from './MessageEditorToolbar'
import { cn } from '@/lib/utils'
import { PULSE_MEDIA_ACCEPT, validatePulseMediaFile } from '@/lib/pulseMediaUrls'
import type { SlashCommand, EntityFilterType } from '@/hooks/ui/useSlashCommands'
import type { EntityResult } from '@/hooks/search/useEntitySearch'

interface MessageEditorProps {
  conversationId: string
  parentMessageId?: string
  onTyping: (isTyping: boolean) => void
  onMessageSent?: () => void
  placeholder?: string
  compactMode?: boolean
}

interface MentionUser {
  id: string
  nom?: string
  prenom?: string
}

// Icon mapping for pending entity links
const ENTITY_ICONS: Record<string, React.ElementType> = {
  etablissement: Building2,
  tache: CheckSquare,
  contact: User,
  groupe: Users,
  evenement: Calendar,
  partenaire: Users,
  todo: CheckSquare,
  poll: BarChart3,
}

export function MessageEditor({
  conversationId,
  parentMessageId,
  onTyping,
  onMessageSent,
  placeholder = 'Écrivez un message...',
  compactMode = false,
}: MessageEditorProps) {
  const [content, setContent] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])

  // Slash commands state
  const [showSlashCommands, setShowSlashCommands] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 })

  // Entity links state
  const [showEntitySearch, setShowEntitySearch] = useState(false)
  const [entityQuery, setEntityQuery] = useState('')
  const [entityPosition, setEntityPosition] = useState({ top: 0, left: 0 })
  const [entityFilter, setEntityFilter] = useState<EntityFilterType>('all')
  const [pendingEntityLinks, setPendingEntityLinks] = useState<PendingEntityLink[]>([])

  // Task creator modal
  const [showTaskCreator, setShowTaskCreator] = useState(false)
  const [showEventCreator, setShowEventCreator] = useState(false)
  const [showTodoCreator, setShowTodoCreator] = useState(false)
  const [showPollCreator, setShowPollCreator] = useState(false)
  // AI transition state
  const [isAITransitioning, setIsAITransitioning] = useState(false)
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sendMessage = useSendPulseMessage()
  const { uploadFile } = usePulseMedia(conversationId)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const createEntityLinks = useCreatePulseEntityLinks()
  const { data: conversation } = usePulseConversation(conversationId)
  const {
    isProcessing: isAIProcessing,
    improve,
    reformulate,
    translate,
    shorten,
    expand,
  } = usePulseAIEditor()

  // Voice dictation
  const [interimTranscript, setInterimTranscript] = useState('')
  const {
    isRecording,
    isProcessing: isTranscribing,
    audioLevel,
    toggleRecording,
  } = useVoiceDictation({
    onTranscript: useCallback((text: string) => {
      setContent((prev) => {
        const separator = prev.trim() ? ' ' : ''
        return prev + separator + text
      })
      setInterimTranscript('')
      setTimeout(adjustHeight, 0)
    }, []),
    onInterimTranscript: setInterimTranscript,
  })

  // Get members for mentions
  const members: MentionUser[] =
    conversation?.members?.map((m) => ({
      id: m.user_id,
      nom: m.user?.nom,
      prenom: m.user?.prenom,
    })) || []

  // AI handlers with transition animation
  const handleAIAction = useCallback(
    async (action: 'improve' | 'reformulate' | 'translate' | 'shorten' | 'expand') => {
      if (!content.trim()) return

      let result: string | null = null
      switch (action) {
        case 'improve':
          result = await improve(content)
          break
        case 'reformulate':
          result = await reformulate(content)
          break
        case 'translate':
          result = await translate(content)
          break
        case 'shorten':
          result = await shorten(content)
          break
        case 'expand':
          result = await expand(content)
          break
      }

      if (result) {
        // Trigger transition animation
        setIsAITransitioning(true)
        setContent(result)

        // Focus and adjust height
        setTimeout(() => {
          textareaRef.current?.focus()
          adjustHeight()
        }, 0)

        // Reset animation after delay
        setTimeout(() => setIsAITransitioning(false), 600)
      }
    },
    [content, improve, reformulate, translate, shorten, expand]
  )

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value)

      const cursorPosition = textareaRef.current?.selectionStart || 0
      const textBeforeCursor = value.slice(0, cursorPosition)

      // Detect @ mentions
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
      if (mentionMatch) {
        setMentionQuery(mentionMatch[1])
        setShowMentions(true)
        setShowSlashCommands(false)
        setShowEntitySearch(false)

        if (containerRef.current) {
          setMentionPosition({ top: -200, left: 0 })
        }
      } else {
        setShowMentions(false)
        setMentionQuery('')
      }

      // Detect / slash commands (only at start of line or after space)
      const slashMatch = textBeforeCursor.match(/(?:^|\s)\/(\w*)$/)
      if (slashMatch && !mentionMatch) {
        setSlashQuery(slashMatch[1])
        setShowSlashCommands(true)
        setShowMentions(false)
        setShowEntitySearch(false)

        if (containerRef.current) {
          setSlashPosition({ top: -300, left: 0 })
        }
      } else if (!mentionMatch) {
        setShowSlashCommands(false)
        setSlashQuery('')
      }

      // Detect # entity links
      const entityMatch = textBeforeCursor.match(/#(\w*)$/)
      if (entityMatch && !mentionMatch && !slashMatch) {
        setEntityQuery(entityMatch[1])
        setShowEntitySearch(true)
        setShowMentions(false)
        setShowSlashCommands(false)

        if (containerRef.current) {
          setEntityPosition({ top: -320, left: 0 })
        }
      } else if (!mentionMatch && !slashMatch) {
        setShowEntitySearch(false)
        setEntityQuery('')
      }

      // Handle typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      if (value.length > 0) {
        onTyping(true)
        typingTimeoutRef.current = setTimeout(() => {
          onTyping(false)
        }, 2000)
      } else {
        onTyping(false)
      }
    },
    [onTyping]
  )

  const handleMentionSelect = useCallback(
    (user: MentionUser) => {
      const cursorPosition = textareaRef.current?.selectionStart || 0
      const textBeforeCursor = content.slice(0, cursorPosition)
      const textAfterCursor = content.slice(cursorPosition)

      const mentionIndex = textBeforeCursor.lastIndexOf('@')
      const newTextBefore = textBeforeCursor.slice(0, mentionIndex)
      const mentionText = `@${user.prenom || ''}${user.nom || ''} `

      setContent(newTextBefore + mentionText + textAfterCursor)
      setShowMentions(false)
      setMentionQuery('')

      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [content]
  )

  const handleSlashCommandSelect = useCallback(
    (command: SlashCommand) => {
      const cursorPosition = textareaRef.current?.selectionStart || 0
      const textBeforeCursor = content.slice(0, cursorPosition)
      const textAfterCursor = content.slice(cursorPosition)

      // Find the / position
      const slashIndex = textBeforeCursor.lastIndexOf('/')
      const newTextBefore = textBeforeCursor.slice(0, slashIndex)

      if (command.actionType === 'insert' && command.insertText) {
        setContent(newTextBefore + command.insertText + textAfterCursor)
      } else if (command.actionType === 'trigger-entity') {
        // Set entity filter and trigger entity search
        setEntityFilter(command.entityFilter || 'all')
        setContent(newTextBefore + '#' + textAfterCursor)
        setTimeout(() => {
          handleContentChange(newTextBefore + '#' + textAfterCursor)
        }, 0)
      } else if (command.actionType === 'open-modal' && command.modalType === 'task-create') {
        setContent(newTextBefore + textAfterCursor)
        setShowTaskCreator(true)
      } else if (command.actionType === 'open-modal' && command.modalType === 'event-create') {
        setContent(newTextBefore + textAfterCursor)
        setShowEventCreator(true)
      } else if (command.actionType === 'open-modal' && command.modalType === 'todo-create') {
        setContent(newTextBefore + textAfterCursor)
        setShowTodoCreator(true)
      } else if (command.actionType === 'open-modal' && command.modalType === 'poll-create') {
        setContent(newTextBefore + textAfterCursor)
        setShowPollCreator(true)
      }

      setShowSlashCommands(false)
      setSlashQuery('')

      setTimeout(() => {
        textareaRef.current?.focus()
        adjustHeight()
      }, 0)
    },
    [content, handleContentChange]
  )

  const handleEntitySelect = useCallback(
    (entity: EntityResult) => {
      const cursorPosition = textareaRef.current?.selectionStart || 0
      const textBeforeCursor = content.slice(0, cursorPosition)
      const textAfterCursor = content.slice(cursorPosition)

      // Find the # position
      const hashIndex = textBeforeCursor.lastIndexOf('#')
      const newTextBefore = textBeforeCursor.slice(0, hashIndex)

      // Insert entity as a clickable link format
      const entityLink = `#[${entity.name}](${entity.type}:${entity.id}) `

      // Add to pending entity links for persistence
      const newLink: PendingEntityLink = {
        entity_type: entity.type as EntityType,
        entity_id: entity.id,
        entity_name: entity.name,
      }
      setPendingEntityLinks((prev) => {
        // Avoid duplicates
        if (
          prev.some(
            (l) => l.entity_id === newLink.entity_id && l.entity_type === newLink.entity_type
          )
        ) {
          return prev
        }
        return [...prev, newLink]
      })

      setContent(newTextBefore + entityLink + textAfterCursor)
      setShowEntitySearch(false)
      setEntityQuery('')
      setEntityFilter('all') // Reset filter

      setTimeout(() => {
        textareaRef.current?.focus()
        adjustHeight()
      }, 0)
    },
    [content]
  )

  // Handle task created from modal
  const handleTaskCreated = useCallback((task: { id: string; titre: string }) => {
    // Add task as pending entity link
    const newLink: PendingEntityLink = {
      entity_type: 'tache',
      entity_id: task.id,
      entity_name: task.titre,
    }
    setPendingEntityLinks((prev) => [...prev, newLink])

    // Insert reference in content
    const entityLink = `#[${task.titre}](tache:${task.id}) `
    setContent((prev) => prev + entityLink)

    setShowTaskCreator(false)
    textareaRef.current?.focus()
  }, [])

  // Handle event created from modal
  const handleEventCreated = useCallback((event: { id: string; title: string }) => {
    const newLink: PendingEntityLink = {
      entity_type: 'evenement' as EntityType,
      entity_id: event.id,
      entity_name: event.title,
    }
    setPendingEntityLinks((prev) => [...prev, newLink])
    const entityLink = `#[${event.title}](evenement:${event.id}) `
    setContent((prev) => prev + entityLink)
    setShowEventCreator(false)
    textareaRef.current?.focus()
  }, [])

  // Remove a pending entity link
  const removePendingLink = useCallback((index: number) => {
    setPendingEntityLinks((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const cursorPosition = textareaRef.current?.selectionStart || content.length
      const newContent = content.slice(0, cursorPosition) + emoji + content.slice(cursorPosition)
      setContent(newContent)
      setShowEmojiPicker(false)

      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [content]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        const validFiles: File[] = []
        const rejectedFiles: string[] = []

        files.forEach((file) => {
          const validationError = validatePulseMediaFile(file)
          if (validationError) {
            rejectedFiles.push(`${file.name} — ${validationError}`)
          } else {
            validFiles.push(file)
          }
        })

        if (rejectedFiles.length > 0) {
          toast({
            title: rejectedFiles.length === 1 ? 'Fichier refusé' : 'Fichiers refusés',
            description: rejectedFiles.slice(0, 3).join('\n'),
            variant: 'destructive',
          })
        }

        if (validFiles.length > 0) {
          setAttachedFiles((prev) => {
            const availableSlots = Math.max(0, 10 - prev.length)
            const filesToAdd = validFiles.slice(0, availableSlots)

            if (filesToAdd.length < validFiles.length) {
              toast({
                title: 'Trop de fichiers',
                description: 'Maximum 10 fichiers par message',
                variant: 'destructive',
              })
            }

            return [...prev, ...filesToAdd]
          })
        }
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [toast]
  )

  const removeAttachedFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const insertChar = useCallback(
    (char: string) => {
      const cursorPos = textareaRef.current?.selectionStart || content.length
      const newContent = content.slice(0, cursorPos) + char + content.slice(cursorPos)
      setContent(newContent)
      handleContentChange(newContent)

      setTimeout(() => {
        textareaRef.current?.focus()
        if (textareaRef.current) {
          textareaRef.current.selectionStart = cursorPos + 1
          textareaRef.current.selectionEnd = cursorPos + 1
        }
      }, 0)
    },
    [content, handleContentChange]
  )

  const handleSubmit = useCallback(async () => {
    if (sendMessage.isPending || isUploadingAttachments) return

    const trimmedContent = content.trim()
    if (!trimmedContent && attachedFiles.length === 0) return

    const invalidFile = attachedFiles.find((file) => validatePulseMediaFile(file))
    if (invalidFile) {
      toast({
        title: 'Pièce jointe invalide',
        description: `${invalidFile.name} ne peut pas être envoyé`,
        variant: 'destructive',
      })
      return
    }

    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(trimmedContent)) !== null) {
      mentions.push(match[1])
    }

    // Extract entity links from content (in case user typed manually)
    const extractedLinks = extractEntityLinksFromContent(trimmedContent)
    // Merge with pending links (avoid duplicates)
    const allLinks = [...pendingEntityLinks]
    extractedLinks.forEach((link) => {
      if (
        !allLinks.some((l) => l.entity_id === link.entity_id && l.entity_type === link.entity_type)
      ) {
        allLinks.push(link)
      }
    })

    const filesToUpload = attachedFiles

    try {
      const newMessage = await sendMessage.mutateAsync({
        conversation_id: conversationId,
        content:
          trimmedContent ||
          (filesToUpload.length > 0 ? `📎 ${filesToUpload.length} fichier(s)` : ''),
        parent_message_id: parentMessageId,
        mentions,
      })

      if (allLinks.length > 0 && newMessage?.id) {
        createEntityLinks.mutate({
          messageId: newMessage.id,
          conversationId,
          entityLinks: allLinks,
        })
      }

      if (filesToUpload.length > 0 && newMessage?.id) {
        setIsUploadingAttachments(true)
        const uploadResults = await Promise.all(
          filesToUpload.map((file) => uploadFile(file, newMessage.id))
        )
        const failedFiles = filesToUpload.filter((_, index) => !uploadResults[index])
        const successCount = uploadResults.length - failedFiles.length

        if (failedFiles.length > 0) {
          const fallbackContent =
            trimmedContent ||
            (successCount > 0 ? `📎 ${successCount} fichier(s)` : '⚠️ Pièce jointe non envoyée')
          await fromExtended('pulse_messages')
            .update({ content: fallbackContent })
            .eq('id', newMessage.id)

          setAttachedFiles(failedFiles)
          toast({
            title:
              failedFiles.length === 1 ? 'Pièce jointe non envoyée' : 'Pièces jointes non envoyées',
            description: failedFiles
              .map((file) => file.name)
              .slice(0, 3)
              .join('\n'),
            variant: 'destructive',
          })
          queryClient.invalidateQueries({
            queryKey: pulseMessageKeys.byConversation(conversationId),
          })
          return
        }

        queryClient.invalidateQueries({ queryKey: pulseMessageKeys.byConversation(conversationId) })
      }

      setContent('')
      setAttachedFiles([])
      setPendingEntityLinks([])
      onTyping(false)
      onMessageSent?.()
      textareaRef.current?.focus()
      adjustHeight()
    } catch {
      // useSendPulseMessage possède déjà le toast/log d'échec. Ici on absorbe le
      // rejet pour préserver le brouillon sans déclencher de notification doublée.
    } finally {
      setIsUploadingAttachments(false)
    }
  }, [
    content,
    attachedFiles,
    conversationId,
    parentMessageId,
    sendMessage,
    isUploadingAttachments,
    onTyping,
    onMessageSent,
    pendingEntityLinks,
    createEntityLinks,
    uploadFile,
    queryClient,
    toast,
  ])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send with Enter (without Shift) when no autocomplete is open
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !showMentions &&
      !showSlashCommands &&
      !showEntitySearch
    ) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Coller une image depuis le presse-papiers (Ctrl/Cmd+V)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items || items.length === 0) return

    const pastedImages: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile()
        if (!blob) continue
        const ext = item.type.split('/')[1] || 'png'
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
        const named =
          blob.name && blob.name.length > 0
            ? blob
            : new File([blob], `capture-${stamp}-${i}.${ext}`, { type: item.type })
        pastedImages.push(named)
      }
    }

    if (pastedImages.length > 0) {
      e.preventDefault()
      setAttachedFiles((prev) => [...prev, ...pastedImages])
    }
  }

  // Adjust textarea height
  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  // Manage pulse-compose-dirty flag
  useEffect(() => {
    if (content.trim().length > 0) {
      safeStorage.setItem('pulse-compose-dirty', '1')
    } else {
      safeStorage.removeItem('pulse-compose-dirty')
    }
  }, [content])

  // Cleanup typing timeout + compose-dirty flag
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      safeStorage.removeItem('pulse-compose-dirty')
    }
  }, [])

  // Keyboard shortcut for voice dictation (Ctrl+Shift+M)
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        toggleRecording()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [toggleRecording])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-xl border bg-background transition-all shadow-sm',
        isFocused &&
          'ring-2 ring-primary/30 ring-offset-1 ring-offset-background border-primary/50',
        isAIProcessing && 'ai-processing-border'
      )}
    >
      {/* AI Processing Overlay */}
      {isAIProcessing && (
        <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm flex items-center justify-center rounded-xl overflow-hidden">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-[ai-dot-pulse_1.4s_ease-in-out_infinite]" />
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-[ai-dot-pulse_1.4s_ease-in-out_0.2s_infinite]" />
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-[ai-dot-pulse_1.4s_ease-in-out_0.4s_infinite]" />
            </div>
            <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-full ai-shimmer-bar" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span>L'IA reformule...</span>
            </div>
          </div>
        </div>
      )}

      {/* Zone 1: Attachments + Entity links preview */}
      {(attachedFiles.length > 0 || pendingEntityLinks.length > 0) && (
        <div className="p-2.5 border-b bg-muted/20 space-y-2">
          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border text-xs group hover:border-primary/50 transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate max-w-[140px] font-medium">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 opacity-50 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive rounded-full transition-all"
                    onClick={() => removeAttachedFile(index)}
                    aria-label={`Retirer la pièce jointe ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Pending entity links */}
          {pendingEntityLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium mr-1">🔗 Liens :</span>
              {pendingEntityLinks.map((link, index) => {
                const Icon = ENTITY_ICONS[link.entity_type] || CheckSquare
                return (
                  <Badge
                    key={`${link.entity_type}-${link.entity_id}`}
                    variant="secondary"
                    className="gap-1.5 pr-1 py-1 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[120px] font-medium">{link.entity_name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 ml-0.5 hover:bg-destructive/20 hover:text-destructive rounded-full"
                      onClick={() => removePendingLink(index)}
                      aria-label="Retirer ce lien"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Autocomplete menus */}
      <MentionAutocomplete
        users={members}
        query={mentionQuery}
        position={mentionPosition}
        onSelect={handleMentionSelect}
        onClose={() => setShowMentions(false)}
        visible={showMentions}
      />
      <SlashCommandMenu
        query={slashQuery}
        position={slashPosition}
        onSelect={handleSlashCommandSelect}
        onClose={() => setShowSlashCommands(false)}
        visible={showSlashCommands}
      />
      <EntityLinkAutocomplete
        query={entityQuery}
        position={entityPosition}
        onSelect={handleEntitySelect}
        onClose={() => {
          setShowEntitySearch(false)
          setEntityFilter('all')
        }}
        visible={showEntitySearch}
        filter={entityFilter}
      />

      {/* Interim transcript preview */}
      {isRecording && interimTranscript && (
        <div className="px-4 py-2.5 text-sm text-primary bg-primary/5 border-b flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          </div>
          <span className="italic">{interimTranscript}...</span>
        </div>
      )}

      {/* Zone 2: Expanded Text Area - compact sur mobile */}
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          handleContentChange(e.target.value)
          adjustHeight()
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={
          isRecording ? '🎤 Parlez maintenant...' : `${placeholder} ou tapez / pour les commandes`
        }
        className={cn(
          'resize-none border-0 focus-visible:ring-0 leading-relaxed',
          'text-base', // 16px minimum - empêche le zoom automatique iOS
          compactMode
            ? 'min-h-[44px] max-h-[100px] px-3 py-2'
            : 'min-h-[80px] max-h-[200px] px-4 py-3',
          isAITransitioning && 'ai-text-transition'
        )}
        rows={compactMode ? 1 : 2}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept={PULSE_MEDIA_ACCEPT}
      />

      <MessageEditorToolbar
        compactMode={compactMode}
        content={content}
        attachedFilesCount={attachedFiles.length}
        isFocused={isFocused}
        isAIProcessing={isAIProcessing}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        audioLevel={audioLevel}
        sendPending={sendMessage.isPending || isUploadingAttachments}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        fileInputRef={fileInputRef}
        insertChar={insertChar}
        toggleRecording={toggleRecording}
        handleAIAction={handleAIAction}
        handleEmojiSelect={handleEmojiSelect}
        handleSubmit={handleSubmit}
      />

      {/* Modals */}
      <TaskCreatorModal
        open={showTaskCreator}
        onOpenChange={setShowTaskCreator}
        conversationId={conversationId}
        onTaskCreated={handleTaskCreated}
      />
      <EventCreatorModal
        open={showEventCreator}
        onOpenChange={setShowEventCreator}
        conversationId={conversationId}
        onEventCreated={handleEventCreated}
      />
      <TodoCreatorModal
        open={showTodoCreator}
        onOpenChange={setShowTodoCreator}
        conversationId={conversationId}
      />
      <PollCreatorModal
        open={showPollCreator}
        onOpenChange={setShowPollCreator}
        conversationId={conversationId}
      />
    </div>
  )
}
