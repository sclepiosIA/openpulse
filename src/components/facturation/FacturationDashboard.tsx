import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Euro,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  CalendarClock,
  Building2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { useAllFacturationPeriodes } from '@/hooks/billing/useAllFacturationPeriodes'
import { STATUT_FACTURE_COLORS } from '@/lib/tresorerie-labels'
import { Skeleton } from '@/components/ui/skeleton'

const PIE_COLORS: Record<string, string> = {
  prevue: '#94a3b8',
  facturee: '#3b82f6',
  encaissee: '#22c55e',
  en_retard: '#ef4444',
  annulee: '#6b7280',
}

export function FacturationDashboard() {
  const {
    isLoading,
    totalPrevuAnnuel,
    totalEncaisse,
    totalFacture,
    totalEnRetard,
    nbEnRetard,
    nbPrevu,
    nbEncaisse,
    nbFacture,
    tauxEncaissement,
    prochainsVirements,
    paiementsAttendusAnnee,
    periodesEnRetard,
    evolution,
    statutPieData,
    currentYear,
    detailPrevu,
    detailEncaisse,
    detailFacture,
    detailEnRetard,
  } = useAllFacturationPeriodes()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={`facturation-dashboard-skeleton-${i}`} className="p-6">
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total annuel prévu */}
          <UITooltip>
            <TooltipTrigger asChild>
              <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-primary border-primary/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-default">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/10 to-transparent pointer-events-none" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">
                        Total annuel prévu
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent truncate">
                        {formatCurrency(totalPrevuAnnuel)}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-60" />
                      <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-2 ring-primary/20 flex items-center justify-center">
                        <Euro className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Année {currentYear}</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs p-3">
              <p className="font-semibold text-xs mb-1.5">
                Top établissements — Prévu ({nbPrevu} périodes)
              </p>
              {detailPrevu.length > 0 ? (
                <div className="space-y-1">
                  {detailPrevu.map((d) => (
                    <div key={d.nom} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-muted-foreground">{d.nom}</span>
                      <span className="font-medium shrink-0">
                        {formatCurrency(d.montant)}{' '}
                        <span className="text-muted-foreground">({d.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune donnée</p>
              )}
            </TooltipContent>
          </UITooltip>

          {/* Encaissé */}
          <UITooltip>
            <TooltipTrigger asChild>
              <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-emerald-500 border-emerald-500/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-default">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-500/10 to-transparent pointer-events-none" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">Encaissé</p>
                      <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-600/70 bg-clip-text text-transparent truncate">
                        {formatCurrency(totalEncaisse)}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg opacity-60" />
                      <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 ring-2 ring-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="mt-2 bg-emerald-500/10 text-emerald-700 border-emerald-500/20 shadow-sm text-xs"
                  >
                    {tauxEncaissement}% du prévu annuel
                  </Badge>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs p-3">
              <p className="font-semibold text-xs mb-1.5">
                Top établissements — Encaissé ({nbEncaisse} périodes)
              </p>
              {detailEncaisse.length > 0 ? (
                <div className="space-y-1">
                  {detailEncaisse.map((d) => (
                    <div key={d.nom} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-muted-foreground">{d.nom}</span>
                      <span className="font-medium shrink-0">
                        {formatCurrency(d.montant)}{' '}
                        <span className="text-muted-foreground">({d.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune donnée</p>
              )}
            </TooltipContent>
          </UITooltip>

          {/* Facturé (à encaisser) */}
          <UITooltip>
            <TooltipTrigger asChild>
              <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-blue-500 border-blue-500/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-default">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/10 to-transparent pointer-events-none" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">
                        Facturé (à encaisser)
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-600/70 bg-clip-text text-transparent truncate">
                        {formatCurrency(totalFacture)}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-lg opacity-60" />
                      <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 ring-2 ring-blue-500/20 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-blue-500" />
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">En attente d'encaissement</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs p-3">
              <p className="font-semibold text-xs mb-1.5">
                Top établissements — Facturé ({nbFacture} périodes)
              </p>
              {detailFacture.length > 0 ? (
                <div className="space-y-1">
                  {detailFacture.map((d) => (
                    <div key={d.nom} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-muted-foreground">{d.nom}</span>
                      <span className="font-medium shrink-0">
                        {formatCurrency(d.montant)}{' '}
                        <span className="text-muted-foreground">({d.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune donnée</p>
              )}
            </TooltipContent>
          </UITooltip>

          {/* En retard */}
          <UITooltip>
            <TooltipTrigger asChild>
              <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-destructive border-destructive/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-default">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-destructive/10 to-transparent pointer-events-none" />
                <CardContent className="pt-6 relative">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">En retard</p>
                      <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-destructive to-destructive/70 bg-clip-text text-transparent truncate">
                        {formatCurrency(totalEnRetard)}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-destructive/20 rounded-full blur-lg opacity-60" />
                      <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-destructive/20 to-destructive/5 ring-2 ring-destructive/20 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                      </div>
                    </div>
                  </div>
                  {nbEnRetard > 0 && (
                    <Badge
                      variant="secondary"
                      className="mt-2 bg-destructive/10 text-destructive border-destructive/20 shadow-sm text-xs"
                    >
                      {nbEnRetard} période{nbEnRetard > 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs p-3">
              <p className="font-semibold text-xs mb-1.5">
                Top établissements — En retard ({nbEnRetard} périodes)
              </p>
              {detailEnRetard.length > 0 ? (
                <div className="space-y-1">
                  {detailEnRetard.map((d) => (
                    <div key={d.nom} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-muted-foreground">{d.nom}</span>
                      <span className="font-medium shrink-0">
                        {formatCurrency(d.montant)}{' '}
                        <span className="text-muted-foreground">({d.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune période en retard</p>
              )}
            </TooltipContent>
          </UITooltip>
        </div>

        {/* Graphiques */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Évolution 12 mois */}
          <Card className="lg:col-span-2 bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-3">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary to-primary/50" />
                Évolution sur 12 mois
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {evolution.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={evolution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mois" className="text-xs" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <RechartsTooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelClassName="font-medium"
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="prevu"
                      stroke="hsl(var(--muted-foreground))"
                      fill="hsl(var(--muted))"
                      fillOpacity={0.3}
                      strokeDasharray="5 5"
                      name="Prévu"
                    />
                    <Area
                      type="monotone"
                      dataKey="encaisse"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.5}
                      name="Encaissé"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </CardContent>
          </Card>

          {/* Répartition par statut */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-500 to-blue-500/50" />
                Répartition par statut
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {statutPieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statutPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statutPieData.map((entry, index) => (
                          // Recharts pose `role="img"` en dur sur chaque secteur
                          // (Sector.js) : sans nom accessible, axe remonte
                          // `svg-img-alt`. Le libellé passe par les props du Cell.
                          <Cell
                            key={`cell-${index}`}
                            aria-label={`${entry.statut} : ${entry.value}`}
                            fill={PIE_COLORS[entry.statut] || '#666'}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-2">
                    {statutPieData.map((s) => (
                      <div key={s.statut} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[s.statut] || '#666' }}
                          />
                          <span className="text-muted-foreground">{s.name}</span>
                        </div>
                        <span className="font-medium">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tableaux détaillés */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Prochains virements attendus */}
          <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-blue-500 border-blue-500/10 shadow-lg">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-md opacity-60" />
                  <div className="relative p-2 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 ring-2 ring-blue-500/20">
                    <CalendarClock className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                Prochains virements attendus
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {prochainsVirements.length > 0 ? (
                  prochainsVirements.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="font-medium truncate text-sm">
                            {p.etablissement?.nom || '—'}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(p.date_debut), 'MMM yyyy', { locale: fr })}
                          {p.date_virement_estimee && (
                            <>
                              {' '}
                              · Virement est.{' '}
                              {format(parseISO(p.date_virement_estimee), 'dd/MM/yyyy')}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-semibold text-sm">{formatCurrency(p.montant_prevu)}</p>
                        <Badge
                          variant="secondary"
                          className={`text-xs shadow-sm ${STATUT_FACTURE_COLORS[p.statut] || ''}`}
                        >
                          {p.statut}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun virement attendu
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Périodes en retard */}
          <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-destructive border-destructive/10 shadow-lg">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-destructive/20 rounded-full blur-md opacity-60" />
                  <div className="relative p-2 rounded-full bg-gradient-to-br from-destructive/20 to-destructive/5 ring-2 ring-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                </div>
                Périodes en retard
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {periodesEnRetard.length > 0 ? (
                  periodesEnRetard.slice(0, 10).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-destructive/5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="font-medium truncate text-sm">
                            {p.etablissement?.nom || '—'}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(p.date_debut), 'dd/MM/yyyy')} →{' '}
                          {format(parseISO(p.date_fin), 'dd/MM/yyyy')}
                          {p.date_facture && (
                            <> · Facturée le {format(parseISO(p.date_facture), 'dd/MM/yyyy')}</>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-semibold text-sm text-destructive">
                          {formatCurrency(p.montant_prevu)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune période en retard 🎉
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tableau de tous les paiements attendus de l'année */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Paiements attendus en {currentYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paiementsAttendusAnnee.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Établissement</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-right">Montant prévu</TableHead>
                    <TableHead className="text-right">Montant perçu</TableHead>
                    <TableHead>Date facture</TableHead>
                    <TableHead>Date virement estimé</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paiementsAttendusAnnee.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {v.etablissement?.nom || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                        {format(parseISO(v.date_debut), 'dd/MM/yyyy')} →{' '}
                        {format(parseISO(v.date_fin), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        {formatCurrency(v.montant_prevu)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {v.montant_percu ? formatCurrency(v.montant_percu) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {v.date_facture ? format(parseISO(v.date_facture), 'dd/MM/yyyy') : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {v.date_virement_estimee
                          ? format(parseISO(v.date_virement_estimee), 'dd/MM/yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_FACTURE_COLORS[v.statut] || 'bg-muted text-muted-foreground'}`}
                        >
                          {v.statut}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {v.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun paiement attendu pour {currentYear}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
