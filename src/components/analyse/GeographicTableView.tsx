import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpDown, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GeoQuickActions } from './GeoQuickActions';
import { BulkActionsBarGeo } from './BulkActionsBarGeo';
import { exportEtablissementsToCSV } from '@/lib/analyseGeoUtils';
import { useToast } from '@/hooks/shared/use-toast';
import type { EtablissementForGeo, GeoSortConfig, GeoSortKey } from '@/types/etablissement-geo';

interface GeographicTableViewProps {
  etablissements: EtablissementForGeo[];
}

export function GeographicTableView({ etablissements }: GeographicTableViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sortConfig, setSortConfig] = useState<GeoSortConfig | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSort = (key: GeoSortKey) => {
    setSortConfig({
      key,
      direction:
        sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const sortedEtablissements = [...etablissements].sort((a, b) => {
    if (!sortConfig) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortConfig.direction === 'asc'
      ? aValue > bValue
        ? 1
        : -1
      : bValue > aValue
      ? 1
      : -1;
  });

  const handleExport = () => {
    exportEtablissementsToCSV(etablissements, 'analyse-geographique');
    toast({ title: `${etablissements.length} établissement(s) exporté(s)` });
  };

  const handleRowClick = (etabId: string) => {
    navigate(`/etablissements/${etabId}`);
  };

  const handleSelectionChange = (id: string, selected: boolean) => {
    setSelectedIds(prev => 
      selected ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? sortedEtablissements.map(e => e.id) : []);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Production':
        return 'default';
      case 'Déploiement':
      case 'Formation':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <CardTitle>Liste des Établissements</CardTitle>
              {sortedEtablissements.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.length === sortedEtablissements.length && sortedEtablissements.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">Tout sélectionner</span>
                </div>
              )}
            </div>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <div className="rounded-md border inline-block min-w-full">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === sortedEtablissements.length && sortedEtablissements.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('nom')}
                        className="h-8 px-2"
                      >
                        Nom
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('ville')}
                        className="h-8 px-2"
                      >
                        Ville
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('region')}
                        className="h-8 px-2"
                      >
                        Région
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('type')}
                        className="h-8 px-2"
                      >
                        Type
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('statut')}
                        className="h-8 px-2"
                      >
                        Statut
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>DPI</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEtablissements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-32 text-muted-foreground">
                        Aucun établissement trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedEtablissements.map((etab) => (
                      <TableRow
                        key={etab.id}
                        className={`cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedIds.includes(etab.id) ? 'bg-primary/5' : ''}`}
                        onClick={() => handleRowClick(etab.id)}
                        role="link"
                        tabIndex={0}
                        aria-label={`Ouvrir la fiche établissement ${etab.nom}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleRowClick(etab.id)
                          }
                        }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(etab.id)}
                            onCheckedChange={(checked) => handleSelectionChange(etab.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{etab.nom}</TableCell>
                        <TableCell>{etab.ville}</TableCell>
                        <TableCell>
                          <span className="text-sm">{etab.region}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{etab.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(etab.statut)}>
                            {etab.statut}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {etab.dpi || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <GeoQuickActions etablissement={etab} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActionsBarGeo
        selectedIds={selectedIds}
        etablissements={etablissements}
        onClearSelection={() => setSelectedIds([])}
      />
    </>
  );
}
