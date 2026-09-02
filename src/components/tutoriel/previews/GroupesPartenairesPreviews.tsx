import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  Users,
  Handshake,
  MapPin,
  TrendingUp,
  Mail,
  Phone,
  Calendar,
  Link2,
  ExternalLink,
  MoreHorizontal,
  Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'

// ============================================
// GROUPE CARD PREVIEW
// ============================================

export const GroupeCardPreview = memo(() => {
  const groupe = {
    nom: 'Groupement Rhône-Alpes',
    type: 'Groupement',
    etablissements: 8,
    etablissementsActifs: 5,
    caTotal: 485000,
    progression: 62,
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
                className="p-2 rounded-lg bg-blue-500/10"
              >
                <Users className="h-5 w-5 text-blue-500" />
              </motion.div>
              <div>
                <CardTitle className="text-lg">{groupe.nom}</CardTitle>
                <Badge variant="outline" className="mt-1">{groupe.type}</Badge>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Plus d'options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Etablissements count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Établissements</span>
            </div>
            <div className="flex items-center gap-1">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-lg font-semibold text-green-600"
              >
                <TutorielCountUpAnimation value={groupe.etablissementsActifs} delay={300} duration={600} />
              </motion.span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">{groupe.etablissements}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progression globale</span>
              <span className="font-medium">
                <TutorielCountUpAnimation value={groupe.progression} delay={400} duration={800} suffix="%" />
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${groupe.progression}%` }}
                transition={{ delay: 0.4, duration: 1 }}
                className="h-full bg-blue-500"
              />
            </div>
          </div>

          {/* CA Total */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
          >
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span>CA Total</span>
            </div>
            <span className="font-semibold">
              <TutorielCountUpAnimation value={groupe.caTotal} delay={500} duration={1000} suffix=" €" />
            </span>
          </motion.div>

          {/* Linked establishments preview */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link2 className="h-3 w-3" />
              <span>Établissements liés</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {['Groupe Vallois', 'Agence Grenoble', 'Agence Annecy', 'Agence Chambéry', 'Agence Valence'].map((etab, index) => (
                <motion.div
                  key={etab}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.08 }}
                >
                  <Badge variant="secondary" className="text-[10px]">{etab}</Badge>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Action */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <Button size="sm" className="w-full">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Voir le groupe
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
})
GroupeCardPreview.displayName = 'GroupeCardPreview'

// ============================================
// PARTENAIRE CARD PREVIEW
// ============================================

export const PartenaireCardPreview = memo(() => {
  const partenaire = {
    nom: 'MedTech Solutions',
    type: 'Intégrateur',
    contacts: 3,
    etablissementsLies: 12,
    ville: 'Paris',
    email: 'contact@medtech-solutions.fr',
    tel: '01 42 XX XX XX',
  }

  const contacts = [
    { nom: 'Pierre Martin', role: 'Directeur Commercial' },
    { nom: 'Claire Dubois', role: 'Chef de Projet' },
    { nom: 'Marc Lefebvre', role: 'Support Technique' },
  ]

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
                className="p-2 rounded-lg bg-purple-500/10"
              >
                <Handshake className="h-5 w-5 text-purple-500" />
              </motion.div>
              <div>
                <CardTitle className="text-lg">{partenaire.nom}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-purple-600 border-purple-200">
                    {partenaire.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {partenaire.ville}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contact info */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2 text-sm"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{partenaire.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{partenaire.tel}</span>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex gap-4 p-2 rounded-lg bg-muted/50"
          >
            <div className="text-center flex-1">
              <div className="text-lg font-semibold">
                <TutorielCountUpAnimation value={partenaire.contacts} delay={400} duration={600} />
              </div>
              <div className="text-xs text-muted-foreground">Contacts</div>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center flex-1">
              <div className="text-lg font-semibold">
                <TutorielCountUpAnimation value={partenaire.etablissementsLies} delay={500} duration={600} />
              </div>
              <div className="text-xs text-muted-foreground">Établissements</div>
            </div>
          </motion.div>

          {/* Contacts list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Contacts</span>
              <Button size="sm" variant="ghost" className="h-6 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
            </div>
            {contacts.map((contact, index) => (
              <motion.div
                key={contact.nom}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-center gap-2 p-2 rounded-lg border"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">
                    {contact.nom.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{contact.nom}</p>
                  <p className="text-xs text-muted-foreground">{contact.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})
PartenaireCardPreview.displayName = 'PartenaireCardPreview'

// ============================================
// RELATIONS TIMELINE PREVIEW
// ============================================

export const RelationsTimelinePreview = memo(() => {
  const events = [
    { type: 'email', text: 'Email envoyé à MedTech Solutions', time: 'Il y a 2h' },
    { type: 'meeting', text: 'Réunion de suivi planifiée', time: 'Hier' },
    { type: 'link', text: 'Groupe Vallois ajouté au groupement', time: 'Il y a 3 jours' },
    { type: 'contact', text: 'Nouveau contact ajouté', time: 'Il y a 1 semaine' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Calendar className="h-4 w-4 text-primary" />
        Historique des relations
      </div>
      <div className="space-y-2">
        {events.map((event, index) => (
          <motion.div
            key={`event-${index}-${event.text.slice(0, 16)}`}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.12 }}
            className="flex items-center gap-3 p-2 rounded-lg border bg-card"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.12 + 0.1, type: 'spring' }}
              className="w-2 h-2 rounded-full bg-primary"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{event.text}</p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{event.time}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
})
RelationsTimelinePreview.displayName = 'RelationsTimelinePreview'
