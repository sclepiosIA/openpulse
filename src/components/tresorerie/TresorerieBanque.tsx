import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQontoTransactions } from "@/hooks/tresorerie/useQontoTransactions";
import { useTresorerieRevenus } from "@/hooks/tresorerie/useTresorerieRevenus";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw,
  Link2,
  Unlink,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Download,
  Calendar as CalendarIcon,
  ChevronRight,
  Building2,
  Filter,
  CreditCard,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO, isWithinInterval, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface TresorerieCategory {
  id: string;
  code: string;
  nom: string;
  couleur: string | null;
  icone: string | null;
}

interface Transaction {
  id: string;
  date_operation: string;
  libelle: string | null;
  montant: number | null;
  type_operation: string | null;
  categorie_code: string | null;
  reconcilie: boolean | null;
  recette_id: string | null;
  reference_externe?: string | null;
}

export function TresorerieBanque() {
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [reconciledFilter, setReconciledFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [search, setSearch] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 90),
    to: new Date()
  });

  const { 
    transactions, 
    connection, 
    isLoading, 
    sync, 
    isSyncing,
    reconcile,
    unreconcile
  } = useQontoTransactions({
    type: typeFilter,
    reconciled: reconciledFilter === 'all' ? null : reconciledFilter === 'yes'
  });

  const { revenus } = useTresorerieRevenus();
  const pendingRevenus = revenus.filter(r => r.statut !== 'paye');

  // Charger les catégories
  const { data: categories } = useQuery({
    queryKey: ['tresorerie-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_categories')
        .select('id, code, nom, couleur, icone');
      if (error) throw error;
      return (data || []) as TresorerieCategory[];
    }
  });

  const categoriesMap = useMemo(() => {
    return Object.fromEntries((categories || []).map(c => [c.code, c]));
  }, [categories]);

  // Filtrer les transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Filtre recherche
      if (search && !tx.libelle?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Filtre date
      if (dateRange.from && dateRange.to) {
        const txDate = parseISO(tx.date_operation);
        if (!isWithinInterval(txDate, { start: dateRange.from, end: dateRange.to })) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, search, dateRange]);

  // Grouper par jour
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(tx => {
      const day = format(parseISO(tx.date_operation), 'yyyy-MM-dd');
      if (!groups[day]) groups[day] = [];
      groups[day].push(tx);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTransactions]);

  // Calculs KPIs
  const totalBalance = connection?.bank_accounts?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;
  const unreconciledCredits = transactions.filter(t => t.type_operation === 'credit' && !t.reconcilie);
  const totalUnreconciled = unreconciledCredits.reduce((sum, t) => sum + (t.montant || 0), 0);

  // Données pour le graphique des flux
  const flowChartData = useMemo(() => {
    const last30Days: Record<string, { date: string; credits: number; debits: number }> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, 'yyyy-MM-dd');
      last30Days[key] = { date: format(d, 'dd/MM'), credits: 0, debits: 0 };
    }
    
    transactions.forEach(tx => {
      const day = format(parseISO(tx.date_operation), 'yyyy-MM-dd');
      if (last30Days[day]) {
        if (tx.type_operation === 'credit') {
          last30Days[day].credits += tx.montant || 0;
        } else {
          last30Days[day].debits += Math.abs(tx.montant || 0);
        }
      }
    });
    
    return Object.values(last30Days);
  }, [transactions]);

  const formatMontant = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

  const formatCompact = (value: number) =>
    new Intl.NumberFormat("fr-FR", { 
      style: "currency", 
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1 
    }).format(value);

  const getCategoryDisplay = (code: string | null) => {
    if (!code) return null;
    const category = categoriesMap[code];
    return category ? {
      nom: category.nom,
      couleur: category.couleur || 'hsl(var(--muted))'
    } : {
      nom: code,
      couleur: 'hsl(var(--muted))'
    };
  };

  const handleReconcile = (transactionId: string, revenuId: string) => {
    reconcile({ transactionId, revenuId });
    setSelectedTransaction(null);
  };

  const handleExport = () => {
    const csv = [
      ["Date", "Libellé", "Type", "Montant", "Catégorie", "Rapproché"].join(";"),
      ...filteredTransactions.map(tx => [
        tx.date_operation,
        tx.libelle || "",
        tx.type_operation || "",
        tx.montant || 0,
        tx.categorie_code || "",
        tx.reconcilie ? "Oui" : "Non"
      ].join(";"))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qonto_transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Hero Section - Solde Qonto */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Solde */}
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Wallet className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Solde Qonto</p>
                  <p className="text-4xl font-bold text-primary">
                    {formatMontant(totalBalance)}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {connection?.bank_accounts?.map((account, i) => (
                  <Badge key={i} variant="outline" className="gap-1">
                    <CreditCard className="h-3 w-3" />
                    {account.name}: {formatCompact(account.balance || 0)}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {connection?.last_sync_at 
                    ? `Sync: ${formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true, locale: fr })}`
                    : 'Jamais synchronisé'
                  }
                </div>
                {connection?.is_active && (
                  <Badge variant="outline" className="text-green-600 border-green-300 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connecté
                  </Badge>
                )}
                {connection?.last_error && (
                  <Badge variant="outline" className="text-red-600 border-red-300 gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Erreur
                  </Badge>
                )}
              </div>
            </div>

            {/* Mini graphique flux */}
            <div className="flex-1 h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flowChartData}>
                  <defs>
                    <linearGradient id="creditsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="debitsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="credits" 
                    stroke="hsl(142, 76%, 36%)" 
                    fill="url(#creditsGradient)"
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="debits" 
                    stroke="hsl(0, 84%, 60%)" 
                    fill="url(#debitsGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs secondaires */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Crédits (90j)</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCompact(transactions.filter(t => t.type_operation === 'credit').reduce((s, t) => s + (t.montant || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Débits (90j)</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCompact(Math.abs(transactions.filter(t => t.type_operation === 'debit').reduce((s, t) => s + (t.montant || 0), 0)))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(unreconciledCredits.length > 5 && "border-amber-500/50")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                unreconciledCredits.length > 5 ? "bg-amber-500/20" : "bg-amber-500/10"
              )}>
                <Unlink className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Non rapprochés</p>
                <p className="text-xl font-bold text-amber-600">{unreconciledCredits.length}</p>
                <p className="text-xs text-muted-foreground">{formatCompact(totalUnreconciled)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-xl font-bold">{transactions.length}</p>
                <p className="text-xs text-muted-foreground">sur 90 jours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de filtres */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Transactions ({filteredTransactions.length})
            </CardTitle>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-[200px]"
                />
              </div>

              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'credit' | 'debit')}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="credit">Crédits</SelectItem>
                  <SelectItem value="debit">Débits</SelectItem>
                </SelectContent>
              </Select>

              <Select value={reconciledFilter} onValueChange={(v) => setReconciledFilter(v as 'all' | 'yes' | 'no')}>
                <SelectTrigger className="w-[150px]">
                  <Link2 className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="yes">Rapprochés</SelectItem>
                  <SelectItem value="no">Non rapprochés</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="text-xs">
                      {dateRange.from && dateRange.to 
                        ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                        : "Période"
                      }
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                    locale={fr}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="sm" onClick={handleExport} aria-label="Exporter" title="Exporter">
                <Download className="h-4 w-4" />
              </Button>

              <Button onClick={() => sync({})} disabled={isSyncing}>
                <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                {isSyncing ? 'Sync...' : 'Synchroniser'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mb-4" />
              <p className="font-medium">Aucune transaction</p>
              <p className="text-sm">Cliquez sur "Synchroniser" pour récupérer vos transactions Qonto</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedTransactions.map(([day, txs]) => (
                <div key={day}>
                  {/* Séparateur de jour */}
                  <div className="sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10 flex items-center gap-2">
                    <Badge variant="outline" className="font-medium">
                      {format(parseISO(day), "EEEE d MMMM", { locale: fr })}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {txs.length} transaction{txs.length > 1 ? 's' : ''}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Transactions du jour */}
                  <div className="space-y-1">
                    {txs.map((tx) => {
                      const categoryDisplay = getCategoryDisplay(tx.categorie_code);
                      
                      return (
                        <div 
                          key={tx.id}
                          className={cn(
                            "flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group",
                            !tx.reconcilie && tx.type_operation === 'credit' && "bg-amber-50/50 dark:bg-amber-950/20"
                          )}
                          onClick={() => setSelectedTransaction(tx)}
                        >
                          {/* Icône type */}
                          <div className={cn(
                            "p-2 rounded-lg shrink-0",
                            tx.type_operation === 'credit' ? "bg-green-500/10" : "bg-red-500/10"
                          )}>
                            {tx.type_operation === 'credit' ? (
                              <ArrowDownLeft className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-red-600" />
                            )}
                          </div>

                          {/* Libellé et catégorie */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{tx.libelle}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {categoryDisplay && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs h-5"
                                  style={{ 
                                    borderColor: categoryDisplay.couleur,
                                    color: categoryDisplay.couleur 
                                  }}
                                >
                                  {categoryDisplay.nom}
                                </Badge>
                              )}
                              {tx.reconcilie ? (
                                <Badge className="text-xs h-5 bg-green-100 text-green-700 dark:bg-green-900/50">
                                  <Link2 className="h-3 w-3 mr-1" />
                                  Rapproché
                                </Badge>
                              ) : tx.type_operation === 'credit' && (
                                <Badge variant="outline" className="text-xs h-5 text-amber-600 border-amber-300">
                                  À rapprocher
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Montant */}
                          <div className={cn(
                            "text-right font-bold shrink-0",
                            tx.type_operation === 'credit' ? "text-green-600" : "text-red-600"
                          )}>
                            {tx.type_operation === 'credit' ? '+' : '-'}
                            {formatMontant(Math.abs(tx.montant || 0))}
                          </div>

                          {/* Actions rapides */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {tx.type_operation === 'credit' && !tx.reconcilie && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTransaction(tx);
                                }}
                              >
                                <Link2 className="h-3.5 w-3.5 mr-1" />
                                Rapprocher
                              </Button>
                            )}
                            {tx.reconcilie && tx.recette_id && (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unreconcile({ transactionId: tx.id, revenuId: tx.recette_id! });
                                }}
                              >
                                <Unlink className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>

                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel latéral détails */}
      <Sheet open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selectedTransaction && (
            <>
              <SheetHeader>
                <SheetTitle>Détails de la transaction</SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Montant */}
                <div className={cn(
                  "p-6 rounded-xl text-center",
                  selectedTransaction.type_operation === 'credit' 
                    ? "bg-green-500/10" 
                    : "bg-red-500/10"
                )}>
                  <p className={cn(
                    "text-4xl font-bold",
                    selectedTransaction.type_operation === 'credit' 
                      ? "text-green-600" 
                      : "text-red-600"
                  )}>
                    {selectedTransaction.type_operation === 'credit' ? '+' : '-'}
                    {formatMontant(Math.abs(selectedTransaction.montant || 0))}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {format(parseISO(selectedTransaction.date_operation), "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                </div>

                {/* Infos */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Libellé</p>
                    <p className="font-medium">{selectedTransaction.libelle}</p>
                  </div>
                  
                  {selectedTransaction.categorie_code && (
                    <div>
                      <p className="text-sm text-muted-foreground">Catégorie</p>
                      <Badge variant="outline">
                        {getCategoryDisplay(selectedTransaction.categorie_code)?.nom || selectedTransaction.categorie_code}
                      </Badge>
                    </div>
                  )}

                  {selectedTransaction.reference_externe && (
                    <div>
                      <p className="text-sm text-muted-foreground">Référence</p>
                      <p className="font-mono text-sm">{selectedTransaction.reference_externe}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    {selectedTransaction.reconcilie ? (
                      <Badge className="bg-green-100 text-green-700">
                        <Link2 className="h-3 w-3 mr-1" />
                        Rapproché
                      </Badge>
                    ) : selectedTransaction.type_operation === 'credit' ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        À rapprocher
                      </Badge>
                    ) : (
                      <Badge variant="secondary">-</Badge>
                    )}
                  </div>
                </div>

                {/* Actions de rapprochement */}
                {selectedTransaction.type_operation === 'credit' && !selectedTransaction.reconcilie && (
                  <div className="space-y-3">
                    <p className="font-medium">Rapprocher avec un revenu</p>
                    {pendingRevenus.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun revenu en attente de paiement</p>
                    ) : (
                      <ScrollArea className="h-[250px]">
                        <div className="space-y-2 pr-4">
                          {pendingRevenus.map((rev) => (
                            <div 
                              key={rev.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => handleReconcile(selectedTransaction.id, rev.id)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Building2 className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{rev.etablissements?.nom || 'N/A'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {rev.mois} • {rev.type_revenu}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">
                                  {formatMontant(rev.montant_prevu || 0)}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {rev.statut}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}

                {/* Bouton annuler rapprochement */}
                {selectedTransaction.reconcilie && selectedTransaction.recette_id && (
                  <Button 
                    variant="outline" 
                    className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      unreconcile({ 
                        transactionId: selectedTransaction.id, 
                        revenuId: selectedTransaction.recette_id! 
                      });
                      setSelectedTransaction(null);
                    }}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Annuler le rapprochement
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
