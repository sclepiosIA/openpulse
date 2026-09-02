import { useState } from 'react';
import { Inbox, MessageCircle, EyeOff, CheckCircle2, RotateCcw, Send, ExternalLink, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageDataState } from '@/components/shared/PageDataState';
import { usePageTitle } from '@/hooks/shared/usePageTitle';
import { useRolePermissions } from '@/hooks/auth/useRolePermissions';
import { useSocialBrands } from '@/hooks/social/useSocialBrands';
import { useSocialComments } from '@/hooks/social/useSocialComments';
import { performCommentAction, type CommentAction } from '@/services/social/socialEdge';

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};

export default function SocialInbox() {
  usePageTitle('Inbox social');
  const perms = useRolePermissions();
  const allowed = ['admin', 'direction', 'copil', 'commercial', 'marketing'].includes(perms.role ?? '');
  const canPublish = ['admin', 'direction', 'marketing'].includes(perms.role ?? '');

  const brandsQ = useSocialBrands();
  const [activeBrand, setActiveBrand] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const commentsQ = useSocialComments(activeBrand, filter);

  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();

  const refresh = () => qc.invalidateQueries({ queryKey: ['social', 'comments'] });

  const callAction = async (commentId: string, action: CommentAction, message?: string) => {
    setBusy(commentId + ':' + action);
    try {
      await performCommentAction(commentId, action, message);
      if (action === 'reply') toast.success('Réponse publiée');
      else if (action === 'hide') toast.success('Commentaire masqué');
      else if (action === 'handle') toast.success('Marqué comme traité');
      else toast.success('Remis en attente');
      setReplyDraft((d) => ({ ...d, [commentId]: '' }));
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Action impossible');
    } finally {
      setBusy(null);
    }
  };

  const brandName = (id: string) => brandsQ.data?.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Inbox social</h1>
            <p className="text-sm text-muted-foreground">Commentaires à traiter sur tous vos comptes connectés.</p>
          </div>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'pending' | 'all')}>
          <TabsList>
            <TabsTrigger value="pending">À traiter</TabsTrigger>
            <TabsTrigger value="all">Tous</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <PageDataState
        isLoading={perms.isLoading || brandsQ.isLoading}
        isError={!allowed || brandsQ.isError}
        error={!allowed ? new Error('Accès réservé.') : brandsQ.error}
        isEmpty={(brandsQ.data?.length ?? 0) === 0}
        emptyTitle="Aucune marque"
        emptyDescription="Configurez une marque depuis les paramètres."
        loadingLabel="Chargement…"
        onRetry={() => brandsQ.refetch()}
      >
        <Tabs value={activeBrand ?? 'all'} onValueChange={(v) => setActiveBrand(v === 'all' ? undefined : v)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">Toutes les marques</TabsTrigger>
            {(brandsQ.data ?? []).map((b) => (
              <TabsTrigger key={b.id} value={b.id} className="gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: b.color_hex || '#6366f1' }} />
                {b.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <PageDataState
          isLoading={commentsQ.isLoading}
          isError={commentsQ.isError}
          error={commentsQ.error}
          isEmpty={(commentsQ.data?.length ?? 0) === 0}
          emptyTitle={filter === 'pending' ? 'Aucun commentaire à traiter' : 'Aucun commentaire'}
          emptyDescription="Les commentaires arrivent via la synchronisation périodique."
          loadingLabel="Chargement des commentaires…"
          onRetry={() => commentsQ.refetch()}
        >
          <div className="space-y-3">
            {(commentsQ.data ?? []).map((c) => {
              const draft = replyDraft[c.id] ?? '';
              const isReplying = busy === c.id + ':reply';
              const isHiding = busy === c.id + ':hide';
              const isHandling = busy?.startsWith(c.id + ':handle') || busy?.startsWith(c.id + ':unhandle');
              return (
                <Card key={c.id} className={c.is_handled ? 'opacity-70' : ''}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{brandName(c.brand_id)}</Badge>
                      <Badge variant="secondary">{PLATFORM_LABEL[c.platform] ?? c.platform}</Badge>
                      {c.is_hidden && <Badge variant="destructive" className="gap-1"><EyeOff className="h-3 w-3" />Masqué</Badge>}
                      {c.is_handled && <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3" />Traité</Badge>}
                      {c.created_time && (
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_time), { addSuffix: true, locale: fr })}
                        </span>
                      )}
                      {c.post?.permalink && (
                        <a href={c.post.permalink} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />voir le post
                        </a>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{c.author_name || 'Anonyme'}</div>
                      <p className="text-sm whitespace-pre-wrap break-words">{c.message || <span className="italic text-muted-foreground">(sans texte)</span>}</p>
                    </div>
                    {c.post?.message && (
                      <div className="text-xs text-muted-foreground line-clamp-2 border-l-2 border-muted pl-2">
                        {c.post.message}
                      </div>
                    )}

                    {canPublish && (c.platform === 'facebook' || c.platform === 'instagram') && !c.is_handled && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Votre réponse…"
                          value={draft}
                          onChange={(e) => setReplyDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                          rows={2}
                          className="text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => callAction(c.id, 'reply', draft)} disabled={!draft.trim() || isReplying}>
                            {isReplying ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Send className="h-3 w-3 mr-2" />}
                            Répondre
                          </Button>
                          {c.platform === 'facebook' && !c.is_hidden && (
                            <Button size="sm" variant="outline" onClick={() => callAction(c.id, 'hide')} disabled={isHiding}>
                              {isHiding ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <EyeOff className="h-3 w-3 mr-2" />}
                              Masquer
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => callAction(c.id, 'handle')} disabled={!!isHandling}>
                            <CheckCircle2 className="h-3 w-3 mr-2" />Marquer traité
                          </Button>
                        </div>
                      </div>
                    )}
                    {c.is_handled && canPublish && (
                      <Button size="sm" variant="ghost" onClick={() => callAction(c.id, 'unhandle')} disabled={!!isHandling}>
                        <RotateCcw className="h-3 w-3 mr-2" />Remettre en attente
                      </Button>
                    )}
                    {!canPublish && (
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />Lecture seule (rôle non autorisé à publier).
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </PageDataState>
      </PageDataState>
    </div>
  );
}
