import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Trash2, Copy } from 'lucide-react';
import { REPORT_SOURCES, type WidgetConfig, type ReportSourceKey } from '@/types/report';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  widget: WidgetConfig | null;
  onUpdate: (patch: Partial<WidgetConfig>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
}

export function BlockConfigPanel({ widget, onUpdate, onDelete, onDuplicate }: Props) {
  if (!widget) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Sélectionnez un bloc pour le configurer
      </div>
    );
  }

  const sourceMeta = widget.source ? REPORT_SOURCES.find(s => s.key === widget.source) : null;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Configuration</p>
          <div className="flex items-center gap-1">
            {onDuplicate && (
              <Button variant="ghost" size="icon" onClick={onDuplicate} className="h-7 w-7" title="Dupliquer" aria-label="Copier">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 text-destructive" title="Supprimer" aria-label="Supprimer">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Titre</Label>
          <Input value={widget.title} onChange={(e) => onUpdate({ title: e.target.value })} className="h-8 text-sm" />
        </div>

        {widget.type === 'markdown' ? (
          <div className="space-y-2">
            <Label className="text-xs">Contenu</Label>
            <Textarea value={widget.markdown || ''} onChange={(e) => onUpdate({ markdown: e.target.value })} rows={6} className="text-sm" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-xs">Source de données</Label>
              <Select value={widget.source} onValueChange={(v) => {
                const meta = REPORT_SOURCES.find(s => s.key === v);
                onUpdate({
                  source: v as ReportSourceKey,
                  dimension: meta?.dimensions[0],
                  measure: meta?.measures[0],
                });
              }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {REPORT_SOURCES.map(s => (
                    <SelectItem key={s.key} value={s.key} className="text-sm">
                      <div className="flex flex-col">
                        <span>{s.label}</span>
                        <span className="text-[10px] text-muted-foreground">{s.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sourceMeta && widget.type !== 'kpi' && (
              <div className="space-y-2">
                <Label className="text-xs">Dimension (axe)</Label>
                <Select value={widget.dimension} onValueChange={(v) => onUpdate({ dimension: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sourceMeta.dimensions.map(d => <SelectItem key={d} value={d} className="text-sm">{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sourceMeta && (
              <div className="space-y-2">
                <Label className="text-xs">Mesure (valeur)</Label>
                <Select value={widget.measure} onValueChange={(v) => onUpdate({ measure: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sourceMeta.measures.map(m => <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {widget.type === 'kpi' && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs">Format</Label>
                  <Select value={widget.format || 'number'} onValueChange={(v) => onUpdate({ format: v as any })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Nombre</SelectItem>
                      <SelectItem value="currency">Devise (€)</SelectItem>
                      <SelectItem value="percent">Pourcentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Comparaison période précédente</Label>
                  <Switch checked={!!widget.compareWithPrevious} onCheckedChange={(c) => onUpdate({ compareWithPrevious: c })} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
