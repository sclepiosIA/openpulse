import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { safeNum } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Building2, Package, FileText, TrendingUp, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GroupeActivitiesTimeline } from './GroupeActivitiesTimeline'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface GroupeConsolidatedViewProps {
  groupe: any
  etablissements: any[]
  contacts: any[]
  taches: any[]
}

export function GroupeConsolidatedView({
  groupe,
  etablissements,
  contacts,
  taches,
}: GroupeConsolidatedViewProps) {
  // Fonction helper pour les couleurs DPI
  const getDpiColor = (dpi: string) => {
    const colors: Record<string, string> = {
      Dedalus:
        'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      MAINCARE:
        'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800',
      Mediboard:
        'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      Orbis:
        'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      Crossway:
        'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300 border-pink-200 dark:border-pink-800',
    }
    return (
      colors[dpi] ||
      'bg-gray-100 text-foreground dark:bg-gray-900 dark:text-muted-foreground border-gray-200 dark:border-gray-800'
    )
  }

  // KPIs agrégés - Modules déployés
  const modulesStats = etablissements.reduce((acc: Record<string, number>, eg: any) => {
    const modules = eg.etablissement?.modules_proposes || []
    modules.forEach((module: string) => {
      acc[module] = (acc[module] || 0) + 1
    })
    return acc
  }, {})

  const modulesData = Object.entries(modulesStats).map(([name, count]) => ({
    name,
    count,
  }))

  // Utiliser les données calculées automatiquement par la base
  const totalModulesUniques = groupe.modules_deployes?.length || 0
  const avgProgression = groupe.progression_moyenne || 0
  const totalPassagesUrgences = groupe.total_passages_urgences_annuel || 0

  // Distribution des DPI
  const dpiCounts = etablissements.reduce((acc: Record<string, number>, eg: any) => {
    const dpi = eg.etablissement?.dpi || 'Non renseigné'
    acc[dpi] = (acc[dpi] || 0) + 1
    return acc
  }, {})

  const dpiData = Object.entries(dpiCounts).map(([name, value]) => ({
    name,
    value,
    color: getDpiColor(name),
  }))

  const passagesUrgencesData = etablissements
    .filter((eg: any) => eg.etablissement?.nombre_passages_urgences_annuel)
    .map((eg: any) => ({
      name: eg.etablissement?.nom?.substring(0, 20) || 'Inconnu',
      passages: eg.etablissement?.nombre_passages_urgences_annuel || 0,
    }))
    .sort((a, b) => b.passages - a.passages)

  const tachesStats = {
    total: taches.length,
    completed: taches.filter((t: any) => t.statut === 'Terminé').length,
    inProgress: taches.filter((t: any) => t.statut === 'En cours').length,
    todo: taches.filter((t: any) => t.statut === 'A faire').length,
  }

  // Données pour graphique de progression par établissement
  const progressionData = etablissements
    .map((eg: any) => ({
      name: eg.etablissement?.nom?.substring(0, 20) || 'Inconnu',
      progression: eg.etablissement?.progression || 0,
    }))
    .sort((a, b) => b.progression - a.progression)

  // Données pour graphique de répartition par statut
  const statutCounts = etablissements.reduce((acc: any, eg: any) => {
    const statut = eg.etablissement?.statut || 'Inconnu'
    acc[statut] = (acc[statut] || 0) + 1
    return acc
  }, {})

  const statutData = Object.entries(statutCounts).map(([name, value]) => ({
    name,
    value,
  }))

  const statutColors: Record<string, string> = {
    Contractuel: 'hsl(var(--chart-1))',
    Déploiement: 'hsl(var(--chart-3))',
    Formation: 'hsl(var(--chart-4))',
    Production: 'hsl(var(--chart-2))',
    Prospect: 'hsl(var(--muted))',
  }

  return (
    <div className="space-y-6">
      {/* KPIs globaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Établissements
            </CardDescription>
            <CardTitle className="text-3xl">{groupe.nombre_etablissements}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Modules déployés
            </CardDescription>
            <CardTitle className="text-3xl">{totalModulesUniques}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {Object.entries(modulesStats)
                .map(([module, count]) => `${module} (${count})`)
                .join(', ') || 'Aucun'}
            </p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Progression moyenne
            </CardDescription>
            <CardTitle className="text-3xl">{avgProgression.toFixed(1)}%</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Passages aux urgences/an
            </CardDescription>
            <CardTitle className="text-3xl">
              {totalPassagesUrgences.toLocaleString('fr-FR')}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Tâches communes
            </CardDescription>
            <CardTitle className="text-3xl">
              {tachesStats.completed}/{tachesStats.total}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Graphique déploiement des modules */}
        <Card>
          <CardHeader>
            <CardTitle>Déploiement des Modules</CardTitle>
            <CardDescription>Nombre d'établissements par module</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modulesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-muted-foreground" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Établissements" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Graphique progression par établissement */}
        <Card>
          <CardHeader>
            <CardTitle>Progression par Établissement</CardTitle>
            <CardDescription>Comparaison du taux de progression</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={progressionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  className="text-muted-foreground"
                />
                <YAxis className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="progression" fill="hsl(var(--primary))" name="Progression %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Graphique répartition par statut */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par Statut</CardTitle>
            <CardDescription>Distribution des établissements</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statutData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statutData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={statutColors[entry.name] || 'hsl(var(--muted))'}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Graphique distribution des DPI */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution des DPI</CardTitle>
            <CardDescription>Éditeurs utilisés dans le groupe</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dpiData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dpiData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Graphique passages aux urgences */}
        <Card>
          <CardHeader>
            <CardTitle>Passages aux Urgences par Établissement</CardTitle>
            <CardDescription>Volume annuel de passages aux urgences</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={passagesUrgencesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  className="text-muted-foreground"
                />
                <YAxis className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => value.toLocaleString('fr-FR')}
                />
                <Legend />
                <Bar dataKey="passages" fill="hsl(var(--chart-1))" name="Passages/an" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tableau comparatif détaillé */}
      <Card>
        <CardHeader>
          <CardTitle>Tableau Comparatif des Établissements</CardTitle>
          <CardDescription>Vue détaillée de tous les établissements membres</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {etablissements.map((eg: any) => (
              <Card key={eg.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <Link
                        to={`/etablissements/${eg.etablissement.id}`}
                        className="text-lg font-semibold hover:underline"
                      >
                        {eg.etablissement.nom}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {eg.etablissement.ville}, {eg.etablissement.region}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {eg.est_etablissement_principal && <Badge variant="default">Principal</Badge>}
                      <Badge variant="secondary">{eg.etablissement.statut}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Type</span>
                      <p className="text-sm font-medium">{eg.etablissement.type}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Modules</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(eg.etablissement.modules_proposes || []).map((module: string) => (
                          <Badge key={module} variant="secondary" className="text-xs">
                            {module}
                          </Badge>
                        ))}
                        {(!eg.etablissement.modules_proposes ||
                          eg.etablissement.modules_proposes.length === 0) && (
                          <span className="text-xs text-muted-foreground">Aucun</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">DPI</span>
                      {eg.etablissement.dpi ? (
                        <Badge
                          variant="outline"
                          className={`text-xs mt-1 ${getDpiColor(eg.etablissement.dpi)}`}
                        >
                          {eg.etablissement.dpi}
                        </Badge>
                      ) : (
                        <p className="text-sm font-medium text-muted-foreground">N/A</p>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Passages urgences/an</span>
                      <p className="text-sm font-medium">
                        {eg.etablissement.nombre_passages_urgences_annuel
                          ? safeNum(
                              eg.etablissement.nombre_passages_urgences_annuel
                            ).toLocaleString('fr-FR')
                          : 'Non renseigné'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Rôle</span>
                      <p className="text-sm font-medium">{eg.role_dans_groupe || 'Membre'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Progression</span>
                      <p className="text-sm font-medium">{eg.etablissement.progression}%</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progression</span>
                      <span>{eg.etablissement.progression}%</span>
                    </div>
                    <Progress value={eg.etablissement.progression} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Statistiques des tâches */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques des Tâches Communes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{tachesStats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-4 bg-green-500/10 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {tachesStats.completed}
              </p>
              <p className="text-sm text-muted-foreground">Terminées</p>
            </div>
            <div className="text-center p-4 bg-blue-500/10 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {tachesStats.inProgress}
              </p>
              <p className="text-sm text-muted-foreground">En cours</p>
            </div>
            <div className="text-center p-4 bg-orange-500/10 rounded-lg">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {tachesStats.todo}
              </p>
              <p className="text-sm text-muted-foreground">À faire</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline des activités du groupe */}
      <GroupeActivitiesTimeline groupeId={groupe.id} />
    </div>
  )
}
