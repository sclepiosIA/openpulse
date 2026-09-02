import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export interface DailyDetailItem {
  id: string;
  libelle: string;
  montant: number;
  type: 'recette' | 'depense';
  source: 'qonto' | 'previsionnel' | 'revenu_historique' | 'salaire_previsionnel';
}

interface DayDetailTooltipProps {
  date: Date;
  totalRecettes: number;
  totalDepenses: number;
  solde: number;
  detailItems: DailyDetailItem[];
  isPrevisionnel: boolean;
  children: React.ReactNode;
  onItemClick?: (item: DailyDetailItem) => void;
}

export function DayDetailTooltip({
  date,
  totalRecettes,
  totalDepenses,
  solde,
  detailItems,
  isPrevisionnel,
  children,
  onItemClick,
}: DayDetailTooltipProps) {
  const recettes = detailItems.filter(item => item.type === 'recette');
  const depenses = detailItems.filter(item => item.type === 'depense');
  
  const soldeJour = totalRecettes - totalDepenses;
  const hasDetails = recettes.length > 0 || depenses.length > 0;

  // Maximum 8 items per section
  const MAX_ITEMS = 8;
  const recettesAffichees = recettes.slice(0, MAX_ITEMS);
  const depensesAffichees = depenses.slice(0, MAX_ITEMS);
  const recettesRestantes = recettes.length - MAX_ITEMS;
  const depensesRestantes = depenses.length - MAX_ITEMS;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-80 sm:w-96 p-0" 
        side="right" 
        align="start"
        sideOffset={8}
      >
        {/* Header avec la date */}
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">
              📅 {format(date, "EEEE d MMMM yyyy", { locale: fr })}
            </h4>
            {isPrevisionnel && (
              <Badge variant="outline" className="text-xs">
                Prévisionnel
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-80">
          <div className="p-3 space-y-3">
            {/* Section Recettes */}
            {(recettes.length > 0 || totalRecettes > 0) && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">💰</span>
                  <h5 className="font-semibold text-xs uppercase text-emerald-700 dark:text-emerald-400">
                    Recettes
                  </h5>
                </div>
                
                {recettesAffichees.length > 0 ? (
                  <div className="space-y-1.5">
                    {recettesAffichees.map((item) => {
                      const isClickable = (item.source === 'previsionnel' || item.source === 'salaire_previsionnel') && onItemClick;
                      return (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center justify-between text-xs",
                            isClickable && "cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 -mx-1 px-1 py-0.5 rounded"
                          )}
                          onClick={isClickable ? () => onItemClick(item) : undefined}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="truncate text-foreground" title={item.libelle}>
                              {item.libelle}
                            </span>
                            {item.source === 'previsionnel' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                                Prévu
                              </Badge>
                            )}
                            {item.source === 'salaire_previsionnel' && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                Salaire
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              +{formatCurrency(item.montant)}
                            </span>
                            {isClickable && (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {recettesRestantes > 0 && (
                      <div className="text-xs text-muted-foreground italic">
                        +{recettesRestantes} autre{recettesRestantes > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Aucun détail disponible</div>
                )}
                
                <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800 flex justify-between">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Total recettes</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(totalRecettes)}
                  </span>
                </div>
              </div>
            )}

            {/* Section Dépenses */}
            {(depenses.length > 0 || totalDepenses > 0) && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">📤</span>
                  <h5 className="font-semibold text-xs uppercase text-red-700 dark:text-red-400">
                    Dépenses
                  </h5>
                </div>
                
                {depensesAffichees.length > 0 ? (
                  <div className="space-y-1.5">
                    {depensesAffichees.map((item) => {
                      const isClickable = (item.source === 'previsionnel' || item.source === 'salaire_previsionnel') && onItemClick;
                      return (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center justify-between text-xs",
                            isClickable && "cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 -mx-1 px-1 py-0.5 rounded"
                          )}
                          onClick={isClickable ? () => onItemClick(item) : undefined}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="truncate text-foreground" title={item.libelle}>
                              {item.libelle}
                            </span>
                            {item.source === 'previsionnel' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                                Prévu
                              </Badge>
                            )}
                            {item.source === 'salaire_previsionnel' && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                Salaire
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className="font-medium text-red-600 dark:text-red-400">
                              -{formatCurrency(item.montant)}
                            </span>
                            {isClickable && (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {depensesRestantes > 0 && (
                      <div className="text-xs text-muted-foreground italic">
                        +{depensesRestantes} autre{depensesRestantes > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Aucun détail disponible</div>
                )}
                
                <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800 flex justify-between">
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">Total dépenses</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    -{formatCurrency(totalDepenses)}
                  </span>
                </div>
              </div>
            )}

            {/* Pas de données */}
            {totalRecettes === 0 && totalDepenses === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                Aucune transaction ce jour
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer avec le solde du jour */}
        <div className="px-4 py-3 border-t bg-muted/30">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium flex items-center gap-1.5">
              📊 Solde du jour
            </span>
            <span className={cn(
              "text-base font-bold",
              soldeJour >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              {soldeJour >= 0 ? '+' : ''}{formatCurrency(soldeJour)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-muted-foreground">Solde cumulé fin de journée</span>
            <span className={cn(
              "text-sm font-semibold",
              solde >= 0 ? "text-green-600" : "text-destructive"
            )}>
              {formatCurrency(solde)}
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
