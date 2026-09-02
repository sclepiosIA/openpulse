/**
 * JarvisEmailPreview - Aperçu complet d'un email avant envoi
 *
 * Affiche l'email formaté avec possibilité de confirmer/modifier/annuler
 */

import { useMemo } from 'react'
import { Mail, Send, Edit2, X, User, Users, FileText, Loader2 } from 'lucide-react'
import DOMPurify from 'dompurify'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useEmailSignature } from '@/hooks/email/useEmailSignature'
import { useAuth } from '@/components/AuthProvider'

interface EmailToolArguments {
  to: string | string[]
  subject?: string
  body: string
  cc?: string | string[]
  bcc?: string | string[]
  thread_id?: string
  account_id?: string
}

interface JarvisEmailPreviewProps {
  emailData: EmailToolArguments
  onConfirm: () => void
  onModify?: () => void
  onCancel: () => void
  isConfirming?: boolean
  className?: string
}

export function JarvisEmailPreview({
  emailData,
  onConfirm,
  onModify,
  onCancel,
  isConfirming = false,
  className,
}: JarvisEmailPreviewProps) {
  const { user } = useAuth()
  const { signature, loading: signatureLoading } = useEmailSignature()

  // Format recipients to display
  const formatRecipients = (recipients: string | string[] | undefined): string => {
    if (!recipients) return ''
    if (Array.isArray(recipients)) return recipients.join(', ')
    return recipients
  }

  // Convert body to HTML for display
  const formattedBody = useMemo(() => {
    let body = emailData.body || ''

    // Convert newlines to <br>
    body = body.replace(/\n/g, '<br>')

    // Add signature if available, wrapped for style isolation
    if (signature && !signatureLoading) {
      body += '<br><br><div class="email-signature-wrapper">' + signature + '</div>'
    }

    // Sanitize HTML — allow email-signature table attributes
    return DOMPurify.sanitize(body, {
      ALLOWED_TAGS: [
        'p',
        'b',
        'i',
        'em',
        'strong',
        'a',
        'ul',
        'ol',
        'li',
        'br',
        'span',
        'div',
        'hr',
        'table',
        'tr',
        'td',
        'th',
        'thead',
        'tbody',
        'img',
        'font',
      ],
      ALLOWED_ATTR: [
        'href',
        'title',
        'class',
        'target',
        'rel',
        'src',
        'alt',
        'style',
        'width',
        'height',
        'cellpadding',
        'cellspacing',
        'border',
        'align',
        'valign',
        'bgcolor',
        'color',
        'size',
        'face',
      ],
      ALLOW_DATA_ATTR: false,
    })
  }, [emailData.body, signature, signatureLoading])

  const toRecipients = formatRecipients(emailData.to)
  const ccRecipients = formatRecipients(emailData.cc)
  const bccRecipients = formatRecipients(emailData.bcc)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('w-full', className)}
    >
      <Card className="border-primary/20 bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden">
        {/* Header */}
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base flex items-center gap-2">
                Aperçu de l'email
                <Badge variant="outline" className="text-xs font-normal">
                  Prêt à envoyer
                </Badge>
              </h3>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-4 space-y-4">
          {/* Metadata */}
          <div className="space-y-2.5 text-sm">
            {/* From */}
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-12 shrink-0 pt-0.5">De :</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground truncate">
                  {user?.email || 'Votre adresse email'}
                </span>
              </div>
            </div>

            {/* To */}
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-12 shrink-0 pt-0.5">À :</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground break-all">{toRecipients || 'Non spécifié'}</span>
              </div>
            </div>

            {/* CC (if any) */}
            {ccRecipients && (
              <div className="flex items-start gap-3">
                <span className="text-muted-foreground w-12 shrink-0 pt-0.5">CC :</span>
                <span className="text-foreground break-all">{ccRecipients}</span>
              </div>
            )}

            {/* BCC (if any) */}
            {bccRecipients && (
              <div className="flex items-start gap-3">
                <span className="text-muted-foreground w-12 shrink-0 pt-0.5">CCI :</span>
                <span className="text-foreground break-all">{bccRecipients}</span>
              </div>
            )}

            {/* Subject */}
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-12 shrink-0 pt-0.5">Objet :</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground">
                  {emailData.subject || '(Sans objet)'}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-3" />

          {/* Email Body */}
          <ScrollArea className="max-h-[250px] pr-3">
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed email-content"
              // safe: formattedBody is produced via DOMPurify.sanitize in the useMemo above
              dangerouslySetInnerHTML={{ __html: formattedBody }}
            />
          </ScrollArea>

          {/* Thread indicator */}
          {emailData.thread_id && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Mail className="h-3.5 w-3.5" />
              <span>Réponse dans un fil de discussion existant</span>
            </div>
          )}
        </CardContent>

        {/* Action Buttons */}
        <CardFooter className="pt-0 pb-4 px-6 flex gap-2 flex-wrap">
          <Button
            onClick={onConfirm}
            disabled={isConfirming}
            className="flex-1 min-w-[120px] h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Envoyer
              </>
            )}
          </Button>

          {onModify && (
            <Button
              variant="outline"
              onClick={onModify}
              disabled={isConfirming}
              className="h-10 border-border/50 hover:bg-muted/50"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          )}

          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isConfirming}
            className="h-10 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
