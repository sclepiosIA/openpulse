import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { AddEtablissementToGroupeDialog } from '@/components/groupe/AddEtablissementToGroupeDialog'
import { EtablissementInfo } from '@/components/etablissement/EtablissementInfo'
import { Link } from 'react-router-dom'
import { Search, ChevronDown, Pencil, Building2, LayoutGrid, List } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface GroupeEtablissementsTabProps {
  groupeId: string
  etablissements: any[]
  onEditEtablissement: (etablissement: any) => void
  isLoading: boolean
}

export function GroupeEtablissementsTab({
  groupeId,
  etablissements,
  onEditEtablissement,
  isLoading,
}: GroupeEtablissementsTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statutFilter, setStatutFilter] = useState('all')
  const [sortBy, setSortBy] = useState('nom')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filteredEtablissements = useMemo(() => {
    if (!etablissements) return []

    const filtered = etablissements.filter((eg) => {
      const matchesSearch =
        eg.etablissement?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eg.etablissement?.ville?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatut = statutFilter === 'all' || eg.etablissement?.statut === statutFilter
      return matchesSearch && matchesStatut
    })

    // Tri
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'nom':
          return (a.etablissement?.nom || '').localeCompare(b.etablissement?.nom || '')
        case 'progression':
          return (b.etablissement?.progression || 0) - (a.etablissement?.progression || 0)
        case 'ville':
          return (a.etablissement?.ville || '').localeCompare(b.etablissement?.ville || '')
        default:
          return 0
      }
    })

    return filtered
  }, [etablissements, searchTerm, statutFilter, sortBy])

  // Statistiques rapides
  const stats = useMemo(() => {
    if (!etablissements) return { total: 0, progression: 0, modules: [] }

    const progression =
      etablissements.length > 0
        ? etablissements.reduce((sum, eg) => sum + (eg.etablissement?.progression || 0), 0) /
          etablissements.length
        : 0

    const allModules = new Set<string>()
    etablissements.forEach((eg) => {
      ;(eg.etablissement?.modules_proposes || []).forEach((m: string) => allModules.add(m))
    })

    return {
      total: etablissements.length,
      progression: progression.toFixed(1),
      modules: Array.from(allModules),
    }
  }, [etablissements])

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded" />
        <div className="h-64 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total établissements</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Progression moyenne</CardDescription>
            <CardTitle className="text-2xl">{stats.progression}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Modules uniques</CardDescription>
            <CardTitle className="text-2xl">{stats.modules.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un établissement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            aria-label="Rechercher un établissement"
          />
        </div>

        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="Prospect">Prospect</SelectItem>
            <SelectItem value="Signature en cours">Signature en cours</SelectItem>
            <SelectItem value="Déploiement">Déploiement</SelectItem>
            <SelectItem value="Production">Production</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nom">Nom</SelectItem>
            <SelectItem value="progression">Progression</SelectItem>
            <SelectItem value="ville">Ville</SelectItem>
          </SelectContent>
        </Select>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
          <TabsList>
            <TabsTrigger value="grid">
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <AddEtablissementToGroupeDialog
          groupeId={groupeId}
          existingEtablissementIds={etablissements?.map((eg: any) => eg.etablissement_id) || []}
        />
      </div>

      {/* Liste des établissements */}
      {filteredEtablissements.length > 0 ? (
        <div className={viewMode === 'grid' ? 'grid gap-4' : 'space-y-2'}>
          {filteredEtablissements.map((eg: any) => (
            <Collapsible key={eg.id}>
              <Card className={viewMode === 'list' ? 'hover:bg-muted/50' : ''}>
                <CardHeader className={viewMode === 'list' ? 'py-3' : ''}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CollapsibleTrigger className="flex items-center gap-2 hover:underline w-full text-left group">
                        <CardTitle className="text-lg">
                          <Link
                            to={`/etablissements/${eg.etablissement.id}`}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {eg.etablissement.nom}
                          </Link>
                        </CardTitle>
                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CardDescription>
                        {eg.etablissement.ville}, {eg.etablissement.region}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {eg.est_etablissement_principal && <Badge variant="default">Principal</Badge>}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditEtablissement(eg.etablissement)}
                        aria-label={`Modifier l'établissement ${eg.etablissement.nom}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-b pb-4">
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p className="font-medium">{eg.etablissement.type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Statut</span>
                    <p className="font-medium">{eg.etablissement.statut}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Modules</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(eg.etablissement.modules_proposes || [])
                        .slice(0, 2)
                        .map((module: string) => (
                          <Badge key={module} variant="outline" className="text-xs">
                            {module}
                          </Badge>
                        ))}
                      {(eg.etablissement.modules_proposes || []).length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{eg.etablissement.modules_proposes.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Progression</span>
                    <p className="font-medium">{eg.etablissement.progression}%</p>
                  </div>
                </CardContent>

                <CollapsibleContent>
                  <CardContent className="pt-4">
                    <EtablissementInfo etablissement={eg.etablissement} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">
              {searchTerm || statutFilter !== 'all'
                ? 'Aucun établissement trouvé'
                : 'Aucun établissement'}
            </p>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statutFilter !== 'all'
                ? 'Modifiez vos critères de recherche'
                : "Ce groupe ne contient pas encore d'établissement"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
