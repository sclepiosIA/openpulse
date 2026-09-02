import { useEffect, useMemo, useRef, useState } from "react";
import { useFacturationPeriodes, FacturationPeriode } from "@/hooks/billing/useFacturationPeriodes";
import { useEtablissementGroupeFacturation } from "@/hooks/crm/useEtablissementGroupeFacturation";
import { useQuery } from "@tanstack/react-query";
import { parseISO, isBefore, startOfMonth, isSameMonth, differenceInMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, PenLine, ChevronDown, TrendingUp, Clock, AlertTriangle, Wallet, MoreVertical, Trash2 } from "lucide-react";
import { EditableCell } from "@/components/tresorerie/EditableCell";
import { MontantPrevuSelector } from "@/components/etablissement/MontantPrevuSelector";
import { EditableDateCell } from "@/components/csm/EditableDateCell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  etablissementId: string;
  etablissement: any;
}

// Flatten all periodes for cascade lookups across year groups
function getAllSortedPeriodes(periodes: FacturationPeriode[]): FacturationPeriode[] {
  return [...periodes].sort((a, b) => a.date_debut.localeCompare(b.date_debut));
}

const STATUT_CONFIG: Record<string, { label: string; className: string }> = {
  prevue: { label: "Prévue", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  facturee: { label: "Facturée", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  encaissee: { label: "Encaissée", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
  en_retard: { label: "En retard", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800" },
};

const STATUT_OPTIONS = [
  { value: "prevue", label: "Prévue" },
  { value: "facturee", label: "Facturée" },
  { value: "encaissee", label: "Encaissée" },
  { value: "en_retard", label: "En retard" },
];

type FilterType = "tous" | "prevue" | "facturee" | "encaissee" | "en_retard";

function formatCurrency(v: number | null): string {
  if (v == null) return "-";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function formatCurrencyFull(v: number | null): string {
  if (v == null) return "-";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
}

// --- KPI Cards ---
function KpiCards({ periodes }: { periodes: FacturationPeriode[] }) {
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const periodesAnneeEnCours = periodes.filter(p => new Date(p.date_debut).getFullYear() === currentYear);
    const totalPrevu = periodesAnneeEnCours.reduce((s, p) => s + (p.montant_prevu || 0), 0);
    const totalEncaisse = periodes.filter(p => p.statut === "encaissee").reduce((s, p) => s + (p.montant_percu ?? p.montant_prevu ?? 0), 0);
    const enAttente = periodes.filter(p => p.statut === "facturee");
    const enRetard = periodes.filter(p => p.statut === "en_retard");
    const montantAttente = enAttente.reduce((s, p) => s + (p.montant_prevu || 0), 0);
    const montantRetard = enRetard.reduce((s, p) => s + (p.montant_prevu || 0), 0);
    const pctEncaisse = totalPrevu > 0 ? Math.round((totalEncaisse / totalPrevu) * 100) : 0;

    return { totalPrevu, totalEncaisse, pctEncaisse, montantAttente, countAttente: enAttente.length, montantRetard, countRetard: enRetard.length, periodesAnneeCount: periodesAnneeEnCours.length, currentYear };
  }, [periodes]);

  const cards = [
    { label: "Total annuel prévu", value: formatCurrency(stats.totalPrevu), sub: `${stats.periodesAnneeCount} période${stats.periodesAnneeCount > 1 ? "s" : ""} en ${stats.currentYear}`, icon: TrendingUp, color: "text-primary" },
    { label: "Encaissé", value: formatCurrency(stats.totalEncaisse), sub: `${stats.pctEncaisse}% du total`, icon: Wallet, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "En attente", value: formatCurrency(stats.montantAttente), sub: `${stats.countAttente} période${stats.countAttente > 1 ? "s" : ""}`, icon: Clock, color: "text-amber-600 dark:text-amber-400" },
    { label: "En retard", value: formatCurrency(stats.montantRetard), sub: `${stats.countRetard} période${stats.countRetard > 1 ? "s" : ""}`, icon: AlertTriangle, color: stats.countRetard > 0 ? "text-destructive" : "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</span>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </div>
            <p className="text-lg font-bold tracking-tight">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Filter bar ---
function FilterBar({ filter, onChange, counts }: { filter: FilterType; onChange: (f: FilterType) => void; counts: Record<FilterType, number> }) {
  const filters: { key: FilterType; label: string }[] = [
    { key: "tous", label: "Tous" },
    { key: "prevue", label: "Prévues" },
    { key: "facturee", label: "Facturées" },
    { key: "encaissee", label: "Encaissées" },
    { key: "en_retard", label: "En retard" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => (
        <Button
          key={f.key}
          variant={filter === f.key ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => onChange(f.key)}
        >
          {f.label}
          <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] px-1.5 text-[10px]">
            {counts[f.key]}
          </Badge>
        </Button>
      ))}
    </div>
  );
}

// --- Status Badge (clickable with dropdown) ---
function StatusBadge({ statut, onSave }: { statut: string; onSave: (v: string) => void }) {
  const cfg = STATUT_CONFIG[statut] || STATUT_CONFIG.prevue;
  return (
    <Select value={statut} onValueChange={onSave}>
      <SelectTrigger className="h-auto border-0 p-0 shadow-none focus:ring-0 w-auto">
        <Badge variant="outline" className={cn("cursor-pointer text-xs font-medium border", cfg.className)}>
          {cfg.label}
        </Badge>
      </SelectTrigger>
      <SelectContent>
        {STATUT_OPTIONS.map((opt) => {
          const optCfg = STATUT_CONFIG[opt.value];
          return (
            <SelectItem key={opt.value} value={opt.value}>
              <span className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full", optCfg?.className?.split(" ")[0])} />
                {opt.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// --- Year accordion ---
function YearGroup({
  year,
  periodes,
  defaultOpen,
  today,
  updatePeriode,
  onDelete,
  etablissement,
  allPeriodes,
  cascadeFromPeriode,
}: {
  year: number;
  periodes: FacturationPeriode[];
  defaultOpen: boolean;
  today: Date;
  updatePeriode: any;
  onDelete: (id: string) => void;
  etablissement: any;
  allPeriodes: FacturationPeriode[];
  cascadeFromPeriode: (id: string) => Promise<void>;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  const totalPrevu = periodes.reduce((s, p) => s + (p.montant_prevu || 0), 0);
  const totalEncaisse = periodes.filter(p => p.statut === "encaissee").reduce((s, p) => s + (p.montant_percu ?? p.montant_prevu ?? 0), 0);
  const pct = totalPrevu > 0 ? Math.round((totalEncaisse / totalPrevu) * 100) : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group">
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          <span className="font-semibold text-sm">{year}</span>
          <span className="text-xs text-muted-foreground">
            {periodes.length} période{periodes.length > 1 ? "s" : ""}
          </span>
          <div className="flex-1 flex items-center gap-3 ml-auto max-w-xs">
            <Progress value={pct} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {formatCurrency(totalEncaisse)} / {formatCurrency(totalPrevu)}
            </span>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border rounded-lg mt-2 overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground w-[22%]">Période</th>
                <th className="text-right p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground w-[12%]">Prévu</th>
                <th className="text-right p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground w-[12%]">Perçu</th>
                <th className="text-center p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground w-[12%]">Date facture</th>
                <th className="text-center p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground w-[12%]">Date virement</th>
                <th className="text-center p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground w-[12%]">Statut</th>
                <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground w-[13%]">Notes</th>
                <th className="p-3 w-[5%]"></th>
              </tr>
            </thead>
            <tbody>
              {periodes.map((p) => {
                const debut = parseISO(p.date_debut);
                const isPast = isBefore(debut, today);
                const isCurrent = isSameMonth(debut, today);
                const isOverdue = p.statut === "en_retard";

                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b last:border-b-0 transition-colors",
                      p.type_periode === "forfait_initial" && "bg-accent/10 border-l-2 border-l-accent",
                      isCurrent && p.type_periode !== "forfait_initial" && "bg-primary/5 border-l-2 border-l-primary",
                      isOverdue && !isCurrent && p.type_periode !== "forfait_initial" && "bg-destructive/5 border-l-2 border-l-destructive",
                      isPast && !isCurrent && !isOverdue && p.type_periode !== "forfait_initial" && "bg-muted/15 text-muted-foreground",
                      !isPast && !isCurrent && !isOverdue && p.type_periode !== "forfait_initial" && "hover:bg-muted/20"
                    )}
                  >
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                        {p.type_periode === "forfait_initial" ? (
                          <Badge variant="outline" className="bg-accent/50 text-accent-foreground border-accent text-xs font-medium">
                            Forfait initial
                          </Badge>
                        ) : (
                          <>
                            <EditableDateCell
                              value={p.date_debut}
                              onSave={async (v) => {
                                await updatePeriode.mutateAsync({ id: p.id, updates: { date_debut: v } });
                                await cascadeFromPeriode(p.id);
                              }}
                              displayFormat="dd MMM yyyy"
                            />
                            <span className="text-muted-foreground">→</span>
                            <EditableDateCell
                              value={p.date_fin}
                              onSave={async (v) => {
                                await updatePeriode.mutateAsync({ id: p.id, updates: { date_fin: v } });
                                await cascadeFromPeriode(p.id);
                              }}
                              displayFormat="dd MMM yyyy"
                            />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end">
                         <MontantPrevuSelector
                          value={p.montant_prevu}
                          onSave={(v) => updatePeriode.mutate({ id: p.id, updates: { montant_prevu: v } })}
                          tarifsPalliers={etablissement?.tarifs_palliers}
                          periodicite={(etablissement?.periodicite_paiement as any) || "mensuel"}
                          dureeMois={differenceInMonths(parseISO(p.date_fin), parseISO(p.date_debut)) + 1}
                          formatDisplay={(v) => formatCurrencyFull(Number(v))}
                        />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end">
                        <EditableCell
                          value={p.montant_percu}
                          type="currency"
                          onSave={(v) => updatePeriode.mutate({ id: p.id, updates: { montant_percu: Number(v) } })}
                          formatDisplay={(v) => v != null && v !== "" ? formatCurrencyFull(Number(v)) : "-"}
                          placeholder="-"
                        />
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <EditableDateCell
                        value={p.date_facture}
                        onSave={(v) => updatePeriode.mutate({ id: p.id, updates: { date_facture: v } })}
                        displayFormat="dd MMM yyyy"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <EditableDateCell
                        value={p.date_virement_estimee}
                        onSave={(v) => updatePeriode.mutate({ id: p.id, updates: { date_virement_estimee: v } })}
                        displayFormat="dd MMM yyyy"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge
                        statut={p.statut}
                        onSave={(v) => updatePeriode.mutate({ id: p.id, updates: { statut: v } })}
                      />
                    </td>
                    <td className="p-3 max-w-[200px]">
                      <EditableCell
                        value={p.notes}
                        type="text"
                        onSave={(v) => updatePeriode.mutate({ id: p.id, updates: { notes: String(v) } })}
                        placeholder="—"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {p.est_modifie_manuellement && (
                          <span title="Modifié manuellement"><PenLine className="h-3.5 w-3.5 text-warning inline-block" /></span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(p.id)} aria-label="Supprimer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette période ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. La période sera définitivement supprimée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteId) onDelete(deleteId);
                  setDeleteId(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CollapsibleContent>
    </Collapsible>
  );
}

// --- Main component ---
export function FacturationDetaillee({ etablissementId, etablissement }: Props) {
  const isGroupe = etablissement?.client_facturation === 'groupe';
  const { data: groupeData, groupeId } = useEtablissementGroupeFacturation(etablissementId, isGroupe);

  // Fetch all groupe member IDs for propagation
  const { data: groupeEtablissementIds } = useQuery({
    queryKey: ['groupe-facturation-etab-ids', groupeId],
    queryFn: async () => {
      if (!groupeId) return [];
      const { data: etabGroupes } = await supabase
        .from('etablissements_groupes')
        .select('etablissement_id')
        .eq('groupe_id', groupeId)
        .is('date_sortie', null);
      if (!etabGroupes) return [];
      const ids = etabGroupes.map(e => e.etablissement_id);
      const { data: etabs } = await supabase
        .from('etablissements')
        .select('id')
        .eq('client_facturation', 'groupe')
        .in('id', ids);
      return (etabs || []).map(e => e.id);
    },
    enabled: isGroupe && !!groupeId,
    staleTime: 5 * 60 * 1000,
  });

  // Build effective etablissement merging groupe config when applicable
  const effectiveEtablissement = useMemo(() => {
    if (!isGroupe || !groupeData) return etablissement;
    return {
      ...etablissement,
      periodicite_paiement: groupeData.periodicite_paiement || etablissement.periodicite_paiement,
      type_offre: groupeData.type_offre || etablissement.type_offre,
      pallier_vise: groupeData.pallier_vise || etablissement.pallier_vise,
      tarifs_palliers: groupeData.tarifs_palliers || etablissement.tarifs_palliers,
      modele_statique_succes: groupeData.modele_statique_succes || etablissement.modele_statique_succes,
      paiement_initial: groupeData.paiement_initial ?? etablissement.paiement_initial,
    };
  }, [etablissement, isGroupe, groupeData]);

  const { periodes, isLoading, syncPeriodes, updatePeriode, deletePeriode, regenererFutures, cascadeFromPeriode } = useFacturationPeriodes(etablissementId, effectiveEtablissement);
  const [filter, setFilter] = useState<FilterType>("tous");
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true;
      syncPeriodes();
    }
  }, [syncPeriodes]);

  const today = startOfMonth(new Date());
  const currentYear = new Date().getFullYear();

  const counts = useMemo(() => {
    const c: Record<FilterType, number> = { tous: periodes.length, prevue: 0, facturee: 0, encaissee: 0, en_retard: 0 };
    periodes.forEach((p) => {
      if (c[p.statut as FilterType] !== undefined) c[p.statut as FilterType]++;
    });
    return c;
  }, [periodes]);

  const filtered = useMemo(() => {
    if (filter === "tous") return periodes;
    return periodes.filter((p) => p.statut === filter);
  }, [periodes, filter]);

  const grouped = useMemo(() => {
    const map = new Map<number, FacturationPeriode[]>();
    filtered.forEach((p) => {
      const year = parseISO(p.date_debut).getFullYear();
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(p);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filtered]);

  const allPeriodesSorted = useMemo(() => getAllSortedPeriodes(periodes), [periodes]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`facturation-detaillee-card-skeleton-${i}`} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`facturation-detaillee-row-skeleton-${i}`} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (periodes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Aucune période de facturation générée.</p>
        <p className="text-sm mt-1">Vérifiez que le modèle économique et les dates de paiement sont renseignés.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <KpiCards periodes={periodes} />

      {/* Toolbar: filters + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <FilterBar filter={filter} onChange={setFilter} counts={counts} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <MoreVertical className="h-4 w-4 mr-1" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowRegenConfirm(true)} className="text-destructive focus:text-destructive">
              <RefreshCw className="h-4 w-4 mr-2" />
              Régénérer les périodes futures
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Year groups */}
      <div className="space-y-3">
        {grouped.map(([year, yearPeriodes]) => (
          <YearGroup
            key={year}
            year={year}
            periodes={yearPeriodes}
            defaultOpen={year === currentYear}
            today={today}
            updatePeriode={updatePeriode}
            onDelete={(id) => deletePeriode.mutate(id)}
            etablissement={effectiveEtablissement}
            allPeriodes={allPeriodesSorted}
            cascadeFromPeriode={cascadeFromPeriode}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Aucune période avec le filtre « {STATUT_CONFIG[filter]?.label || filter} »
        </div>
      )}

      {/* Confirm regeneration dialog */}
      <AlertDialog open={showRegenConfirm} onOpenChange={setShowRegenConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Régénérer les périodes futures ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action écrasera toutes les périodes « prévue » à partir de la dernière période déjà traitée, puis régénérera une projection continue sur 3 ans maximum.
              {isGroupe && groupeEtablissementIds && groupeEtablissementIds.length > 1 && (
                <span className="block mt-2 font-medium text-foreground">
                  ⚠️ La régénération sera propagée aux {groupeEtablissementIds.length} établissements du groupe en facturation commune.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                regenererFutures(isGroupe ? groupeEtablissementIds : undefined);
                setShowRegenConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Régénérer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
