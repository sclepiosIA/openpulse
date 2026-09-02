import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useFormDetail, useFormResponses } from '@/hooks/forms/useForms';
import { useToast } from '@/hooks/shared/use-toast';
import { PageDataState } from '@/components/common/PageDataState';

export default function FormResponses() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: form, isLoading: formLoading, isError: formError, refetch: refetchForm } = useFormDetail(formId);
  const { data: responses, isLoading: responsesLoading, isError: responsesError, refetch: refetchResponses } = useFormResponses(formId);

  const isLoading = formLoading || responsesLoading;
  const isError = formError || responsesError;

  const exportCSV = () => {
    if (!form || !responses) return;

    const fields = form.form_fields.filter(f => !['heading', 'paragraph'].includes(f.type));
    const headers = ['Date', 'Nom', 'Email', ...fields.map(f => f.label)];

    const rows = responses.map(response => {
      const date = new Date(response.submitted_at).toLocaleString('fr-FR');
      const fieldValues = fields.map(field => {
        const fv = response.form_field_values.find(v => v.field_id === field.id);
        return fv?.value || '';
      });
      return [date, response.respondent_name || '', response.respondent_email || '', ...fieldValues];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title}-reponses.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export CSV téléchargé' });
  };

  if (isLoading || isError || !form) {
    return (
      <div className="p-4 md:p-6">
        <PageDataState
          isLoading={isLoading}
          isError={isError}
          isEmpty={!isLoading && !isError && !form}
          emptyTitle="Formulaire introuvable"
          onRetry={() => { refetchForm(); refetchResponses(); }}
        >
          <></>
        </PageDataState>
      </div>
    );
  }

  const fields = form.form_fields.filter(f => !['heading', 'paragraph'].includes(f.type));

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/formulaires/${formId}/edit`)} aria-label="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{form.title}</h1>
              <p className="text-xs text-muted-foreground">{responses?.length || 0} réponse{(responses?.length || 0) > 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!responses?.length}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Exporter CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6">
        {!responses?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Eye className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">Aucune réponse</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Les réponses apparaîtront ici une fois le formulaire publié et rempli.
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Nom</TableHead>
                      <TableHead className="whitespace-nowrap">Email</TableHead>
                      {fields.map((field) => (
                        <TableHead key={field.id} className="whitespace-nowrap">{field.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((response) => (
                      <TableRow key={response.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(response.submitted_at).toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-sm">{response.respondent_name || '—'}</TableCell>
                        <TableCell className="text-sm">{response.respondent_email || '—'}</TableCell>
                        {fields.map((field) => {
                          const fv = response.form_field_values.find(v => v.field_id === field.id);
                          return (
                            <TableCell key={field.id} className="text-sm max-w-[200px] truncate">
                              {fv?.value || '—'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
