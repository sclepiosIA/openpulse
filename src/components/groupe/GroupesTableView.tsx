import { useState } from "react"
import { Link } from "react-router-dom"
import { Groupe } from "@/hooks/crm/useGroupes"
import { GroupeBadge } from "@/components/ui/groupe-badge"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Eye, Mail, Trash2, Building2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CRMTableWrapper } from "@/components/layout/CRMTableWrapper"
import { CRMSortableHeader } from "@/components/layout/CRMSortableHeader"
import { CRMEmptyState } from "@/components/layout/CRMEmptyState"
import { EntityAvatar } from "@/components/ui/EntityAvatar"
import { cn } from "@/lib/utils"

interface GroupesTableViewProps {
  groupes: Groupe[]
}

export function GroupesTableView({ groupes }: GroupesTableViewProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction:
        sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    })
  }

  const sortedGroupes = [...groupes].sort((a, b) => {
    if (!sortConfig) return 0

    const aValue = a[sortConfig.key as keyof Groupe]
    const bValue = b[sortConfig.key as keyof Groupe]

    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    return sortConfig.direction === 'asc'
      ? (aValue as number) > (bValue as number) ? 1 : -1
      : (bValue as number) > (aValue as number) ? 1 : -1
  })

  if (groupes.length === 0) {
    return (
      <CRMEmptyState
        icon={Building2}
        title="Aucun groupe trouvé"
        description="Modifiez vos critères de recherche ou créez un nouveau groupe."
        variant="compact"
      />
    )
  }

  return (
    <CRMTableWrapper minWidth="900px">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <CRMSortableHeader
              field="nom"
              currentSortField={sortConfig?.key}
              currentSortDirection={sortConfig?.direction}
              onSort={handleSort}
            >
              Nom
            </CRMSortableHeader>
            <TableHead>Type</TableHead>
            <CRMSortableHeader
              field="region"
              currentSortField={sortConfig?.key}
              currentSortDirection={sortConfig?.direction}
              onSort={handleSort}
            >
              Région
            </CRMSortableHeader>
            <CRMSortableHeader
              field="nombre_etablissements"
              currentSortField={sortConfig?.key}
              currentSortDirection={sortConfig?.direction}
              onSort={handleSort}
              align="center"
            >
              Établissements
            </CRMSortableHeader>
            <TableHead>Modules</TableHead>
            <CRMSortableHeader
              field="progression_moyenne"
              currentSortField={sortConfig?.key}
              currentSortDirection={sortConfig?.direction}
              onSort={handleSort}
              align="center"
            >
              Progression
            </CRMSortableHeader>
            <CRMSortableHeader
              field="total_passages_urgences_annuel"
              currentSortField={sortConfig?.key}
              currentSortDirection={sortConfig?.direction}
              onSort={handleSort}
              align="right"
            >
              Passages/an
            </CRMSortableHeader>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedGroupes.map((groupe, index) => (
            <TableRow 
              key={groupe.id} 
              className={cn(
                "hover:bg-muted/50 group transition-colors",
                "animate-in fade-in-0 slide-in-from-bottom-1"
              )}
              style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <EntityAvatar
                    name={groupe.nom}
                    logoUrl={groupe.logo_url}
                    size="sm"
                  />
                  <Link to={`/groupes/${groupe.id}`} className="hover:underline hover:text-primary transition-colors">
                    {groupe.nom}
                  </Link>
                </div>
              </TableCell>
              <TableCell>
                <GroupeBadge type={groupe.type} />
              </TableCell>
              <TableCell className="text-muted-foreground">{groupe.region || '-'}</TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary">{groupe.nombre_etablissements}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {groupe.modules_deployes && groupe.modules_deployes.length > 0 ? (
                    <>
                      {groupe.modules_deployes.slice(0, 2).map((module) => (
                        <Badge key={module} variant="outline" className="text-xs">
                          {module}
                        </Badge>
                      ))}
                      {groupe.modules_deployes.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{groupe.modules_deployes.length - 2}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Aucun</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={groupe.progression_moyenne} className="h-2 flex-1" />
                  <span className="text-xs font-medium w-12 text-right tabular-nums">
                    {groupe.progression_moyenne.toFixed(0)}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {groupe.total_passages_urgences_annuel 
                  ? groupe.total_passages_urgences_annuel.toLocaleString()
                  : '-'}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Plus d'options"
                      title="Plus d'options"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/groupes/${groupe.id}`} className="flex items-center">
                        <Eye className="h-4 w-4 mr-2" />
                        Voir détails
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Mail className="h-4 w-4 mr-2" />
                      Envoyer email
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CRMTableWrapper>
  )
}
