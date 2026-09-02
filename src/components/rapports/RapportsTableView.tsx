import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Settings2, ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react'
import { useAllEtablissements } from '@/hooks/crm/useProspects'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { formatNumber } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

type SortField = 'nom' | 'region' | 'statut' | 'responsable' | 'type_offre' | 'pallier_vise' | 'valeur' | 'passages' | 'progression' | 'date_creation'
type SortOrder = 'asc' | 'desc'

const STATUS_COLORS: Record<string, string> = {
  'Prospect': 'bg-muted-foreground text-muted-foreground-foreground',
  'Contractuel': 'bg-blue-500 text-white',
  'Conformité': 'bg-yellow-500 text-white',
  'Déploiement': 'bg-purple-500 text-white',
  'Formation': 'bg-orange-500 text-white',
  'Go-Live': 'bg-emerald-500 text-white',
  'Production': 'bg-green-600 text-white',
}

export function RapportsTableView() {
  const navigate = useNavigate()
  const { data: etablissements } = useAllEtablissements()
  const { data: profiles } = useProfiles()

  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('nom')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  
  const [visibleColumns, setVisibleColumns] = useState({
    nom: true,
    region: true,
    ville: true,
    statut: true,
    responsable: true,
    type_offre: true,
    pallier_vise: true,
    valeur: true,
    passages: true,
    progression: true,
    date_creation: true,
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const filteredAndSortedData = useMemo(() => {
    if (!etablissements) return []

    // Filter
    let filtered = etablissements
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = etablissements.filter(e => 
        e.nom.toLowerCase().includes(query) ||
        e.ville?.toLowerCase().includes(query) ||
        e.region?.toLowerCase().includes(query) ||
        e.statut.toLowerCase().includes(query)
      )
    }

    // Calculate values for sorting
    const withValues = filtered.map(e => {
      const valeur = calculateEtablissementValue(e)

      const responsable = profiles?.find(p => p.id === e.commercial_id)
      const responsableNom = responsable ? `${responsable.prenom} ${responsable.nom}` : 'Non assigné'

      return { ...e, valeur, responsableNom }
    })

    // Sort
    const sorted = [...withValues].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortField) {
        case 'nom':
          aVal = a.nom
          bVal = b.nom
          break
        case 'region':
          aVal = a.region || ''
          bVal = b.region || ''
          break
        case 'statut':
          aVal = a.statut
          bVal = b.statut
          break
        case 'responsable':
          aVal = a.responsableNom
          bVal = b.responsableNom
          break
        case 'type_offre':
          aVal = a.type_offre || ''
          bVal = b.type_offre || ''
          break
        case 'pallier_vise':
          aVal = a.pallier_vise || ''
          bVal = b.pallier_vise || ''
          break
        case 'valeur':
          aVal = a.valeur
          bVal = b.valeur
          break
        case 'passages':
          aVal = a.nombre_passages_urgences_annuel || 0
          bVal = b.nombre_passages_urgences_annuel || 0
          break
        case 'progression':
          aVal = a.progression || 0
          bVal = b.progression || 0
          break
        case 'date_creation':
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0
          break
        default:
          aVal = a.nom
          bVal = b.nom
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal)
      }

      const numA = typeof aVal === 'number' ? aVal : 0;
      const numB = typeof bVal === 'number' ? bVal : 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })

    return sorted
  }, [etablissements, profiles, searchQuery, sortField, sortOrder])

  // Agrégations
  const totals = useMemo(() => {
    if (!filteredAndSortedData.length) return { count: 0, valeur: 0, passages: 0 }
    
    return {
      count: filteredAndSortedData.length,
      valeur: filteredAndSortedData.reduce((sum, e) => sum + e.valeur, 0),
      passages: filteredAndSortedData.reduce((sum, e) => sum + (e.nombre_passages_urgences_annuel || 0), 0),
    }
  }, [filteredAndSortedData])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-30" />
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" />
      : <ArrowDown className="w-4 h-4 ml-1" />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Vue Tableau Détaillée</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Paramètres">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.nom}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, nom: checked }))
                  }
                >
                  Nom
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.region}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, region: checked }))
                  }
                >
                  Région
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.ville}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, ville: checked }))
                  }
                >
                  Ville
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.statut}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, statut: checked }))
                  }
                >
                  Statut
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.responsable}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, responsable: checked }))
                  }
                >
                  Responsable
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.type_offre}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, type_offre: checked }))
                  }
                >
                  Type d'offre
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.pallier_vise}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, pallier_vise: checked }))
                  }
                >
                  Pallier visé
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.valeur}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, valeur: checked }))
                  }
                >
                  Valeur (€)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.passages}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, passages: checked }))
                  }
                >
                  Passages urgences
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.progression}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, progression: checked }))
                  }
                >
                  Progression
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.date_creation}
                  onCheckedChange={(checked) => 
                    setVisibleColumns(prev => ({ ...prev, date_creation: checked }))
                  }
                >
                  Date création
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  {visibleColumns.nom && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('nom')}>
                      <div className="flex items-center">
                        Nom
                        <SortIcon field="nom" />
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.region && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('region')}>
                      <div className="flex items-center">
                        Région
                        <SortIcon field="region" />
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.ville && (
                    <TableHead>Ville</TableHead>
                  )}
                  {visibleColumns.statut && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('statut')}>
                      <div className="flex items-center">
                        Statut
                        <SortIcon field="statut" />
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.responsable && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('responsable')}>
                      <div className="flex items-center">
                        Responsable
                        <SortIcon field="responsable" />
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.type_offre && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('type_offre')}>
                      <div className="flex items-center">
                        Type d'offre
                        <SortIcon field="type_offre" />
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.pallier_vise && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('pallier_vise')}>
                      <div className="flex items-center">
                        Pallier visé
                        <SortIcon field="pallier_vise" />
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.valeur && (
                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort('valeur')}>
                      <div className="flex items-center justify-end">
                        Valeur (€)
                        <SortIcon field="valeur" />
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.passages && (
                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort('passages')}>
                      <div className="flex items-center justify-end">
                        Passages/an
                        <SortIcon field="passages" />
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.progression && (
                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort('progression')}>
                      <div className="flex items-center justify-end">
                        Progression
                        <SortIcon field="progression" />
                      </div>
                    </TableHead>
                  )}
                  {visibleColumns.date_creation && (
                    <TableHead className="cursor-pointer" onClick={() => handleSort('date_creation')}>
                      <div className="flex items-center">
                        Date création
                        <SortIcon field="date_creation" />
                      </div>
                    </TableHead>
                  )}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
                      className="text-center text-muted-foreground py-8"
                    >
                      Aucun établissement trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredAndSortedData.map((etablissement) => (
                      <TableRow
                        key={etablissement.id}
                        className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => navigate(`/etablissements/${etablissement.id}`)}
                        role="link"
                        tabIndex={0}
                        aria-label={`Ouvrir la fiche établissement ${etablissement.nom}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            navigate(`/etablissements/${etablissement.id}`)
                          }
                        }}
                      >
                        {visibleColumns.nom && (
                          <TableCell className="font-medium">{etablissement.nom}</TableCell>
                        )}
                        {visibleColumns.region && (
                          <TableCell>{etablissement.region || '-'}</TableCell>
                        )}
                        {visibleColumns.ville && (
                          <TableCell>{etablissement.ville || '-'}</TableCell>
                        )}
                        {visibleColumns.statut && (
                          <TableCell>
                            <Badge className={STATUS_COLORS[etablissement.statut] || 'bg-muted'}>
                              {etablissement.statut}
                            </Badge>
                          </TableCell>
                        )}
                        {visibleColumns.responsable && (
                          <TableCell className="text-sm">{etablissement.responsableNom}</TableCell>
                        )}
                        {visibleColumns.type_offre && (
                          <TableCell>{etablissement.type_offre || '-'}</TableCell>
                        )}
                        {visibleColumns.pallier_vise && (
                          <TableCell>{etablissement.pallier_vise || '-'}</TableCell>
                        )}
                        {visibleColumns.valeur && (
                          <TableCell className="text-right font-medium">
                            {formatNumber(etablissement.valeur)} €
                          </TableCell>
                        )}
                        {visibleColumns.passages && (
                          <TableCell className="text-right">
                            {etablissement.nombre_passages_urgences_annuel?.toLocaleString('fr-FR') || '-'}
                          </TableCell>
                        )}
                        {visibleColumns.progression && (
                          <TableCell className="text-right">{etablissement.progression || 0}%</TableCell>
                        )}
                        {visibleColumns.date_creation && (
                          <TableCell>
                            {etablissement.created_at 
                              ? format(new Date(etablissement.created_at), 'dd/MM/yyyy', { locale: fr })
                              : '-'
                            }
                          </TableCell>
                        )}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/etablissements/${etablissement.id}`)}
                            aria-label={`Voir la fiche établissement ${etablissement.nom}`}
                            title="Voir la fiche"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Ligne de totaux */}
                    <TableRow className="bg-muted/50 font-semibold">
                      {visibleColumns.nom && (
                        <TableCell>Total ({totals.count})</TableCell>
                      )}
                      {visibleColumns.region && <TableCell />}
                      {visibleColumns.ville && <TableCell />}
                      {visibleColumns.statut && <TableCell />}
                      {visibleColumns.responsable && <TableCell />}
                      {visibleColumns.type_offre && <TableCell />}
                      {visibleColumns.pallier_vise && <TableCell />}
                      {visibleColumns.valeur && (
                        <TableCell className="text-right">
                          {formatNumber(totals.valeur)} €
                        </TableCell>
                      )}
                      {visibleColumns.passages && (
                        <TableCell className="text-right">
                          {totals.passages.toLocaleString('fr-FR')}
                        </TableCell>
                      )}
                      {visibleColumns.progression && <TableCell />}
                      {visibleColumns.date_creation && <TableCell />}
                      <TableCell />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
