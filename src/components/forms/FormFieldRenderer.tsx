import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star } from 'lucide-react';
import type { FormField } from '@/hooks/forms/useForms';
import type { Json } from '@/integrations/supabase/types';

function getOptionsArray(options: Json): string[] {
  if (Array.isArray(options)) return options.map(String);
  return [];
}

interface FormFieldRendererProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function FormFieldRenderer({ field, value, onChange, disabled }: FormFieldRendererProps) {
  const labelEl = (
    <Label className="text-sm font-medium text-foreground">
      {field.label}
      {field.required && <span className="text-destructive ml-1">*</span>}
      {field.description && (
        <span className="block text-xs text-muted-foreground font-normal mt-0.5">{field.description}</span>
      )}
    </Label>
  );

  switch (field.type) {
    case 'heading':
      return <h3 className="text-lg font-semibold text-foreground pt-2">{field.label}</h3>;

    case 'paragraph':
      return <p className="text-sm text-muted-foreground">{field.label}</p>;

    case 'text':
    case 'email':
    case 'phone':
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
            placeholder={field.placeholder || ''}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={field.required}
          />
        </div>
      );

    case 'number':
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Input
            type="number"
            placeholder={field.placeholder || ''}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={field.required}
          />
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Textarea
            placeholder={field.placeholder || ''}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={field.required}
            rows={4}
          />
        </div>
      );

    case 'date':
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={field.required}
          />
        </div>
      );

    case 'select': {
      const selectOpts = getOptionsArray(field.options);
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Sélectionner...'} />
            </SelectTrigger>
            <SelectContent>
              {selectOpts.map((opt: string) => (
                <SelectItem key={`select-${field.id}-${opt}`} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    case 'radio': {
      const radioOpts = getOptionsArray(field.options);
      return (
        <div className="space-y-1.5">
          {labelEl}
          <RadioGroup value={value} onValueChange={onChange} disabled={disabled}>
            {radioOpts.map((opt: string, i: number) => (
              <div key={`radio-${field.id}-${opt}`} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${field.id}-${i}`} />
                <Label htmlFor={`${field.id}-${i}`} className="font-normal">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      );
    }

    case 'checkbox': {
      const selectedValues = value ? value.split(',') : [];
      const checkOpts = getOptionsArray(field.options);
      return (
        <div className="space-y-1.5">
          {labelEl}
          <div className="space-y-2">
            {checkOpts.map((opt: string, i: number) => {
              const checked = selectedValues.includes(opt);
              return (
                <div key={`checkbox-${field.id}-${opt}`} className="flex items-center gap-2">
                  <Checkbox
                    id={`${field.id}-${i}`}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(c) => {
                      const newValues = c
                        ? [...selectedValues, opt]
                        : selectedValues.filter(v => v !== opt);
                      onChange(newValues.join(','));
                    }}
                  />
                  <Label htmlFor={`${field.id}-${i}`} className="font-normal">{opt}</Label>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case 'rating': {
      const rating = parseInt(value) || 0;
      const maxRating = 5;
      return (
        <div className="space-y-1.5">
          {labelEl}
          <div className="flex gap-1">
            {Array.from({ length: maxRating }, (_, i) => (
              <button
                // safe: immutable static rating slots
                key={`rating-${field.id}-${i}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(String(i + 1))}
                aria-label={`Note ${i + 1} sur ${maxRating}`}
                aria-pressed={rating === i + 1}
                title={`${i + 1}/${maxRating}`}
                className="p-0.5 transition-colors"
              >
                <Star
                  className={`h-6 w-6 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                />
              </button>
            ))}
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Input
            placeholder={field.placeholder || ''}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      );
  }
}
