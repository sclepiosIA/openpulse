import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Link2,
  Link2Off,
  Landmark,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Euro,
} from "lucide-react";
import { useQontoTransactions } from "@/hooks/tresorerie/useQontoTransactions";
import { useFactures } from "@/hooks/billing/useFactures";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
interface MatchSuggestion {
  transactionId: string;
  factureId: string;
  facture: any;
  transaction: any;
  score: number;
  reasons: string[];
}

export function FacturationQontoReconciliation() {
  const queryClient = useQueryClient();
  const { 
    transactions, 
    connection, 
    isLoading: isLoadingQonto, 
    sync, 
    isSyncing 
  } = useQontoTransactions({ type: 'credit', reconciled: false });
  
  const { factures, isLoading: isLoadingFactures } = useFactures();
  const [isReconciling, setIsReconciling] = useState<string | null>(null);

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
    }).format(montant);
  };

  // Factures non payées
  const facturesEnAttente = useMemo(() => {
    return (factures || []).filter(f => 
      f.statut === 'brouillon' || f.statut === 'en_attente'
    );
  }, [factures]);

  // Calcul des suggestions de matching
  const matchSuggestions: MatchSuggestion[] = useMemo(() => {
    const suggestions: MatchSuggestion[] = [];

    for (const transaction of transactions) {
      for (const facture of facturesEnAttente) {
        const reasons: string[] = [];
        let score = 0;

        // Match par montant (±5%)
        const montantDiff = Math.abs(transaction.montant - facture.montant_ttc) / facture.montant_ttc;
        if (montantDiff <= 0.05) {
          score += 50;
          reasons.push(`Montant proche (${(100 - montantDiff * 100).toFixed(0)}%)`);
        } else if (montantDiff <= 0.1) {
          score += 25;
          reasons.push('Montant similaire');
        }

        // Match par date (±14 jours de l'échéance)
        if (facture.date_echeance && transaction.date_operation) {
          const daysDiff = Math.abs(differenceInDays(
            parseISO(transaction.date_operation),
            parseISO(facture.date_echeance)
          ));
          if (daysDiff <= 7) {
            score += 30;
            reasons.push('Date proche de l\'échéance');
          } else if (daysDiff <= 14) {
            score += 15;
            reasons.push('Date dans les 2 semaines');
          }
        }

        // Match par libellé (nom d'établissement ou numéro facture)
        const libelleLower = transaction.libelle?.toLowerCase() || '';
        if (facture.client_nom && libelleLower.includes(facture.client_nom.toLowerCase().slice(0, 10))) {
          score += 20;
          reasons.push('Nom client détecté');
        }
        if (facture.numero && libelleLower.includes(facture.numero.toLowerCase())) {
          score += 40;
          reasons.push('Numéro facture détecté');
        }

        // Seuil minimum pour suggérer
        if (score >= 40) {
          suggestions.push({
            transactionId: transaction.id,
            factureId: facture.id,
            facture,
            transaction,
            score,
            reasons,
          });
        }
      }
    }

    // Trier par score décroissant et garder la meilleure suggestion par transaction
    const bestByTransaction = new Map<string, MatchSuggestion>();
    for (const s of suggestions.sort((a, b) => b.score - a.score)) {
      if (!bestByTransaction.has(s.transactionId)) {
        bestByTransaction.set(s.transactionId, s);
      }
    }

    return Array.from(bestByTransaction.values());
  }, [transactions, facturesEnAttente]);

  // Rapprocher une facture avec une transaction
  const handleReconcile = async (suggestion: MatchSuggestion) => {
    setIsReconciling(suggestion.transactionId);
    try {
      // Mettre à jour la transaction bancaire
      const { error: transError } = await supabase
        .from('tresorerie_operations_bancaires')
        .update({ 
          reconcilie: true,
          notes: `Rapproché avec facture ${suggestion.facture.numero}`
        })
        .eq('id', suggestion.transactionId);

      if (transError) throw transError;

      // Mettre à jour la facture
      const { error: factError } = await supabase
        .from('factures')
        .update({ 
          statut: 'payee',
          date_paiement: suggestion.transaction.date_operation
        } as never)
        .eq('id', suggestion.factureId);

      if (factError) throw factError;

      toast.success('Rapprochement effectué', {
        description: `Facture ${suggestion.facture.numero} marquée comme payée`
      });

      // Invalider les caches
      queryClient.invalidateQueries({ queryKey: ['qonto-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['factures'] });
    } catch (error: unknown) {
      toast.error('Erreur lors du rapprochement', { description: sanitizeSupabaseError(error) });
    } finally {
      setIsReconciling(null);
    }
  };

  const isLoading = isLoadingQonto || isLoadingFactures;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const unreconciledCount = transactions.length;
  const pendingFacturesCount = facturesEnAttente.length;
  const totalUnreconciled = transactions.reduce((sum, t) => sum + t.montant, 0);
  const totalPending = facturesEnAttente.reduce((sum, f) => sum + f.montant_ttc, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Solde Qonto</p>
                <p className="text-xl font-bold">
                  {connection?.bank_accounts?.[0]?.balance 
                    ? formatMontant(connection.bank_accounts[0].balance)
                    : '--'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Euro className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Crédits non rapprochés</p>
                <p className="text-xl font-bold">{formatMontant(totalUnreconciled)}</p>
                <p className="text-xs text-muted-foreground">{unreconciledCount} transaction{unreconciledCount > 1 ? 's' : ''}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Factures en attente</p>
                <p className="text-xl font-bold">{formatMontant(totalPending)}</p>
                <p className="text-xs text-muted-foreground">{pendingFacturesCount} facture{pendingFacturesCount > 1 ? 's' : ''}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suggestions</p>
                <p className="text-xl font-bold">{matchSuggestions.length}</p>
                <p className="text-xs text-muted-foreground">rapprochements possibles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {connection?.last_sync_at && (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Dernière sync: {format(new Date(connection.last_sync_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
            </>
          )}
        </div>
        <Button onClick={() => sync({})} disabled={isSyncing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
          Synchroniser Qonto
        </Button>
      </div>

      {/* Suggestions de rapprochement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Rapprochement bancaire
          </CardTitle>
          <CardDescription>
            Associez les paiements reçus avec les factures correspondantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matchSuggestions.length === 0 && unreconciledCount === 0 && pendingFacturesCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-primary/50" />
              <p className="font-medium">Tout est à jour !</p>
              <p className="text-sm">Aucun rapprochement en attente</p>
            </div>
          ) : matchSuggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2Off className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="font-medium">Aucune correspondance trouvée</p>
              <p className="text-sm">
                {unreconciledCount} crédit{unreconciledCount > 1 ? 's' : ''} Qonto | {pendingFacturesCount} facture{pendingFacturesCount > 1 ? 's' : ''} en attente
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {matchSuggestions.map((suggestion) => (
                <div
                  key={suggestion.transactionId}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Facture */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono">
                          {suggestion.facture.numero}
                        </Badge>
                        <Badge 
                          variant={suggestion.facture.statut === 'en_retard' ? 'destructive' : 'secondary'}
                        >
                          {suggestion.facture.statut}
                        </Badge>
                      </div>
                      <p className="font-medium truncate">{suggestion.facture.client_nom}</p>
                      <p className="text-lg font-bold text-primary">
                        {formatMontant(suggestion.facture.montant_ttc)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Échéance: {suggestion.facture.date_echeance 
                          ? format(new Date(suggestion.facture.date_echeance), 'dd/MM/yyyy')
                          : 'Non définie'}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="flex flex-col items-center px-4">
                      <div className={cn(
                        "h-12 w-12 rounded-full flex items-center justify-center text-white font-bold",
                        suggestion.score >= 80 ? "bg-emerald-500" :
                        suggestion.score >= 60 ? "bg-amber-500" : "bg-orange-500"
                      )}>
                        {suggestion.score}%
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground my-2" />
                      <div className="text-xs text-center text-muted-foreground max-w-[100px]">
                        {suggestion.reasons.slice(0, 2).join(', ')}
                      </div>
                    </div>

                    {/* Transaction Qonto */}
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-xs text-muted-foreground mb-1">
                        {format(new Date(suggestion.transaction.date_operation), 'dd/MM/yyyy')}
                      </p>
                      <p className="font-medium truncate">{suggestion.transaction.libelle}</p>
                      <p className="text-lg font-bold text-emerald-600">
                        +{formatMontant(suggestion.transaction.montant)}
                      </p>
                    </div>

                    {/* Action */}
                    <Button
                      onClick={() => handleReconcile(suggestion)}
                      disabled={isReconciling === suggestion.transactionId}
                      className="shrink-0"
                    >
                      {isReconciling === suggestion.transactionId ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Link2 className="h-4 w-4 mr-2" />
                          Rapprocher
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions non matchées */}
      {transactions.length > matchSuggestions.length && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Transactions sans correspondance
            </CardTitle>
            <CardDescription>
              Ces crédits Qonto n'ont pas de facture correspondante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transactions
                .filter(t => !matchSuggestions.some(s => s.transactionId === t.id))
                .slice(0, 10)
                .map(transaction => (
                  <div 
                    key={transaction.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">{transaction.libelle}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.date_operation), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <p className="font-bold text-emerald-600">
                      +{formatMontant(transaction.montant)}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
