import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAllEtablissements } from "@/hooks/crm/useProspects"
import { useProfiles } from "@/hooks/profile/useProfiles"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, Target, Award, Clock } from 'lucide-react'
import { useMemo } from 'react'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))']
const STATUS_COLORS = {
  'Prospect': 'hsl(var(--muted))',
  'Contractuel': 'hsl(var(--primary))',
  'Conformité': 'hsl(var(--secondary))',
  'Déploiement': 'hsl(var(--accent))',
  'Formation': 'hsl(var(--chart-2))',
  'Go-Live': 'hsl(var(--chart-3))',
  'Production': 'hsl(var(--chart-4))',
}

export function RapportsComparativeView() {
  const { data: etablissements } = useAllEtablissements()
  const { data: profiles } = useProfiles()

  const analysisData = useMemo(() => {
    if (!etablissements || !profiles) return null

    // Calculate value per establishment
    const etablissementsWithValue = etablissements.map(e => ({
      ...e,
      valeur: calculateEtablissementValue(e)
    }))

    // By Region
    const byRegion = etablissementsWithValue.reduce((acc: any, e) => {
      const region = e.region || 'Non défini'
      if (!acc[region]) {
        acc[region] = { region, count: 0, valeur: 0, enProduction: 0 }
      }
      acc[region].count++
      acc[region].valeur += e.valeur
      if (e.statut === 'Production' || e.statut === 'Go-Live') acc[region].enProduction++
      return acc
    }, {})

    // By Type Offre
    const byTypeOffre = etablissementsWithValue.reduce((acc: any, e) => {
      const type = e.type_offre || 'Non défini'
      if (!acc[type]) {
        acc[type] = { type, count: 0, valeur: 0 }
      }
      acc[type].count++
      acc[type].valeur += e.valeur
      return acc
    }, {})

    // By Pallier
    const byPallier = etablissementsWithValue.reduce((acc: any, e) => {
      const pallier = e.pallier_vise || 'Non défini'
      if (!acc[pallier]) {
        acc[pallier] = { pallier, count: 0, valeur: 0 }
      }
      acc[pallier].count++
      acc[pallier].valeur += e.valeur
      return acc
    }, {})

    // By Commercial
    const byCommercial = etablissementsWithValue.reduce((acc: any, e) => {
      if (!e.commercial_id) return acc
      const profile = profiles.find(p => p.id === e.commercial_id)
      const name = profile ? `${profile.prenom} ${profile.nom}` : 'Inconnu'
      if (!acc[e.commercial_id]) {
        acc[e.commercial_id] = { commercial: name, count: 0, valeur: 0, enProduction: 0 }
      }
      acc[e.commercial_id].count++
      acc[e.commercial_id].valeur += e.valeur
      if (e.statut === 'Production' || e.statut === 'Go-Live') acc[e.commercial_id].enProduction++
      return acc
    }, {})

    // Segmentation
    const topPerformers = etablissementsWithValue
      .filter(e => e.statut === 'Production' || e.statut === 'Go-Live')
      .filter(e => e.progression && e.progression >= 80)
      .sort((a, b) => b.valeur - a.valeur)
      .slice(0, 10)

    const retardsCritiques = etablissementsWithValue
      .filter(e => !['Production', 'Go-Live', 'Prospect'].includes(e.statut))
      .filter(e => {
        const createdAt = new Date(e.created_at)
        const monthsOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
        return monthsOld > 6 && (!e.progression || e.progression < 50)
      })
      .sort((a, b) => (a.progression || 0) - (b.progression || 0))

    const aRisque = etablissementsWithValue
      .filter(e => !['Production', 'Go-Live', 'Prospect'].includes(e.statut))
      .filter(e => {
        const createdAt = new Date(e.created_at)
        const monthsOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
        return monthsOld > 3 && monthsOld <= 6 && (!e.progression || e.progression < 70)
      })

    const opportunites = etablissementsWithValue
      .filter(e => e.statut === 'Prospect')
      .filter(e => e.valeur > 50000 || (e.nombre_passages_urgences_annuel && e.nombre_passages_urgences_annuel > 30000))
      .sort((a, b) => b.valeur - a.valeur)

    return {
      byRegion: Object.values(byRegion).sort((a: any, b: any) => b.valeur - a.valeur),
      byTypeOffre: Object.values(byTypeOffre),
      byPallier: Object.values(byPallier),
      byCommercial: Object.values(byCommercial).sort((a: any, b: any) => b.valeur - a.valeur).slice(0, 10),
      segmentation: {
        topPerformers,
        retardsCritiques,
        aRisque,
        opportunites
      }
    }
  }, [etablissements, profiles])

  if (!analysisData) return <div>Chargement...</div>

  return (
    <div className="space-y-6">
      {/* Segmentation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
            <Award className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.segmentation.topPerformers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              En production avec +80% progression
            </p>
            <div className="mt-2 space-y-1">
              {analysisData.segmentation.topPerformers.slice(0, 3).map(e => (
                <div key={e.id} className="text-xs flex justify-between">
                  <span className="truncate">{e.nom}</span>
                  <Badge variant="secondary" className="ml-2">{e.progression}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retards Critiques</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.segmentation.retardsCritiques.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +6 mois, progression &lt;50%
            </p>
            <div className="mt-2 space-y-1">
              {analysisData.segmentation.retardsCritiques.slice(0, 3).map(e => (
                <div key={e.id} className="text-xs flex justify-between">
                  <span className="truncate">{e.nom}</span>
                  <Badge variant="destructive" className="ml-2">{e.progression || 0}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À Risque</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.segmentation.aRisque.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              3-6 mois, progression &lt;70%
            </p>
            <div className="mt-2 space-y-1">
              {analysisData.segmentation.aRisque.slice(0, 3).map(e => (
                <div key={e.id} className="text-xs flex justify-between">
                  <span className="truncate">{e.nom}</span>
                  <Badge variant="outline" className="ml-2">{e.progression || 0}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunités</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.segmentation.opportunites.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Prospects à forte valeur
            </p>
            <div className="mt-2 space-y-1">
              {analysisData.segmentation.opportunites.slice(0, 3).map(e => (
                <div key={e.id} className="text-xs flex justify-between">
                  <span className="truncate">{e.nom}</span>
                  <Badge variant="secondary" className="ml-2">{Math.round(e.valeur / 1000)}k€</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparative Analysis Tabs */}
      <Tabs defaultValue="region" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="region">Par Région</TabsTrigger>
          <TabsTrigger value="offre">Par Type d'Offre</TabsTrigger>
          <TabsTrigger value="pallier">Par Pallier</TabsTrigger>
          <TabsTrigger value="commercial">Par Commercial</TabsTrigger>
        </TabsList>

        <TabsContent value="region" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>CA par Région</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analysisData.byRegion}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => `${Math.round(value / 1000)}k€`} />
                    <Bar dataKey="valeur" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Établissements par Région</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analysisData.byRegion}
                      dataKey="count"
                      nameKey="region"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.region}: ${entry.count}`}
                    >
                      {analysisData.byRegion.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Détails par Région</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysisData.byRegion.map((r: any) => (
                  <div key={r.region} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{r.region}</div>
                      <div className="text-sm text-muted-foreground">
                        {r.count} établissement{r.count > 1 ? 's' : ''} • {r.enProduction} en production
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{Math.round(r.valeur / 1000)}k€</div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(r.valeur / r.count / 1000)}k€/étab
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offre" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>CA par Type d'Offre</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analysisData.byTypeOffre}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => `${Math.round(value / 1000)}k€`} />
                    <Bar dataKey="valeur" fill="hsl(var(--secondary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Répartition par Offre</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analysisData.byTypeOffre}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.type}: ${entry.count}`}
                    >
                      {analysisData.byTypeOffre.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pallier" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyse par Pallier Visé</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analysisData.byPallier}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pallier" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="hsl(var(--primary))" name="Nombre" />
                  <Bar yAxisId="right" dataKey="valeur" fill="hsl(var(--accent))" name="Valeur (€)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commercial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Commerciaux</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analysisData.byCommercial} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="commercial" type="category" width={150} />
                  <Tooltip formatter={(value: any) => `${Math.round(value / 1000)}k€`} />
                  <Legend />
                  <Bar dataKey="valeur" fill="hsl(var(--primary))" name="CA Total" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 space-y-2">
                {analysisData.byCommercial.map((c: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{idx + 1}</Badge>
                      <div>
                        <div className="font-medium">{c.commercial}</div>
                        <div className="text-sm text-muted-foreground">
                          {c.count} établissement{c.count > 1 ? 's' : ''} • {c.enProduction} en production
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{Math.round(c.valeur / 1000)}k€</div>
                      <div className="text-sm text-muted-foreground">
                        Taux: {c.count > 0 ? Math.round((c.enProduction / c.count) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Vues Rapides Prédéfinies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Forte croissance
            </Button>
            <Button variant="outline" size="sm">
              <TrendingDown className="h-4 w-4 mr-2" />
              En déclin
            </Button>
            <Button variant="outline" size="sm">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Nécessite attention
            </Button>
            <Button variant="outline" size="sm">
              <Target className="h-4 w-4 mr-2" />
              Prospects prioritaires
            </Button>
            <Button variant="outline" size="sm">
              <Award className="h-4 w-4 mr-2" />
              Meilleurs performers
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
