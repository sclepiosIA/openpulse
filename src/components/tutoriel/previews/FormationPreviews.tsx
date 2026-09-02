/**
 * Live Previews pour le module Formation
 */
import { memo, useEffect, useState } from 'react'
import { TutorielPreviewWrapper } from '../TutorielMockProviders'
import { TutorielCountUpAnimation, TutorielProgressBar } from '../TutorielCountUpAnimation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  GraduationCap,
  Users,
  Calendar,
  CheckCircle2,
  QrCode,
  Star,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock data
export const mockFormationSession = {
  id: '1',
  titre: 'Formation OpenPulse - Module Urgences',
  date: '2024-01-18',
  heureDebut: '09:00',
  heureFin: '17:00',
  lieu: 'Cabinet Les Tilleuls - Salle de formation',
  formateur: 'Thomas Martin',
  participantsInscrits: 12,
  participantsPresents: 10,
  statut: 'en_cours',
}

export const mockParticipants = [
  { id: '1', nom: 'Marie Dupont', fonction: 'Infirmière', emarge: true, heureEmargement: '08:55' },
  { id: '2', nom: 'Jean Lefebvre', fonction: 'Assistant', emarge: true, heureEmargement: '08:58' },
  {
    id: '3',
    nom: 'Sophie Martin',
    fonction: 'Cadre de santé',
    emarge: true,
    heureEmargement: '09:02',
  },
  { id: '4', nom: 'Pierre Durand', fonction: 'Médecin', emarge: false, heureEmargement: null },
]

export const mockSatisfactionResults = {
  noteGlobale: 4.6,
  tauxReponse: 83,
  categories: [
    { label: 'Contenu', note: 4.8 },
    { label: 'Formateur', note: 4.9 },
    { label: 'Supports', note: 4.5 },
    { label: 'Pratique', note: 4.3 },
  ],
}

export const mockFormationStats = {
  sessionsTotal: 24,
  participantsFormes: 186,
  tauxSatisfactionMoyen: 4.5,
  heuresFormation: 192,
}

/**
 * Carte de session de formation
 */
export const FormationSessionPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const session = mockFormationSession

  return (
    <TutorielPreviewWrapper>
      <Card
        className={cn(
          'transition-all duration-500',
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
      >
        <CardContent className="p-4">
          {/* Header with status */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{session.titre}</h3>
                <p className="text-xs text-muted-foreground">{session.formateur}</p>
              </div>
            </div>
            <Badge className="bg-primary/20 text-primary">En cours</Badge>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {session.date} • {session.heureDebut} - {session.heureFin}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {session.participantsPresents}/{session.participantsInscrits} participants présents
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Émargement</span>
              <span className="font-medium">
                <TutorielCountUpAnimation
                  value={(session.participantsPresents / session.participantsInscrits) * 100}
                  suffix="%"
                  delay={300}
                />
              </span>
            </div>
            <TutorielProgressBar
              value={session.participantsPresents}
              maxValue={session.participantsInscrits}
              delay={400}
              color="success"
            />
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
FormationSessionPreview.displayName = 'FormationSessionPreview'

/**
 * Tableau d'émargement
 */
export const FormationEmargementPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  const [checkingIndex, setCheckingIndex] = useState(-1)

  useEffect(() => {
    setIsVisible(true)

    // Simulate someone checking in
    const timeout = setTimeout(() => {
      setCheckingIndex(3)
    }, 2000)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Émargement
            </CardTitle>
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Scanner QR</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mockParticipants.map((participant, index) => {
              const isChecking = checkingIndex === index
              const isEmarge = participant.emarge || isChecking

              return (
                <div
                  key={participant.id}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-lg transition-all duration-500',
                    isEmarge ? 'bg-success/10' : 'bg-muted/50',
                    isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4',
                    isChecking && 'ring-2 ring-success animate-pulse'
                  )}
                  style={{ transitionDelay: `${index * 80}ms` }}
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                      isEmarge ? 'bg-success text-white' : 'bg-muted'
                    )}
                  >
                    {isEmarge ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{participant.nom}</p>
                    <p className="text-xs text-muted-foreground">{participant.fonction}</p>
                  </div>
                  {isEmarge && (
                    <span className="text-xs text-success">
                      {isChecking ? "À l'instant" : participant.heureEmargement}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
FormationEmargementPreview.displayName = 'FormationEmargementPreview'

/**
 * QR Code pour émargement
 */
export const FormationQRCodePreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    setIsVisible(true)

    const interval = setInterval(() => {
      setIsPulsing(true)
      setTimeout(() => setIsPulsing(false), 1000)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <Card
        className={cn(
          'transition-all duration-500',
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        )}
      >
        <CardContent className="p-6 text-center">
          {/* QR Code placeholder */}
          <div
            className={cn(
              'w-32 h-32 mx-auto bg-card rounded-xl p-2 shadow-lg transition-all',
              isPulsing && 'ring-4 ring-primary/50 scale-105'
            )}
          >
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center">
              <QrCode className="h-16 w-16 text-white" />
            </div>
          </div>

          <p className="text-sm font-medium mt-4">Scannez pour émarger</p>
          <p className="text-xs text-muted-foreground mt-1">
            Session: {mockFormationSession.titre}
          </p>

          {isPulsing && (
            <Badge className="mt-3 animate-fade-in bg-success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Scan détecté !
            </Badge>
          )}
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
FormationQRCodePreview.displayName = 'FormationQRCodePreview'

/**
 * Résultats de satisfaction
 */
export const FormationSatisfactionPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-warning" />
            Satisfaction
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Global score */}
          <div
            className={cn(
              'text-center mb-4 transition-all duration-500',
              isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            )}
          >
            <div className="text-4xl font-bold text-warning">
              <TutorielCountUpAnimation
                value={mockSatisfactionResults.noteGlobale}
                decimals={1}
                delay={300}
              />
            </div>
            <div className="flex justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-4 w-4 transition-all',
                    star <= Math.round(mockSatisfactionResults.noteGlobale)
                      ? 'text-warning fill-warning'
                      : 'text-muted-foreground'
                  )}
                  style={{ transitionDelay: `${star * 100}ms` }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <TutorielCountUpAnimation
                value={mockSatisfactionResults.tauxReponse}
                suffix="%"
                delay={500}
              />{' '}
              de réponses
            </p>
          </div>

          {/* Category scores */}
          <div className="space-y-3">
            {mockSatisfactionResults.categories.map((cat, index) => (
              <div
                key={cat.label}
                className={cn(
                  'transition-all duration-500',
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                )}
                style={{ transitionDelay: `${index * 100 + 400}ms` }}
              >
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{cat.label}</span>
                  <span className="font-medium">{cat.note}/5</span>
                </div>
                <TutorielProgressBar
                  value={cat.note}
                  maxValue={5}
                  delay={index * 100 + 500}
                  color="warning"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
FormationSatisfactionPreview.displayName = 'FormationSatisfactionPreview'

/**
 * Analytics formations globales
 */
export const FormationAnalyticsPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const stats = [
    {
      label: 'Sessions réalisées',
      value: mockFormationStats.sessionsTotal,
      icon: Calendar,
      color: 'text-primary',
    },
    {
      label: 'Participants formés',
      value: mockFormationStats.participantsFormes,
      icon: Users,
      color: 'text-success',
    },
    {
      label: 'Satisfaction moyenne',
      value: mockFormationStats.tauxSatisfactionMoyen,
      icon: Star,
      color: 'text-warning',
      decimals: 1,
      suffix: '/5',
    },
    {
      label: 'Heures de formation',
      value: mockFormationStats.heuresFormation,
      icon: BarChart3,
      color: 'text-purple-500',
      suffix: 'h',
    },
  ]

  return (
    <TutorielPreviewWrapper>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            className={cn(
              'transition-all duration-500',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            )}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className={cn('h-5 w-5', stat.color)} />
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={cn('text-xl font-bold', stat.color)}>
                    <TutorielCountUpAnimation
                      value={stat.value}
                      decimals={stat.decimals || 0}
                      suffix={stat.suffix || ''}
                      delay={index * 150 + 200}
                    />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TutorielPreviewWrapper>
  )
})
FormationAnalyticsPreview.displayName = 'FormationAnalyticsPreview'
