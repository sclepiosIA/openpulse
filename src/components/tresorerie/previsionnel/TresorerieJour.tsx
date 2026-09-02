import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQontoTransactions } from "@/hooks/tresorerie/useQontoTransactions";
import { useTresorerieDepenses, type Depense } from "@/hooks/tresorerie/useTresorerieDepenses";
import { useTresorerieRevenus } from "@/hooks/tresorerie/useTresorerieRevenus";
import { useSalaireProjectionsOverrides } from "@/hooks/hr/useSalaireProjectionsOverrides";
import { cn } from "@/lib/utils";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";

import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isSameDay, isWeekend, isBefore, startOfDay } from "date-fns";
import { getDaysInMonth, setDate } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { isFrenchHoliday } from "@/lib/frenchHolidays";
import { DayDetailTooltip, type DailyDetailItem } from "./DayDetailTooltip";
import { CreateDepensePrevisionnelleDialog } from "./CreateDepensePrevisionnelleDialog";
import { CreateRecettePrevisionnelleDialog } from "./CreateRecettePrevisionnelleDialog";
import { DepenseActionsDialog } from "./DepenseActionsDialog";
import { EditDepenseDialog } from "./EditDepenseDialog";
import { APayerPlusTardDialog } from "./APayerPlusTardDialog";
import { SalairePrevActionsDialog } from "./SalairePrevActionsDialog";
import { useRHSalaires } from "@/hooks/hr/useRHSalaires";

interface DailyData {
  date: Date;
  totalDepenses: number;
  totalRecettes: number;
  solde: number;
  topExpenses: string[];
  topRecettes: string[];
  isPrevisionnel: boolean;
  detailItems: DailyDetailItem[];
}

interface MonthData {
  month: Date;
  label: string;
  days: DailyData[];
  isPrevisionnel: boolean;
}

export function TresorerieJour() {
  const { transactions, connection, isLoading: isLoadingQonto } = useQontoTransactions();
  const { depenses: depensesPrevues, isLoading: isLoadingDepenses } = useTresorerieDepenses();
  const { revenus: revenusPrevus, isLoading: isLoadingRevenus } = useTresorerieRevenus();
  const { overrides: salaireOverrides, isLoading: isLoadingOverrides, getApplicableOverride } = useSalaireProjectionsOverrides();
   
   // Récupérer tous les salaires pour projection
   const { salaires, isLoading: isLoadingSalaires } = useRHSalaires();
  
  // Ref pour scroller vers le mois en cours au chargement
  const currentMonthRef = useRef<HTMLDivElement>(null);
  
  // États pour les dialogs
  const [showDepenseDialog, setShowDepenseDialog] = useState(false);
  const [showRecetteDialog, setShowRecetteDialog] = useState(false);
  
  // États pour actions sur dépenses
  const [selectedDepense, setSelectedDepense] = useState<Depense | null>(null);
  const [showActionsDialog, setShowActionsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedSalaireItem, setSelectedSalaireItem] = useState<DailyDetailItem | null>(null);
  const [showSalaireDialog, setShowSalaireDialog] = useState(false);
  const [showAPayerPlusTardDialog, setShowAPayerPlusTardDialog] = useState(false);

   const isLoading = isLoadingQonto || isLoadingDepenses || isLoadingRevenus || isLoadingSalaires || isLoadingOverrides;
  
   // Calculer les derniers salaires connus par employé
   const derniersNetPayes = useMemo(() => {
     if (!salaires || salaires.length === 0) return new Map<string, {
       prenom: string;
       nom: string;
       netPaye: number;
       dernierMois: string;
     }>();
     
     const derniersSalaires = new Map<string, {
       prenom: string;
       nom: string;
       netPaye: number;
       dernierMois: string;
     }>();
     
     salaires.forEach(s => {
       const existing = derniersSalaires.get(s.profile_id);
       if (!existing || s.mois > existing.dernierMois) {
         derniersSalaires.set(s.profile_id, {
           prenom: s.profiles?.prenom || '',
           nom: s.profiles?.nom || '',
           netPaye: s.net_paye || s.salaire_net || 0,
           dernierMois: s.mois
         });
       }
     });
     
     return derniersSalaires;
   }, [salaires]);
 
  // Filtrer les dépenses "À payer plus tard"
  const depensesAPayerPlusTard = useMemo(() => {
    if (!depensesPrevues) return [];
    return depensesPrevues.filter(
      (dep) => dep.statut === "a_payer_plus_tard" || dep.date_prevue === "1900-01-01"
    );
  }, [depensesPrevues]);

  // Calculer le total "À payer plus tard"
  const totalAPayerPlusTard = useMemo(() => {
    return {
      total: depensesAPayerPlusTard.reduce((sum, dep) => sum + dep.montant, 0),
      count: depensesAPayerPlusTard.length,
    };
  }, [depensesAPayerPlusTard]);

  const monthsData = useMemo((): MonthData[] => {
    const today = new Date();
    const currentMonth = startOfMonth(today);

    // Générer 13 mois : 6 passés + courant + 6 futurs
    const months: MonthData[] = [];
    for (let i = -6; i <= 6; i++) {
      const monthStart = i < 0 ? subMonths(currentMonth, Math.abs(i)) : addMonths(currentMonth, i);
      const monthEnd = endOfMonth(monthStart);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const isPrevisionnel = monthStart > currentMonth;

      months.push({
        month: monthStart,
        label: format(monthStart, "MMMM yyyy", { locale: fr }),
        isPrevisionnel,
        days: daysInMonth.map((day) => ({
          date: day,
          totalDepenses: 0,
          totalRecettes: 0,
          solde: 0,
          topExpenses: [],
          topRecettes: [],
          isPrevisionnel: day > today,
          detailItems: [],
        })),
      });
    }

    // Créer un map de tous les jours pour accès rapide
    const allDaysMap = new Map<string, DailyData>();
    months.forEach((month) => {
      month.days.forEach((day) => {
        allDaysMap.set(format(day.date, "yyyy-MM-dd"), day);
      });
    });

    // Remplir avec les données des transactions Qonto (passé + aujourd'hui)
    if (transactions) {
      transactions.forEach((tx) => {
        const dayKey = format(new Date(tx.date_operation), "yyyy-MM-dd");
        const dayData = allDaysMap.get(dayKey);
        if (dayData) {
          const montant = Math.abs(tx.montant);
          if (tx.type_operation === "debit") {
            dayData.totalDepenses += montant;
            // Ajouter le libellé court (max 15 chars)
            if (dayData.topExpenses.length < 3 && tx.libelle) {
              dayData.topExpenses.push(tx.libelle.substring(0, 15));
            }
            // Ajouter aux détails
            dayData.detailItems.push({
              id: tx.id,
              libelle: tx.libelle || 'Transaction',
              montant,
              type: 'depense',
              source: 'qonto',
            });
          } else {
            dayData.totalRecettes += montant;
            // Ajouter le libellé court pour les recettes (max 12 chars)
            if (dayData.topRecettes.length < 2 && tx.libelle) {
              dayData.topRecettes.push(tx.libelle.substring(0, 12));
            }
            // Ajouter aux détails
            dayData.detailItems.push({
              id: tx.id,
              libelle: tx.libelle || 'Transaction',
              montant,
              type: 'recette',
              source: 'qonto',
            });
          }
        }
      });
    }

    // NOTE: l'ancien bloc "revenus Qonto historiques payés sans tx" est désactivé
    // pour respecter l'isolation Réalisé/Projeté (cf. memory Treasury Architecture).
    // Les revenus payés du passé doivent provenir des transactions Qonto réelles ;
    // tout revenu paye sans tx correspondante est considéré comme drift de données
    // et n'est plus injecté dans la vue jour (évite le double comptage).


    // Remplir avec les dépenses prévisionnelles (futurs non payés)
    if (depensesPrevues) {
      depensesPrevues.forEach((dep) => {
        if (dep.date_prevue && dep.statut !== "paye") {
          const dayKey = format(new Date(dep.date_prevue), "yyyy-MM-dd");
          const dayData = allDaysMap.get(dayKey);
          if (dayData && dayData.isPrevisionnel) {
            dayData.totalDepenses += dep.montant;
            if (dayData.topExpenses.length < 3 && dep.nom) {
              dayData.topExpenses.push(dep.nom.substring(0, 15));
            }
            // Ajouter aux détails
            dayData.detailItems.push({
              id: dep.id,
              libelle: dep.nom || 'Dépense prévue',
              montant: dep.montant,
              type: 'depense',
              source: 'previsionnel',
            });
          }
        }
      });
    }

    // Remplir avec les revenus prévisionnels (futurs non payés)
    if (revenusPrevus) {
      revenusPrevus.forEach((rev) => {
        // Les revenus utilisent 'mois' au format YYYY-MM ou 'date_facture'
        const revenuDate = rev.date_facture || rev.mois;
        if (revenuDate && rev.statut !== "paye") {
          // Normaliser la date au format YYYY-MM-01 si c'est juste YYYY-MM
          const normalizedDate = revenuDate.length === 7 ? `${revenuDate}-01` : revenuDate;
          const dayKey = format(new Date(normalizedDate), "yyyy-MM-dd");
          const dayData = allDaysMap.get(dayKey);
          
          if (dayData && dayData.isPrevisionnel) {
            const montant = rev.montant_prevu || 0;
            dayData.totalRecettes += montant;
            if (dayData.topRecettes.length < 2) {
              const label = rev.etablissements?.nom || rev.type_revenu || "Revenu";
              dayData.topRecettes.push(label.substring(0, 12));
            }
            // Ajouter aux détails
            const fullLabel = rev.etablissements?.nom || rev.type_revenu || "Revenu prévu";
            dayData.detailItems.push({
              id: rev.id,
              libelle: fullLabel,
              montant,
              type: 'recette',
              source: 'previsionnel',
            });
          }
        }
      });
    }

     // ======== PROJECTION DES SALAIRES AU 28 DE CHAQUE MOIS FUTUR ========
     if (derniersNetPayes.size > 0) {
      const aujourdhui = startOfMonth(new Date());
       months.forEach((month) => {
        // Inclure le mois courant ET les mois futurs (pas les mois passés)
        const isMoisCourantOuFutur = month.month >= aujourdhui;
        if (isMoisCourantOuFutur) {
           const moisKey = format(month.month, 'yyyy-MM') + '-01';
           const moisYYYYMM = format(month.month, 'yyyy-MM');
           
           derniersNetPayes.forEach((emp, profileId) => {
             // 1. Vérifier si un salaire RH existe déjà pour ce mois/employé
             const salaireExiste = salaires?.some(
               s => s.profile_id === profileId && s.mois.startsWith(moisYYYYMM)
             );
             if (salaireExiste) return; // Ne pas projeter, le salaire réel existe
             
             // 2. Vérifier si une surcharge manuelle ponctuelle existe (source = salaire_manuel ou [EXCLU])
             const surchargeManuelle = depensesPrevues?.find(
               d => d.nom?.includes(`Salaire ${emp.prenom} ${emp.nom}`) &&
                    d.date_prevue.startsWith(moisYYYYMM) &&
                    d.source !== 'salaire_previsionnel'
             );
             if (surchargeManuelle) return; // Géré par la dépense manuelle
             
             // 3. Vérifier si une exclusion existe (nom contient [EXCLU])
             const exclusion = depensesPrevues?.find(
               d => d.nom?.includes(`[EXCLU] Salaire ${emp.prenom} ${emp.nom}`) &&
                    d.date_prevue.startsWith(moisYYYYMM)
             );
             if (exclusion) return; // Salaire exclu pour ce mois
             
              // 4. Calculer le montant à projeter (surcharge permanente ou dernier net payé)
              const override = getApplicableOverride(profileId, moisKey);
              
              // Si l'override existe avec montant = 0, c'est une exclusion
              if (override && Number(override.montant) === 0) return;
              
              const montantAProjecter = override ? Number(override.montant) : emp.netPaye;
              
              if (montantAProjecter > 0) {
               // Calculer le jour 28 (ou dernier jour si mois plus court)
               const joursInMonth = getDaysInMonth(month.month);
               const jour28 = Math.min(28, joursInMonth);
               const dateKey = format(setDate(month.month, jour28), 'yyyy-MM-dd');
               const dayData = allDaysMap.get(dateKey);
               
               if (dayData) {
                 dayData.totalDepenses += montantAProjecter;
                 if (dayData.topExpenses.length < 3) {
                   dayData.topExpenses.push(`Sal. ${emp.prenom}`.substring(0, 15));
                 }
                 dayData.detailItems.push({
                   id: `salaire-prev-${profileId}-${moisKey}`,
                   libelle: `Salaire ${emp.prenom} ${emp.nom}${override ? ' (modifié)' : ''}`,
                   montant: montantAProjecter,
                   type: 'depense',
                   source: 'salaire_previsionnel',
                 });
               }
             }
           });
         }
       });
     }
 
    // Calculer le solde continu sur tous les jours
    const currentBalance = connection?.bank_accounts?.[0]?.balance || 0;

    // Aplatir tous les jours chronologiquement (du plus ancien au plus récent)
    const allDays: DailyData[] = [];
    months.forEach((month) => {
      month.days.forEach((day) => {
        allDays.push(day);
      });
    });

    // Trouver l'index du jour d'aujourd'hui
    const todayIndex = allDays.findIndex((d) => isSameDay(d.date, today));

    if (todayIndex >= 0) {
      // Solde d'aujourd'hui = solde bancaire actuel
      allDays[todayIndex].solde = currentBalance;

      // Vers le passé (indices < todayIndex) - on remonte
      let runningBalance = currentBalance;
      for (let i = todayIndex - 1; i >= 0; i--) {
        const dayAfter = allDays[i + 1];
        // Pour retrouver le solde de la veille : solde_veille = solde_jour - recettes_jour + depenses_jour
        runningBalance = dayAfter.solde - dayAfter.totalRecettes + dayAfter.totalDepenses;
        allDays[i].solde = runningBalance;
      }

      // Vers le futur (indices > todayIndex) - on projette
      runningBalance = currentBalance;
      for (let i = todayIndex + 1; i < allDays.length; i++) {
        const dayBefore = allDays[i - 1];
        // Solde du lendemain = solde_jour + recettes_jour - depenses_jour
        runningBalance = dayBefore.solde + allDays[i].totalRecettes - allDays[i].totalDepenses;
        allDays[i].solde = runningBalance;
      }
    } else {
      // Si aujourd'hui n'est pas dans la plage, calculer à partir du dernier jour connu
      let runningBalance = currentBalance;
      for (let i = allDays.length - 1; i >= 0; i--) {
        if (i === allDays.length - 1) {
          allDays[i].solde = runningBalance;
        } else {
          const dayAfter = allDays[i + 1];
          runningBalance = dayAfter.solde - dayAfter.totalRecettes + dayAfter.totalDepenses;
          allDays[i].solde = runningBalance;
        }
      }
    }

    return months;
   }, [transactions, connection, depensesPrevues, revenusPrevus, salaires, derniersNetPayes, salaireOverrides, getApplicableOverride]);

  // Auto-scroll vers le mois en cours au chargement
  useEffect(() => {
    if (!isLoading && currentMonthRef.current) {
      currentMonthRef.current.scrollIntoView({ 
        behavior: 'auto', 
        inline: 'start',
        block: 'nearest'
      });
    }
  }, [isLoading]);

  // Handler pour clic sur un item dans le tooltip
  const handleItemClick = useCallback((item: DailyDetailItem) => {
    if (item.type === 'depense') {
      if (item.source === 'previsionnel') {
        // Dépenses prévisionnelles manuelles
        const depense = depensesPrevues.find(d => d.id === item.id);
        if (depense) {
          setSelectedDepense(depense);
          setShowActionsDialog(true);
        }
      } else if (item.source === 'salaire_previsionnel') {
        // Salaires prévisionnels (projection automatique)
        setSelectedSalaireItem(item);
        setShowSalaireDialog(true);
      }
    }
  }, [depensesPrevues]);

  // Handler pour passer en mode édition
  const handleOpenEdit = useCallback(() => {
    setShowActionsDialog(false);
    setShowEditDialog(true);
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[400px]" />
        </CardContent>
      </Card>
    );
  }

  // Fonction pour déterminer la classe de fond d'une ligne
  const getRowBackgroundClass = (day: DailyData): string => {
    const today = startOfDay(new Date());
    const dayDate = startOfDay(day.date);

    // Aujourd'hui (priorité max) - couleur amber très visible
    if (dayDate.getTime() === today.getTime()) {
      return "bg-amber-400/60 dark:bg-amber-500/40 font-semibold";
    }

    // Jour férié - même couleur que weekend
    if (isFrenchHoliday(day.date)) {
      return "bg-blue-200 dark:bg-blue-800/60";
    }

    // Weekend
    if (isWeekend(day.date)) {
      return "bg-blue-200 dark:bg-blue-800/60";
    }

    // Jour passé (ni férié ni weekend)
    if (isBefore(dayDate, today)) {
      return "bg-slate-200/80 dark:bg-slate-800/50";
    }

    return "";
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Vue jour par jour sur 13 mois
            </p>
            {/* Légende des couleurs */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-slate-200 border dark:bg-slate-700"></span> Passé
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-200 border dark:bg-blue-700"></span> Weekend / Férié
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-400/60 border border-amber-500"></span> Aujourd'hui
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Indicateur "À payer plus tard" - toujours visible */}
            <button
              onClick={() => setShowAPayerPlusTardDialog(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-md border border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors cursor-pointer"
            >
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                À payer plus tard : {formatCurrency(totalAPayerPlusTard.total)}
              </span>
              <Badge variant="secondary" className="text-xs">
                {totalAPayerPlusTard.count}
              </Badge>
            </button>
            
            {/* Boutons d'action */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDepenseDialog(true)}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <TrendingDown className="h-4 w-4 mr-1" />
              Dépense
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRecetteDialog(true)}
              className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-600/10"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Recette
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-4">
          {monthsData.map((month, index) => (
            <div 
              key={month.label} 
              className="flex-shrink-0 min-w-[340px]"
              ref={index === 6 ? currentMonthRef : undefined}
            >
              {/* Header du mois */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <h3 className="text-sm font-semibold capitalize">{month.label}</h3>
                {month.isPrevisionnel && (
                  <Badge variant="outline" className="text-xs py-0">
                    Prévisionnel
                  </Badge>
                )}
              </div>

              {/* Tableau */}
              <div className={cn("rounded-md border", month.isPrevisionnel && "bg-muted/30")}>
                <Table>
                  <TableHeader>
                    <TableRow className="h-6">
                      <TableHead className="py-0 w-14">Jour</TableHead>
                      <TableHead className="py-0 text-right w-16">Recettes</TableHead>
                      <TableHead className="py-0 text-right w-16">Dépenses</TableHead>
                      <TableHead className="py-0 text-right w-20">Solde</TableHead>
                      <TableHead className="py-0 w-28">Libellés</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {month.days.map((day) => (
                      <DayDetailTooltip
                        key={format(day.date, "yyyy-MM-dd")}
                        date={day.date}
                        totalRecettes={day.totalRecettes}
                        totalDepenses={day.totalDepenses}
                        solde={day.solde}
                        detailItems={day.detailItems}
                        isPrevisionnel={day.isPrevisionnel}
                        onItemClick={handleItemClick}
                      >
                        <TableRow className={cn("h-5 cursor-pointer", getRowBackgroundClass(day))}>
                          <TableCell className="py-0 font-medium text-xs whitespace-nowrap">
                            {format(day.date, "EEEEEE dd", { locale: fr })}
                          </TableCell>
                          {/* Recettes */}
                          <TableCell
                            className={cn(
                              "py-0 text-right font-medium text-xs",
                              day.isPrevisionnel ? "text-emerald-500" : "text-green-600"
                            )}
                          >
                            {day.totalRecettes > 0 ? formatCurrency(day.totalRecettes) : "-"}
                          </TableCell>
                          {/* Dépenses */}
                          <TableCell
                            className={cn(
                              "py-0 text-right font-medium text-xs",
                              day.isPrevisionnel ? "text-orange-600" : "text-destructive"
                            )}
                          >
                            {day.totalDepenses > 0 ? formatCurrency(day.totalDepenses) : "-"}
                          </TableCell>
                          {/* Solde */}
                          <TableCell
                            className={cn(
                              "py-0 text-right font-medium text-xs",
                              day.solde >= 0 ? "text-green-600" : "text-destructive"
                            )}
                          >
                            {formatCurrency(day.solde)}
                          </TableCell>
                          {/* Libellés combinés */}
                          <TableCell className="py-0 text-muted-foreground text-xs truncate max-w-[100px]">
                            {[...day.topRecettes, ...day.topExpenses].slice(0, 3).join(", ") || "-"}
                          </TableCell>
                        </TableRow>
                      </DayDetailTooltip>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
          </div>
        </div>
        
        {/* Dialogs */}
        <CreateDepensePrevisionnelleDialog
          open={showDepenseDialog}
          onOpenChange={setShowDepenseDialog}
        />
        <CreateRecettePrevisionnelleDialog
          open={showRecetteDialog}
          onOpenChange={setShowRecetteDialog}
        />
        
        {/* Dialogs d'actions sur dépenses */}
        <DepenseActionsDialog
          open={showActionsDialog}
          onOpenChange={setShowActionsDialog}
          depense={selectedDepense}
          allDepenses={depensesPrevues}
          onEdit={handleOpenEdit}
        />
        <EditDepenseDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          depense={selectedDepense}
          allDepenses={depensesPrevues}
        />
        
        {/* Dialog des dépenses "À payer plus tard" */}
        <APayerPlusTardDialog
          open={showAPayerPlusTardDialog}
          onOpenChange={setShowAPayerPlusTardDialog}
          depenses={depensesAPayerPlusTard}
          onEdit={(depense) => {
            setSelectedDepense(depense);
            setShowEditDialog(true);
            setShowAPayerPlusTardDialog(false);
          }}
        />
        
        {/* Dialog pour salaires prévisionnels */}
        <SalairePrevActionsDialog
          open={showSalaireDialog}
          onOpenChange={setShowSalaireDialog}
          salaireItem={selectedSalaireItem}
          derniersNetPayes={derniersNetPayes}
        />
      </CardContent>
    </Card>
  );
}
