import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, X, ArrowDownUp } from 'lucide-react';
import type { ChurnRiskLevel } from '@/hooks/csm/useChurnPredictions';

export type ChurnSortKey = 'score' | 'name' | 'predicted_at';

export interface ChurnFiltersState {
  search: string;
  risks: ChurnRiskLevel[];
  csms: string[];
  offres: string[];
  minScore: number;
  sort: ChurnSortKey;
}

interface Props {
  filters: ChurnFiltersState;
  onChange: (f: ChurnFiltersState) => void;
  csmOptions: Array<{ id: string; label: string }>;
  offreOptions: string[];
}

const RISK_LABELS: Record<ChurnRiskLevel, string> = {
  critical: '🔴 Critique', high: '🟠 Élevé', medium: '🟡 Modéré', low: '🟢 Faible',
};
const SORT_LABELS: Record<ChurnSortKey, string> = {
  score: 'Score', name: 'Nom', predicted_at: 'Calculé le',
};

export function ChurnFiltersBar({ filters, onChange, csmOptions, offreOptions }: Props) {
  const toggle = <K extends keyof ChurnFiltersState>(key: K, val: any) => {
    const arr = (filters[key] as any) as any[];
    if (arr.includes(val)) onChange({ ...filters, [key]: arr.filter(x => x !== val) });
    else onChange({ ...filters, [key]: [...arr, val] });
  };

  const reset = () => onChange({
    search: '', risks: [], csms: [], offres: [], minScore: 0, sort: 'score',
  });

  const activeCount = (filters.search ? 1 : 0) + filters.risks.length + filters.csms.length + filters.offres.length + (filters.minScore > 0 ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2 sticky top-0 z-10 bg-background/80 backdrop-blur py-2 border-b">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          placeholder="Rechercher un compte…"
          className="pl-8 h-9"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" /> Risque
            {filters.risks.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{filters.risks.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2">
          {(Object.keys(RISK_LABELS) as ChurnRiskLevel[]).map(k => (
            <label key={k} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer text-sm">
              <Checkbox checked={filters.risks.includes(k)} onCheckedChange={() => toggle('risks', k)} />
              <span>{RISK_LABELS[k]}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>

      {csmOptions.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5" /> CSM
              {filters.csms.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{filters.csms.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 max-h-72 overflow-y-auto">
            {csmOptions.map(o => (
              <label key={o.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox checked={filters.csms.includes(o.id)} onCheckedChange={() => toggle('csms', o.id)} />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {offreOptions.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5" /> Offre
              {filters.offres.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{filters.offres.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 max-h-72 overflow-y-auto">
            {offreOptions.map(o => (
              <label key={o} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox checked={filters.offres.includes(o)} onCheckedChange={() => toggle('offres', o)} />
                <span className="truncate">{o}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>
      )}

      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-xs text-muted-foreground">Score ≥</span>
        <Input
          type="number"
          min={0}
          max={100}
          value={filters.minScore}
          onChange={e => onChange({ ...filters, minScore: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
          className="h-9 w-16"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 ml-auto">
            <ArrowDownUp className="h-3.5 w-3.5 mr-1.5" /> Tri : {SORT_LABELS[filters.sort]}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2">
          {(Object.keys(SORT_LABELS) as ChurnSortKey[]).map(k => (
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
