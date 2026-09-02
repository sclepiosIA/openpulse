import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { ArrowLeft, Database, Save, RefreshCw, Download, Upload, Trash2, Activity, HardDrive, Clock, CheckCircle, AlertTriangle, Settings, BarChart3 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/shared/use-toast"
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { useDatabaseStats, useDatabaseActions, BackupFile } from "@/hooks/system/useSystemManagement"
import { useAdminDataActions } from "@/hooks/auth/useSecurityActions"
import { supabase } from "@/lib/supabaseBrowser"
import { PageDataState } from "@/components/shared/PageDataState"

export default function GestionBaseDonnees() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  
  // Utiliser les hooks pour les données réelles
  const { data: dbStats, isLoading: statsLoading } = useDatabaseStats()
  const databaseActions = useDatabaseActions()
  
  const [backupConfig, setBackupConfig] = useState({
    autoBackup: true,
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    retentionDays: 30,
    compressionEnabled: true,
    notifyOnFailure: true
  })

  const [maintenanceConfig, setMaintenanceConfig] = useState({
    autoVacuum: true,
    autoAnalyze: true,
    maintenanceWindow: '03:00',
    maxConnections: 100,
    sharedBuffers: '256MB'
  })

  // Historique des sauvegardes (pour le moment vide, sera implémenté plus tard)
  const backupHistory: BackupFile[] = []

  const handleDeleteBackup = async (backupId: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      toast({
        title: "Sauvegarde supprimée",
        description: "La sauvegarde a été supprimée avec succès"
      })
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la sauvegarde",
        variant: "destructive"
      })
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 5000))
      toast({
        title: "Restauration terminée",
        description: "La base de données a été restaurée avec succès"
      })
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de restaurer la sauvegarde",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: "bg-green-100 text-green-800",
      in_progress: "bg-blue-100 text-blue-800", 
      failed: "bg-red-100 text-red-800"
    }
    const labels = {
      completed: "Terminé",
      in_progress: "En cours",
      failed: "Échec"
    }
    
    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    )
  }

  const handleAnalyzeDatabase = async () => {
    const tables = ['profiles', 'etablissements', 'taches', 'contacts', 'categories_taches', 'modeles_taches']
    
    try {
      for (const table of tables) {
        const { error } = await supabase.rpc('analyze_table', { table_name: table })
        if (error) throw error
      }
      
      toast({
        title: "Analyse terminée",
        description: `${tables.length} tables analysées avec succès`
      })
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      })
    }
  }

  const { exportDatabase } = useAdminDataActions()

  const handleExportDatabase = async () => {
    try {
      const exportData = await exportDatabase()
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-db-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      
      toast({
        title: "Export réussi",
        description: "Les données ont été exportées avec succès"
      })
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      })
    }
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/parametres')}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Database className="w-8 h-8" />
              Gestion de la base de données
            </h1>
            <p className="text-muted-foreground mt-2">
              Sauvegarde, maintenance et optimisation de la base de données
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => databaseActions.testConnection.mutate()} 
            disabled={databaseActions.testConnection.isPending}
          >
            <Activity className="w-4 h-4 mr-2" />
            Tester connexion
          </Button>
          <Button 
            onClick={() => databaseActions.createBackup.mutate()} 
            disabled={databaseActions.createBackup.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {databaseActions.createBackup.isPending ? "Création..." : "Créer sauvegarde"}
          </Button>
        </div>
      </div>

      {statsLoading ? (
        <div className="p-6">
          <PageDataState isLoading loadingLabel="Chargement des statistiques BDD...">
            {null}
          </PageDataState>
        </div>
      ) : (
        <>
          {/* Database Health Status */}
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              Base de données opérationnelle - Dernière vérification: {dbStats?.lastCheck || 'N/A'}
            </AlertDescription>
          </Alert>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Taille totale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbStats?.totalSize || 'N/A'}</div>
            <p className="text-xs text-muted-foreground mt-1">Géré par Supabase</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbStats?.cacheHitRatio.toFixed(1) || 'N/A'}%</div>
            <p className="text-xs text-muted-foreground">Taux de cache PostgreSQL</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Connexions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Géré par Supabase</div>
            <p className="text-xs text-muted-foreground">Pool de connexions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dbStats?.uptime || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">Temps de fonctionnement</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Gestion avancée</CardTitle>
          <CardDescription>
            Outils complets pour la gestion de la base de données
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="backups">Sauvegardes</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
              <TabsTrigger value="tables">Tables</TabsTrigger>
              <TabsTrigger value="settings">Configuration</TabsTrigger>
            </TabsList>

            {/* Vue d'ensemble */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tables</Label>
                  <div className="text-2xl font-bold">{dbStats?.tables || 0}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Enregistrements</Label>
                  <div className="text-2xl font-bold">{dbStats?.records.toLocaleString() || 0}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Index</Label>
                  <div className="text-2xl font-bold">{dbStats?.indexes || 0}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Taux de cache</Label>
                  <div className="text-2xl font-bold text-green-600">{dbStats?.cacheHitRatio.toFixed(1) || 0}%</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Connexions max</Label>
                  <div className="text-2xl font-bold">{maintenanceConfig.maxConnections}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Buffers partagés</Label>
                  <div className="text-2xl font-bold">{maintenanceConfig.sharedBuffers}</div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Actions rapides</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => databaseActions.optimizeDatabase.mutate()} 
                    disabled={databaseActions.optimizeDatabase.isPending}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Optimiser
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => databaseActions.createBackup.mutate()} 
                    disabled={databaseActions.createBackup.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleAnalyzeDatabase}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Analyser
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleExportDatabase}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exporter
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Sauvegardes */}
            <TabsContent value="backups" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Configuration des sauvegardes</h3>
                <Button 
                  onClick={() => databaseActions.createBackup.mutate()} 
                  disabled={databaseActions.createBackup.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Nouvelle sauvegarde
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Sauvegarde automatique</Label>
                      <div className="text-sm text-muted-foreground">
                        Créer des sauvegardes automatiques régulières
                      </div>
                    </div>
                    <Switch
                      checked={backupConfig.autoBackup}
                      onCheckedChange={(checked) => setBackupConfig({...backupConfig, autoBackup: checked})}
                    />
                  </div>

                  {backupConfig.autoBackup && (
                    <>
                      <div className="space-y-2">
                        <Label>Fréquence</Label>
                        <Select value={backupConfig.frequency} onValueChange={(value) => setBackupConfig({...backupConfig, frequency: value as any})}>
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
                        <Label>Rétention (jours)</Label>
                        <Input
                          type="number"
                          value={backupConfig.retentionDays}
                          onChange={(e) => setBackupConfig({...backupConfig, retentionDays: parseInt(e.target.value)})}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Compression</Label>
                      <div className="text-sm text-muted-foreground">
                        Compresser les fichiers de sauvegarde
                      </div>
                    </div>
                    <Switch
                      checked={backupConfig.compressionEnabled}
                      onCheckedChange={(checked) => setBackupConfig({...backupConfig, compressionEnabled: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notification d'échec</Label>
                      <div className="text-sm text-muted-foreground">
                        Notifier en cas d'échec de sauvegarde
                      </div>
                    </div>
                    <Switch
                      checked={backupConfig.notifyOnFailure}
                      onCheckedChange={(checked) => setBackupConfig({...backupConfig, notifyOnFailure: checked})}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Historique des sauvegardes</h4>
                {backupHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="w-8 h-8 mx-auto mb-4 opacity-50" />
                    <p>Aucune sauvegarde disponible</p>
                    <p className="text-sm">Créez votre première sauvegarde pour commencer</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom du fichier</TableHead>
                        <TableHead>Taille</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backupHistory.map((backup) => (
                        <TableRow key={backup.id}>
                          <TableCell className="font-medium">{backup.name}</TableCell>
                          <TableCell>{backup.size}</TableCell>
                          <TableCell>{backup.date}</TableCell>
                          <TableCell>
                            <Badge variant={backup.type === 'auto' ? 'secondary' : 'outline'}>
                              {backup.type === 'auto' ? 'Auto' : 'Manuel'}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(backup.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm">
                                <Download className="w-4 h-4" />
                              </Button>
                              {backup.status === 'completed' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-blue-600">
                                      <RefreshCw className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirmer la restauration</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Êtes-vous sûr de vouloir restaurer cette sauvegarde ? 
                                        Cette action remplacera toutes les données actuelles.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleRestoreBackup(backup.id)}>
                                        Restaurer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer la sauvegarde</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Êtes-vous sûr de vouloir supprimer cette sauvegarde ? 
                                      Cette action est irréversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteBackup(backup.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* Maintenance */}
            <TabsContent value="maintenance" className="space-y-4">
              <h3 className="text-lg font-medium">Configuration de la maintenance</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>VACUUM automatique</Label>
                      <div className="text-sm text-muted-foreground">
                        Nettoyage automatique des données supprimées
                      </div>
                    </div>
                    <Switch
                      checked={maintenanceConfig.autoVacuum}
                      onCheckedChange={(checked) => setMaintenanceConfig({...maintenanceConfig, autoVacuum: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>ANALYZE automatique</Label>
                      <div className="text-sm text-muted-foreground">
                        Mise à jour automatique des statistiques
                      </div>
                    </div>
                    <Switch
                      checked={maintenanceConfig.autoAnalyze}
                      onCheckedChange={(checked) => setMaintenanceConfig({...maintenanceConfig, autoAnalyze: checked})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fenêtre de maintenance</Label>
                    <Input
                      type="time"
                      value={maintenanceConfig.maintenanceWindow}
                      onChange={(e) => setMaintenanceConfig({...maintenanceConfig, maintenanceWindow: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Connexions maximum</Label>
                    <Input
                      type="number"
                      value={maintenanceConfig.maxConnections}
                      onChange={(e) => setMaintenanceConfig({...maintenanceConfig, maxConnections: parseInt(e.target.value)})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Buffers partagés</Label>
                    <Select value={maintenanceConfig.sharedBuffers} onValueChange={(value) => setMaintenanceConfig({...maintenanceConfig, sharedBuffers: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="128MB">128 MB</SelectItem>
                        <SelectItem value="256MB">256 MB</SelectItem>
                        <SelectItem value="512MB">512 MB</SelectItem>
                        <SelectItem value="1GB">1 GB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Actions de maintenance</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => databaseActions.optimizeDatabase.mutate()} 
                    disabled={databaseActions.optimizeDatabase.isPending}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    VACUUM complet
                  </Button>
                  <Button variant="outline" disabled={statsLoading}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    ANALYZE tables
                  </Button>
                  <Button variant="outline" disabled={statsLoading}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    REINDEX
                  </Button>
                  <Button variant="outline" disabled={statsLoading}>
                    <Activity className="w-4 h-4 mr-2" />
                    Statistiques
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Tables */}
            <TabsContent value="tables" className="space-y-4">
              <h3 className="text-lg font-medium">Statistiques des tables</h3>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom de la table</TableHead>
                    <TableHead>Enregistrements</TableHead>
                    <TableHead>Taille</TableHead>
                    <TableHead>Dernière modification</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbStats?.tableStats?.map((table) => (
                    <TableRow key={table.name}>
                      <TableCell className="font-medium">{table.name}</TableCell>
                      <TableCell>{table.records.toLocaleString()}</TableCell>
                      <TableCell>{table.size}</TableCell>
                      <TableCell>{table.lastUpdated}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm">
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) || (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {statsLoading ? "Chargement..." : "Aucune données disponibles"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Configuration */}
            <TabsContent value="settings" className="space-y-4">
              <h3 className="text-lg font-medium">Configuration avancée</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Import/Export</CardTitle>
                    <CardDescription>
                      Importer ou exporter des données
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button variant="outline" className="w-full">
                      <Upload className="w-4 h-4 mr-2" />
                      Importer des données
                    </Button>
                    <Button variant="outline" className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Exporter toutes les données
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Nettoyage</CardTitle>
                    <CardDescription>
                      Nettoyer les données obsolètes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button variant="outline" className="w-full">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Nettoyer les logs anciens
                    </Button>
                    <Button variant="outline" className="w-full">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Purger les données temporaires
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Attention :</strong> Certaines opérations peuvent affecter les performances 
                  pendant leur exécution. Il est recommandé de les effectuer pendant les heures creuses.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  )
}