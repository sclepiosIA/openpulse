/**
 * Live Previews pour le module Trésorerie
 */
import { memo, useEffect, useState } from 'react'
import { TutorielPreviewWrapper } from '../TutorielMockProviders'
import { TutorielCountUpAnimation, TutorielProgressBar } from '../TutorielCountUpAnimation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock data
export const mockTresorerieKPIs = {
  soldeBancaire: 145280,
  revenusMensuels: 85000,
  depensesMensuelles: 62000,
  aEncaisser: 35000,
  trendRevenus: 12,
  trendDepenses: -5
}

export const mockRevenus = [
  { id: '1', etablissement: 'Cabinet Les Tilleuls', montant: 15000, statut: 'encaisse', date: '2024-01-15' },
  { id: '2', etablissement: 'CH Le Villeneuve', montant: 25000, statut: 'prevu', date: '2024-01-20' },
  { id: '3', etablissement: 'Clinique St Jean', montant: 18500, statut: 'facture', date: '2024-01-10' },
]

export const mockDepenses = [
  { id: '1', nom: 'Salaires janvier', montant: 42000, categorie: 'Salaires', statut: 'paye' },
  { id: '2', nom: 'Loyer bureaux', montant: 3500, categorie: 'Locaux', statut: 'paye' },
  { id: '3', nom: 'Licences Azure', montant: 2800, categorie: 'Tech', statut: 'prevu' },
]

/**
 * Dashboard Trésorerie avec KPIs animés
 */
export const TresorerieDashboardPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const kpis = [
    { 
      label: 'Solde bancaire', 
      value: mockTresorerieKPIs.soldeBancaire, 
      icon: Wallet, 
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      prefix: '',
      suffix: ' €'
    },
    { 
      label: 'Revenus du mois', 
      value: mockTresorerieKPIs.revenusMensuels, 
      icon: TrendingUp, 
      color: 'text-success',
      bgColor: 'bg-success/10',
      trend: mockTresorerieKPIs.trendRevenus,
      prefix: '+',
      suffix: ' €'
    },
    { 
      label: 'Dépenses du mois', 
      value: mockTresorerieKPIs.depensesMensuelles, 
      icon: TrendingDown, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      trend: mockTresorerieKPIs.trendDepenses,
      prefix: '-',
      suffix: ' €'
    },
    { 
      label: 'À encaisser', 
      value: mockTresorerieKPIs.aEncaisser, 
      icon: CreditCard, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      suffix: ' €'
    },
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
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                  <p className={cn("text-lg font-bold", kpi.color)}>
                    <TutorielCountUpAnimation 
                      value={kpi.value} 
                      suffix={kpi.suffix}
                      delay={index * 150}
                    />
                  </p>
                </div>
                {kpi.trend !== undefined && (
                  <Badge 
                    variant={kpi.trend > 0 ? "default" : "destructive"} 
                    className="text-xs"
                  >
                    {kpi.trend > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                    {Math.abs(kpi.trend)}%
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TutorielPreviewWrapper>
  )
})
TresorerieDashboardPreview.displayName = 'TresorerieDashboardPreview'

/**
 * Liste des revenus avec progression
 */
export const TresorerieRevenusPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'encaisse':
        return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />Encaissé</Badge>
      case 'facture':
        return <Badge className="bg-primary/10 text-primary border-primary/20"><Clock className="h-3 w-3 mr-1" />Facturé</Badge>
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Prévu</Badge>
    }
  }

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            Revenus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockRevenus.map((revenu, index) => (
            <div 
              key={revenu.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg bg-muted/50 transition-all duration-500",
                isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
              )}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{revenu.etablissement}</p>
                <p className="text-xs text-muted-foreground">{revenu.date}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-success">
                  <TutorielCountUpAnimation value={revenu.montant} suffix=" €" delay={index * 150} />
                </p>
                {getStatusBadge(revenu.statut)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
TresorerieRevenusPreview.displayName = 'TresorerieRevenusPreview'

/**
 * Liste des dépenses avec catégories
 */
export const TresorerieDepensesPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const getCategoryColor = (categorie: string) => {
    switch (categorie) {
      case 'Salaires': return 'bg-blue-100 text-blue-700'
      case 'Locaux': return 'bg-amber-100 text-amber-700'
      case 'Tech': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const total = mockDepenses.reduce((sum, d) => sum + d.montant, 0)

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            Dépenses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockDepenses.map((depense, index) => (
            <div 
              key={depense.id}
              className={cn(
                "space-y-2 p-3 rounded-lg bg-muted/50 transition-all duration-500",
                isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
              )}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", getCategoryColor(depense.categorie))}>
                    {depense.categorie}
                  </span>
                  <span className="text-sm font-medium">{depense.nom}</span>
                </div>
                <span className="text-sm font-bold text-destructive">
                  -<TutorielCountUpAnimation value={depense.montant} suffix=" €" delay={index * 150} />
                </span>
              </div>
              <TutorielProgressBar 
                value={depense.montant} 
                maxValue={total} 
                delay={index * 150} 
                color="destructive"
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
TresorerieDepensesPreview.displayName = 'TresorerieDepensesPreview'
