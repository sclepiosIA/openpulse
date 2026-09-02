import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Webhook, Bell, Plus, Copy, Trash2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { useWorkflows } from '@/hooks/workflows/useWorkflows'
import {
  useWorkflowWebhookTokens,
  useCreateWebhookToken,
  useToggleWebhookToken,
  useDeleteWebhookToken,
} from '@/hooks/workflows/useWorkflowWebhookTokens'
import {
  useWorkflowAlertConfigs,
  useUpsertAlertConfig,
  useDeleteAlertConfig,
  type AlertConfig,
} from '@/hooks/workflows/useWorkflowAlertConfig'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { toast } from 'sonner'
import { SUPABASE_URL } from '@/lib/supabaseBrowser'

function webhookUrl(token: string) {
  return `${SUPABASE_URL}/functions/v1/workflow-webhook-trigger/${token}`
}

function WebhooksTab() {
  const { data: workflows } = useWorkflows()
  const { data: tokens, isLoading } = useWorkflowWebhookTokens()
  const createMut = useCreateWebhookToken()
  const toggleMut = useToggleWebhookToken()
  const deleteMut = useDeleteWebhookToken()

  const [open, setOpen] = useState(false)
  const [wfId, setWfId] = useState<string>('')
  const [label, setLabel] = useState('')

  const handleCreate = async () => {
    if (!wfId) return
    await createMut.mutateAsync({ workflow_id: wfId, label: label.trim() || undefined })
    setOpen(false)
    setLabel('')
    setWfId('')
  }

  const wfMap = useMemo(() => {
    const m = new Map<string, string>()
    ;(workflows ?? []).forEach((w) => m.set(w.id, w.nom))
    return m
  }, [workflows])

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Tokens webhooks entrants</CardTitle>
          <CardDescription>
            Chaque token expose une URL publique{' '}
            <span className="font-mono">POST /workflow-webhook-trigger/{`{token}`}</span> qui
            déclenche un workflow.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" /> Nouveau token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau token webhook</DialogTitle>
              <DialogDescription>Sélectionnez le workflow à déclencher.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Workflow</Label>
                <Select value={wfId} onValueChange={setWfId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(workflows ?? []).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Libellé (optionnel)</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Stripe webhook"
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={!wfId || createMut.isPending}>
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Chargement…</p>
        ) : !tokens?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun token. Créez-en un pour exposer un déclencheur HTTP.
          </p>
        ) : (
          <div className="space-y-3">
            {tokens.map((t) => (
              <div key={t.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={t.is_active ? 'default' : 'outline'} className="text-xs">
                        {t.is_active ? 'Actif' : 'Désactivé'}
                      </Badge>
                      <span className="font-medium text-sm truncate">
                        {wfMap.get(t.workflow_id) ?? t.workflow_id.slice(0, 8)}
                      </span>
                      {t.label && (
                        <span className="text-xs text-muted-foreground">· {t.label}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Créé {format(new Date(t.created_at), 'PPp', { locale: fr })} · {t.total_calls}{' '}
                      appel(s)
                      {t.last_used_at
                        ? ` · dernier ${format(new Date(t.last_used_at), 'PPp', { locale: fr })}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={(v) => toggleMut.mutate({ id: t.id, is_active: v })}
                      aria-label="Activer/désactiver"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMut.mutate(t.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-muted/40 rounded p-2">
                  <code className="text-[10px] font-mono break-all flex-1">
                    {webhookUrl(t.token)}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl(t.token))
                      toast.success('URL copiée')
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AlertsTab() {
  const { data: workflows } = useWorkflows()
  const { data: configs, isLoading } = useWorkflowAlertConfigs()
  const upsertMut = useUpsertAlertConfig()
  const deleteMut = useDeleteAlertConfig()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<AlertConfig> | null>(null)

  const wfMap = useMemo(() => {
    const m = new Map<string, string>()
    ;(workflows ?? []).forEach((w) => m.set(w.id, w.nom))
    return m
  }, [workflows])

  const openNew = () => {
    setEditing({
      workflow_id: null,
      failure_rate_threshold: 0.3,
      min_runs: 5,
      window_minutes: 60,
      scheduled_backlog_threshold: 50,
      notify_user_ids: [],
      is_active: true,
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!editing) return
    await upsertMut.mutateAsync(editing)
    setOpen(false)
    setEditing(null)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Alertes santé</CardTitle>
          <CardDescription>
            Notifications automatiques en cas de taux d'échec dépassé ou de backlog scheduled trop
            important.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nouvelle alerte
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Chargement…</p>
        ) : !configs?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucune alerte configurée.
          </p>
        ) : (
          <div className="space-y-3">
            {configs.map((c) => (
              <div key={c.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={c.is_active ? 'default' : 'outline'}>
                        {c.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                      <span className="font-medium text-sm">
                        {c.workflow_id
                          ? (wfMap.get(c.workflow_id) ?? 'Workflow inconnu')
                          : 'Tous workflows'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Seuil échec : {(c.failure_rate_threshold * 100).toFixed(0)}% · min{' '}
                      {c.min_runs} runs / {c.window_minutes} min · backlog &gt;{' '}
                      {c.scheduled_backlog_threshold}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Destinataires : {c.notify_user_ids?.length ?? 0} utilisateur(s)
                      {c.last_triggered_at &&
                        ` · dernière alerte ${format(new Date(c.last_triggered_at), 'PPp', { locale: fr })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(c)
                        setOpen(true)
                      }}
                    >
                      Éditer
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMut.mutate(c.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier l'alerte" : 'Nouvelle alerte'}</DialogTitle>
            <DialogDescription>
              Une notification in-app est envoyée aux destinataires si le taux d'échec dépasse le
              seuil sur la fenêtre.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Workflow ciblé</Label>
                <Select
                  value={editing.workflow_id ?? '__all__'}
                  onValueChange={(v) =>
                    setEditing({ ...editing, workflow_id: v === '__all__' ? null : v })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous workflows (global)</SelectItem>
                    {(workflows ?? []).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Seuil échec (0-1)</Label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={editing.failure_rate_threshold ?? 0.3}
                    onChange={(e) =>
                      setEditing({ ...editing, failure_rate_threshold: parseFloat(e.target.value) })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Min runs</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editing.min_runs ?? 5}
                    onChange={(e) =>
                      setEditing({ ...editing, min_runs: parseInt(e.target.value, 10) })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Fenêtre (minutes)</Label>
                  <Input
                    type="number"
                    min="5"
                    value={editing.window_minutes ?? 60}
                    onChange={(e) =>
                      setEditing({ ...editing, window_minutes: parseInt(e.target.value, 10) })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Backlog scheduled</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editing.scheduled_backlog_threshold ?? 50}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        scheduled_backlog_threshold: parseInt(e.target.value, 10),
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>IDs utilisateurs à notifier (séparés par virgule)</Label>
                <Input
                  value={(editing.notify_user_ids ?? []).join(',')}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      notify_user_ids: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="uuid1,uuid2"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={upsertMut.isPending}>
              {upsertMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function AutomationsWebhooksAndAlerts() {
  usePageTitle('Webhooks & Alertes')
  const navigate = useNavigate()

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        icon={Webhook}
        title="Webhooks & Alertes"
        subtitle="Tokens entrants et configurations d'alertes santé"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="bg-card/90 text-primary hover:bg-card"
            onClick={() => navigate('/automatisations')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        }
      />
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <Tabs defaultValue="webhooks">
          <TabsList>
            <TabsTrigger value="webhooks">
              <Webhook className="h-3.5 w-3.5 mr-1.5" /> Webhooks
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <Bell className="h-3.5 w-3.5 mr-1.5" /> Alertes
            </TabsTrigger>
          </TabsList>
          <TabsContent value="webhooks" className="mt-4">
            <WebhooksTab />
          </TabsContent>
          <TabsContent value="alerts" className="mt-4">
            <AlertsTab />
          </TabsContent>
        </Tabs>
      </div>
    </ImmersivePageBackground>
  )
}
