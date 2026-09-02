import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEcheancesFacturation, EcheanceFacturation } from "@/hooks/billing/useFacturationEtablissement";
import { CalendarClock, Receipt, Building2, TrendingUp, FileText, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface FacturationEcheancesProps {
  onGenerateFacture?: (echeance: EcheanceFacturation) => void;
}

export function FacturationEcheances({ onGenerateFacture }: FacturationEcheancesProps) {
  const { echeancesParMois, isLoading, totalMontant } = useEcheancesFacturation(6);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([
    format(new Date(), 'yyyy-MM')
  ]);
  const [filterModele, setFilterModele] = useState<string>("all");
  const [filterPeriodicite, setFilterPeriodicite] = useState<string>("all");

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Filtrer les échéances
  const filteredEcheancesParMois = useMemo(() => {
    const filtered: Record<string, EcheanceFacturation[]> = {};
    
    Object.entries(echeancesParMois).forEach(([mois, echeances]) => {
      const filteredEcheances = echeances.filter(e => {
        const matchModele = filterModele === "all" || e.etablissement.modele === filterModele;
        const matchPeriodicite = filterPeriodicite === "all" || e.etablissement.periodicite === filterPeriodicite;
        return matchModele && matchPeriodicite;
      });
      
      if (filteredEcheances.length > 0) {
        filtered[mois] = filteredEcheances;
      }
    });
    
    return filtered;
  }, [echeancesParMois, filterModele, filterPeriodicite]);

  const filteredTotalMontant = useMemo(() => {
    return Object.values(filteredEcheancesParMois)
      .flat()
      .reduce((sum, e) => sum + e.montant, 0);
  }, [filteredEcheancesParMois]);

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(montant);
  };

  const getModeleBadge = (modele: string) => {
    switch (modele) {
      case 'Succès':
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 border-emerald-200">Au Succès</Badge>;
      case 'Statique':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 border-blue-200">Statique</Badge>;
      case 'Estimation':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">Estimation</Badge>;
      default:
        return <Badge variant="outline">Non défini</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const moisKeys = Object.keys(filteredEcheancesParMois).sort();

  return (
    <div className="space-y-6">
      {/* KPI + Filtres */}
      <div className="flex flex-col md:flex-row gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 flex-1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CA prévisionnel (6 mois)</p>
                <p className="text-3xl font-bold text-primary">{formatMontant(filteredTotalMontant)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:w-80">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtres</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterModele} onValueChange={setFilterModele}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Modèle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous modèles</SelectItem>
                  <SelectItem value="Succès">Au Succès</SelectItem>
                  <SelectItem value="Statique">Statique</SelectItem>
                  <SelectItem value="Estimation">Estimation</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPeriodicite} onValueChange={setFilterPeriodicite}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Périodicité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="mensuel">Mensuel</SelectItem>
                  <SelectItem value="trimestriel">Trimestriel</SelectItem>
                  <SelectItem value="semestriel">Semestriel</SelectItem>
                  <SelectItem value="annuel">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Échéances par mois */}
      {moisKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarClock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Aucune échéance à venir</p>
            <p className="text-sm text-muted-foreground/70">
              {filterModele !== "all" || filterPeriodicite !== "all" 
                ? "Essayez de modifier les filtres" 
                : "Les établissements en production généreront des échéances automatiquement"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {moisKeys.map((key) => {
            const echeances = filteredEcheancesParMois[key];
            const totalMois = echeances.reduce((sum, e) => sum + e.montant, 0);
            const isExpanded = expandedMonths.includes(key);
            const moisDate = new Date(key + '-01');
            const moisLabel = format(moisDate, 'MMMM yyyy', { locale: fr });
            const isCurrentMonth = key === format(new Date(), 'yyyy-MM');

            return (
              <Card key={key} className={cn(isCurrentMonth && "ring-2 ring-primary/20")}>
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleMonth(key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        isCurrentMonth ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <CalendarClock className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg capitalize flex items-center gap-2">
                          {moisLabel}
                          {isCurrentMonth && <Badge variant="default" className="text-xs">Mois en cours</Badge>}
                        </CardTitle>
                        <CardDescription>
                          {echeances.length} échéance{echeances.length > 1 ? 's' : ''} à facturer
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold text-foreground">{formatMontant(totalMois)}</p>
                      <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="divide-y">
                      {echeances.map((echeance, idx) => (
                        <div 
                          key={`${echeance.etablissement.etablissement_id}-${echeance.type}-${idx}`}
                          className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{echeance.etablissement.nom}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {getModeleBadge(echeance.etablissement.modele)}
                                {echeance.etablissement.pallier_vise && (
                                  <Badge variant="outline" className="text-xs">{echeance.etablissement.pallier_vise}</Badge>
                                )}
                                <span className="text-xs text-muted-foreground capitalize">{echeance.etablissement.periodicite}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold text-lg">{formatMontant(echeance.montant)}</p>
                              <p className="text-xs text-muted-foreground">{echeance.libelle}</p>
                            </div>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); onGenerateFacture?.(echeance); }}>
                              <FileText className="h-4 w-4 mr-2" />
                              Générer
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {echeances.length > 1 && (
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <Button variant="outline" onClick={() => echeances.forEach(e => onGenerateFacture?.(e))}>
                          <Receipt className="h-4 w-4 mr-2" />
                          Générer toutes ({echeances.length})
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
