import React, { useState, useEffect } from "react"
import { debug } from "@/lib/debug"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Settings, Save, RefreshCw, Database, Shield, Monitor, AlertTriangle, CheckCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/shared/use-toast"
import { useSystemConfig, useSystemStats, useUpdateSystemConfig, useSystemMaintenanceActions, SystemConfig } from "@/hooks/system/useSystemConfig"
import { UnifiedPageHeader } from "@/components/layout/UnifiedPageHeader"
import { CollapsibleKPISection, KPIToggleButton } from "@/components/shared/CollapsibleKPISection"
import { PageDataState } from "@/components/shared/PageDataState"

export default function ConfigurationSysteme() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("general")
  
  // Utiliser les hooks pour les données réelles
  const { data: systemData, isLoading: configLoading, error: configError } = useSystemConfig()
  const { data: systemStats, isLoading: statsLoading } = useSystemStats()
  const updateConfigMutation = useUpdateSystemConfig()
  const maintenanceActions = useSystemMaintenanceActions()
  
  const [config, setConfig] = useState<SystemConfig>({
    app_name: "OpenPulse Manager",
    app_version: "1.0.0",
    environment: "production",
    maintenance_mode: false,
    debug_mode: false,
    
    db_backup_enabled: true,
    db_backup_frequency: "daily",
    db_retention_days: 30,
    
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    notification_email: "admin@exploitant.example.org",
    
    session_timeout: 3600,
    password_complexity: true,
    two_factor_auth: false,
    login_attempts: 5,
    
    cache_enabled: true,
    cache_timeout: 300,
    log_level: "info",
    max_file_size: 10
  })

  // Mettre à jour la configuration locale quand les données sont chargées
  useEffect(() => {
    if (systemData?.config) {
      setConfig(systemData.config)
    }
  }, [systemData])

  const handleSave = async () => {
    try {
      await updateConfigMutation.mutateAsync(config)
    } catch (error) {
      debug.error('Error saving config:', error)
    }
  }

  const updateConfigValue = (key: keyof SystemConfig, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  // Afficher un message d'erreur si l'utilisateur n'a pas les permissions
  if (configError) {
    return (
      <div className="space-y-6">
        <UnifiedPageHeader
          title="Configuration système"
          subtitle="Paramètres généraux et configuration de l'application"
          icon={Settings}
        />
        
        <div className="px-3 sm:px-4 lg:px-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Vous n'avez pas les permissions nécessaires pour accéder à la configuration système. 
              Seuls les administrateurs peuvent modifier ces paramètres.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (configLoading || statsLoading) {
    return (
      <div className="p-6">
        <PageDataState
          isLoading
          loadingLabel="Chargement de la configuration..."
        >
          {null}
        </PageDataState>
      </div>
    )
  }

  const configTabs = [
    { value: "general", label: "Général" },
    { value: "database", label: "Base de données" },
    { value: "notifications", label: "Notifications" },
    { value: "security", label: "Sécurité" },
    { value: "performance", label: "Performance" },
    { value: "emails", label: "Emails" },
  ]

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-4 sm:space-y-6">
      {/* Header unifié */}
      <UnifiedPageHeader
        title="Configuration système"
        subtitle="Paramètres généraux et configuration de l'application"
        icon={Settings}
        actions={
          <div className="flex items-center gap-2">
            <KPIToggleButton 
              storageKey="config-systeme-stats-visible" 
              label="Stats"
              showIcon={true}
            />
            <Button 
              variant="outline"
              size="sm"
              onClick={() => maintenanceActions.clearCache.mutate()} 
              disabled={maintenanceActions.clearCache.isPending}
              className="h-8"
            >
              <RefreshCw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Vider le cache</span>
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateConfigMutation.isPending} className="h-8">
              <Save className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{updateConfigMutation.isPending ? "Enregistrement..." : "Enregistrer"}</span>
            </Button>
          </div>
        }
      />

      <div className="px-3 sm:px-4 lg:px-6 space-y-4 sm:space-y-6">
        {/* System Status Alert */}
        {config.maintenance_mode && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              Le mode maintenance est activé. L'application est inaccessible aux utilisateurs.
            </AlertDescription>
          </Alert>
        )}

        {/* System Stats - Collapsible */}
        <CollapsibleKPISection storageKey="config-systeme-stats-visible" defaultOpen={true}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Temps de fonctionnement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{systemStats?.uptime}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Utilisateurs actifs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.activeUsers}/{systemStats?.totalUsers}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tâches terminées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.completedTasks}/{systemStats?.totalTasks}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Taille BDD</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemStats?.dbSize}</div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleKPISection>

        {/* Configuration Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration détaillée</CardTitle>
            <CardDescription>
              Paramètres avancés de l'application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="database">Base de données</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="security">Sécurité</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="emails">Emails</TabsTrigger>
              </TabsList>

            {/* Onglet Général */}
            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appName">Nom de l'application</Label>
                  <Input
                    id="appName"
                    value={config.app_name}
                    onChange={(e) => updateConfigValue('app_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appVersion">Version</Label>
                  <Input
                    id="appVersion"  
                    value={config.app_version}
                    onChange={(e) => updateConfigValue('app_version', e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="environment">Environnement</Label>
                <Select value={config.environment} onValueChange={(value) => updateConfigValue('environment', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Développement</SelectItem>
                    <SelectItem value="staging">Test</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="maintenance">Mode maintenance</Label>
                  <div className="text-sm text-muted-foreground">
                    Désactive l'accès à l'application pour maintenance
                  </div>
                </div>
                <Switch
                  id="maintenance"
                  checked={config.maintenance_mode}
                  onCheckedChange={(checked) => updateConfigValue('maintenance_mode', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="debug">Mode debug</Label>
                  <div className="text-sm text-muted-foreground">
                    Active les logs détaillés pour le débogage
                  </div>
                </div>
                <Switch
                  id="debug"
                  checked={config.debug_mode}
                  onCheckedChange={(checked) => updateConfigValue('debug_mode', checked)}
                />
              </div>
            </TabsContent>

            {/* Onglet Base de données */}
            <TabsContent value="database" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Configuration base de données</h3>
                <Button 
                  variant="outline" 
                  onClick={() => maintenanceActions.optimizeDB.mutate()} 
                  disabled={maintenanceActions.optimizeDB.isPending}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Optimiser BDD
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dbBackup">Sauvegarde automatique</Label>
                  <div className="text-sm text-muted-foreground">
                    Active la sauvegarde automatique de la base de données
                  </div>
                </div>
                <Switch
                  id="dbBackup"
                  checked={config.db_backup_enabled}
                  onCheckedChange={(checked) => updateConfigValue('db_backup_enabled', checked)}
                />
              </div>

              {config.db_backup_enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Fréquence de sauvegarde</Label>
                    <Select value={config.db_backup_frequency} onValueChange={(value) => updateConfigValue('db_backup_frequency', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Quotidienne</SelectItem>
                        <SelectItem value="weekly">Hebdomadaire</SelectItem>
                        <SelectItem value="monthly">Mensuelle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retention">Rétention (jours)</Label>
                    <Input
                      id="retention"
                      type="number"
                      value={config.db_retention_days}
                      onChange={(e) => updateConfigValue('db_retention_days', parseInt(e.target.value))}
                    />
                  </div>
                </>
              )}

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Les sauvegardes automatiques sont gérées par Supabase. Consultez le tableau de bord Supabase pour l'historique.
                </AlertDescription>
              </Alert>
            </TabsContent>

            {/* Onglet Notifications */}
            <TabsContent value="notifications" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notifEmail">Email de notification</Label>
                <Input
                  id="notifEmail"
                  type="email"
                  value={config.notification_email}
                  onChange={(e) => updateConfigValue('notification_email', e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications par email</Label>
                    <div className="text-sm text-muted-foreground">
                      Recevoir les alertes système par email
                    </div>
                  </div>
                  <Switch
                    checked={config.email_notifications}
                    onCheckedChange={(checked) => updateConfigValue('email_notifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications SMS</Label>
                    <div className="text-sm text-muted-foreground">
                      Recevoir les alertes critiques par SMS
                    </div>
                  </div>
                  <Switch
                    checked={config.sms_notifications}
                    onCheckedChange={(checked) => updateConfigValue('sms_notifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications push</Label>
                    <div className="text-sm text-muted-foreground">
                      Notifications en temps réel dans l'application
                    </div>
                  </div>
                  <Switch
                    checked={config.push_notifications}
                    onCheckedChange={(checked) => updateConfigValue('push_notifications', checked)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Onglet Sécurité */}
            <TabsContent value="security" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">Timeout de session (secondes)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={config.session_timeout}
                  onChange={(e) => updateConfigValue('session_timeout', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loginAttempts">Tentatives de connexion max</Label>
                <Input
                  id="loginAttempts"
                  type="number"
                  value={config.login_attempts}
                  onChange={(e) => updateConfigValue('login_attempts', parseInt(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Complexité des mots de passe</Label>
                  <div className="text-sm text-muted-foreground">
                    Exiger des mots de passe complexes
                  </div>
                </div>
                <Switch
                  checked={config.password_complexity}
                  onCheckedChange={(checked) => updateConfigValue('password_complexity', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Authentification à deux facteurs</Label>
                  <div className="text-sm text-muted-foreground">
                    Activer la 2FA pour tous les utilisateurs
                  </div>
                </div>
                <Switch
                  checked={config.two_factor_auth}
                  onCheckedChange={(checked) => updateConfigValue('two_factor_auth', checked)}
                />
              </div>
            </TabsContent>

            {/* Onglet Performance */}
            <TabsContent value="performance" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cache système</Label>
                  <div className="text-sm text-muted-foreground">
                    Active la mise en cache pour améliorer les performances
                  </div>
                </div>
                <Switch
                  checked={config.cache_enabled}
                  onCheckedChange={(checked) => updateConfigValue('cache_enabled', checked)}
                />
              </div>

              {config.cache_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="cacheTimeout">Durée de vie du cache (secondes)</Label>
                  <Input
                    id="cacheTimeout"
                    type="number"
                    value={config.cache_timeout}
                    onChange={(e) => updateConfigValue('cache_timeout', parseInt(e.target.value))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Niveau de logs</Label>
                <Select value={config.log_level} onValueChange={(value) => updateConfigValue('log_level', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxFileSize">Taille max fichiers (MB)</Label>
                <Input
                  id="maxFileSize"
                  type="number"
                  value={config.max_file_size}
                  onChange={(e) => updateConfigValue('max_file_size', parseInt(e.target.value))}
                />
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Statistiques cache</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Taille: </span>
                    <span className="font-medium">{systemStats?.cacheSize}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taux de hit: </span>
                    <span className="font-medium">87%</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Onglet Emails */}
            <TabsContent value="emails" className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  La synchronisation automatique des emails est configurée via GitHub Actions.
                  Le workflow s'exécute quotidiennement à 2h du matin (UTC).
                </AlertDescription>
              </Alert>

              <Card className="p-4 bg-muted/50">
                <h4 className="font-semibold mb-3">Configuration CRON</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fréquence:</span>
                    <span className="font-medium">Quotidienne (2h00 UTC)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Méthode:</span>
                    <span className="font-medium">GitHub Actions</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fichier:</span>
                    <code className="text-xs bg-background px-2 py-1 rounded">.github/workflows/email-sync.yml</code>
                  </div>
                </div>
              </Card>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Configuration requise dans les secrets GitHub:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><code>VITE_SUPABASE_URL</code>: URL de votre projet Supabase</li>
                    <li><code>VITE_SUPABASE_PUBLISHABLE_KEY</code>: Clé anonyme Supabase</li>
                    <li><code>CRON_SECRET</code>: Secret partagé pour authentifier les requêtes CRON</li>
                  </ul>
                  <p className="mt-3 text-sm">
                    Configurez ces secrets dans: Settings → Secrets and variables → Actions → New repository secret
                  </p>
                </AlertDescription>
              </Alert>

              <Card className="p-4">
                <h4 className="font-semibold mb-3">Dernières synchronisations</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div>
                      <p className="font-medium">Aujourd'hui 02:00</p>
                      <p className="text-xs text-muted-foreground">Tous les comptes actifs</p>
                    </div>
                    <Badge variant="default">Succès</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Consultez les logs détaillés dans l'onglet "Logs Système" ou sur GitHub Actions
                  </p>
                </div>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => window.open('https://github.com', '_blank')}>
                  <Monitor className="mr-2 h-4 w-4" />
                  Voir les workflows GitHub
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle>Actions de maintenance</CardTitle>
          <CardDescription>
            Outils de maintenance et de diagnostic système
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              onClick={() => maintenanceActions.clearCache.mutate()}
              disabled={maintenanceActions.clearCache.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Vider le cache
            </Button>
            <Button 
              variant="outline"
              onClick={() => maintenanceActions.optimizeDB.mutate()}
              disabled={maintenanceActions.optimizeDB.isPending}
            >
              <Database className="w-4 h-4 mr-2" />
              Optimiser BDD
            </Button>
            <Button 
              variant="outline"
              onClick={() => maintenanceActions.runBackup.mutate()}
              disabled={maintenanceActions.runBackup.isPending}
            >
              <Monitor className="w-4 h-4 mr-2" />
              Sauvegarde manuelle
            </Button>
            <Button 
              variant="outline"
              onClick={() => maintenanceActions.restartServices.mutate()}
              disabled={maintenanceActions.restartServices.isPending}
            >
              <Shield className="w-4 h-4 mr-2" />
              Redémarrer services
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}