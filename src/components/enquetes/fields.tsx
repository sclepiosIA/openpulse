import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";

interface RadioFieldProps {
  label: ReactNode;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  precision?: { value: string; onChange: (v: string) => void; placeholder?: string; showWhen?: string };
}

export function RadioField({ label, required, value, onChange, options, precision }: RadioFieldProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium leading-relaxed">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid gap-2">
        {options.map((opt) => (
          <label key={opt.value}
            className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2.5 hover:bg-accent cursor-pointer transition-colors">
            <RadioGroupItem value={opt.value} id={`${label}-${opt.value}`} />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </RadioGroup>
      {precision && value === precision.showWhen && (
        <Textarea
          value={precision.value}
          onChange={(e) => precision.onChange(e.target.value)}
          placeholder={precision.placeholder || "Précisez…"}
          maxLength={1000}
          className="mt-2"
        />
      )}
    </div>
  );
}

interface CheckboxArrayProps {
  label: ReactNode;
  required?: boolean;
  values: string[];
  onChange: (v: string[]) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  allowOther?: { value: string; onChange: (v: string) => void };
}

export function CheckboxArrayField({ label, required, values, onChange, options, allowOther }: CheckboxArrayProps) {
  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  };
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium leading-relaxed">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="grid gap-2">
        {options.map((opt) => (
          <label key={opt.value}
            className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2.5 hover:bg-accent cursor-pointer transition-colors">
            <Checkbox
              checked={values.includes(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
              id={`cb-${opt.value}`}
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
      {allowOther && (
        <Input
          value={allowOther.value}
          onChange={(e) => allowOther.onChange(e.target.value)}
          placeholder="Autre : précisez…"
          maxLength={200}
        />
      )}
    </div>
  );
}

interface ScaleFieldProps {
  label: ReactNode;
  required?: boolean;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  minLabel?: string;
  maxLabel?: string;
}

export function ScaleField({ label, required, min, max, value, onChange, minLabel, maxLabel }: ScaleFieldProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium leading-relaxed">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{min} — {minLabel}</span>
            <span>{max} — {maxLabel}</span>
          </div>
          <Slider
            value={[value]}
            min={min}
            max={max}
            step={1}
            onValueChange={(v) => onChange(v[0])}
          />
          <div className="text-center mt-3">
            <span className="inline-flex items-center justify-center min-w-14 h-10 rounded-md bg-primary text-primary-foreground text-lg font-semibold">
              {value}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TextFieldProps {
  label: ReactNode;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}

export function TextField({ label, required, value, onChange, placeholder, multiline, maxLength = 2000 }: TextFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-base font-medium leading-relaxed">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} rows={4} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} />
      )}
      {maxLength && (
        <p className="text-xs text-muted-foreground text-right">{value.length}/{maxLength}</p>
      )}
    </div>
  );
}
