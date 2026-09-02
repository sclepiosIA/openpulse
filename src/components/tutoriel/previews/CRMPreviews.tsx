import { memo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  User,
  Mail,
  MapPin,
  Calendar,
  Heart,
  CheckCircle2,
  Plus,
  MessageSquare,
  FileText,
  Clock,
  Euro,
  Star,
  MoreHorizontal,
  Edit,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'

// ============================================
// ETABLISSEMENT CARD PREVIEW
// ============================================

export const CRMEtablissementPreview = memo(() => {
  const [healthScore, setHealthScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setHealthScore(87), 500)
    return () => clearTimeout(timer)
  }, [])

  const etablissement = {
    nom: 'Groupe Vallois',
    type: 'Grand compte',
    statut: 'Production',
    ville: 'Lyon',
    ca: 125000,
    contacts: 4,
    tachesEnCours: 3,
    prochainRdv: '15 Jan 2026',
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-orange-500'
    return 'text-red-500'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="p-2 rounded-lg bg-primary/10"
              >
                <Building2 className="h-5 w-5 text-primary" />
              </motion.div>
              <div>
                <CardTitle className="text-lg">{etablissement.nom}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {etablissement.type}
                  </Badge>
                  <Badge className="text-xs bg-green-500/10 text-green-600 border-green-200">
                    {etablissement.statut}
                  </Badge>
                </div>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="text-right"
            >
              <div className={`text-2xl font-bold ${getHealthColor(healthScore)}`}>
                <TutorielCountUpAnimation
                  value={healthScore}
                  duration={1000}
                  delay={500}
                  suffix="%"
                />
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Heart className="h-3 w-3" />
                Score santé
              </div>
            </motion.div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Location */}
          <motion.div
            className="flex items-center gap-2 text-sm text-muted-foreground"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <MapPin className="h-4 w-4" />
            {etablissement.ville}
          </motion.div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'CA Annuel', value: etablissement.ca, suffix: ' €', icon: Euro },
              { label: 'Contacts', value: etablissement.contacts, icon: User },
              { label: 'Tâches', value: etablissement.tachesEnCours, icon: CheckCircle2 },
            ].map((stat, index) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="text-center p-2 rounded-lg bg-muted/50"
                >
                  <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <div className="text-lg font-semibold">
                    <TutorielCountUpAnimation
                      value={stat.value}
                      delay={400 + index * 100}
                      duration={800}
                      suffix={stat.suffix}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </motion.div>
              )
            })}
          </div>

          {/* Next appointment */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex items-center justify-between p-2 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Prochain RDV</span>
            </div>
            <Badge variant="secondary">{etablissement.prochainRdv}</Badge>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex gap-2"
          >
            <Button size="sm" className="flex-1">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Voir détails
            </Button>
            <Button size="sm" variant="outline">
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
})
CRMEtablissementPreview.displayName = 'CRMEtablissementPreview'

// ============================================
// CONTACTS LIST PREVIEW
// ============================================

export const CRMContactsPreview = memo(() => {
  const contacts = [
    {
      nom: 'Dr. Marie Lambert',
      role: 'Directrice des soins',
      email: 'marie.lambert@groupe-vallois.example.org',
      tel: '04 72 XX XX XX',
      principal: true,
    },
    {
      nom: 'Jean-Pierre Duval',
      role: 'DSI',
      email: 'jp.duval@groupe-vallois.example.org',
      tel: '04 72 XX XX XX',
      principal: false,
    },
    {
      nom: 'Sophie Durand',
      role: 'Cadre de santé',
      email: 's.moreau@groupe-vallois.example.org',
      tel: '04 72 XX XX XX',
      principal: false,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <User className="h-4 w-4 text-primary" />
          Contacts ({contacts.length})
        </div>
        <Button size="sm" variant="outline" className="h-7">
          <Plus className="h-3 w-3 mr-1" />
          Ajouter
        </Button>
      </div>
      <div className="space-y-2">
        {contacts.map((contact, index) => (
          <motion.div
            key={contact.email}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.15 }}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.15 + 0.1, type: 'spring' }}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback
                  className={contact.principal ? 'bg-primary text-primary-foreground' : ''}
                >
                  {contact.nom
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{contact.nom}</span>
                {contact.principal && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.15 + 0.2, type: 'spring' }}
                  >
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  </motion.div>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{contact.role}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {contact.email}
                </span>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              aria-label="Plus d'options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  )
})
CRMContactsPreview.displayName = 'CRMContactsPreview'

// ============================================
// NOTES & ACTIVITIES TIMELINE PREVIEW
// ============================================

export const CRMNotesPreview = memo(() => {
  const activities = [
    {
      type: 'note',
      user: 'Marie D.',
      content: 'Appel de suivi effectué, satisfaction confirmée',
      time: 'Il y a 2h',
      icon: MessageSquare,
    },
    {
      type: 'email',
      user: 'Système',
      content: 'Email automatique envoyé : Rappel renouvellement',
      time: 'Hier',
      icon: Mail,
    },
    {
      type: 'tache',
      user: 'Thomas B.',
      content: 'Formation planifiée pour le 20 janvier',
      time: 'Il y a 2 jours',
      icon: CheckCircle2,
    },
    {
      type: 'document',
      user: 'Sophie L.',
      content: 'Contrat annuel ajouté aux documents',
      time: 'Il y a 1 semaine',
      icon: FileText,
    },
  ]

  const typeColors = {
    note: 'bg-blue-500',
    email: 'bg-green-500',
    tache: 'bg-purple-500',
    document: 'bg-orange-500',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-primary" />
          Historique
        </div>
        <Button size="sm" variant="outline" className="h-7">
          <Plus className="h-3 w-3 mr-1" />
          Note
        </Button>
      </div>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-4">
          {activities.map((activity, index) => {
            const Icon = activity.icon
            return (
              <motion.div
                key={`crm-activity-${activity.type}-${activity.time}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15 }}
                className="relative pl-10"
              >
                {/* Timeline dot */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.15 + 0.1, type: 'spring' }}
                  className={`absolute left-2 w-5 h-5 rounded-full ${typeColors[activity.type as keyof typeof typeColors]} flex items-center justify-center`}
                >
                  <Icon className="h-3 w-3 text-white" />
                </motion.div>

                <div className="p-2 rounded-lg border bg-card">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="font-medium text-foreground">{activity.user}</span>
                    <span>{activity.time}</span>
                  </div>
                  <p className="text-sm">{activity.content}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
CRMNotesPreview.displayName = 'CRMNotesPreview'

// ============================================
// HEALTH SCORE BREAKDOWN PREVIEW
// ============================================

export const CRMHealthScorePreview = memo(() => {
  const metrics = [
    { label: 'Adoption', value: 92, maxValue: 100, color: 'bg-green-500' },
    { label: 'NPS', value: 8.5, maxValue: 10, color: 'bg-blue-500' },
    { label: 'Support', value: 75, maxValue: 100, color: 'bg-orange-500' },
    { label: 'Engagement', value: 88, maxValue: 100, color: 'bg-purple-500' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Heart className="h-4 w-4 text-primary" />
        Détail du score de santé
      </div>
      <div className="space-y-3">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.15 }}
            className="space-y-1"
          >
            <div className="flex items-center justify-between text-sm">
              <span>{metric.label}</span>
              <span className="font-medium">
                <TutorielCountUpAnimation
                  value={metric.value}
                  delay={index * 150}
                  duration={800}
                  decimals={metric.maxValue === 10 ? 1 : 0}
                />
                <span className="text-muted-foreground">/{metric.maxValue}</span>
              </span>
            </div>
            <div className={`h-2 rounded-full bg-muted overflow-hidden`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(metric.value / metric.maxValue) * 100}%` }}
                transition={{ delay: index * 0.15, duration: 1 }}
                className={`h-full ${metric.color}`}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
})
CRMHealthScorePreview.displayName = 'CRMHealthScorePreview'
