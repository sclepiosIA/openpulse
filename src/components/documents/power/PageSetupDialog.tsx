/**
 * Mise en page : format, orientation, marges. Injecte CSS @page + une classe sur le conteneur.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type PageFormat = 'A4' | 'A3' | 'Letter' | 'Legal';
export type PageOrientation = 'portrait' | 'landscape';
export interface PageSetup {
  format: PageFormat;
  orientation: PageOrientation;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

export const DEFAULT_PAGE_SETUP: PageSetup = {
  format: 'A4',
  orientation: 'portrait',
  marginTop: 20,
  marginRight: 20,
  marginBottom: 20,
  marginLeft: 20,
};

const FORMAT_SIZES: Record<PageFormat, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  Letter: { w: 216, h: 279 },
  Legal: { w: 216, h: 356 },
};

export function pageSetupToStyle(setup: PageSetup): React.CSSProperties {
  const s = FORMAT_SIZES[setup.format];
  const w = setup.orientation === 'portrait' ? s.w : s.h;
  const h = setup.orientation === 'portrait' ? s.h : s.w;
  // 1mm ≈ 3.78px @ 96dpi
  return {
    width: `${w * 3.78}px`,
    minHeight: `${h * 3.78}px`,
    padding: `${setup.marginTop}mm ${setup.marginRight}mm ${setup.marginBottom}mm ${setup.marginLeft}mm`,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: PageSetup;
  onChange: (s: PageSetup) => void;
}

export function PageSetupDialog({ open, onOpenChange, value, onChange }: Props) {
  const [local, setLocal] = useState<PageSetup>(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mise en page</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Format</Label>
              <Select value={local.format} onValueChange={(v) => setLocal({ ...local, format: v as PageFormat })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                  <SelectItem value="A3">A3 (297 × 420 mm)</SelectItem>
                  <SelectItem value="Letter">Letter (216 × 279 mm)</SelectItem>
                  <SelectItem value="Legal">Legal (216 × 356 mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Orientation</Label>
              <Select value={local.orientation} onValueChange={(v) => setLocal({ ...local, orientation: v as PageOrientation })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Paysage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Marges (mm)</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const).map((k) => (
                <div key={k}>
                  <span className="text-[10px] uppercase text-muted-foreground">{k.replace('margin', '')}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={local[k]}
                    onChange={(e) => setLocal({ ...local, [k]: Number(e.target.value) || 0 })}
                    className="h-8"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => { onChange(local); onOpenChange(false); }}>Appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
