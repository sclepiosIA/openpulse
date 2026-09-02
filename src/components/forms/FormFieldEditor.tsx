import { useState } from 'react';
import { GripVertical, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { FormField } from '@/hooks/forms/useForms';
import type { Json } from '@/integrations/supabase/types';

function getOptionsArray(options: Json): string[] {
  if (Array.isArray(options)) return options.map(String);
  return [];
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'number', label: 'Nombre' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Liste déroulante' },
  { value: 'radio', label: 'Choix unique' },
  { value: 'checkbox', label: 'Choix multiple' },
  { value: 'rating', label: 'Notation (étoiles)' },
  { value: 'heading', label: 'Titre (séparateur)' },
  { value: 'paragraph', label: 'Paragraphe (texte libre)' },
];

const OPTION_TYPES = ['select', 'radio', 'checkbox'];

interface FormFieldEditorProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
  isDragging?: boolean;
}

export function FormFieldEditor({ field, onUpdate, onDelete, isDragging }: FormFieldEditorProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasOptions = OPTION_TYPES.includes(field.type);
  const isDecorative = ['heading', 'paragraph'].includes(field.type);

  const optionsArr = getOptionsArray(field.options);

  const addOption = () => {
    const options = [...optionsArr, `Option ${optionsArr.length + 1}`];
    onUpdate({ options });
  };

  const updateOption = (index: number, value: string) => {
    const options = [...optionsArr];
    options[index] = value;
    onUpdate({ options });
  };

  const removeOption = (index: number) => {
    const options = optionsArr.filter((_: string, i: number) => i !== index);
    onUpdate({ options });
  };

  return (
    <Card className={`transition-all ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
          <span className="text-sm font-medium text-foreground truncate flex-1">{field.label || 'Nouveau champ'}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
            {FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}
          </span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Précédent">
              {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </CollapsibleTrigger>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={onDelete} aria-label="Supprimer">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <CollapsibleContent>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Label</Label>
                <Input
                  value={field.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  placeholder="Libellé du champ"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={field.type} onValueChange={(type) => onUpdate({ type })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!isDecorative && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description (optionnel)</Label>
                  <Textarea
                    value={field.description || ''}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    placeholder="Texte d'aide sous le champ"
                    rows={2}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Placeholder</Label>
                  <Input
                    value={field.placeholder || ''}
                    onChange={(e) => onUpdate({ placeholder: e.target.value })}
                    placeholder="Texte indicatif dans le champ"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(required) => onUpdate({ required })}
                  />
                  <Label className="text-sm">Obligatoire</Label>
                </div>
              </>
            )}

            {hasOptions && (
              <div className="space-y-2">
                <Label className="text-xs">Options</Label>
                {optionsArr.map((opt: string, i: number) => (
                  // stable: positional editable option without id
                  <div key={`field-option-${i}`} className="flex items-center gap-2">
                    <Input
                      value={String(opt)}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => removeOption(i)} aria-label="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOption} className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Ajouter une option
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
