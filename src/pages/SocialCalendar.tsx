import { Link } from 'react-router-dom';
import { Calendar, Plus, Trash2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageDataState } from '@/components/shared/PageDataState';
import { usePageTitle } from '@/hooks/shared/usePageTitle';
import { useRolePermissions } from '@/hooks/auth/useRolePermissions';
import { useScheduledPosts } from '@/hooks/social/useScheduledPosts';
import { useSocialBrands } from '@/hooks/social/useSocialBrands';
import { deleteScheduledPost } from '@/services/social/scheduledPosts';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function SocialCalendar() {
  usePageTitle('Calendrier social');
  const perms = useRolePermissions();
  const allowed = ['admin', 'direction', 'copil', 'commercial', 'marketing'].includes(perms.role ?? '');
  const brandsQ = useSocialBrands();
  const postsQ = useScheduledPosts();
  const qc = useQueryClient();

  const brandName = (id: string) => brandsQ.data?.find((b) => b.id === id)?.name ?? '—';

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce post planifié ?')) return;
    try {
      await deleteScheduledPost(id);
      toast.success('Supprimé');
      qc.invalidateQueries({ queryKey: ['social', 'scheduled'] });
    } catch {
      toast.error('Suppression impossible');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Calendrier éditorial</h1>
            <p className="text-sm text-muted-foreground">Posts planifiés et historique.</p>
          </div>
        </div>
        <Button asChild size="sm"><Link to="/social/composer"><Plus className="h-4 w-4 mr-2" />Nouveau post</Link></Button>
      </header>

      <PageDataState
        isLoading={perms.isLoading || postsQ.isLoading}
        isError={!allowed || postsQ.isError}
        error={!allowed ? new Error('Accès réservé.') : postsQ.error}
        isEmpty={(postsQ.data?.length ?? 0) === 0}
        emptyTitle="Aucun post planifié"
        emptyDescription="Créez un post depuis le composer."
        loadingLabel="Chargement…"
        onRetry={() => postsQ.refetch()}
      >
        <div className="space-y-3">
          {(postsQ.data ?? []).map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline">{brandName(p.brand_id)}</Badge>
                    {p.status === 'scheduled' && <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Planifié</Badge>}
                    {p.status === 'published' && <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3" />Publié</Badge>}
                    {p.status === 'failed' && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Échec</Badge>}
                    {p.status === 'processing' && <Badge variant="secondary">En cours…</Badge>}
                    {p.status === 'draft' && <Badge variant="outline">Brouillon</Badge>}
                    {p.scheduled_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(p.scheduled_at), "EEEE d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm line-clamp-2 whitespace-pre-wrap break-words">{p.message}</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.target_account_ids.length} compte(s) ciblé(s)
                    {p.attempt_count > 0 && ` · ${p.attempt_count} tentative(s)`}
                  </div>
                  {p.error_message && (
                    <div className="text-xs text-destructive mt-1 truncate">{p.error_message}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  {p.status !== 'published' && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageDataState>
    </div>
  );
}
