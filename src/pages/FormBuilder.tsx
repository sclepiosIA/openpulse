import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Eye, ExternalLink, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormDetail, useFormFields, type FormField } from '@/hooks/forms/useForms';
import { useForms } from '@/hooks/forms/useForms';
import { FormFieldEditor } from '@/components/forms/FormFieldEditor';
import { FormPreview } from '@/components/forms/FormPreview';
import { useToast } from '@/hooks/shared/use-toast';

export default function FormBuilder() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: form, isLoading } = useFormDetail(formId);
  const { updateForm } = useForms();
  const { addField, updateField, deleteField } = useFormFields(formId);
  const [activeTab, setActiveTab] = useState('edit');

  const handleAddField = useCallback(async (type: string = 'text') => {
    if (!formId || !form) return;
    const position = form.form_fields.length;
    await addField.mutateAsync({
      form_id: formId,
      type,
      label: type === 'heading' ? 'Section' : type === 'paragraph' ? 'Texte explicatif' : 'Nouveau champ',
      required: false,
      options: ['select', 'radio', 'checkbox'].includes(type) ? ['Option 1', 'Option 2'] : [],
      validation_rules: {},
      position,
    });
  }, [formId, form, addField]);

  const handleUpdateField = useCallback(async (fieldId: string, updates: Partial<FormField>) => {
    await updateField.mutateAsync({ id: fieldId, ...updates });
  }, [updateField]);

  const handleDeleteField = useCallback(async (fieldId: string) => {
    await deleteField.mutateAsync(fieldId);
  }, [deleteField]);

  const handleTitleChange = useCallback(async (title: string) => {
    if (!formId) return;
    await updateForm.mutateAsync({ id: formId, title });
  }, [formId, updateForm]);

  const handleDescriptionChange = useCallback(async (description: string) => {
    if (!formId) return;
    await updateForm.mutateAsync({ id: formId, description });
  }, [formId, updateForm]);

  const handlePublish = useCallback(async () => {
    if (!formId || !form) return;
    const newStatus = form.status === 'published' ? 'draft' : 'published';
    await updateForm.mutateAsync({ id: formId, status: newStatus });
    toast({ title: newStatus === 'published' ? 'Formulaire publié !' : 'Formulaire dépublié' });
  }, [formId, form, updateForm, toast]);

  const handleCopyLink = useCallback(() => {
    if (!form?.slug) return;
    navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`);
    toast({ title: 'Lien copié !' });
  }, [form, toast]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-4 md:p-6 text-center">
        <p className="text-muted-foreground">Formulaire introuvable</p>
        <Button variant="link" onClick={() => navigate('/formulaires')}>Retour aux formulaires</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/formulaires')} aria-label="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <Input
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
              />
            </div>
            <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>
              {form.status === 'published' ? 'Publié' : 'Brouillon'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {form.status === 'published' && (
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Lien
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(`/formulaires/${formId}/responses`)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Réponses
            </Button>
            <Button size="sm" onClick={handlePublish}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              {form.status === 'published' ? 'Dépublier' : 'Publier'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="edit">Éditeur</TabsTrigger>
            <TabsTrigger value="preview">Aperçu</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4 max-w-2xl">
            <div className="space-y-1.5">
              <Textarea
                value={form.description || ''}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Description du formulaire (optionnel)"
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-3">
              {form.form_fields.map((field) => (
                <FormFieldEditor
                  key={field.id}
                  field={field}
                  onUpdate={(updates) => handleUpdateField(field.id, updates)}
                  onDelete={() => handleDeleteField(field.id)}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => handleAddField('text')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Texte
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddField('textarea')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Texte long
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddField('select')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Liste
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddField('radio')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Choix unique
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddField('checkbox')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Choix multiple
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddField('rating')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Notation
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddField('date')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Date
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddField('email')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Email
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddField('number')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Nombre
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddField('heading')}>
                <Plus className="h-3.5 w-3.5 mr-1" />Titre
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <FormPreview form={form} />
          </TabsContent>

          <TabsContent value="settings" className="max-w-lg space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message de succès</label>
              <Textarea
                value={form.success_message}
                onChange={(e) => updateForm.mutateAsync({ id: form.id, success_message: e.target.value })}
                rows={2}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
