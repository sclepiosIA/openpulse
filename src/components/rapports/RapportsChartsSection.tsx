import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FALLBACK_FUNNEL_STATUTS } from '@/config/referenceDataDefaults'
import { useStatutsEtablissement } from '@/hooks/system/useReferenceData'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Funnel,
  LabelList,
} from 'recharts'
import { useAllEtablissements } from '@/hooks/crm/useProspects'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { formatNumber } from '@/lib/utils'
import { useMemo } from 'react'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]
const STATUS_COLORS = {
  Prospect: 'hsl(var(--muted-foreground))',
  Contractuel: 'hsl(var(--chart-1))',
  Conformité: 'hsl(var(--chart-2))',
  Déploiement: 'hsl(var(--chart-3))',
  Formation: 'hsl(var(--chart-4))',
  'Go-Live': 'hsl(var(--chart-5))',
  Production: 'hsl(142 76% 36%)',
}

export function RapportsChartsSection() {
  const { data: etablissements } = useAllEtablissements()
  const { data: profiles } = useProfiles()
  const { data: statutsRef } = useStatutsEtablissement()

  // Pipeline par statut
  const pipelineData = useMemo(() => {
    if (!etablissements) return []

    const statusCount: Record<string, { count: number; value: number }> = {}

    etablissements.forEach((e) => {
      if (!statusCount[e.statut]) {
        statusCount[e.statut] = { count: 0, value: 0 }
      }
      statusCount[e.statut].count++
      statusCount[e.statut].value += calculateEtablissementValue(e)
    })

    return Object.entries(statusCount).map(([statut, data]) => ({
      statut,
      count: data.count,
      valeur: Math.round(data.value),
    }))
  }, [etablissements])

  // Distribution par type d'offre
  const offreTypeData = useMemo(() => {
    if (!etablissements) return []

    const typeCount: Record<string, number> = {}
    etablissements.forEach((e) => {
      const type = e.type_offre || 'Non défini'
      typeCount[type] = (typeCount[type] || 0) + 1
    })

    return Object.entries(typeCount).map(([name, value]) => ({ name, value }))
  }, [etablissements])

  // Performance par commercial
  const commercialPerformance = useMemo(() => {
    if (!etablissements || !profiles) return []

    const perfData: Record<string, { count: number; value: number }> = {}

    etablissements.forEach((e) => {
      const responsableId = e.commercial_id
      if (!responsableId) return

      const profile = profiles.find((p) => p.id === responsableId)
      const name = profile ? `${profile.prenom} ${profile.nom}` : 'Non assigné'

      if (!perfData[name]) {
        perfData[name] = { count: 0, value: 0 }
      }
      perfData[name].count++
      perfData[name].value += calculateEtablissementValue(e)
    })

    return Object.entries(perfData)
      .map(([name, data]) => ({
        name,
        clients: data.count,
        ca: Math.round(data.value),
      }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 10)
  }, [etablissements, profiles])

  // Funnel de conversion
  const funnelData = useMemo(() => {
    if (!etablissements) return []

    const statuts =
      statutsRef.length > 0
        ? statutsRef
            .filter((s) => [...FALLBACK_FUNNEL_STATUTS].includes(s.label as any))
            .map((s) => s.label)
        : [...FALLBACK_FUNNEL_STATUTS]
    return statuts
      .map((statut) => {
        let count = 0
        if (statut === 'Déploiement') {
          count = etablissements.filter((e) =>
            ['Déploiement', 'Conformité'].includes(e.statut)
          ).length
        } else {
          count = etablissements.filter((e) => e.statut === statut).length
        }
        return { name: statut, value: count }
      })
      .filter((d) => d.value > 0)
  }, [etablissements, statutsRef])

  // Répartition géographique (top 10 régions)
  const geoData = useMemo(() => {
    if (!etablissements) return []

    const regionCount: Record<string, number> = {}
    etablissements.forEach((e) => {
      const region = e.region || 'Non défini'
      regionCount[region] = (regionCount[region] || 0) + 1
    })

    return Object.entries(regionCount)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [etablissements])

  // Évolution CA (simulation sur 12 mois)
  const evolutionData = useMemo(() => {
    if (!etablissements) return []

    const months = [
      'Jan',
      'Fév',
      'Mar',
      'Avr',
      'Mai',
      'Jun',
      'Jul',
      'Aoû',
      'Sep',
      'Oct',
      'Nov',
      'Déc',
    ]
    const currentMonth = new Date().getMonth()

    return months
      .map((month, index) => {
        // Simulation: répartition progressive du CA sur les mois passés
        const monthsAgo = currentMonth - index
        if (monthsAgo < 0) return { month, realise: 0, previsionnel: 0 }

        const ratio = (currentMonth - monthsAgo + 1) / (currentMonth + 1)
        const totalCA = etablissements.reduce((sum, e) => {
          if (e.statut === 'Production' || e.statut === 'Go-Live') {
            return sum + calculateEtablissementValue(e)
          }
          return sum
        }, 0)

        const totalPrevisionnel = etablissements.reduce((sum, e) => {
          return sum + calculateEtablissementValue(e)
        }, 0)

        return {
          month,
          realise: Math.round(totalCA * ratio),
          previsionnel: Math.round(totalPrevisionnel),
        }
      })
      .reverse()
  }, [etablissements])

  // Part de marché nationale
  const partMarcheData = useMemo(() => {
    if (!etablissements) return []

    const passagesProduction = etablissements
      .filter((e) => e.statut === 'Production' || e.statut === 'Go-Live')
      .reduce((sum, e) => sum + (e.nombre_passages_urgences_annuel || 0), 0)

    const totalPassages = etablissements.reduce(
      (sum, e) => sum + (e.nombre_passages_urgences_annuel || 0),
      0
    )

    const passagesRestants = 24_000_000 - totalPassages

    return [
      {
        name: 'En Production',
        value: passagesProduction,
        fill: 'hsl(142 76% 36%)',
      },
      {
        name: 'Pipeline',
        value: totalPassages - passagesProduction,
        fill: 'hsl(var(--chart-4))',
      },
      {
        name: 'Marché non adressé',
        value: passagesRestants > 0 ? passagesRestants : 0,
        fill: 'hsl(var(--muted))',
      },
    ]
  }, [etablissements])

  // Progression vers marché total (pour graphique barres empilées)
  const progressionMarcheData = useMemo(() => {
    if (!etablissements) return []

    const passagesProduction = etablissements
      .filter((e) => e.statut === 'Production' || e.statut === 'Go-Live')
      .reduce((sum, e) => sum + (e.nombre_passages_urgences_annuel || 0), 0)

    const totalPassages = etablissements.reduce(
      (sum, e) => sum + (e.nombre_passages_urgences_annuel || 0),
      0
    )

    return [
      {
        name: 'Marché National',
        production: passagesProduction,
        pipeline: totalPassages - passagesProduction,
        nonAdresse: Math.max(0, 24_000_000 - totalPassages),
      },
    ]
  }, [etablissements])

  const tooltipStyle = {
    borderRadius: '12px',
    border: '1px solid hsl(var(--border))',
    backgroundColor: 'rgba(255,255,255,0.95)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Évolution du CA */}
      <Card className="lg:col-span-2 bg-card/80 backdrop-blur-sm border-l-4 border-l-primary border-primary/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary to-primary/50" />
            Évolution du Chiffre d'Affaires
          </CardTitle>
          <CardDescription>CA réalisé vs prévisionnel sur les 12 derniers mois</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${formatNumber(value)}€`} />
              <Tooltip
                formatter={(value: number) => `${formatNumber(value)} €`}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="realise"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                name="CA Réalisé"
              />
              <Line
                type="monotone"
                dataKey="previsionnel"
                stroke="hsl(var(--chart-4))"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="CA Prévisionnel"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pipeline par statut */}
      <Card className="bg-card/80 backdrop-blur-sm border-t-4 border-t-blue-500 border-blue-500/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-500 to-blue-500/50" />
            Pipeline par Statut
          </CardTitle>
          <CardDescription>Répartition des établissements et valeur</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="statut" angle={-45} textAnchor="end" height={80} />
              <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--chart-1))" />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--chart-2))"
                tickFormatter={(value) => `${formatNumber(value)}€`}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="hsl(var(--chart-1))" name="Nombre" />
              <Bar yAxisId="right" dataKey="valeur" fill="hsl(var(--chart-2))" name="Valeur (€)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Type d'offre */}
      <Card className="bg-card/80 backdrop-blur-sm border-t-4 border-t-amber-500 border-amber-500/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-500 to-amber-500/50" />
            Distribution par Type d'Offre
          </CardTitle>
          <CardDescription>Répartition des modèles commerciaux</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={offreTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="hsl(var(--chart-1))"
                dataKey="value"
              >
                {offreTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Répartition géographique */}
      <Card className="bg-card/80 backdrop-blur-sm border-t-4 border-t-emerald-500 border-emerald-500/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-500/50" />
            Top 10 Régions
          </CardTitle>
          <CardDescription>Répartition par région</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={geoData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="region" width={100} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(var(--chart-3))" name="Établissements" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance commerciaux */}
      <Card className="bg-card/80 backdrop-blur-sm border-t-4 border-t-violet-500 border-violet-500/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-500 to-violet-500/50" />
            Performance par Commercial
          </CardTitle>
          <CardDescription>Top 10 par chiffre d'affaires</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={commercialPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `${formatNumber(value)}€`} />
              <YAxis type="category" dataKey="name" width={120} />
              <Tooltip
                formatter={(value: number) => `${formatNumber(value)} €`}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Bar dataKey="ca" fill="hsl(var(--chart-4))" name="CA (€)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Part de Marché National - Camembert */}
      <Card className="lg:col-span-2 bg-card/80 backdrop-blur-sm border-l-4 border-l-success border-success/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-success to-success/50" />
            Part de Marché National
          </CardTitle>
          <CardDescription>
            Répartition sur les 24 millions de passages annuels en France
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={partMarcheData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value, percent }) =>
                  `${name}: ${formatNumber(value)} (${(percent * 100).toFixed(2)}%)`
                }
                outerRadius={100}
                dataKey="value"
              >
                {partMarcheData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => `${formatNumber(value)} passages`}
                contentStyle={tooltipStyle}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-success/5 to-transparent border border-success/10">
            <div className="text-sm text-muted-foreground text-center space-y-1">
              <p>
                <strong className="text-success">Production actuelle</strong> :{' '}
                {formatNumber(partMarcheData[0]?.value || 0)} passages (
                {(((partMarcheData[0]?.value || 0) / 24_000_000) * 100).toFixed(2)}% du marché
                national)
              </p>
              <p>
                <strong className="text-blue-600">Potentiel pipeline</strong> :{' '}
                {formatNumber((partMarcheData[0]?.value || 0) + (partMarcheData[1]?.value || 0))}{' '}
                passages (
                {(
                  (((partMarcheData[0]?.value || 0) + (partMarcheData[1]?.value || 0)) /
                    24_000_000) *
                  100
                ).toFixed(2)}
                % du marché national)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progression vers marché total - Barres empilées */}
      <Card className="lg:col-span-2 bg-card/80 backdrop-blur-sm border-t-4 border-t-primary border-primary/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary to-primary/50" />
            Progression vers le Marché Total
          </CardTitle>
          <CardDescription>
            Répartition des passages par statut jusqu'au marché national
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={progressionMarcheData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `${formatNumber(value)}`} />
              <YAxis type="category" dataKey="name" />
              <Tooltip
                formatter={(value: number) => `${formatNumber(value)} passages`}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Bar dataKey="production" stackId="a" fill="hsl(142 76% 36%)" name="En Production" />
              <Bar dataKey="pipeline" stackId="a" fill="hsl(var(--chart-4))" name="Pipeline" />
              <Bar dataKey="nonAdresse" stackId="a" fill="hsl(var(--muted))" name="Non adressé" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Funnel de conversion */}
      <Card className="lg:col-span-2 bg-card/80 backdrop-blur-sm border-l-4 border-l-violet-500 border-violet-500/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-500 to-violet-500/50" />
            Funnel de Conversion
          </CardTitle>
          <CardDescription>Progression Prospect → Production</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="hsl(var(--chart-5))" name="Établissements">
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                <LabelList dataKey="value" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
