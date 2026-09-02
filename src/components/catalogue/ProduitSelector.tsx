import { useState, useMemo, useEffect } from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCatalogueProduits } from "@/hooks/catalogue/useCatalogueProduits";
import type { CatalogueProduit } from "@/types/facturation";
import { PRODUIT_TYPE_LABELS } from "@/types/facturation";

interface ProduitSelectorProps {
  value?: string | null;
  onSelect: (produit: CatalogueProduit | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filterType?: CatalogueProduit['type'];
}

export function ProduitSelector({
  value,
  onSelect,
  placeholder = "Sélectionner un produit…",
  disabled,
  className,
  filterType,
}: ProduitSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const { produits, isLoading } = useCatalogueProduits();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const selected = useMemo(
    () => produits.find((p) => p.id === value) ?? null,
    [produits, value]
  );

  const filtered = useMemo(() => {
    let list = produits;
    if (filterType) list = list.filter((p) => p.type === filterType);
    if (debounced) {
      const q = debounced.toLowerCase();
      list = list.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.nom.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 50);
  }, [produits, debounced, filterType]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">
              {selected ? `${selected.code} — ${selected.nom}` : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher (code, nom)…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Aucun produit trouvé</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear"
                  onSelect={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Effacer la sélection
                </CommandItem>
              )}
              {filtered.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === p.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                      <span className="font-medium truncate">{p.nom}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {PRODUIT_TYPE_LABELS[p.type]} ·{" "}
                      {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(p.prix_unitaire_ht)}{" "}
                      / {p.unite} · TVA {p.taux_tva}%
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
