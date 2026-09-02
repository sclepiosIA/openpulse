import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormFieldRenderer } from './FormFieldRenderer';
import type { FormWithFields } from '@/hooks/forms/useForms';

interface FormPreviewProps {
  form: FormWithFields;
}

export function FormPreview({ form }: FormPreviewProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (fieldId: string, value: string) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
  };

  return (
    <Card className="max-w-2xl mx-auto">
      {form.cover_image_url && (
        <div className="h-32 rounded-t-lg bg-gradient-to-r from-primary/20 to-primary/5" />
      )}
      <CardHeader>
        <CardTitle className="text-xl">{form.title}</CardTitle>
        {form.description && (
          <CardDescription>{form.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {form.form_fields.map((field) => (
          <FormFieldRenderer
            key={field.id}
            field={field}
            value={values[field.id] || ''}
            onChange={(v) => handleChange(field.id, v)}
            disabled
          />
        ))}
        <Button disabled className="w-full sm:w-auto">
          Envoyer (aperçu)
        </Button>
      </CardContent>
    </Card>
  );
}
