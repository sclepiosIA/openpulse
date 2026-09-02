import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTresorerieRevenus } from '@/hooks/tresorerie/useTresorerieRevenus'
import { useTresorerieDepenses } from '@/hooks/tresorerie/useTresorerieDepenses'
import { useQontoTransactions } from '@/hooks/tresorerie/useQontoTransactions'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  Landmark,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  FileText,
  CreditCard,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react'
import { QontoAEncaisserDetailDialog } from './QontoAEncaisserDetailDialog'
import { useQontoClientInvoices } from '@/hooks/tresorerie/useQontoClientInvoices'
import {
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  Area,
  AreaChart,
} from 'recharts'
import { format, startOfMonth, subMonths, differenceInDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface TresorerieDashboardProps {
  onNavigateToTab?: (tab: string) => void
}

export function TresorerieDashboard({ onNavigateToTab }: TresorerieDashboardProps) {
  const { revenus, isLoading: loadingRevenus, marquerPaye, isUpdating } = useTresorerieRevenus()
  const { depenses, isLoading: loadingDepenses } = useTresorerieDepenses()
  const { connection, transactions, sync, isSyncing } = useQontoTransactions({})
  const {
    invoices: qontoInvoices,
    totalAEncaisser: aEncaisser,
    isLoading: loadingQontoInvoices,
  } = useQontoClientInvoices()

  const [showAEncaisserDialog, setShowAEncaisserDialog] = useState(false)
  const qontoBalance = connection?.bank_accounts?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0

  const isLoading = loadingRevenus || loadingDepenses

  // Calculs KPIs - Variables de référence pour les dates
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const prevMonthDate = subMonths(now, 1)
  const prevYear = prevMonthDate.getFullYear()
  const prevMonth = prevMonthDate.getMonth()

  // Helper pour comparer les mois (fonctionne avec format YYYY-MM-DD ou Date)
  const isSameMonth = (dateStr: string, year: number, month: number): boolean => {
    const d = new Date(dateStr)
    return d.getFullYear() === year && d.getMonth() === month
  }

  // Revenus payés (via montant_paye non null OU statuts payé/encaissé)
  const revenusPaies = revenus
    .filter((r) => r.statut === 'paye' || r.statut === 'encaisse' || r.montant_paye !== null)
    .reduce((sum, r) => sum + (r.montant_paye || r.montant_prevu || 0), 0)

  // Revenus du mois courant
  const revenusMois = revenus
    .filter((r) => isSameMonth(r.mois, currentYear, currentMonth))
    .reduce((sum, r) => sum + (r.montant_prevu || 0), 0)

  // Revenus du mois précédent
  const revenusMoisPrecedent = revenus
    .filter((r) => isSameMonth(r.mois, prevYear, prevMonth))
    .reduce((sum, r) => sum + (r.montant_prevu || 0), 0)

  const tendanceRevenus =
    revenusMoisPrecedent > 0
      ? (((revenusMois - revenusMoisPrecedent) / revenusMoisPrecedent) * 100).toFixed(1)
      : null

  // Dépenses
  const depensesPayees = depenses
    .filter((d) => d.statut === 'paye' || d.statut === 'payee')
    .reduce((sum, d) => sum + d.montant, 0)

  // Dépenses du mois courant
  const depensesMois = depenses
    .filter((d) => isSameMonth(d.date_prevue, currentYear, currentMonth))
    .reduce((sum, d) => sum + d.montant, 0)

  // Dépenses du mois précédent
  const depensesMoisPrecedent = depenses
    .filter((d) => isSameMonth(d.date_prevue, prevYear, prevMonth))
    .reduce((sum, d) => sum + d.montant, 0)

  const tendanceDepenses =
    depensesMoisPrecedent > 0
      ? (((depensesMois - depensesMoisPrecedent) / depensesMoisPrecedent) * 100).toFixed(1)
      : null

  // Solde calculé
  const soldeActuel = revenusPaies - depensesPayees

  // À encaisser = factures Qonto impayées (via hook useQontoClientInvoices)
  // La variable aEncaisser est maintenant fournie par le hook
  // À payer = toutes les dépenses non payées
  const aPayer = depenses
    .filter((d) => d.statut !== 'paye' && d.statut !== 'payee')
    .reduce((sum, d) => sum + d.montant, 0)

  // Alertes
  const depensesEnRetard = depenses.filter((d) => {
    if (d.statut === 'paye' || d.statut === 'payee') return false
    const datePrevue = parseISO(d.date_prevue)
    return differenceInDays(new Date(), datePrevue) > 0
  })

  const revenusEnRetard = revenus.filter((r) => {
    if (r.statut === 'paye') return false
    if (!r.date_facture) return false
    const dateFacture = parseISO(r.date_facture)
    return differenceInDays(new Date(), dateFacture) > 30
  })

  const transactionsNonRapprochees = transactions.filter(
    (t) => t.type_operation === 'credit' && !t.reconcilie
  ).length

  // Écart Qonto vs Calculé
  const ecartQontoCalcule = qontoBalance - soldeActuel

  // Flux de trésorerie net du mois
  const cashflowNet = revenusMois - depensesMois

  // Données graphique 6 derniers mois
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(startOfMonth(now), 5 - i)
    const chartYear = date.getFullYear()
    const chartMonth = date.getMonth()
    const moisLabel = format(date, 'MMM', { locale: fr })

    const revenusM = revenus
      .filter((r) => isSameMonth(r.mois, chartYear, chartMonth))
      .reduce((sum, r) => sum + (r.montant_paye || r.montant_prevu || 0), 0)

    const depensesM = depenses
      .filter((d) => isSameMonth(d.date_prevue, chartYear, chartMonth))
      .reduce((sum, d) => sum + d.montant, 0)

    return {
      mois: moisLabel,
      revenus: revenusM,
      depenses: depensesM,
      flux: revenusM - depensesM,
    }
  })

  const formatMontant = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)

  const formatCompact = (value: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={`tresorerie-dashboard-skeleton-${i}`} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="tresorerie-dashboard">
      {/* Alertes visuelles - Premium Style */}
      {(depensesEnRetard.length > 0 ||
        revenusEnRetard.length > 0 ||
        transactionsNonRapprochees > 10) && (
        <div className="space-y-3">
          {depensesEnRetard.length > 0 && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-destructive/10 to-transparent border border-destructive/20 shadow-sm backdrop-blur-sm">
              <div className="relative">
                <div className="absolute inset-0 bg-destructive/30 rounded-full blur-md" />
                <div className="relative p-2 rounded-full bg-destructive/10 ring-2 ring-destructive/20">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-destructive">
                  {depensesEnRetard.length} dépense{depensesEnRetard.length > 1 ? 's' : ''} en
                  retard
                </p>
                <p className="text-sm text-muted-foreground">
                  Total: {formatMontant(depensesEnRetard.reduce((s, d) => s + d.montant, 0))}
                </p>
              </div>
              <Badge variant="destructive" className="shadow-md">
                {depensesEnRetard.length}
              </Badge>
            </div>
          )}

          {revenusEnRetard.length > 0 && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 shadow-sm backdrop-blur-sm">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-md" />
                <div className="relative p-2 rounded-full bg-orange-500/10 ring-2 ring-orange-500/20">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-orange-600">
                  {revenusEnRetard.length} facture{revenusEnRetard.length > 1 ? 's' : ''} impayée
                  {revenusEnRetard.length > 1 ? 's' : ''} (+30j)
                </p>
                <p className="text-sm text-muted-foreground">
                  Total:{' '}
                  {formatMontant(revenusEnRetard.reduce((s, r) => s + (r.montant_prevu || 0), 0))}
                </p>
              </div>
              <Badge className="bg-orange-500 shadow-md">{revenusEnRetard.length}</Badge>
            </div>
          )}

          {transactionsNonRapprochees > 10 && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 shadow-sm backdrop-blur-sm">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-md" />
                <div className="relative p-2 rounded-full bg-amber-500/10 ring-2 ring-amber-500/20">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-600">
                  {transactionsNonRapprochees} transactions à rapprocher
                </p>
                <p className="text-sm text-muted-foreground">
                  Rendez-vous dans l'onglet Banque pour les traiter
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hero Section - Solde Qonto - Premium Glassmorphism */}
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-l-4 border-l-primary border-primary/10 shadow-lg">
        {/* Gradient decorative background */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-primary/5 to-transparent pointer-events-none" />
        <CardContent className="pt-6 relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl opacity-60" />
                <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-2 ring-primary/20">
                  <Landmark className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Solde Qonto</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {formatMontant(qontoBalance)}
                </p>
                {connection?.last_sync_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dernière sync:{' '}
                    {format(new Date(connection.last_sync_at), 'dd/MM à HH:mm', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {Math.abs(ecartQontoCalcule) > 100 && (
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1 shadow-sm',
                    ecartQontoCalcule > 0
                      ? 'text-success border-success/30 bg-success/5'
                      : 'text-destructive border-destructive/30 bg-destructive/5'
                  )}
                >
                  {ecartQontoCalcule > 0 ? '+' : ''}
                  {formatCompact(ecartQontoCalcule)} vs calculé
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => sync({})}
                disabled={isSyncing}
                className="rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
                Synchroniser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Grid - Premium Glassmorphism */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Revenus du mois */}
        <Card
          className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-success border-success/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer"
          onClick={() => onNavigateToTab?.('revenus')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus du mois</CardTitle>
            <div className="relative">
              <div className="absolute inset-0 bg-success/20 rounded-full blur-lg opacity-50" />
              <div className="relative p-2 rounded-full bg-gradient-to-br from-success/20 to-success/5 ring-2 ring-success/20">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-success to-success/70 bg-clip-text text-transparent">
              {formatMontant(revenusMois)}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {revenus.filter((r) => isSameMonth(r.mois, currentYear, currentMonth)).length}{' '}
                revenus
              </p>
              {tendanceRevenus && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs gap-1 shadow-sm',
                    Number(tendanceRevenus) >= 0
                      ? 'text-success border-success/30 bg-success/5'
                      : 'text-destructive border-destructive/30 bg-destructive/5'
                  )}
                >
                  {Number(tendanceRevenus) >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {tendanceRevenus}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dépenses du mois */}
        <Card
          className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-destructive border-destructive/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer"
          onClick={() => onNavigateToTab?.('depenses')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dépenses du mois</CardTitle>
            <div className="relative">
              <div className="absolute inset-0 bg-destructive/20 rounded-full blur-lg opacity-50" />
              <div className="relative p-2 rounded-full bg-gradient-to-br from-destructive/20 to-destructive/5 ring-2 ring-destructive/20">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-destructive to-destructive/70 bg-clip-text text-transparent">
              {formatMontant(depensesMois)}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {
                  depenses.filter((d) => isSameMonth(d.date_prevue, currentYear, currentMonth))
                    .length
                }{' '}
                dépenses
              </p>
              {tendanceDepenses && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs gap-1 shadow-sm',
                    Number(tendanceDepenses) <= 0
                      ? 'text-success border-success/30 bg-success/5'
                      : 'text-destructive border-destructive/30 bg-destructive/5'
                  )}
                >
                  {Number(tendanceDepenses) >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {tendanceDepenses}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Flux de trésorerie net */}
        <Card
          className={cn(
            'relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5',
            cashflowNet >= 0
              ? 'border-t-success border-success/10'
              : 'border-t-destructive border-destructive/10'
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flux de trésorerie</CardTitle>
            <div className="relative">
              <div
                className={cn(
                  'absolute inset-0 rounded-full blur-lg opacity-50',
                  cashflowNet >= 0 ? 'bg-success/20' : 'bg-destructive/20'
                )}
              />
              <div
                className={cn(
                  'relative p-2 rounded-full ring-2',
                  cashflowNet >= 0
                    ? 'bg-gradient-to-br from-success/20 to-success/5 ring-success/20'
                    : 'bg-gradient-to-br from-destructive/20 to-destructive/5 ring-destructive/20'
                )}
              >
                <Zap
                  className={cn('h-4 w-4', cashflowNet >= 0 ? 'text-success' : 'text-destructive')}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-3xl font-bold bg-clip-text text-transparent',
                cashflowNet >= 0
                  ? 'bg-gradient-to-r from-success to-success/70'
                  : 'bg-gradient-to-r from-destructive to-destructive/70'
              )}
            >
              {cashflowNet >= 0 ? '+' : ''}
              {formatMontant(cashflowNet)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Revenus - Dépenses ce mois</p>
          </CardContent>
        </Card>

        {/* À encaisser - Cliquable */}
        <Card
          className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-orange-500 border-orange-500/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer group"
          onClick={() => setShowAEncaisserDialog(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium group-hover:text-orange-600 transition-colors">
              À encaisser
            </CardTitle>
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative p-2 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-500/5 ring-2 ring-orange-500/20 group-hover:ring-orange-500/40 transition-all">
                <FileText className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-600/70 bg-clip-text text-transparent">
              {formatMontant(aEncaisser)}
            </div>
            <p className="text-xs text-muted-foreground mt-2 group-hover:text-orange-600/70 transition-colors">
              Cliquez pour voir le détail
            </p>
          </CardContent>
        </Card>

        {/* À payer */}
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 border-t-violet-500 border-violet-500/10 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À payer</CardTitle>
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500/20 rounded-full blur-lg opacity-50" />
              <div className="relative p-2 rounded-full bg-gradient-to-br from-violet-500/20 to-violet-500/5 ring-2 ring-violet-500/20">
                <Clock className="h-4 w-4 text-violet-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-violet-600/70 bg-clip-text text-transparent">
              {formatMontant(aPayer)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Dépenses en attente</p>
          </CardContent>
        </Card>

        {/* Solde calculé */}
        <Card
          className={cn(
            'relative overflow-hidden bg-card/80 backdrop-blur-sm border-t-4 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5',
            soldeActuel >= 0
              ? 'border-t-success border-success/10'
              : 'border-t-destructive border-destructive/10'
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde calculé</CardTitle>
            <div className="relative">
              <div
                className={cn(
                  'absolute inset-0 rounded-full blur-lg opacity-50',
                  soldeActuel >= 0 ? 'bg-success/20' : 'bg-destructive/20'
                )}
              />
              <div
                className={cn(
                  'relative p-2 rounded-full ring-2',
                  soldeActuel >= 0
                    ? 'bg-gradient-to-br from-success/20 to-success/5 ring-success/20'
                    : 'bg-gradient-to-br from-destructive/20 to-destructive/5 ring-destructive/20'
                )}
              >
                <Wallet
                  className={cn('h-4 w-4', soldeActuel >= 0 ? 'text-success' : 'text-destructive')}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-3xl font-bold bg-clip-text text-transparent',
                soldeActuel >= 0
                  ? 'bg-gradient-to-r from-success to-success/70'
                  : 'bg-gradient-to-r from-destructive to-destructive/70'
              )}
            >
              {formatMontant(soldeActuel)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Revenus payés - Dépenses payées</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques - Premium Style */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Évolution Revenus/Dépenses */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="flex items-center gap-3">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary to-primary/50" />
              Évolution sur 6 mois
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v) => formatCompact(v)}
                    tick={{ fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip
                    formatter={(value: number) => formatMontant(value)}
                    labelFormatter={(label) => `Mois: ${label}`}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="revenus"
                    name="Revenus"
                    fill="hsl(142, 76%, 36%)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="depenses"
                    name="Dépenses"
                    fill="hsl(0, 84%, 60%)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cashflow"
                    name="Cashflow"
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(217, 91%, 60%)', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cashflow Area */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="flex items-center gap-3">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-success to-success/50" />
              Tendance du cashflow
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[280px]">
              {chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v) => formatCompact(v)}
                      tick={{ fontSize: 12 }}
                      width={70}
                    />
                    <Tooltip
                      formatter={(value: number) => formatMontant(value)}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cashflow"
                      name="Flux de trésorerie"
                      stroke="hsl(217, 91%, 60%)"
                      fill="url(#cashflowGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée de flux de trésorerie disponible
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Résumé rapide - Premium Style */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-l-4 border-l-success border-success/10 shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-success/10 to-transparent pointer-events-none" />
          <CardContent className="pt-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-success/20 rounded-full blur-md opacity-60" />
                <div className="relative p-2.5 rounded-full bg-gradient-to-br from-success/20 to-success/5 ring-2 ring-success/20">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold bg-gradient-to-r from-success to-success/70 bg-clip-text text-transparent">
                  {revenus.filter((r) => r.statut === 'paye').length}
                </p>
                <p className="text-sm text-muted-foreground font-medium">Factures encaissées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-l-4 border-l-orange-500 border-orange-500/10 shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-orange-500/10 to-transparent pointer-events-none" />
          <CardContent className="pt-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-md opacity-60" />
                <div className="relative p-2.5 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-500/5 ring-2 ring-orange-500/20">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-600/70 bg-clip-text text-transparent">
                  {revenus.filter((r) => r.statut === 'facture').length}
                </p>
                <p className="text-sm text-muted-foreground font-medium">En attente de paiement</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-l-4 border-l-destructive border-destructive/10 shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-destructive/10 to-transparent pointer-events-none" />
          <CardContent className="pt-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-destructive/20 rounded-full blur-md opacity-60" />
                <div className="relative p-2.5 rounded-full bg-gradient-to-br from-destructive/20 to-destructive/5 ring-2 ring-destructive/20">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold bg-gradient-to-r from-destructive to-destructive/70 bg-clip-text text-transparent">
                  {depensesEnRetard.length}
                </p>
                <p className="text-sm text-muted-foreground font-medium">Dépenses en retard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog détail À encaisser - Factures Qonto */}
      <QontoAEncaisserDetailDialog
        open={showAEncaisserDialog}
        onOpenChange={setShowAEncaisserDialog}
        invoices={qontoInvoices}
        totalAEncaisser={aEncaisser}
        isLoading={loadingQontoInvoices}
      />
    </div>
  )
}
