import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react"
import { useEtablissements } from "@/hooks/crm/useEtablissements"
import { useCategories } from "@/hooks/catalogue/useCategories"
import { useProfiles } from "@/hooks/profile/useProfiles"
import { useIsMobile } from "@/hooks/ui/use-mobile"
import { PieChart, Pie, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { TaskForAnalytics } from '@/types/taches-analytics'

const CustomLegend = ({ data }: { data: Array<{ name: string; value: number; fill: string }> }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  return (
    <div className="mt-4 space-y-2">
      {data.map((entry, index) => {
        const percentage = ((entry.value / total) * 100).toFixed(1)
        return (
          <div key={`legend-${index}`} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: entry.fill }}
              />
              <span className="truncate font-medium">{entry.name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground ml-2 flex-shrink-0">
              <span className="font-semibold">{entry.value}</span>
              <span>({percentage}%)</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface TasksAnalyticsViewProps {
  taches: TaskForAnalytics[]
}

export function TasksAnalyticsView({ taches }: TasksAnalyticsViewProps) {
  const { data: etablissements } = useEtablissements()
  const { data: categories } = useCategories()
  const { data: profiles } = useProfiles()
  const isMobile = useIsMobile()

  // Statistiques générales
  const stats = useMemo(() => {
    const total = taches.length
    const terminees = taches.filter(t => t.statut === 'Terminé').length
    const enCours = taches.filter(t => t.statut === 'En cours').length
    const enRetard = taches.filter(t => {
      if (!t.echeance || t.statut === 'Terminé') return false
      return new Date(t.echeance) < new Date()
    }).length

    return { total, terminees, enCours, enRetard }
  }, [taches])

  // Distribution par catégorie
  const categoryDistribution = useMemo(() => {
    const colorMap: Record<string, string> = {
      'Commercial': '#3b82f6', // Bleu
      'Conformité': '#a855f7', // Violet
      'Technique': '#22c55e',  // Vert
      'Administratif': '#f97316', // Orange
      'RH': '#ec4899', // Rose
      'Déploiement': '#06b6d4', // Cyan
    }
    
    return categories?.map(cat => ({
      name: cat.nom,
      value: taches.filter(t => t.categorie_id === cat.id).length,
      fill: colorMap[cat.nom] || cat.couleur
    })).filter(item => item.value > 0) || []
  }, [categories, taches])

  // Workload par personne
  const workloadByPerson = useMemo(() => {
    return profiles?.map(profile => {
      const profileTaches = taches.filter(t => t.responsable_id === profile.id)
      return {
        name: `${profile.prenom} ${profile.nom}`,
        completed: profileTaches.filter(t => t.statut === 'Terminé').length,
        inProgress: profileTaches.filter(t => t.statut === 'En cours').length,
        todo: profileTaches.filter(t => t.statut === 'A faire').length,
        blocked: profileTaches.filter(t => t.statut === 'Bloqué').length,
      }
    }).filter(item => item.completed + item.inProgress + item.todo + item.blocked > 0) || []
  }, [profiles, taches])

  // Taux de complétion par établissement
  const completionByEtablissement = useMemo(() => {
    return etablissements?.map(etab => {
      const etabTaches = taches.filter(t => t.etablissement_id === etab.id)
      const completed = etabTaches.filter(t => t.statut === 'Terminé').length
      const completionRate = etabTaches.length > 0 ? Math.round((completed / etabTaches.length) * 100) : 0
      
      // Code couleur basé sur le taux de complétion
      let fill = '#22c55e' // Vert par défaut (>75%)
      if (completionRate < 50) {
        fill = '#ef4444' // Rouge (<50%)
      } else if (completionRate < 75) {
        fill = '#f59e0b' // Jaune (50-75%)
      }
      
      return {
        name: etab.nom,
        total: etabTaches.length,
        completionRate,
        fill
      }
    }).filter(item => item.total > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 10) || []
  }, [etablissements, taches])

  // Distribution par priorité
  const priorityDistribution = useMemo(() => {
    return [
      { name: 'Haute', value: taches.filter(t => t.priorite === 'high').length, fill: '#dc2626' },
      { name: 'Moyenne', value: taches.filter(t => t.priorite === 'medium').length, fill: '#eab308' },
      { name: 'Basse', value: taches.filter(t => t.priorite === 'low').length, fill: '#22c55e' },
    ].filter(item => item.value > 0)
  }, [taches])

  return (
    <div className="space-y-6">
      {/* Cards statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Terminées</p>
                <p className="text-2xl font-bold text-green-600">{stats.terminees}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En cours</p>
                <p className="text-2xl font-bold text-blue-600">{stats.enCours}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En retard</p>
                <p className="text-2xl font-bold text-red-600">{stats.enRetard}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Distribution par catégorie */}
        {categoryDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribution par Catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={isMobile ? 70 : 90}
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const total = categoryDistribution.reduce((sum, item) => sum + item.value, 0)
                      const percentage = ((value / total) * 100).toFixed(1)
                      return [`${value} (${percentage}%)`, name]
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <CustomLegend data={categoryDistribution} />
            </CardContent>
          </Card>
        )}

        {/* Distribution par priorité */}
        {priorityDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribution par Priorité</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                <PieChart>
                  <Pie
                    data={priorityDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={isMobile ? 70 : 90}
                  >
                    {priorityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const total = priorityDistribution.reduce((sum, item) => sum + item.value, 0)
                      const percentage = ((value / total) * 100).toFixed(1)
                      return [`${value} (${percentage}%)`, name]
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <CustomLegend data={priorityDistribution} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Workload par personne */}
      {workloadByPerson.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Charge de Travail par Personne</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={isMobile ? 350 : 400}>
              <BarChart data={workloadByPerson}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120} 
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="completed" stackId="a" fill="#10b981" name="Terminées" />
                <Bar dataKey="inProgress" stackId="a" fill="#3b82f6" name="En cours" />
                <Bar dataKey="todo" stackId="a" fill="#94a3b8" name="À faire" />
                <Bar dataKey="blocked" stackId="a" fill="#ef4444" name="Bloquées" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Taux de complétion par établissement */}
      {completionByEtablissement.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Taux de Complétion par Établissement (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={isMobile ? 350 : 400}>
              <BarChart data={completionByEtablissement} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={200}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 25 ? value.substring(0, 22) + '...' : value}
                />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="completionRate" name="Taux (%)">
                  {completionByEtablissement.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
