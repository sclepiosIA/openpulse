import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchSatisfactionCampaigns,
  fetchSatisfactionCampaignCounts,
  fetchSatisfactionEtabOptions,
  fetchSatisfactionServiceOptions,
  upsertSatisfactionCampaign,
  toggleSatisfactionCampaignActive,
} from '@/services/satisfaction/satisfactionV3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Archive, Play } from 'lucide-react';

const DPI_OPTIONS = [
  { value: 'hm', label: 'Hôpital Manager (hm)' },
  { value: 'mediboard', label: 'Médiboard' },
  { value: 'easily', label: 'Easily' },
  { value: 'resurgences', label: 'Résurgences' },
];
const ALL_VALUE = '__all__';

interface Campaign {
  id: string;
  title: string | null;
  message: string | null;
  is_active: boolean | null;
  priority: number | null;
  target_etablissement: string | null;
  target_dpi: string | null;
  target_service: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
}

interface CampaignForm {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  priority: number;
  target_etablissement: string;
  target_dpi: string;
  target_service: string;
  starts_at: string;
  ends_at: string;
}

const emptyForm: CampaignForm = {
  id: '',
  title: '',
  message: '',
  is_active: true,
  priority: 0,
  target_etablissement: '',
  target_dpi: '',
  target_service: '',
  starts_at: '',
  ends_at: '',
};

export default function AdminSatisfactionCampagnes() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);

  const campaignsQ = useQuery({
    queryKey: ['satisfaction-v3-campaigns'],
    queryFn: fetchSatisfactionCampaigns,
  });

  const countsQ = useQuery({
    queryKey: ['satisfaction-v3-campaign-counts'],
    queryFn: fetchSatisfactionCampaignCounts,
  });

  const etabOptionsQ = useQuery({
    queryKey: ['satisfaction-v3-etab-options'],
    queryFn: fetchSatisfactionEtabOptions,
  });


  const serviceOptionsQ = useQuery({
    queryKey: ['satisfaction-v3-service-options'],
    queryFn: fetchSatisfactionServiceOptions,
  });


  const save = useMutation({
    mutationFn: async () => {
      if (!form.id.trim()) throw new Error("L'identifiant (slug) est requis.");
      if (!form.title.trim()) throw new Error('Le titre est requis.');
      const payload: any = {
        id: form.id.trim(),
        title: form.title.trim(),
        message: form.message.trim() || null,
        is_active: form.is_active,
        priority: Number(form.priority) || 0,
        target_etablissement: form.target_etablissement.trim() || null,
        target_dpi: form.target_dpi.trim() || null,
        target_service: form.target_service.trim() || null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      await upsertSatisfactionCampaign(payload, editing ? editing.id : null);
    },
    onSuccess: () => {
      toast.success(editing ? 'Campagne mise à jour.' : 'Campagne créée.');
      qc.invalidateQueries({ queryKey: ['satisfaction-v3-campaigns'] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erreur.'),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: Campaign) => {
      await toggleSatisfactionCampaignActive(c.id, !c.is_active);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['satisfaction-v3-campaigns'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erreur.'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };
  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      id: c.id,
      title: c.title ?? '',
      message: c.message ?? '',
      is_active: !!c.is_active,
      priority: c.priority ?? 0,
      target_etablissement: c.target_etablissement ?? '',
      target_dpi: c.target_dpi ?? '',
      target_service: c.target_service ?? '',
      starts_at: c.starts_at ? c.starts_at.slice(0, 16) : '',
      ends_at: c.ends_at ? c.ends_at.slice(0, 16) : '',
    });
    setDialogOpen(true);
  };

  const rows = campaignsQ.data ?? [];
  const counts = countsQ.data ?? {};

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/satisfaction"><ArrowLeft className="w-4 h-4 mr-1" /> Retour</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Campagnes de satisfaction</h1>
            <p className="text-sm text-muted-foreground">
              Pilotez les enquêtes servies par les DPI OpenPulse V3 et le formulaire public.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle campagne
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Toutes les campagnes ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Priorité</TableHead>
                  <TableHead>Ciblage</TableHead>
                  <TableHead>Fenêtre</TableHead>
                  <TableHead className="text-right">Réponses</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignsQ.isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
                )}
                {!campaignsQ.isLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Aucune campagne.</TableCell></TableRow>
                )}
                {rows.map((c) => {
                  const targets = [
                    c.target_dpi && `DPI: ${c.target_dpi}`,
                    c.target_etablissement && `Étab: ${c.target_etablissement}`,
                    c.target_service && `Service: ${c.target_service}`,
                  ].filter(Boolean);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell className="font-medium">{c.title ?? '—'}</TableCell>
                      <TableCell>
                        {c.is_active ? (
                          <Badge>Active</Badge>
                        ) : (
                          <Badge variant="secondary">Archivée</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{c.priority ?? 0}</TableCell>
                      <TableCell className="text-xs">
                        {targets.length ? targets.join(' · ') : <span className="text-muted-foreground">Tous</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.starts_at ? new Date(c.starts_at).toLocaleDateString('fr-FR') : '—'}
                        {' → '}
                        {c.ends_at ? new Date(c.ends_at).toLocaleDateString('fr-FR') : '∞'}
                      </TableCell>
                      <TableCell className="text-right">{counts[c.id] ?? 0}</TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Éditer</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive.mutate(c)}
                          disabled={toggleActive.isPending}
                          title={c.is_active ? 'Archiver (is_active=false)' : 'Activer'}
                        >
                          {c.is_active ? <><Archive className="w-3 h-3 mr-1" />Archiver</> : <><Play className="w-3 h-3 mr-1" />Activer</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            L'archivage désactive la campagne sans jamais supprimer les données. La sélection de la
            campagne servie (priorité + ciblage + dédoublonnage) est effectuée côté Edge Function.
          </p>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label>Identifiant (slug)</Label>
              <Input
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                disabled={!!editing}
                placeholder="ex: nps-hm-2026-q3"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label>Titre</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Message affiché</Label>
              <Textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
            <div>
              <Label>Priorité</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Cible : DPI</Label>
              <Select
                value={form.target_dpi || ALL_VALUE}
                onValueChange={(v) => setForm((f) => ({ ...f, target_dpi: v === ALL_VALUE ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Tous les DPI" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Tous les DPI</SelectItem>
                  {DPI_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cible : établissement</Label>
              <Select
                value={form.target_etablissement || ALL_VALUE}
                onValueChange={(v) => setForm((f) => ({ ...f, target_etablissement: v === ALL_VALUE ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Tous les établissements" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL_VALUE}>Tous les établissements</SelectItem>
                  {(etabOptionsQ.data ?? []).map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                  {form.target_etablissement && !(etabOptionsQ.data ?? []).includes(form.target_etablissement) && (
                    <SelectItem value={form.target_etablissement}>{form.target_etablissement}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Cible : service</Label>
              <Select
                value={form.target_service || ALL_VALUE}
                onValueChange={(v) => setForm((f) => ({ ...f, target_service: v === ALL_VALUE ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Tous les services" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL_VALUE}>Tous les services</SelectItem>
                  {(serviceOptionsQ.data ?? []).map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                  {form.target_service && !(serviceOptionsQ.data ?? []).includes(form.target_service) && (
                    <SelectItem value={form.target_service}>{form.target_service}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Début (optionnel)</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              />
            </div>
            <div>
              <Label>Fin (optionnel)</Label>
              <Input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
