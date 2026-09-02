import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

import { Search, Filter, X, ArrowDownUp } from 'lucide-react';
import { useMemo } from 'react';

export type TierKey = 'hot' | 'warm' | 'working' | 'cold';
export type SortKey = 'score' | 'velocity' | 'last' | 'mrr';

interface Owner { id: string; prenom: string | null; nom: string | null; email: string | null }

export interface ScoringFiltersState {
  search: string;
  tiers: TierKey[];
  owners: string[];          // user_ids
  statuts: string[];         // statut labels
  onlySnoozed: boolean;
  onlyOrphans: boolean;
  sort: SortKey;
}

interface Props {
  filters: ScoringFiltersState;
  onChange: (f: ScoringFiltersState) => void;
  ownersList: Owner[];
  statutsList: string[];
}

const TIER_LABELS: Record<TierKey, string> = {
  hot: '🔥 Chauds (≥80)', warm: '🌡️ Tièdes (60-79)', working: '⚙️ À travailler (40-59)', cold: '❄️ Froids (<40)',
};
const SORT_LABELS: Record<SortKey, string> = {
  score: 'Score', velocity: 'Vélocité', last: 'Dernier signal', mrr: 'MRR potentiel',
};

export function ScoringFiltersBar({ filters, onChange, ownersList, statutsList }: Props) {
  const ownerLabel = useMemo(() => {
    if (filters.owners.length === 0) return 'Tous';
    if (filters.owners.length === 1) {
      const o = ownersList.find(x => x.id === filters.owners[0]);
      return o ? `${o.prenom ?? ''} ${o.nom ?? ''}`.trim() || o.email : '1 sélectionné';
    }
    return `${filters.owners.length} sélectionnés`;
  }, [filters.owners, ownersList]);

  const toggle = <K extends keyof ScoringFiltersState>(key: K, val: any) => {
    const arr = (filters[key] as any) as any[];
    if (arr.includes(val)) onChange({ ...filters, [key]: arr.filter(x => x !== val) });
    else onChange({ ...filters, [key]: [...arr, val] });
  };

  const reset = () => onChange({
    search: '', tiers: [], owners: [], statuts: [],
    onlySnoozed: false, onlyOrphans: false, sort: 'score',
  });

  const activeCount =
    (filters.search ? 1 : 0) + filters.tiers.length + filters.owners.length + filters.statuts.length +
    (filters.onlySnoozed ? 1 : 0) + (filters.onlyOrphans ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2 sticky top-0 z-10 bg-background/80 backdrop-blur py-2 border-b">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          placeholder="Rechercher un prospect…"
          className="pl-8 h-9"
        />
      </div>

      {/* Tier */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" /> Tier
            {filters.tiers.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{filters.tiers.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2">
          {(Object.keys(TIER_LABELS) as TierKey[]).map(k => (
            <label key={k} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer text-sm">
              <Checkbox checked={filters.tiers.includes(k)} onCheckedChange={() => toggle('tiers', k)} />
              <span>{TIER_LABELS[k]}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>

      {/* Owner */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" /> Owner : {ownerLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 max-h-80 overflow-y-auto">
          {ownersList.map(o => {
            const label = `${o.prenom ?? ''} ${o.nom ?? ''}`.trim() || o.email || o.id.slice(0, 8);
            return (
              <label key={o.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox checked={filters.owners.includes(o.id)} onCheckedChange={() => toggle('owners', o.id)} />
                <span className="truncate">{label}</span>
              </label>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Statut */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" /> Phase
            {filters.statuts.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{filters.statuts.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 max-h-80 overflow-y-auto">
          {statutsList.map(s => (
            <label key={s} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer text-sm">
              <Checkbox checked={filters.statuts.includes(s)} onCheckedChange={() => toggle('statuts', s)} />
              <span>{s}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>

      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={filters.onlySnoozed} onCheckedChange={v => onChange({ ...filters, onlySnoozed: !!v })} />
        Snoozés
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={filters.onlyOrphans} onCheckedChange={v => onChange({ ...filters, onlyOrphans: !!v })} />
        Sans owner
      </label>

      {/* Sort */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 ml-auto">
            <ArrowDownUp className="h-3.5 w-3.5 mr-1.5" /> Tri : {SORT_LABELS[filters.sort]}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2">
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
            <button
              key={k}
              onClick={() => onChange({ ...filters, sort: k })}
              className={`block w-full text-left py-1.5 px-2 rounded hover:bg-muted text-sm ${filters.sort === k ? 'bg-muted font-medium' : ''}`}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="h-9" onClick={reset}>
          <X className="h-3.5 w-3.5 mr-1" /> Réinitialiser
        </Button>
      )}
    </div>
  );
}
