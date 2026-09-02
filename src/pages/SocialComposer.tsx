import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Clock, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageDataState } from '@/components/shared/PageDataState';
import { PlatformBadge } from '@/components/social/PlatformBadge';
import { usePageTitle } from '@/hooks/shared/usePageTitle';
import { useRolePermissions } from '@/hooks/auth/useRolePermissions';
import { useAuth } from '@/hooks/shared/useAuth';
import { useSocialBrands } from '@/hooks/social/useSocialBrands';
import { useSocialAccounts } from '@/hooks/social/useSocialAccounts';
import { publishSocialNow, scheduleSocialPost } from '@/services/social/socialEdge';
import { toast } from 'sonner';

export default function SocialComposer() {
  usePageTitle('Composer');
  const perms = useRolePermissions();
  const { user } = useAuth();
  const allowed = ['admin', 'direction', 'marketing'].includes(perms.role ?? '');

  const brandsQ = useSocialBrands();
  const [brandId, setBrandId] = useState<string | undefined>(undefined);
  const accountsQ = useSocialAccounts(brandId);

  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handlePublishNow = async () => {
    if (!message.trim() || selected.length === 0) {
      toast.error('Message + au moins un compte requis');
      return;
    }
    setBusy(true);
    try {
      const r = await publishSocialNow(message, selected, mediaUrl || undefined);
      const errCount = Object.keys(r?.errors || {}).length;
      const okCount = Object.keys(r?.published || {}).length;
      if (errCount === 0) toast.success(`Publié sur ${okCount} compte(s)`);
      else toast.warning(`${okCount} OK, ${errCount} échec(s)`);
      setMessage(''); setMediaUrl(''); setSelected([]);
    } catch (e: any) {
      toast.error(e?.message || 'Publication impossible');
    } finally {
      setBusy(false);
    }
  };

  const handleSchedule = async () => {
    if (!message.trim() || selected.length === 0 || !scheduledAt || !brandId) {
      toast.error('Marque + message + comptes + date requis');
      return;
    }
    setBusy(true);
    try {
      await scheduleSocialPost({
        brandId,
        message,
        accountIds: selected,
        scheduledAt,
        mediaUrl: mediaUrl || undefined,
        createdBy: user?.id,
      });
      toast.success('Post planifié');
      setMessage(''); setMediaUrl(''); setSelected([]); setScheduledAt('');
    } catch (e: any) {
      toast.error(e?.message || 'Planification impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Composer un post</h1>
          <p className="text-sm text-muted-foreground">Publication immédiate ou planifiée multi-plateformes.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/social/calendrier"><Clock className="h-4 w-4 mr-2" />Calendrier</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/social">Retour</Link></Button>
        </div>
      </header>

      <PageDataState
        isLoading={perms.isLoading || brandsQ.isLoading}
        isError={!allowed || brandsQ.isError}
        error={!allowed ? new Error('Réservé aux rôles marketing / direction / admin.') : brandsQ.error}
        loadingLabel="Chargement…"
      >
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">1. Marque</CardTitle></CardHeader>
          <CardContent>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger><SelectValue placeholder="Sélectionnez une marque" /></SelectTrigger>
              <SelectContent>
                {(brandsQ.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {brandId && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">2. Comptes cibles</CardTitle></CardHeader>
            <CardContent>
              {accountsQ.isLoading && <div className="text-sm text-muted-foreground">Chargement…</div>}
              {!accountsQ.isLoading && (accountsQ.data?.length ?? 0) === 0 && (
                <div className="text-sm text-muted-foreground">
                  Aucun compte synchronisé pour cette marque. Connectez d'abord les plateformes puis lancez une synchronisation.
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-2">
                {(accountsQ.data ?? []).map((a) => (
                  <label key={a.id} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent">
                    <Checkbox checked={selected.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
                    <PlatformBadge platform={a.platform} />
                    <span className="text-sm truncate">{a.display_name}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">3. Contenu</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="msg">Message</Label>
              <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Votre message…" maxLength={2200} />
              <div className="text-xs text-muted-foreground mt-1">{message.length} / 2200</div>
            </div>
            <div>
              <Label htmlFor="media">URL média (image ou vidéo publique)</Label>
              <div className="flex gap-2">
                <Input id="media" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" />
                {mediaUrl && (
                  <Button variant="ghost" size="icon" onClick={() => setMediaUrl('')}><X className="h-4 w-4" /></Button>
                )}
              </div>
              {mediaUrl && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon className="h-3 w-3" />
                  <span className="truncate">{mediaUrl}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">4. Publication</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <Label htmlFor="when">Planifier pour (optionnel)</Label>
                <Input id="when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSchedule} disabled={busy || !scheduledAt} variant="outline">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                  Planifier
                </Button>
                <Button onClick={handlePublishNow} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Publier maintenant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageDataState>
    </div>
  );
}
