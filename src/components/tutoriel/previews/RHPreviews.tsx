/**
 * Live Previews pour le module RH/People
 */
import { memo, useEffect, useState } from 'react'
import { TutorielPreviewWrapper } from '../TutorielMockProviders'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'
import { TutorielFlowDiagram } from '../TutorielFlowDiagram'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Users,
  Wallet,
  Calendar,
  Upload,
  Sparkles,
  CheckCircle2,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock data
export const mockRHKPIs = {
  effectifTotal: 12,
  masseSalarialeNette: 38500,
  masseSalarialeBrute: 52000,
  coutEmployeur: 68000,
  absencesEnCours: 2
}

export const mockTeamMembers = [
  { id: '1', prenom: 'Sophie', nom: 'Bernard', role: 'Commerciale', avatar: null, status: 'active' },
  { id: '2', prenom: 'Thomas', nom: 'Martin', role: 'Chef de projet', avatar: null, status: 'active' },
  { id: '3', prenom: 'Julie', nom: 'Petit', role: 'CSM', avatar: null, status: 'absence' },
  { id: '4', prenom: 'Marc', nom: 'Dubois', role: 'Développeur', avatar: null, status: 'active' },
]

export const mockSalaires = [
  { id: '1', employe: 'Sophie Bernard', netPaye: 3200, brut: 4100, coutEmployeur: 5400 },
  { id: '2', employe: 'Thomas Martin', netPaye: 3800, brut: 4900, coutEmployeur: 6400 },
  { id: '3', employe: 'Julie Petit', netPaye: 2900, brut: 3700, coutEmployeur: 4800 },
]

export const mockAbsences = [
  { id: '1', employe: 'Julie Petit', type: 'Congés payés', debut: '2024-01-15', fin: '2024-01-22', jours: 6 },
  { id: '2', employe: 'Marc Dubois', type: 'RTT', debut: '2024-01-18', fin: '2024-01-18', jours: 1 },
]

/**
 * Vue d'ensemble RH avec KPIs
 */
export const RHOverviewPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const kpis = [
    { label: 'Effectif total', value: mockRHKPIs.effectifTotal, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10', suffix: '' },
    { label: 'Masse salariale nette', value: mockRHKPIs.masseSalarialeNette, icon: Wallet, color: 'text-success', bgColor: 'bg-success/10', suffix: ' €' },
    { label: 'Coût employeur', value: mockRHKPIs.coutEmployeur, icon: Briefcase, color: 'text-warning', bgColor: 'bg-warning/10', suffix: ' €' },
    { label: 'Absences en cours', value: mockRHKPIs.absencesEnCours, icon: Calendar, color: 'text-destructive', bgColor: 'bg-destructive/10', suffix: '' },
  ]

  return (
    <TutorielPreviewWrapper>
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi, index) => (
          <Card 
            key={kpi.label}
            className={cn(
              "transition-all duration-500",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", kpi.bgColor)}>
                  <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className={cn("text-lg font-bold", kpi.color)}>
                    <TutorielCountUpAnimation value={kpi.value} suffix={kpi.suffix} delay={index * 150} />
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
RHOverviewPreview.displayName = 'RHOverviewPreview'

/**
 * Liste de l'équipe avec avatars animés
 */
export const RHTeamListPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Équipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockTeamMembers.map((member, index) => (
              <div 
                key={member.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-all duration-500",
                  isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                )}
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {member.prenom[0]}{member.nom[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{member.prenom} {member.nom}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </div>
                <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                  {member.status === 'active' ? 'Actif' : 'Absent'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
RHTeamListPreview.displayName = 'RHTeamListPreview'

/**
 * Tableau des salaires
 */
export const RHSalairesPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Salaires du mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
              <span>Employé</span>
              <span className="text-right">Net payé</span>
              <span className="text-right">Brut</span>
              <span className="text-right">Coût total</span>
            </div>
            {/* Rows */}
            {mockSalaires.map((salaire, index) => (
              <div 
                key={salaire.id}
                className={cn(
                  "grid grid-cols-4 gap-2 py-2 transition-all duration-500",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <span className="text-sm font-medium truncate">{salaire.employe}</span>
                <span className="text-sm text-right text-success font-semibold">
                  <TutorielCountUpAnimation value={salaire.netPaye} suffix=" €" delay={index * 150} />
                </span>
                <span className="text-sm text-right text-muted-foreground">
                  <TutorielCountUpAnimation value={salaire.brut} suffix=" €" delay={index * 150 + 50} />
                </span>
                <span className="text-sm text-right text-warning font-semibold">
                  <TutorielCountUpAnimation value={salaire.coutEmployeur} suffix=" €" delay={index * 150 + 100} />
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
RHSalairesPreview.displayName = 'RHSalairesPreview'

/**
 * Démonstration du parsing IA de bulletin
 */
export const RHBulletinParsingPreview = memo(() => {
  const [step, setStep] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % 5)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const steps = [
    { id: 'upload', label: 'Upload PDF', description: 'Glisser-déposer le bulletin' },
    { id: 'analyze', label: 'Analyse IA', description: 'Extraction des données' },
    { id: 'extract', label: 'Extraction', description: 'Salaire, cotisations...' },
    { id: 'validate', label: 'Validation', description: 'Vérification des données' },
    { id: 'save', label: 'Enregistrement', description: 'Sauvegarde en base' },
  ]

  const extractedFields = [
    { label: 'Employé', value: 'Sophie Bernard' },
    { label: 'Période', value: 'Janvier 2024' },
    { label: 'Net payé', value: '3 200,00 €' },
    { label: 'Brut', value: '4 100,00 €' },
  ]

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Parsing IA - Bulletin de paie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Flow diagram */}
          <TutorielFlowDiagram 
            steps={steps}
            direction="horizontal"
            autoPlay={true}
            loop={true}
          />

          {/* Extracted data preview */}
          {step >= 2 && (
            <div className="mt-4 p-4 rounded-lg bg-success/5 border border-success/20 animate-fade-in">
              <p className="text-xs font-medium text-success mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Données extraites
              </p>
              <div className="grid grid-cols-2 gap-2">
                {extractedFields.map((field, index) => (
                  <div 
                    key={field.label}
                    className={cn(
                      "transition-all duration-300",
                      step >= 2 + Math.floor(index / 2) ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    <p className="text-sm font-medium">{field.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
RHBulletinParsingPreview.displayName = 'RHBulletinParsingPreview'

/**
 * Planning des absences visuel
 */
export const RHAbsencesPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Congés payés': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'RTT': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Maladie': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Absences en cours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockAbsences.map((absence, index) => (
              <div 
                key={absence.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all duration-500",
                  getTypeColor(absence.type),
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{absence.employe}</p>
                  <p className="text-xs">{absence.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs">{absence.debut} → {absence.fin}</p>
                  <Badge variant="outline" className="text-xs mt-1">{absence.jours} jour(s)</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
RHAbsencesPreview.displayName = 'RHAbsencesPreview'
