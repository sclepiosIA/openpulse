import { AlertTriangle, Database, HardDrive } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DbHealthStats } from '@/hooks/system/useDbHealthStats'

interface DatabaseTabProps {
  dbHealth: DbHealthStats | undefined
  dbHealthLoading: boolean
}

export function DatabaseTab({ dbHealth, dbHealthLoading }: DatabaseTabProps) {
  if (dbHealthLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!dbHealth) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Impossible de charger les statistiques DB. Vérifiez les permissions admin.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Taille totale</span>
            </div>
            <p className="text-2xl font-bold mt-1">{dbHealth.total_db_size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Tables</span>
            </div>
            <p className="text-2xl font-bold mt-1">{dbHealth.table_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Tables à fort seq_scan</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {dbHealth.high_seq_scan_tables?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* High seq scan alert */}
      {dbHealth.high_seq_scan_tables && dbHealth.high_seq_scan_tables.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Tables avec ratio seq_scan élevé
            </CardTitle>
            <CardDescription className="text-xs">
              Tables où les scans séquentiels dominent largement les scans par index
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right">Seq Scans</TableHead>
                    <TableHead className="text-right">Idx Scans</TableHead>
                    <TableHead className="text-right">Lignes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbHealth.high_seq_scan_tables.map((t) => (
                    <TableRow key={t.table_name}>
                      <TableCell className="font-mono text-xs">{t.table_name}</TableCell>
                      <TableCell className="text-right text-amber-600 font-semibold">
                        {t.seq_scan.toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.idx_scan.toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.rows.toLocaleString('fr-FR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top tables by size */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Top 30 tables par taille
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead className="text-right">Taille</TableHead>
                  <TableHead className="text-right">Données</TableHead>
                  <TableHead className="text-right">Index</TableHead>
                  <TableHead className="text-right">Lignes</TableHead>
                  <TableHead className="text-right">Idx %</TableHead>
                  <TableHead className="text-right">Dead tuples %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dbHealth.tables?.map((t) => (
                  <TableRow key={t.table_name}>
                    <TableCell className="font-mono text-xs">{t.table_name}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {t.total_size_pretty}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {t.data_size_pretty}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {t.index_size_pretty}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.n_live_tup?.toLocaleString('fr-FR') ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          t.idx_scan_pct >= 80
                            ? 'text-emerald-600 border-emerald-200'
                            : t.idx_scan_pct >= 50
                              ? 'text-amber-600 border-amber-200'
                              : 'text-red-600 border-red-200'
                        )}
                      >
                        {t.idx_scan_pct}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {t.dead_tup_pct > 10 ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-600 border-amber-200"
                        >
                          {t.dead_tup_pct}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t.dead_tup_pct}%</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
