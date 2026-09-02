import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface TarifsPalliers {
  palier1?: number;
  palier2?: number;
  palier3?: number;
  palier4?: number;
}

interface MontantPrevuSelectorProps {
  value: number | null;
  onSave: (montant: number) => void;
  tarifsPalliers?: TarifsPalliers | null;
  periodicite?: "mensuel" | "trimestriel" | "semestriel" | "annuel";
  dureeMois?: number;
  formatDisplay?: (v: number | null) => string;
}

const PERIODICITE_DIVISORS: Record<string, number> = {
  mensuel: 12,
  trimestriel: 4,
  semestriel: 2,
  annuel: 1,
};

const SUBDIVISION_OPTIONS = [
  { key: "trimestriel", label: "Trimestriel", divisor: 4 },
  { key: "semestriel", label: "Semestriel", divisor: 2 },
  { key: "annuel", label: "Annuel", divisor: 1 },
];

function formatCurrencyCompact(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

export function MontantPrevuSelector({
  value,
  onSave,
  tarifsPalliers,
  periodicite = "mensuel",
  dureeMois,
  formatDisplay,
}: MontantPrevuSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const displayValue = formatDisplay
    ? formatDisplay(value)
    : value != null
    ? formatCurrencyCompact(value)
    : "-";

  const currentDivisor = dureeMois ? (12 / dureeMois) : (PERIODICITE_DIVISORS[periodicite] || 12);

  // Build palier options from tarifs_palliers
  const palierOptions = tarifsPalliers
    ? ([1, 2, 3, 4] as const)
        .map((n) => {
          const annualAmount = tarifsPalliers[`palier${n}` as keyof TarifsPalliers];
          if (!annualAmount || annualAmount <= 0) return null;
          const periodAmount = annualAmount / currentDivisor;
          return { label: `Palier ${n}`, annualAmount, periodAmount };
        })
        .filter(Boolean) as { label: string; annualAmount: number; periodAmount: number }[]
    : [];

  // Estimate annual amount from current value to compute subdivisions
  const estimatedAnnual = value != null && value > 0 ? value * currentDivisor : null;

  const handleSelect = (montant: number) => {
    onSave(Math.round(montant * 100) / 100);
    setOpen(false);
  };

  const handleCustomSave = () => {
    const parsed = parseFloat(customValue.replace(/\s/g, "").replace(",", "."));
    if (!isNaN(parsed) && parsed >= 0) {
      handleSelect(parsed);
    }
    setCustomValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "group/cell flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors"
          )}
          title="Cliquer pour choisir un palier ou saisir un montant"
        >
          <span className="font-medium">{displayValue}</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        {/* Paliers section */}
        {palierOptions.length > 0 && (
          <div className="p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Paliers
            </p>
            {palierOptions.map((opt) => (
              <button
                key={opt.label}
                className={cn(
                  "w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/70 transition-colors",
                  value != null && Math.abs(value - opt.periodAmount) < 0.01 && "bg-primary/10 text-primary font-medium"
                )}
                onClick={() => handleSelect(opt.periodAmount)}
              >
                <span>{opt.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrencyCompact(opt.periodAmount)}
                  <span className="text-[10px] ml-1 opacity-60">
                    ({formatCurrencyCompact(opt.annualAmount)}/an{dureeMois ? ` · ${dureeMois} mois` : ''})
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Subdivisions section */}
        {estimatedAnnual != null && estimatedAnnual > 0 && (
          <>
            {palierOptions.length > 0 && <Separator />}
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Subdivisions
              </p>
              {SUBDIVISION_OPTIONS.map((sub) => {
                const subAmount = estimatedAnnual / sub.divisor;
                return (
                  <button
                    key={sub.key}
                    className={cn(
                      "w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/70 transition-colors",
                      value != null && Math.abs(value - subAmount) < 0.01 && "bg-primary/10 text-primary font-medium"
                    )}
                    onClick={() => handleSelect(subAmount)}
                  >
                    <span>{sub.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrencyCompact(subAmount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Custom input */}
        <Separator />
        <div className="p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Montant libre
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Ex: 5 000"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomSave();
                if (e.key === "Escape") setOpen(false);
              }}
              className="h-8 text-sm"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={handleCustomSave} aria-label="Valider">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
