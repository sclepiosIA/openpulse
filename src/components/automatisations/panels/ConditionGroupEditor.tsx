import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

type Leaf = { field: string; operator: string; value?: any };
type Group = { all?: any[]; any?: any[] };
type Cfg = Leaf | Group;

const OPS = [
  ['equals', '= égal'], ['not_equals', '≠ différent'], ['contains', 'contient'],
  ['not_contains', 'ne contient pas'], ['greater_than', '> sup.'], ['less_than', '< inf.'],
  ['is_empty', 'est vide'], ['is_not_empty', 'non vide'], ['in', 'dans (CSV)'],
] as const;

function isGroup(c: any): c is Group {
  return c && (Array.isArray(c.all) || Array.isArray(c.any));
}
function isLeaf(c: any): c is Leaf {
  return c && typeof c === 'object' && !isGroup(c) && ('field' in c || 'operator' in c);
}

interface Props {
  value: Cfg;
  onChange: (v: Cfg) => void;
  depth?: number;
}

export function ConditionGroupEditor({ value, onChange, depth = 0 }: Props) {
  // Promotion : leaf seul -> groupe { all: [leaf] } pour permettre l'ajout
  const promote = () => {
    if (isLeaf(value)) onChange({ all: [value] });
    else if (!isGroup(value)) onChange({ all: [{ field: '', operator: 'equals', value: '' }] });
  };

  // Cas vide initial
  if (!isGroup(value) && !isLeaf(value)) {
    return (
      <div className="space-y-2">
        <LeafEditor value={{ field: '', operator: 'equals', value: '' }} onChange={(l) => onChange(l)} />
        <Button size="sm" variant="outline" className="w-full" onClick={promote}>
          <Plus className="h-3 w-3 mr-1" /> Convertir en groupe ET/OU
        </Button>
      </div>
    );
  }

  if (isLeaf(value)) {
    return (
      <div className="space-y-2">
        <LeafEditor value={value} onChange={onChange} />
        <Button size="sm" variant="outline" className="w-full" onClick={promote}>
          <Plus className="h-3 w-3 mr-1" /> Ajouter une autre règle (ET/OU)
        </Button>
      </div>
    );
  }

  // Group
  const isAll = Array.isArray(value.all);
  const items = (isAll ? value.all : value.any) || [];

  const setMode = (mode: 'all' | 'any') => {
    onChange(mode === 'all' ? { all: items } : { any: items });
  };
  const updateItem = (i: number, v: Cfg) => {
    const next = items.slice();
    next[i] = v;
    onChange(isAll ? { all: next } : { any: next });
  };
  const addRule = () => {
    const next = [...items, { field: '', operator: 'equals', value: '' }];
    onChange(isAll ? { all: next } : { any: next });
  };
  const addGroup = () => {
    const next = [...items, { all: [{ field: '', operator: 'equals', value: '' }] }];
    onChange(isAll ? { all: next } : { any: next });
  };
  const removeAt = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange(isAll ? { all: next } : { any: next });
  };

  return (
    <div className={`rounded border p-2 space-y-2 ${depth > 0 ? 'bg-muted/30' : ''}`}>
      <div className="flex items-center gap-2">
        <Label className="text-xs">Logique</Label>
        <Select value={isAll ? 'all' : 'any'} onValueChange={(v) => setMode(v as 'all' | 'any')}>
          <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ET (toutes vraies)</SelectItem>
            <SelectItem value="any">OU (au moins une)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1">
          <div className="flex-1">
            <ConditionGroupEditor value={item} onChange={(v) => updateItem(i, v)} depth={depth + 1} />
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeAt(i)} aria-label="Supprimer">
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={addRule}>
          <Plus className="h-3 w-3 mr-1" /> Règle
        </Button>
        {depth < 2 && (
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={addGroup}>
            <Plus className="h-3 w-3 mr-1" /> Sous-groupe
          </Button>
        )}
      </div>
    </div>
  );
}

function LeafEditor({ value, onChange }: { value: Leaf; onChange: (v: Leaf) => void }) {
  const noValueOp = value.operator === 'is_empty' || value.operator === 'is_not_empty';
  return (
    <div className="space-y-1.5">
      <Input
        value={value.field || ''}
        onChange={(e) => onChange({ ...value, field: e.target.value })}
        placeholder="ex: trigger.statut_new"
        className="h-8 text-xs"
      />
      <Select value={value.operator || 'equals'} onValueChange={(v) => onChange({ ...value, operator: v })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {OPS.map(([k, label]) => (
            <SelectItem key={k} value={k}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!noValueOp && (
        <Input
          value={String(value.value ?? '')}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
          placeholder="Valeur"
          className="h-8 text-xs"
        />
      )}
    </div>
  );
}
