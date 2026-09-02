/**
 * SipSettingsForm — configuration du trunk SIP utilisateur.
 *
 * Stockage chiffré côté DB (RPC set_sip_credentials), jamais de password en clair en BDD.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPhoneSettings } from '@/hooks/cti/useUserPhoneSettings';
import { setSipCredentials } from '@/services/cti/sipCredentials';
import { useAuth } from '@/hooks/shared/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
import { deleteOwnRecordings } from '@/hooks/voice/useCalls';

export function SipSettingsForm() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: existing, isLoading } = useUserPhoneSettings(user?.id);

  const [form, setForm] = useState({
    sip_uri: '',
    sip_username: '',
    sip_password: '',
    sip_domain: '',
    sip_proxy: '',
    sip_transport: 'wss' as 'wss' | 'tls' | 'tcp' | 'udp',
    caller_id: '',
    record_calls: false,
  });

  useEffect(() => {
    if (existing) {
      setForm((f) => ({
        ...f,
        sip_uri: existing.sip_uri || '',
        sip_username: existing.sip_username || '',
        sip_domain: existing.sip_domain || '',
        sip_proxy: existing.sip_proxy || '',
        sip_transport: (existing.sip_transport as typeof f.sip_transport) || 'wss',
        caller_id: existing.caller_id || '',
        record_calls: existing.record_calls ?? false,
      }));
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.sip_username || !form.sip_domain || (!form.sip_password && !existing)) {
        throw new Error('Identifiant, mot de passe et domaine sont requis');
      }
      await setSipCredentials({
        sip_uri: form.sip_uri || `sip:${form.sip_username}@${form.sip_domain}`,
        sip_username: form.sip_username,
        sip_password: form.sip_password || '__keep__',
        sip_domain: form.sip_domain,
        sip_transport: form.sip_transport,
        sip_proxy: form.sip_proxy || undefined,
        caller_id: form.caller_id || undefined,
        record_calls: form.record_calls,
      });
    },
    onSuccess: () => {
      toast({ title: 'Configuration SIP enregistrée' });
      setForm((f) => ({ ...f, sip_password: '' }));
      qc.invalidateQueries({ queryKey: ['user_phone_settings'] });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const purge = useMutation({
    mutationFn: deleteOwnRecordings,
    onSuccess: (n) => toast({ title: `${n} enregistrement(s) supprimé(s)` }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Téléphonie SIP</CardTitle>
        <CardDescription>
          Configurez votre trunk SIP (OVH Telecom, Keyyo, Asterisk perso…) pour passer des appels depuis l'application.
          Mot de passe chiffré côté serveur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sip_username">Identifiant SIP *</Label>
            <Input id="sip_username" value={form.sip_username} onChange={(e) => setForm({ ...form, sip_username: e.target.value })} placeholder="0033123456789" />
          </div>
          <div>
            <Label htmlFor="sip_password">Mot de passe SIP {existing && '(laisser vide pour conserver)'}</Label>
            <Input id="sip_password" type="password" value={form.sip_password} onChange={(e) => setForm({ ...form, sip_password: e.target.value })} placeholder="••••••••" autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="sip_domain">Domaine SIP *</Label>
            <Input id="sip_domain" value={form.sip_domain} onChange={(e) => setForm({ ...form, sip_domain: e.target.value })} placeholder="sip.ovh.fr" />
          </div>
          <div>
            <Label htmlFor="sip_proxy">Proxy WSS (optionnel)</Label>
            <Input id="sip_proxy" value={form.sip_proxy} onChange={(e) => setForm({ ...form, sip_proxy: e.target.value })} placeholder="wss://sip.ovh.fr:7443" />
          </div>
          <div>
            <Label htmlFor="sip_transport">Transport</Label>
            <Select value={form.sip_transport} onValueChange={(v) => setForm({ ...form, sip_transport: v as typeof form.sip_transport })}>
              <SelectTrigger id="sip_transport"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wss">WSS (WebSocket sécurisé)</SelectItem>
                <SelectItem value="tls">TLS</SelectItem>
                <SelectItem value="tcp">TCP</SelectItem>
                <SelectItem value="udp">UDP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="caller_id">Caller ID (nom affiché)</Label>
            <Input id="caller_id" value={form.caller_id} onChange={(e) => setForm({ ...form, caller_id: e.target.value })} placeholder="OpenPulse" />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <Switch id="record_calls" checked={form.record_calls} onCheckedChange={(v) => setForm({ ...form, record_calls: v })} />
          <Label htmlFor="record_calls" className="cursor-pointer">
            Enregistrer mes appels (purge automatique après 90 jours)
          </Label>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
          <Button variant="outline" onClick={() => purge.mutate()} disabled={purge.isPending}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer mes enregistrements
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
