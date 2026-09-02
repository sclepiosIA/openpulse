import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/shared/use-toast"
import { useNotificationRules, useNotificationHistory, useUpdateNotificationRule, useDeleteNotificationRule, useSendTestEmail } from "@/hooks/notifications/useNotifications"
import { useNotificationPreferences, NotificationPreferences } from "@/hooks/notifications/useNotificationPreferences"
import { PushPreferencesPanel } from "@/components/notifications/PushPreferencesPanel"
import {
  Bell,
  Mail,
  MessageSquare,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  Plus,
  Info
} from "lucide-react"

interface NotificationRule {
  id: string
  name: string
  type: 'email' | 'system' | 'push'
  event: string
  enabled: boolean
  recipients: string[]
  conditions?: string
}

interface NotificationHistory {
  id: string
  type: 'email' | 'system' | 'push'
  title: string
  message: string
  status: 'sent' | 'failed' | 'pending'
  timestamp: string
  recipients: number
}

export default function GestionNotifications() {
  const { toast } = useToast()
  
  // Use real data hooks
  const { data: realNotificationRules = [], isLoading: rulesLoading } = useNotificationRules()
  const { data: realNotificationHistory = [], isLoading: historyLoading } = useNotificationHistory()
  const { preferences, updatePreferences, isUpdating } = useNotificationPreferences()
  const updateRule = useUpdateNotificationRule()
  const deleteRule = useDeleteNotificationRule()
  const sendTestEmail = useSendTestEmail()

  const handleTestEmail = () => {
    const recipient = prompt("Entrez l'adresse email de test:")
    if (recipient) {
      sendTestEmail.mutate({ 
        recipient,
        subject: "Test de configuration email - Marque",
        content: undefined // Will use default template
      })
    }
  }

  // Handler pour les préférences email
  const handleEmailNotificationChange = (key: keyof NotificationPreferences['email_notifications'], field: string, value: boolean | string | number) => {
    updatePreferences({
      email_notifications: {
        ...preferences.email_notifications,
        [key]: {
          ...preferences.email_notifications[key],
          [field]: value,
        },
      },
    })
  }

  // Handler pour les préférences in-app
  const handleInAppNotificationChange = (key: keyof NotificationPreferences['in_app_notifications'], value: boolean) => {
    updatePreferences({
      in_app_notifications: {
        ...preferences.in_app_notifications,
        [key]: value,
      },
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />
      case 'system': return <Bell className="w-4 h-4" />
      case 'push': return <MessageSquare className="w-4 h-4" />
      default: return <Bell className="w-4 h-4" />
    }
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Gestion des notifications</h1>
        <p className="text-muted-foreground mt-2">
          Configuration des alertes, notifications et communications système
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
          <TabsTrigger value="rules">Règles</TabsTrigger>
          <TabsTrigger value="templates">Modèles</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        {/* Paramètres généraux */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notifications Push */}
            <PushPreferencesPanel />

            {/* Paramètres Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Notifications Email
                </CardTitle>
                <CardDescription>
                  Configuration des notifications par email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-ai">Suggestions IA</Label>
                    <p className="text-xs text-muted-foreground">Recevoir les suggestions IA par email</p>
                  </div>
                  <Switch 
                    id="email-ai"
                    checked={preferences.email_notifications.ai_suggestions.enabled}
                    onCheckedChange={(checked) => handleEmailNotificationChange('ai_suggestions', 'enabled', checked)}
                    disabled={isUpdating}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-tasks">Rappels de tâches</Label>
                    <p className="text-xs text-muted-foreground">Recevoir les rappels de tâches</p>
                  </div>
                  <Switch 
                    id="email-tasks"
                    checked={preferences.email_notifications.task_reminders.enabled}
                    onCheckedChange={(checked) => handleEmailNotificationChange('task_reminders', 'enabled', checked)}
                    disabled={isUpdating}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-urgent">Tâches urgentes</Label>
                    <p className="text-xs text-muted-foreground">Alertes pour tâches à échéance proche</p>
                  </div>
                  <Switch 
                    id="email-urgent"
                    checked={preferences.email_notifications.urgent_tasks.enabled}
                    onCheckedChange={(checked) => handleEmailNotificationChange('urgent_tasks', 'enabled', checked)}
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-etab">Mises à jour établissements</Label>
                    <p className="text-xs text-muted-foreground">Changements sur les établissements</p>
                  </div>
                  <Switch 
                    id="email-etab"
                    checked={preferences.email_notifications.establishment_updates.enabled}
                    onCheckedChange={(checked) => handleEmailNotificationChange('establishment_updates', 'enabled', checked)}
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-mentions">Mentions d'équipe</Label>
                    <p className="text-xs text-muted-foreground">Quand on vous mentionne</p>
                  </div>
                  <Switch 
                    id="email-mentions"
                    checked={preferences.email_notifications.team_mentions.enabled}
                    onCheckedChange={(checked) => handleEmailNotificationChange('team_mentions', 'enabled', checked)}
                    disabled={isUpdating}
                  />
                </div>

                <Separator />

                <Button 
                  onClick={handleTestEmail} 
                  variant="outline" 
                  className="w-full"
                  disabled={sendTestEmail.isPending}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {sendTestEmail.isPending ? "Envoi..." : "Envoyer un email de test"}
                </Button>
              </CardContent>
            </Card>

            {/* Notifications In-App */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notifications In-App
                </CardTitle>
                <CardDescription>
                  Alertes affichées dans l'interface
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="inapp-ai">Suggestions IA</Label>
                  </div>
                  <Switch 
                    id="inapp-ai"
                    checked={preferences.in_app_notifications.ai_suggestions}
                    onCheckedChange={(checked) => handleInAppNotificationChange('ai_suggestions', checked)}
                    disabled={isUpdating}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="inapp-assign">Assignations de tâches</Label>
                  </div>
                  <Switch 
                    id="inapp-assign"
                    checked={preferences.in_app_notifications.task_assignments}
                    onCheckedChange={(checked) => handleInAppNotificationChange('task_assignments', checked)}
                    disabled={isUpdating}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="inapp-complete">Tâches terminées</Label>
                  </div>
                  <Switch 
                    id="inapp-complete"
                    checked={preferences.in_app_notifications.task_completions}
                    onCheckedChange={(checked) => handleInAppNotificationChange('task_completions', checked)}
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="inapp-status">Changements de statut</Label>
                  </div>
                  <Switch 
                    id="inapp-status"
                    checked={preferences.in_app_notifications.establishment_status_changes}
                    onCheckedChange={(checked) => handleInAppNotificationChange('establishment_status_changes', checked)}
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="inapp-mentions">Commentaires et mentions</Label>
                  </div>
                  <Switch 
                    id="inapp-mentions"
                    checked={preferences.in_app_notifications.comments_mentions}
                    onCheckedChange={(checked) => handleInAppNotificationChange('comments_mentions', checked)}
                    disabled={isUpdating}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Info SMTP */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Configuration SMTP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">Géré par Supabase</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      L'envoi d'emails est géré automatiquement via Resend et Supabase. 
                      Aucune configuration SMTP manuelle n'est requise.
                    </p>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Règles de notifications */}
        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Règles de notifications</CardTitle>
                  <CardDescription>
                    Définir quand et comment envoyer les notifications
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle règle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rulesLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : realNotificationRules.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    Aucune règle de notification configurée
                  </div>
                ) : (
                  realNotificationRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Switch 
                          checked={rule.is_active}
                          onCheckedChange={() => updateRule.mutate({ id: rule.id, is_active: !rule.is_active })}
                        />
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {rule.event_type} → {rule.recipients.join(', ')}
                            </p>
                            {rule.description && (
                              <p className="text-xs text-muted-foreground">
                                {rule.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={rule.is_active ? "default" : "secondary"}>
                          {rule.is_active ? "Actif" : "Inactif"}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteRule.mutate(rule.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modèles de notifications */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Modèles d'emails</CardTitle>
                  <CardDescription>
                    Personnaliser le contenu des notifications
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau modèle
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Nom du modèle</Label>
                    <Input id="template-name" placeholder="Ex: Notification de tâche" />
                  </div>
                  <div>
                    <Label htmlFor="template-subject">Sujet</Label>
                    <Input id="template-subject" placeholder="Ex: [OpenPulse] Nouvelle tâche assignée" />
                  </div>
                  <div>
                    <Label htmlFor="template-content">Contenu</Label>
                    <Textarea 
                      id="template-content" 
                      rows={10}
                      placeholder="Bonjour {{nom_utilisateur}},

Une nouvelle tâche vous a été assignée :
- Titre : {{titre_tache}}
- Échéance : {{date_echeance}}
- Priorité : {{priorite}}

Cordialement,
L'équipe OpenPulse"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>Variables disponibles</Label>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <code>{'{{nom_utilisateur}}'}</code>
                        <code>{'{{titre_tache}}'}</code>
                        <code>{'{{date_echeance}}'}</code>
                        <code>{'{{priorite}}'}</code>
                        <code>{'{{etablissement}}'}</code>
                        <code>{'{{responsable}}'}</code>
                        <code>{'{{date_creation}}'}</code>
                        <code>{'{{statut}}'}</code>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Aperçu</Label>
                    <div className="p-4 border rounded-lg bg-background">
                      <div className="space-y-2">
                        <p className="font-medium">Sujet: [OpenPulse] Nouvelle tâche assignée</p>
                        <Separator />
                        <div className="text-sm">
                          <p>Bonjour Jean Dupont,</p>
                          <br />
                          <p>Une nouvelle tâche vous a été assignée :</p>
                          <ul className="list-disc list-inside ml-4">
                            <li>Titre : Configuration serveur de production</li>
                            <li>Échéance : 20/01/2024</li>
                            <li>Priorité : Haute</li>
                          </ul>
                          <br />
                          <p>Cordialement,<br />L'équipe OpenPulse</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" disabled title="Aperçu bientôt disponible">Prévisualiser</Button>
                <Button
                  onClick={() => toast({
                    title: "Bientôt disponible",
                    description: "La sauvegarde de modèles personnalisés arrive dans une prochaine version.",
                  })}
                >
                  Enregistrer le modèle
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historique */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Historique des notifications</CardTitle>
              <CardDescription>
                Journal des notifications envoyées
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historyLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : realNotificationHistory.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    Aucune notification dans l'historique
                  </div>
                ) : (
                  realNotificationHistory.map((notification) => (
                    <div key={notification.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Mail className="w-4 h-4" />
                        <div>
                          <p className="font-medium">{notification.subject}</p>
                          <p className="text-sm text-muted-foreground">{notification.content?.substring(0, 100)}...</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(notification.sent_at).toLocaleString('fr-FR')} · {notification.recipient_email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {notification.status === 'sent' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : notification.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        )}
                        <Badge variant={notification.status === 'sent' ? 'default' : notification.status === 'failed' ? 'destructive' : 'secondary'}>
                          {notification.status === 'sent' ? 'Envoyé' : notification.status === 'failed' ? 'Échec' : 'En attente'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistiques */}
        <TabsContent value="stats" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Notifications envoyées</CardTitle>
                <Mail className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,284</div>
                <p className="text-xs text-muted-foreground">+12% ce mois</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taux de livraison</CardTitle>
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">98.2%</div>
                <p className="text-xs text-muted-foreground">+0.3% ce mois</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Échecs d'envoi</CardTitle>
                <XCircle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">23</div>
                <p className="text-xs text-muted-foreground">-5% ce mois</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Utilisateurs actifs</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">156</div>
                <p className="text-xs text-muted-foreground">+8 ce mois</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Activité des notifications</CardTitle>
              <CardDescription>
                Répartition des notifications par type et statut
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Notifications email</span>
                    <span className="text-sm text-muted-foreground">856 (67%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full w-[67%]"></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Notifications système</span>
                    <span className="text-sm text-muted-foreground">312 (24%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-secondary h-2 rounded-full w-[24%]"></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Notifications push</span>
                    <span className="text-sm text-muted-foreground">116 (9%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-accent h-2 rounded-full w-[9%]"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}