import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, MoreHorizontal, Trash2, Copy, ExternalLink, Eye, Edit, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader';
import { useForms } from '@/hooks/forms/useForms';
import { useToast } from '@/hooks/shared/use-toast';

import { useAuth } from '@/hooks/shared/useAuth';
import { PageDataState } from '@/components/common/PageDataState';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Brouillon', variant: 'secondary' },
  published: { label: 'Publié', variant: 'default' },
  closed: { label: 'Fermé', variant: 'outline' },
};

export default function Forms() {
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { forms, isLoading, isError, refetch, createForm, deleteForm, updateForm } = useForms();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const result = await createForm.mutateAsync({ title: newTitle.trim(), description: newDescription.trim() || undefined });
    setCreateOpen(false);
    setNewTitle('');
    setNewDescription('');
    navigate(`/formulaires/${result.id}/edit`);
  };

  const handleDuplicate = async (form: typeof forms[0]) => {
    await createForm.mutateAsync({ title: `${form.title} (copie)`, description: form.description || undefined });
  };

  const handlePublishToggle = async (form: typeof forms[0]) => {
    const newStatus = form.status === 'published' ? 'draft' : 'published';
    await updateForm.mutateAsync({ id: form.id, status: newStatus });
    toast({ title: newStatus === 'published' ? 'Formulaire publié' : 'Formulaire dépublié' });
  };

  const handleCopyLink = (form: typeof forms[0]) => {
    const url = `${window.location.origin}/f/${form.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Lien copié !' });
  };

  return (
    <div className="flex flex-col min-h-full">
      <ImmersivePageHeader
        title="Formulaires"
        subtitle={`${forms.length} formulaire${forms.length > 1 ? 's' : ''}`}
        icon={ClipboardList}
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau formulaire
          </Button>
        }
      />

      <div className="flex-1 p-4 md:p-6">
        {isLoading || isError ? (
          <PageDataState isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
            <></>
          </PageDataState>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Aucun formulaire</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Créez votre premier formulaire pour collecter des données, des retours ou des inscriptions.
            </p>
            <Button onClick={() => setCreateOpen(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-1" />
              Créer un formulaire
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => {
              const status = statusLabels[form.status] || statusLabels.draft;
              return (
                <Card key={form.id} className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/formulaires/${form.id}/edit`)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground truncate">{form.title}</h3>
                        {form.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{form.description}</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Plus d'options">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => navigate(`/formulaires/${form.id}/edit`)}>
                            <Edit className="h-4 w-4 mr-2" />Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/formulaires/${form.id}/responses`)}>
                            <Eye className="h-4 w-4 mr-2" />Réponses
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePublishToggle(form)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {form.status === 'published' ? 'Dépublier' : 'Publier'}
                          </DropdownMenuItem>
                          {form.status === 'published' && (
                            <DropdownMenuItem onClick={() => handleCopyLink(form)}>
                              <Copy className="h-4 w-4 mr-2" />Copier le lien
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDuplicate(form)}>
                            <Copy className="h-4 w-4 mr-2" />Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteForm.mutate(form.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(form.updated_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau formulaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Enquête de satisfaction"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optionnel)</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Décrivez le but de ce formulaire"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || createForm.isPending}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
