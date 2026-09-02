/**
 * Page API Developer - Module 10: API Publique & Marketplace
 */

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Key,
  Webhook,
  ShoppingBag,
  BarChart3,
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Code,
  Globe,
  AlertTriangle,
} from 'lucide-react'
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useApiLogs,
  useWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
  useMarketplaceConnectors,
  useMyConnectorInstallations,
  useInstallConnector,
  useApiStats,
} from '@/hooks/shared/useApi'
import type { ApiPermission, WebhookEvent, ConnectorCategory } from '@/types/api'
import { useToast } from '@/hooks/shared/use-toast'

const categoryLabels: Record<ConnectorCategory, string> = {
  crm: 'CRM',
  erp: 'ERP',
  comptabilite: 'Comptabilité',
  communication: 'Communication',
  analytics: 'Analytics',
  sante: 'Santé',
  autre: 'Autre',
}

export default function ApiDeveloper() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [showWebhookDialog, setShowWebhookDialog] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ConnectorCategory | null>(null)

  const { toast } = useToast()

  const { data: stats } = useApiStats()
  const { data: apiKeys } = useApiKeys()
  const { data: apiLogs } = useApiLogs(50)
  const { data: webhooks } = useWebhooks()
  const { data: connectors } = useMarketplaceConnectors(selectedCategory || undefined)
  const { data: installations } = useMyConnectorInstallations()

  const createApiKey = useCreateApiKey()
  const revokeApiKey = useRevokeApiKey()
  const createWebhook = useCreateWebhook()
  const deleteWebhook = useDeleteWebhook()
  const installConnector = useInstallConnector()

  // Form states
  const [apiKeyForm, setApiKeyForm] = useState({
    nom: '',
    description: '',
    permissions: ['read'] as ApiPermission[],
    rate_limit_per_minute: 60,
    rate_limit_per_day: 10000,
  })

  const [webhookForm, setWebhookForm] = useState({
    nom: '',
    url: '',
    events: [] as WebhookEvent[],
    retry_count: 3,
    timeout_seconds: 30,
  })

  const handleCreateApiKey = async () => {
    const result = await createApiKey.mutateAsync(apiKeyForm)
    setNewApiKey(result.full_key)
    setApiKeyForm({
      nom: '',
      description: '',
      permissions: ['read'],
      rate_limit_per_minute: 60,
      rate_limit_per_day: 10000,
    })
  }

  const handleCreateWebhook = async () => {
    await createWebhook.mutateAsync(webhookForm)
    setShowWebhookDialog(false)
    setWebhookForm({
      nom: '',
      url: '',
      events: [],
      retry_count: 3,
      timeout_seconds: 30,
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copié dans le presse-papiers' })
  }

  const webhookEvents: WebhookEvent[] = [
    'etablissement.created',
    'etablissement.updated',
    'etablissement.deleted',
    'contact.created',
    'contact.updated',
    'tache.created',
    'tache.completed',
    'ticket.created',
    'ticket.resolved',
    'invoice.created',
    'invoice.paid',
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Espace Développeur</h1>
          <p className="text-muted-foreground">API, Webhooks et Marketplace</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/docs" target="_blank">
              <Code className="h-4 w-4 mr-2" />
              Documentation API
            </a>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="api-keys">Clés API</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Requêtes Aujourd'hui</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_requests_today || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.total_requests_month || 0} ce mois
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Clés API Actives</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.active_api_keys || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Webhooks Actifs</CardTitle>
                <Webhook className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.active_webhooks || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Temps de Réponse</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.avg_response_time_ms || 0}ms</div>
                <p className="text-xs text-muted-foreground">
                  Taux d'erreur: {stats?.error_rate || 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Démarrage Rapide</CardTitle>
                <CardDescription>Commencez à utiliser l'API en quelques étapes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Créer une clé API</p>
                    <p className="text-sm text-muted-foreground">
                      Générez une clé pour authentifier vos requêtes
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Lire la documentation</p>
                    <p className="text-sm text-muted-foreground">
                      Découvrez les endpoints disponibles
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Configurer les webhooks</p>
                    <p className="text-sm text-muted-foreground">
                      Recevez des notifications en temps réel
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exemple de Requête</CardTitle>
                <CardDescription>Récupérer la liste des établissements</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  {`curl -X GET \\
  https://api.exploitant.example.org/v1/etablissements \\
  -H "Authorization: Bearer VOTRE_CLE_API" \\
  -H "Content-Type: application/json"`}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    copyToClipboard(
                      `curl -X GET https://api.exploitant.example.org/v1/etablissements -H "Authorization: Bearer VOTRE_CLE_API"`
                    )
                  }
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copier
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Clés API</h2>
              <p className="text-muted-foreground">Gérez vos clés d'accès à l'API</p>
            </div>
            <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle Clé
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer une Clé API</DialogTitle>
                  <DialogDescription>
                    La clé sera affichée une seule fois après création
                  </DialogDescription>
                </DialogHeader>
                {newApiKey ? (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-yellow-800 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Copiez cette clé maintenant</span>
                      </div>
                      <p className="text-sm text-yellow-700 mb-3">
                        Cette clé ne sera plus affichée. Conservez-la en lieu sûr.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="bg-card px-3 py-2 rounded border flex-1 text-sm font-mono break-all">
                          {newApiKey}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(newApiKey)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          setShowApiKeyDialog(false)
                          setNewApiKey(null)
                        }}
                      >
                        Fermer
                      </Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input
                        value={apiKeyForm.nom}
                        onChange={(e) => setApiKeyForm({ ...apiKeyForm, nom: e.target.value })}
                        placeholder="Ma clé de production"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (optionnel)</Label>
                      <Textarea
                        value={apiKeyForm.description}
                        onChange={(e) =>
                          setApiKeyForm({ ...apiKeyForm, description: e.target.value })
                        }
                        placeholder="Utilisée pour..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Limites de taux</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Par minute</Label>
                          <Input
                            type="number"
                            value={apiKeyForm.rate_limit_per_minute}
                            onChange={(e) =>
                              setApiKeyForm({
                                ...apiKeyForm,
                                rate_limit_per_minute: parseInt(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Par jour</Label>
                          <Input
                            type="number"
                            value={apiKeyForm.rate_limit_per_day}
                            onChange={(e) =>
                              setApiKeyForm({
                                ...apiKeyForm,
                                rate_limit_per_day: parseInt(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleCreateApiKey} disabled={!apiKeyForm.nom}>
                        Créer
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {apiKeys?.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Key className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{key.nom}</p>
                          <p className="text-sm text-muted-foreground">
                            <code>{key.key_prefix}...</code> · {key.total_requests} requêtes
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {key.est_active ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            Révoqué
                          </Badge>
                        )}
                        {key.est_active && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => revokeApiKey.mutate(key.id)}
                          >
                            Révoquer
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!apiKeys || apiKeys.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">Aucune clé API</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm">
            <strong>Webhooks inter-produits OpenPulse</strong> (Site Web, Backend PHP, etc.) : la
            configuration ne se fait <em>pas</em> ici, mais dans{' '}
            <a href="/parametres/platform-api" className="underline font-medium">
              Paramètres → Platform API
            </a>
            . Cet onglet ne gère que les webhooks génériques de l'API publique.
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Webhooks</h2>
              <p className="text-muted-foreground">Recevez des notifications en temps réel</p>
            </div>

            <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Créer un Webhook</DialogTitle>
                  <DialogDescription>
                    Configurez l'URL et les événements à écouter
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input
                        value={webhookForm.nom}
                        onChange={(e) => setWebhookForm({ ...webhookForm, nom: e.target.value })}
                        placeholder="Mon webhook"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input
                        value={webhookForm.url}
                        onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                        placeholder="https://mon-serveur.com/webhook"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Événements</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {webhookEvents.map((event) => (
                        <label key={event} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={webhookForm.events.includes(event)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWebhookForm({
                                  ...webhookForm,
                                  events: [...webhookForm.events, event],
                                })
                              } else {
                                setWebhookForm({
                                  ...webhookForm,
                                  events: webhookForm.events.filter((ev) => ev !== event),
                                })
                              }
                            }}
                            className="rounded"
                          />
                          {event}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleCreateWebhook}
                    disabled={
                      !webhookForm.nom || !webhookForm.url || webhookForm.events.length === 0
                    }
                  >
                    Créer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {webhooks?.map((webhook) => (
                    <div key={webhook.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{webhook.nom}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {webhook.est_actif ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactif</Badge>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteWebhook.mutate(webhook.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{webhook.url}</p>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                      {webhook.last_triggered_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Dernier appel:{' '}
                          {new Date(webhook.last_triggered_at).toLocaleString('fr-FR')}
                          {webhook.last_status && (
                            <span
                              className={
                                webhook.last_status === 'success'
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }
                            >
                              {' '}
                              ({webhook.last_status})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                  {(!webhooks || webhooks.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun webhook configuré
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Logs d'API</CardTitle>
              <CardDescription>Historique des 50 dernières requêtes</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {apiLogs?.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 border rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {log.status_code && log.status_code < 400 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Badge variant="outline">{log.method}</Badge>
                        <code className="text-muted-foreground">{log.endpoint}</code>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{log.status_code}</span>
                        <span>{log.duration_ms}ms</span>
                        <span>{new Date(log.created_at).toLocaleTimeString('fr-FR')}</span>
                      </div>
                    </div>
                  ))}
                  {(!apiLogs || apiLogs.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">Aucun log disponible</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Marketplace Tab */}
        <TabsContent value="marketplace" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Marketplace</h2>
              <p className="text-muted-foreground">Connecteurs et intégrations partenaires</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                Tous
              </Button>
              {Object.entries(categoryLabels)
                .slice(0, 4)
                .map(([key, label]) => (
                  <Button
                    key={key}
                    variant={selectedCategory === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(key as ConnectorCategory)}
                  >
                    {label}
                  </Button>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectors?.map((connector) => {
              const isInstalled = installations?.some((i) => i.connector_id === connector.id)

              return (
                <Card key={connector.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {connector.logo_url ? (
                          <img
                            loading="lazy"
                            decoding="async"
                            src={connector.logo_url}
                            alt={connector.nom}
                            className="w-10 h-10 rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-lg">{connector.nom}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {categoryLabels[connector.categorie]}
                          </Badge>
                        </div>
                      </div>
                      {connector.est_certifie && (
                        <Badge className="bg-blue-100 text-blue-800">Certifié</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{connector.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          {connector.nombre_installations} installations
                        </span>
                        {connector.note_moyenne && (
                          <span className="ml-2">⭐ {connector.note_moyenne}</span>
                        )}
                      </div>
                      {isInstalled ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Installé
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => installConnector.mutate({ connector_id: connector.id })}
                        >
                          Installer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {(!connectors || connectors.length === 0) && (
              <p className="col-span-full text-center text-muted-foreground py-8">
                Aucun connecteur disponible dans cette catégorie
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
