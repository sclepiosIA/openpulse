import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFormBySlug, useSubmitFormResponse } from '@/hooks/forms/useForms';
import { FormFieldRenderer } from '@/components/forms/FormFieldRenderer';
import { Skeleton } from '@/components/ui/skeleton';

export default function FormPublic() {
  const { slug } = useParams<{ slug: string }>();
  const { data: form, isLoading } = useFormBySlug(slug);
  const submitResponse = useSubmitFormResponse();
  const [values, setValues] = useState<Record<string, string>>({});
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (fieldId: string, value: string) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Validate required fields
    const missingRequired = form.form_fields
      .filter(f => f.required && !['heading', 'paragraph'].includes(f.type))
      .filter(f => !values[f.id]?.trim());

    if (missingRequired.length > 0) {
      return; // HTML5 validation should handle this
    }

    try {
      await submitResponse.mutateAsync({
        form_id: form.id,
        respondent_name: respondentName || undefined,
        respondent_email: respondentEmail || undefined,
        values: Object.entries(values)
          .filter(([_, v]) => v.trim())
          .map(([field_id, value]) => ({ field_id, value })),
      });
      setSubmitted(true);
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-muted/30 flex items-center justify-center p-4">
        <Skeleton className="w-full max-w-2xl h-96 rounded-xl" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-dvh bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Ce formulaire n'existe pas ou n'est plus disponible.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-dvh bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Réponse envoyée !</h2>
            <p className="text-muted-foreground">{form.success_message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 py-8 px-4">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{form.title}</CardTitle>
            {form.description && (
              <CardDescription>{form.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Respondent info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-border/50">
              <div className="space-y-1.5">
                <Label className="text-sm">Votre nom</Label>
                <Input
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  placeholder="Nom (optionnel)"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Votre email</Label>
                <Input
                  type="email"
                  value={respondentEmail}
                  onChange={(e) => setRespondentEmail(e.target.value)}
                  placeholder="Email (optionnel)"
                />
              </div>
            </div>

            {/* Form fields */}
            {form.form_fields.map((field) => (
              <FormFieldRenderer
                key={field.id}
                field={field}
                value={values[field.id] || ''}
                onChange={(v) => handleChange(field.id, v)}
              />
            ))}

            <Button type="submit" disabled={submitResponse.isPending} className="w-full sm:w-auto">
              {submitResponse.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Envoyer
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
