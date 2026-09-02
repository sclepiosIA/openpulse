/**
 * Formatage conditionnel : règles simples (> < = between + top/bottom N).
 * Renvoie un tableau de règles à évaluer côté rendu.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';

export type CfOp = 'gt' | 'lt' | 'eq' | 'between' | 'contains';

export interface CfRule {
  id: string;
  range: string;
  op: CfOp;
  a: string;
  b?: string;
  bgColor: string;
  textColor?: string;
  bold?: boolean;
}

function parseA1(range: string) {
  const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!m) return null;
  const col = (s: string) => s.toUpperCase().split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
  return { c1: col(m[1]), r1: parseInt(m[2]) - 1, c2: col(m[3]), r2: parseInt(m[4]) - 1 };
}

export function evaluateCfRule(rule: CfRule, cellKey: string, value: string): boolean {
  const m = cellKey.match(/^([A-Z]+)(\d+)$/);
  if (!m) return false;
  const col = m[1].split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const row = parseInt(m[2]) - 1;
  const p = parseA1(rule.range);
  if (!p) return false;
  if (row < p.r1 || row > p.r2 || col < p.c1 || col > p.c2) return false;
  const n = parseFloat(value);
  const a = parseFloat(rule.a);
  const b = rule.b !== undefined ? parseFloat(rule.b) : NaN;
  switch (rule.op) {
    case 'gt': return isFinite(n) && isFinite(a) && n > a;
    case 'lt': return isFinite(n) && isFinite(a) && n < a;
    case 'eq': return value === rule.a || (isFinite(n) && isFinite(a) && n === a);
    case 'between': return isFinite(n) && isFinite(a) && isFinite(b) && n >= a && n <= b;
    case 'contains': return value.toLowerCase().includes(rule.a.toLowerCase());
  }
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rules: CfRule[];
  onChange: (r: CfRule[]) => void;
}

export function ConditionalFormattingDialog({ open, onOpenChange, rules, onChange }: Props) {
  const [local, setLocal] = useState<CfRule[]>(rules);

  const addRule = () => {
    setLocal([...local, {
      id: crypto.randomUUID(),
      range: 'A1:A10',
      op: 'gt',
      a: '0',
      bgColor: '#fef3c7',
    }]);
  };

  const updateRule = (id: string, patch: Partial<CfRule>) => {
    setLocal(local.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Formatage conditionnel</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[400px] overflow-auto">
          {local.length === 0 && (
            <div className="text-xs text-muted-foreground py-4 text-center">Aucune règle. Cliquez sur « Ajouter » pour en créer une.</div>
          )}
          {local.map((r) => (
            <div key={r.id} className="grid grid-cols-[100px_100px_1fr_1fr_60px_60px_auto] gap-1 items-end border rounded p-2">
              <div>
                <Label className="text-[10px]">Plage</Label>
                <Input value={r.range} onChange={(e) => updateRule(r.id, { range: e.target.value.toUpperCase() })} className="h-8 font-mono text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Opérateur</Label>
                <Select value={r.op} onValueChange={(v) => updateRule(r.id, { op: v as CfOp })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gt">&gt;</SelectItem>
                    <SelectItem value="lt">&lt;</SelectItem>
                    <SelectItem value="eq">=</SelectItem>
                    <SelectItem value="between">entre</SelectItem>
                    <SelectItem value="contains">contient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Valeur</Label>
                <Input value={r.a} onChange={(e) => updateRule(r.id, { a: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Valeur 2</Label>
                <Input
                  value={r.b || ''}
                  onChange={(e) => updateRule(r.id, { b: e.target.value })}
                  disabled={r.op !== 'between'}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">Fond</Label>
                <input type="color" value={r.bgColor} onChange={(e) => updateRule(r.id, { bgColor: e.target.value })} className="h-8 w-full" />
              </div>
              <div>
                <Label className="text-[10px]">Texte</Label>
                <input type="color" value={r.textColor || '#000000'} onChange={(e) => updateRule(r.id, { textColor: e.target.value })} className="h-8 w-full" />
              </div>
              <Button size="sm" variant="ghost" onClick={() => setLocal(local.filter((x) => x.id !== r.id))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={addRule} className="gap-1"><Plus className="h-3.5 w-3.5" /> Ajouter</Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => { onChange(local); onOpenChange(false); }}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
