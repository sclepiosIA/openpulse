import { memo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Send,
  Star,
  Paperclip,
  Clock,
  Sparkles,
  Building2,
  User,
  Check,
  Reply,
  Forward,
  Archive,
  Trash2,
  MoreHorizontal,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
// ============================================
// EMAIL INBOX PREVIEW
// ============================================

export const EmailInboxPreview = memo(() => {
  const emails = [
    { 
      id: 1, 
      from: 'Dr. Martin Dupont', 
      fromEmail: 'martin.dupont@groupe-vallois.example.org',
      subject: 'RE: Planification formation équipe terrain',
      preview: 'Bonjour, suite à notre échange téléphonique, je vous confirme notre disponibilité pour...',
      time: '10:32',
      unread: true,
      starred: true,
      hasAttachment: true,
      aiTags: ['Formation', 'Groupe Vallois'],
      etablissement: 'Groupe Vallois'
    },
    { 
      id: 2, 
      from: 'Sophie Bernard', 
      fromEmail: 'sophie.bernard@clinique-parc.example.org',
      subject: 'Demande de démonstration outil métier',
      preview: 'Madame, Monsieur, nous souhaiterions organiser une démonstration de votre solution...',
      time: '09:15',
      unread: true,
      starred: false,
      hasAttachment: false,
      aiTags: ['Commercial', 'Prospect'],
      etablissement: null
    },
    { 
      id: 3, 
      from: 'Support Technique', 
      fromEmail: 'support@ch-littoral.example.org',
      subject: 'Ticket #4521 - Résolu',
      preview: 'Le problème signalé a été résolu. La synchronisation fonctionne correctement...',
      time: 'Hier',
      unread: false,
      starred: false,
      hasAttachment: false,
      aiTags: ['Support', 'Résolu'],
      etablissement: 'CH Marseille'
    },
  ]

  return (
    <div className="space-y-1 divide-y divide-border rounded-lg border overflow-hidden">
      {emails.map((email, index) => (
        <motion.div
          key={email.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.15, duration: 0.3 }}
          className={`p-3 cursor-pointer transition-colors ${email.unread ? 'bg-primary/5' : 'bg-card'} hover:bg-accent/50`}
        >
          <div className="flex items-start gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.15 + 0.1, type: 'spring' }}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className={email.unread ? 'bg-primary text-primary-foreground' : ''}>
                  {email.from.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm truncate ${email.unread ? 'font-semibold' : ''}`}>
                  {email.from}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  {email.hasAttachment && <Paperclip className="h-3 w-3" />}
                  {email.starred && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                  <span>{email.time}</span>
                </div>
              </div>
              <p className={`text-sm truncate ${email.unread ? 'font-medium' : 'text-muted-foreground'}`}>
                {email.subject}
              </p>
              <p className="text-xs text-muted-foreground truncate">{email.preview}</p>
              
              {/* AI Tags */}
              <motion.div 
                className="flex items-center gap-1.5 mt-2"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 + 0.3 }}
              >
                <Sparkles className="h-3 w-3 text-primary" />
                {email.aiTags.map((tag) => (
                  <Badge key={`${email.subject}-tag-${tag}`} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
                {email.etablissement && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                    <Building2 className="h-2.5 w-2.5" />
                    {email.etablissement}
                  </Badge>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
})
EmailInboxPreview.displayName = 'EmailInboxPreview'

// ============================================
// EMAIL COMPOSE WITH AI PREVIEW
// ============================================

export const EmailComposePreview = memo(() => {
  const [typedText, setTypedText] = useState('')
  const [showSuggestion, setShowSuggestion] = useState(false)
  
  const fullText = "Bonjour Dr. Martin,\n\nSuite à notre entretien, je vous confirme la date de formation pour votre équipe."
  const aiSuggestion = "Je vous propose également d'inclure une session de questions-réponses d'une heure après la formation principale."

  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      if (index < fullText.length) {
        setTypedText(fullText.slice(0, index + 1))
        index++
      } else {
        clearInterval(timer)
        setTimeout(() => setShowSuggestion(true), 500)
      }
    }, 30)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      {/* Header */}
      <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Nouveau message</span>
      </div>
      
      {/* To field */}
      <div className="p-2 border-b flex items-center gap-2">
        <span className="text-sm text-muted-foreground">À :</span>
        <Badge variant="secondary" className="gap-1">
          <User className="h-3 w-3" />
          martin.dupont@groupe-vallois.example.org
        </Badge>
      </div>

      {/* Subject */}
      <div className="p-2 border-b">
        <span className="text-sm font-medium">RE: Planification formation équipe terrain</span>
      </div>

      {/* Body */}
      <div className="p-3 min-h-[120px] relative">
        <p className="text-sm whitespace-pre-wrap">{typedText}</p>
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="inline-block w-0.5 h-4 bg-primary ml-0.5"
        />

        {/* AI Suggestion */}
        <AnimatePresence>
          {showSuggestion && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20"
            >
              <div className="flex items-center gap-2 text-xs text-primary mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="font-medium">Suggestion IA</span>
              </div>
              <p className="text-sm text-muted-foreground">{aiSuggestion}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" className="text-xs h-7">
                  <Check className="h-3 w-3 mr-1" />
                  Insérer
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-7">
                  Ignorer
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toolbar */}
      <div className="p-2 border-t bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button size="sm" className="h-8">
            <Send className="h-3.5 w-3.5 mr-1" />
            Envoyer
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Joindre un fichier">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="IA">
            <Sparkles className="h-4 w-4 text-primary" />
          </Button>
        </div>
      </div>
    </div>
  )
})
EmailComposePreview.displayName = 'EmailComposePreview'

// ============================================
// EMAIL CLASSIFICATION AI PREVIEW
// ============================================

export const EmailClassificationPreview = memo(() => {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 1200),
      setTimeout(() => setStage(3), 2000),
      setTimeout(() => setStage(4), 2800),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const email = {
    from: 'direction@clinique-tilleuls.example.org',
    subject: 'Demande urgente de support technique',
    preview: 'Bonjour, nous rencontrons un problème critique avec le module de facturation...'
  }

  const classifications = [
    { label: 'Catégorie', value: 'Support Technique', icon: AlertCircle, color: 'text-orange-500' },
    { label: 'Priorité', value: 'Haute', icon: Clock, color: 'text-red-500' },
    { label: 'Établissement', value: 'Clinique Saint-Jean', icon: Building2, color: 'text-blue-500' },
    { label: 'Action suggérée', value: 'Créer ticket support', icon: CheckCircle2, color: 'text-green-500' },
  ]

  return (
    <div className="space-y-4">
      {/* Email being analyzed */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-3 rounded-lg border bg-card"
      >
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{email.from}</span>
        </div>
        <p className="text-sm font-medium">{email.subject}</p>
        <p className="text-xs text-muted-foreground mt-1">{email.preview}</p>
      </motion.div>

      {/* AI Analysis indicator */}
      {stage >= 1 && stage < 4 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 text-sm text-primary"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            <Sparkles className="h-4 w-4" />
          </motion.div>
          <span>Analyse IA en cours...</span>
        </motion.div>
      )}

      {/* Classification results */}
      <div className="grid grid-cols-2 gap-2">
        {classifications.map((item, index) => {
          const Icon = item.icon
          const shouldShow = stage >= index + 1
          
          return (
            <AnimatePresence key={item.label}>
              {shouldShow && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="p-2 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Icon className={`h-3 w-3 ${item.color}`} />
                    {item.label}
                  </div>
                  <p className="text-sm font-medium">{item.value}</p>
                </motion.div>
              )}
            </AnimatePresence>
          )
        })}
      </div>
    </div>
  )
})
EmailClassificationPreview.displayName = 'EmailClassificationPreview'

// ============================================
// EMAIL ACTIONS PREVIEW
// ============================================

export const EmailActionsPreview = memo(() => {
  const [activeAction, setActiveAction] = useState<string | null>(null)

  const actions = [
    { id: 'reply', icon: Reply, label: 'Répondre', shortcut: 'R' },
    { id: 'forward', icon: Forward, label: 'Transférer', shortcut: 'F' },
    { id: 'archive', icon: Archive, label: 'Archiver', shortcut: 'E' },
    { id: 'delete', icon: Trash2, label: 'Supprimer', shortcut: 'Suppr' },
  ]

  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      setActiveAction(actions[index % actions.length].id)
      index++
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MoreHorizontal className="h-4 w-4 text-primary" />
        Actions rapides
      </div>
      <div className="flex gap-2">
        {actions.map((action, index) => {
          const Icon = action.icon
          const isActive = activeAction === action.id
          
          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: isActive ? 1.05 : 1,
                backgroundColor: isActive ? 'hsl(var(--primary) / 0.1)' : 'transparent'
              }}
              transition={{ delay: index * 0.1 }}
            >
              <Button
                variant="outline"
                size="sm"
                className={`flex flex-col h-auto py-2 ${isActive ? 'border-primary' : ''}`}
              >
                <Icon className={`h-4 w-4 mb-1 ${isActive ? 'text-primary' : ''}`} />
                <span className="text-xs">{action.label}</span>
                <kbd className="text-[10px] text-muted-foreground mt-0.5 bg-muted px-1 rounded">
                  {action.shortcut}
                </kbd>
              </Button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
})
EmailActionsPreview.displayName = 'EmailActionsPreview'
