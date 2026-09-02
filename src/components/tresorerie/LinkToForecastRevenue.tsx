import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link2, Unlink, Search, Building2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { QontoCredit, ForecastRevenue } from "@/hooks/tresorerie/useQontoCredits";

interface LinkToForecastRevenueProps {
  credit: QontoCredit;
  forecastRevenus: ForecastRevenue[];
  onLink: (operationId: string, recetteId: string) => void;
  onUnlink: (operationId: string, recetteId: string) => void;
  isLinking: boolean;
}

export function LinkToForecastRevenue({
  credit,
  forecastRevenus,
  onLink,
  onUnlink,
  isLinking,
}: LinkToForecastRevenueProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const formatMontant = (value: number | null) =>
    value ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value) : "-";

  // Sort forecast revenues by proximity to the credit amount and date
  const sortedRevenus = useMemo(() => {
    let filtered = forecastRevenus;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.etablissement_nom?.toLowerCase().includes(s) ||
          r.notes?.toLowerCase().includes(s) ||
          String(r.montant_prevu).includes(s)
      );
    }

    return [...filtered].sort((a, b) => {
      const diffA = Math.abs((a.montant_prevu || 0) - credit.montant);
      const diffB = Math.abs((b.montant_prevu || 0) - credit.montant);
      if (diffA !== diffB) return diffA - diffB;
      const creditDate = new Date(credit.date_operation).getTime();
      const dateA = Math.abs(new Date(a.mois).getTime() - creditDate);
      const dateB = Math.abs(new Date(b.mois).getTime() - creditDate);
      return dateA - dateB;
    });
  }, [forecastRevenus, credit.montant, credit.date_operation, search]);

  // If already linked, show the establishment name
  if (credit.recette_previsionnelle) {
    const rp = credit.recette_previsionnelle;
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="secondary" className="text-xs truncate max-w-[200px] gap-1">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{rp.etablissement_nom || "Recette"}</span>
          <span className="text-muted-foreground shrink-0">
            ({formatMontant(rp.montant_prevu)})
          </span>
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onUnlink(credit.id, rp.id)}
          disabled={isLinking}
          title="Délier" aria-label="Supprimer le lien">
          <Unlink className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Link2 className="h-3 w-3" />
          Relier
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="p-3 border-b">
          <p className="text-sm font-medium mb-2">Relier à une recette prévisionnelle</p>
          <p className="text-xs text-muted-foreground mb-2">
            Virement : {formatMontant(credit.montant)} le {format(parseISO(credit.date_operation), "dd/MM/yyyy")}
          </p>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {sortedRevenus.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune recette prévisionnelle disponible
            </p>
          ) : (
            sortedRevenus.map((rev) => {
              const amountMatch = rev.montant_prevu === credit.montant;
              return (
                <button
                  key={rev.id}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-b-0 transition-colors disabled:opacity-50"
                  onClick={() => {
                    onLink(credit.id, rev.id);
                    setOpen(false);
                  }}
                  disabled={isLinking}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {rev.etablissement_nom || "Sans établissement"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(rev.mois), "MMMM yyyy", { locale: fr })}
                        {rev.type_revenu && ` · ${rev.type_revenu}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-medium ${amountMatch ? "text-primary" : ""}`}>
                        {formatMontant(rev.montant_prevu)}
                      </p>
                      {amountMatch && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                          Montant identique
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
