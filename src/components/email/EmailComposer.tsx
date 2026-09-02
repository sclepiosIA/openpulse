import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/shared/use-toast'
import { fromExtended } from '@/lib/supabaseTyped'
import { Send, Loader2, X, Save, Paperclip, FileText, Code, Calendar, Link2 } from 'lucide-react'
import { EmailTransferDialog } from './EmailTransferDialog'

import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TemplateSelector } from './TemplateSelector'
import { RichTextEditor } from './RichTextEditor'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/components/AuthProvider'
import { EmailAIAssistant } from './EmailAIAssistant'
import { useErrorHandler } from '@/hooks/shared/useErrorHandler'
import { useEmailSignature } from '@/hooks/email/useEmailSignature'
import { EmailRecipientInput } from './EmailRecipientInput'
import { debug } from '@/lib/debug'
import { enqueueEmail } from '@/lib/offlineOutbox'
import { useQueryClient } from '@tanstack/react-query'
import { useDefaultEmailAccount } from '@/hooks/email/useDefaultEmailAccount'
import { useEmailDraftActions } from '@/hooks/email/useEmailDraftActions'
import { useDraftRecovery } from '@/hooks/email/useDraftRecovery'
import { sanitizeEmailHtml } from '@/lib/emailUtils'
import { invokeEdge } from "@/services/edgeFunctions";

// Email validation helpers
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future bulk-validation use (audit 2026-05-28)
const validateEmailList = (emailList: string): string[] => {
  if (!emailList.trim()) return []

  const emails = emailList
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e)
  const invalid = emails.filter((e) => !validateEmail(e))

  return invalid
}

import type { EmailDraft } from '@/types/email'

interface EmailComposerProps {
  accountId: string
  onCancel: () => void
  onSent: () => void
  initialDraft?: EmailDraft
  initialRecipient?: { email: string; name?: string } | null
}

export function EmailComposer({
  accountId,
  onCancel,
  onSent,
  initialDraft,
  initialRecipient,
}: EmailComposerProps) {
  // Résoudre le compte email par défaut (prenom.nom@exploitant.example.org si "all" sélectionné)
  const { resolvedAccountId, resolvedAccount } = useDefaultEmailAccount(accountId)
  const { saveDraft, deleteDraft, createOutboundThread, deleteOrphanThread, deleteThread } =
    useEmailDraftActions()

  // Determine initial "to" recipients: prioritize initialRecipient, then initialDraft
  const getInitialTo = (): string[] => {
    if (initialRecipient?.email) {
      return [initialRecipient.email]
    }
    if (initialDraft?.to_addresses) {
      return initialDraft.to_addresses
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
    }
    return []
  }

  const [to, setTo] = useState<string[]>(getInitialTo())
  const [cc, setCc] = useState<string[]>(
    initialDraft?.cc_addresses
      ? initialDraft.cc_addresses
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
      : []
  )
  const [bcc, setBcc] = useState<string[]>(
    initialDraft?.bcc_addresses
      ? initialDraft.bcc_addresses
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
      : []
  )
  const [subject, setSubject] = useState(initialDraft?.subject || '')
  const [body, setBody] = useState(initialDraft?.body || '')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [transferOpen, setTransferOpen] = useState(false)

  const [isHtmlMode, setIsHtmlMode] = useState(true)
  const { toast } = useToast()
  const { user } = useAuth()

  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id || null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- AI animation flag wired in JSX below (audit 2026-05-28)
  const [isAIAnimating, setIsAIAnimating] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- AI processing flag wired in JSX below (audit 2026-05-28)
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [icsAttachment, setIcsAttachment] = useState<string | undefined>()
  const icsAttachmentRef = useRef<string | undefined>()
  const visioRichHtmlRef = useRef<string | undefined>()

  const { handleError } = useErrorHandler()
  const { signature } = useEmailSignature()
  const queryClient = useQueryClient()

  // ── Local draft recovery (sessionStorage snapshot) ──────────────
  const hasInitialData = !!(initialDraft || initialRecipient)
  const recoveryFields = useMemo(
    () => ({
      to,
      cc,
      bcc,
      subject,
      body,
      accountId: resolvedAccountId || accountId,
    }),
    [to, cc, bcc, subject, body, resolvedAccountId, accountId]
  )

  const { clearSnapshot } = useDraftRecovery(
    recoveryFields,
    { setTo, setCc, setBcc, setSubject, setBody },
    hasInitialData
  )

  // Listen for rich visio HTML from EmailAIAssistant
  useEffect(() => {
    const handler = (e: Event) => {
      const richHtml = (e as CustomEvent).detail as string
      visioRichHtmlRef.current = richHtml
    }
    window.addEventListener('visio-rich-html', handler)
    return () => window.removeEventListener('visio-rich-html', handler)
  }, [])

  // Handler pour l'ICS généré par EmailVisioInviteDialog
  const handleIcsGenerated = (ics: string) => {
    debug.log('[EmailComposer] ICS generated:', ics.length, 'chars')
    icsAttachmentRef.current = ics
    setIcsAttachment(ics)
  }

  // Construire les participants à partir des destinataires pour l'invitation visio
  const derivedParticipants = [
    ...to.map((email) => ({ email, name: undefined, type: 'to' as const })),
    ...cc.map((email) => ({ email, name: undefined, type: 'cc' as const })),
  ]

  // Auto-save draft every 10 seconds (server-side)
  useEffect(() => {
    // Fix: filter empty strings from to array, require real content
    const hasRecipients = to.filter(Boolean).length > 0
    const hasSubjectOrBody = subject.trim().length > 0 || body.trim().length > 0
    if (!hasRecipients && !hasSubjectOrBody) return

    // Don't save with invalid account (e.g. 'all')
    const effectiveAccountId = resolvedAccountId || accountId
    if (!effectiveAccountId || effectiveAccountId === 'all') return

    const autoSave = async () => {
      setIsSaving(true)
      try {
        if (!user) return

        const draftData = {
          user_id: user.id,
          account_id: resolvedAccountId || accountId,
          to_addresses: to.join(', '),
          cc_addresses: cc.join(', '),
          bcc_addresses: bcc.join(', '),
          subject: subject,
          body: body,
          attachments: attachments.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
          })),
        }

        const newId = await saveDraft(draftId, draftData)
        if (newId && !draftId) {
          setDraftId(newId)
        }
        setLastSaved(new Date())
      } catch (error) {
        debug.error('Auto-save error:', error)
      } finally {
        setIsSaving(false)
      }
    }

    const timer = setTimeout(autoSave, 10000)
    return () => clearTimeout(timer)
  }, [to, cc, bcc, subject, body, attachments, resolvedAccountId, accountId, draftId])

  const handleSend = async () => {
    // Utiliser le compte résolu (prenom.nom@exploitant.example.org par défaut)
    const sendAccountId = resolvedAccountId

    // Validation du compte email
    if (!sendAccountId) {
      toast({
        title: 'Erreur',
        description: 'Aucun compte email disponible pour envoyer',
        variant: 'destructive',
      })
      return
    }

    // Validation des champs obligatoires
    if (to.length === 0 || !subject.trim() || !body.trim()) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez remplir tous les champs obligatoires (À, Sujet, Message)',
        variant: 'destructive',
      })
      return
    }

    // Validation de la taille du corps (max 500 Ko)
    if (body.length > 500000) {
      toast({
        title: 'Message trop long',
        description: "Le corps de l'email ne peut pas dépasser 500 Ko",
        variant: 'destructive',
      })
      return
    }

    // Validation des pièces jointes (max 25 Mo total)
    const totalSize = attachments.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > 25 * 1024 * 1024) {
      toast({
        title: 'Pièces jointes trop volumineuses',
        description: 'La taille totale des pièces jointes ne peut pas dépasser 25 Mo',
        variant: 'destructive',
      })
      return
    }

    // Mode hors ligne : on enfile dans l'outbox et on quitte tôt.
    // Les pièces jointes ne sont pas encore uploadées → on refuse pour rester safe.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (attachments.length > 0) {
        toast({
          title: 'Hors ligne',
          description: "Impossible d'envoyer un email avec pièces jointes hors ligne. Réessayez quand vous serez connecté.",
          variant: 'destructive',
        })
        return
      }
      try {
        await enqueueEmail({
          function_name: 'send-email-reply',
          payload: {
            account_id: sendAccountId,
            to,
            cc: cc.length > 0 ? cc : undefined,
            bcc: bcc.length > 0 ? bcc : undefined,
            subject,
            body,
          },
          display: {
            to,
            subject: subject || '(sans objet)',
            excerpt: body.replace(/<[^>]*>/g, '').slice(0, 120),
          },
        })
        toast({
          title: 'Email en file d\'attente',
          description: "Vous êtes hors ligne — l'email sera envoyé automatiquement au retour du réseau.",
        })
        onSent()
        return
      } catch (err) {
        toast({
          title: 'Erreur',
          description: "Impossible d'enregistrer le brouillon en local.",
          variant: 'destructive',
        })
        return
      }
    }

    setSending(true)
    try {
      // Swap simplified visio HTML with rich version for SMTP
      let finalBody = body
      if (visioRichHtmlRef.current && finalBody.includes('📹 Invitation à une visioconférence')) {
        // Replace the simplified TipTap visio block with the rich SMTP version
        finalBody = finalBody.replace(
          /<p><strong>📹 Invitation à une visioconférence<\/strong><\/p>[\s\S]*?<p><a href="[^"]*">🔗 Rejoindre la visioconférence<\/a><\/p>/,
          visioRichHtmlRef.current
        )
      }

      // Add signature to body if it exists (signature is already decoded HTML)
      const bodyWithSignature = signature
        ? isHtmlMode
          ? `${finalBody}<br><br>--<br>${signature}`
          : `${finalBody}\n\n--\n${signature.replace(/<[^>]*>/g, '')}` // Strip HTML for plain text
        : finalBody

      // Utiliser la ref pour garantir que l'ICS est disponible même si setState n'est pas terminé
      const icsToSend = icsAttachmentRef.current || icsAttachment
      debug.log(
        '[EmailComposer] Sending with ICS:',
        icsToSend ? 'YES (' + icsToSend.length + ' chars)' : 'NO'
      )

      // Get account email address for participants (using safe view)
      const { data: accountData } = await fromExtended('user_email_accounts_safe')
        .select('email_address')
        .eq('id', sendAccountId)
        .maybeSingle()

      const senderEmail = (accountData as { email_address: string } | null)?.email_address || ''

      // Create a new thread for this outbound email
      const threadId = `outbound-${Date.now()}-${crypto.randomUUID()}`
      const allParticipants = [
        { email: senderEmail, name: null, type: 'from' },
        ...to.map((email) => ({ email, name: null, type: 'to' })),
        ...cc.map((email) => ({ email, name: null, type: 'cc' })),
      ]

      const newThread = await createOutboundThread({
        threadId,
        accountId: sendAccountId,
        subject,
        participants: allParticipants,
      })

      debug.log('[EmailComposer] Created thread:', newThread.id)

      // Encode attachments to base64 for SMTP delivery
      const fileToB64 = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => {
            const result = r.result as string
            resolve(result.split(',')[1] || '')
          }
          r.onerror = () => reject(r.error)
          r.readAsDataURL(file)
        })
      const encodedAttachments = await Promise.all(
        attachments.map(async (f) => ({
          filename: f.name,
          mime_type: f.type || 'application/octet-stream',
          size: f.size,
          content_base64: await fileToB64(f),
        }))
      )

      const data = await invokeEdge<any>('send-email-reply', {
          thread_id: newThread.id,
          account_id: sendAccountId,
          to: to,
          cc: cc.length > 0 ? cc : undefined,
          bcc: bcc.length > 0 ? bcc : undefined,
          subject: subject,
          body: bodyWithSignature,
          ics_content: icsToSend,
          attachments: encodedAttachments.length > 0 ? encodedAttachments : undefined,
        },);
    const error = null;

      // Handle partial success FIRST: SMTP sent but DB storage failed
      if (data?.smtp_sent && data?.db_stored === false) {
        await deleteOrphanThread(newThread.id)

        toast({
          title: 'Email envoyé partiellement',
          description:
            "L'email a été envoyé mais n'apparaîtra pas dans vos envoyés. Contactez le support.",
          variant: 'destructive',
        })
        queryClient.invalidateQueries({ queryKey: ['threads-enriched-data'] })
        queryClient.invalidateQueries({ queryKey: ['email-threads'] })
        queryClient.invalidateQueries({ queryKey: ['email-threads-infinite'] })
        onSent()
        return
      }

      // Si l'envoi échoue complètement, supprimer le thread orphelin créé
      if (error || !data?.success) {
        debug.log('[EmailComposer] Send failed, deleting orphan thread:', newThread.id)
        await deleteThread(newThread.id)
        throw error || new Error(data?.error || "Échec de l'envoi")
      }

      toast({
        title: 'Email envoyé',
        description: 'Votre message a été envoyé avec succès',
      })

      // Invalidate ALL relevant caches to reflect sent email immediately
      queryClient.invalidateQueries({ queryKey: ['threads-enriched-data'] })
      queryClient.invalidateQueries({ queryKey: ['email-threads'] })
      queryClient.invalidateQueries({ queryKey: ['email-threads-infinite'] })
      window.dispatchEvent(new CustomEvent('email-sent'))

      // Delete draft if exists
      if (draftId) {
        await deleteDraft(draftId)
      }

      // Reset form + clear local snapshot
      clearSnapshot()
      setTo([])
      setCc([])
      setBcc([])
      setSubject('')
      setBody('')
      setAttachments([])
      setDraftId(null)
      setIcsAttachment(undefined)
      icsAttachmentRef.current = undefined
      onSent()
    } catch (error) {
      handleError(error, "Envoi de l'email")
    } finally {
      setSending(false)
    }
  }

  const handleSaveDraft = async () => {
    try {
      if (!user) return

      const draftData = {
        user_id: user.id,
        account_id: accountId,
        to_addresses: to.join(', '),
        cc_addresses: cc.join(', '),
        bcc_addresses: bcc.join(', '),
        subject: subject,
        body: body,
        attachments: attachments.map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })),
      }

      const newId = await saveDraft(draftId, draftData)
      if (newId && !draftId) setDraftId(newId)

      toast({
        title: 'Brouillon sauvegardé',
        description: 'Votre message a été enregistré avec succès',
      })
    } catch (error) {
      debug.error('Save draft error:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder le brouillon',
        variant: 'destructive',
      })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const totalSize = [...attachments, ...files].reduce((sum, f) => sum + f.size, 0)

    if (files.length + attachments.length > 10) {
      toast({
        title: 'Trop de fichiers',
        description: 'Maximum 10 fichiers autorisés',
        variant: 'destructive',
      })
      return
    }

    if (totalSize > 25 * 1024 * 1024) {
      toast({
        title: 'Fichiers trop volumineux',
        description: 'Taille totale maximum: 25 MB',
        variant: 'destructive',
      })
      return
    }

    setAttachments((prev) => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleInsertTemplate = (content: string, templateSubject: string) => {
    setBody(content)
    if (!subject) setSubject(templateSubject)
    toast({
      title: 'Template inséré',
      description: 'Le contenu du template a été ajouté',
    })
  }

  return (
    <Card className="p-6" data-testid="email-composer">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Nouveau message</h2>
          {isSaving ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Enregistrement...
            </span>
          ) : lastSaved ? (
            <span className="text-xs text-muted-foreground">
              Sauvegardé {formatDistanceToNow(lastSaved, { addSuffix: true, locale: fr })}
            </span>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Fermer" title="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Affichage du compte d'envoi */}
      {resolvedAccount && (
        <div className="mb-4 p-2 bg-muted/50 rounded-md flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">De :</span>
          <span className="font-medium">{resolvedAccount.email_address}</span>
        </div>
      )}

      <div className="space-y-4">
        <EmailRecipientInput
          label="À *"
          value={to}
          onChange={setTo}
          placeholder="destinataire@exemple.com"
          disabled={sending}
        />

        <div className="grid grid-cols-2 gap-4">
          <EmailRecipientInput
            label="CC"
            value={cc}
            onChange={setCc}
            placeholder="copie@exemple.com"
            disabled={sending}
          />
          <EmailRecipientInput
            label="CCI"
            value={bcc}
            onChange={setBcc}
            placeholder="cachee@exemple.com"
            disabled={sending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Sujet *</Label>
          <Input
            id="subject"
            placeholder="Objet de votre message"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending}
          />
        </div>

        <TemplateSelector
          onInsert={handleInsertTemplate}
          currentSubject={subject}
          currentBody={body}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="body">Message *</Label>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Switch checked={isHtmlMode} onCheckedChange={setIsHtmlMode} disabled={sending} />
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {isHtmlMode ? 'Éditeur riche' : 'Texte brut'}
              </span>
            </div>
          </div>

          {isHtmlMode ? (
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Rédigez votre message..."
              disabled={sending}
              isAnimating={isAIAnimating}
            />
          ) : (
            <Textarea
              id="body"
              placeholder="Rédigez votre message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sending}
              rows={10}
              className="min-h-[200px]"
            />
          )}
        </div>

        {/* AI Assistant */}
        <EmailAIAssistant
          text={body}
          onTextUpdate={(content: string) => setBody(content)}
          onIcsGenerated={handleIcsGenerated}
          threadParticipants={derivedParticipants.map((p) => ({
            email: p.email,
            name: p.name,
            type: p.type,
          }))}
        />

        {/* ICS indicator */}
        {icsAttachment && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Invitation calendrier jointe (.ics)
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 w-6 p-0"
              onClick={() => {
                setIcsAttachment(undefined)
                icsAttachmentRef.current = undefined
                visioRichHtmlRef.current = undefined
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <Label>Pièces jointes ({attachments.length})</Label>
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div
                  key={`att-${index}-${file.name}-${file.size}`}
                  className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm"
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({(file.size / 1024).toFixed(0)} Ko)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => removeAttachment(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature preview — real HTML render */}
        {signature && (
          <div className="border-t pt-2 space-y-1">
            <p className="text-xs text-muted-foreground">
              ✉️ Signature (ajoutée automatiquement) :
            </p>
            <div className="email-signature-wrapper rounded border p-2 bg-muted/30 overflow-auto max-h-[200px]">
              {/* safe: sanitizeEmailHtml strips dangerous tags/attrs via DOMPurify */}
              <div dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(signature) }} />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t">
          <Button onClick={handleSend} disabled={sending} className="gap-2 flex-1 sm:flex-none">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer
          </Button>

          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <Button variant="outline" size="sm" onClick={handleSaveDraft} className="gap-2">
              <Save className="h-4 w-4" />
              Brouillon
            </Button>

            <label>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={sending}
              />
              <Button variant="outline" size="sm" asChild>
                <span className="gap-2 cursor-pointer">
                  <Paperclip className="h-4 w-4" />
                  Joindre
                </span>
              </Button>
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferOpen(true)}
              className="gap-2"
              disabled={sending}
              title="Envoyer des fichiers lourds via un lien sécurisé"
            >
              <Link2 className="h-4 w-4" />
              Transfert
            </Button>
          </div>

          <EmailTransferDialog
            open={transferOpen}
            onClose={() => setTransferOpen(false)}
            defaultRecipients={to}
            onCreated={({ publicUrl, expiresAt, totalSize, files }) => {
              const expires = new Date(expiresAt).toLocaleDateString('fr-FR')
              const sizeMb = (totalSize / 1024 / 1024).toFixed(1)
              const list = files
                .map((f) => `<li>${f.filename} (${(f.size / 1024 / 1024).toFixed(2)} Mo)</li>`)
                .join('')
              const block = `
<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;font-family:Arial,sans-serif">
  <p style="margin:0 0 8px 0;font-weight:600;color:#111827">📎 Fichiers partagés via transfert sécurisé</p>
  <ul style="margin:0 0 12px 18px;padding:0;color:#374151;font-size:14px">${list}</ul>
  <p style="margin:0 0 12px 0;color:#6b7280;font-size:13px">Taille totale : ${sizeMb} Mo • Disponible jusqu'au ${expires}</p>
  <a href="${publicUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">⬇ Télécharger les fichiers</a>
  <p style="margin:12px 0 0 0;color:#9ca3af;font-size:12px">Lien : <a href="${publicUrl}" style="color:#2563eb">${publicUrl}</a></p>
</div>`
              setBody((prev) => (prev || '') + block)
              toast({ title: 'Lien inséré dans le message', description: `Expire le ${expires}` })
            }}
          />

        </div>
      </div>
    </Card>
  )
}
