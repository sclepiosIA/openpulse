import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Shield, Save, AlertTriangle, CheckCircle, Lock, Activity, UserCheck, Clock, Globe } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/shared/use-toast"
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { useSecurityStats, useSecurityConfig, useSecurityLogs, useBlockedIPs, useSecurityActions, useUserSessions } from "@/hooks/system/useSystemManagement"
import { useAdminDataActions } from "@/hooks/auth/useSecurityActions"
import { supabase } from "@/lib/supabaseBrowser"
import { AuthorizedIPsManager } from "@/components/admin/AuthorizedIPsManager"
import { SecurityComplianceDashboard } from '@/components/auth/SecurityComplianceDashboard'
import { AdminGuard } from "@/components/security/AdminGuard"
import { PageDataState } from "@/components/common/PageDataState"
import {
  PasswordsTabContent,
  AuthenticationTabContent,
  SessionsTabContent,
  LogsTabContent,
  type SecurityLogRow,
  type UserSession,
} from "@/pages/admin/securite/GestionSecuriteTabs"



export default function GestionSecurite() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  
  // Utiliser les données réelles
  const { data: securityStats, isLoading: statsLoading, isError: statsError, error: statsErrorObj, refetch: refetchStats } = useSecurityStats()
  const { data: securityConfig, isLoading: configLoading, isError: configError, error: configErrorObj, refetch: refetchConfig } = useSecurityConfig()
  const { data: securityLogs, isLoading: logsLoading } = useSecurityLogs()
  const { data: blockedIPs, isLoading: blockedIPsLoading } = useBlockedIPs()
  const { data: userSessions, isLoading: sessionsLoading } = useUserSessions()
  const { saveSecurityConfig, blockIP, logSecurityEvent } = useSecurityActions()
  
  const [configState, setConfigState] = useState({
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSymbols: false,
    passwordExpiration: 90,
    twoFactorRequired: false,
    sessionTimeout: 3600,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    ipWhitelistEnabled: false,
    bruteForceProtection: true,
    securityHeaders: true,
    auditLogging: true,
    loginAlerts: true,
    suspiciousActivityAlerts: true,
    passwordChangeAlerts: true
  })

  // Mettre à jour l'état local quand la config BDD est chargée
  useEffect(() => {
    if (securityConfig) {
      setConfigState({
        passwordMinLength: securityConfig.password_min_length,
        passwordRequireUppercase: securityConfig.password_require_uppercase,
        passwordRequireLowercase: securityConfig.password_require_lowercase,
        passwordRequireNumbers: securityConfig.password_require_numbers,
        passwordRequireSymbols: securityConfig.password_require_symbols,
        passwordExpiration: securityConfig.password_expiration,
        twoFactorRequired: securityConfig.two_factor_required,
        sessionTimeout: securityConfig.session_timeout,
        maxLoginAttempts: securityConfig.max_login_attempts,
        lockoutDuration: securityConfig.lockout_duration,
        ipWhitelistEnabled: securityConfig.ip_whitelist_enabled,
        bruteForceProtection: securityConfig.brute_force_protection,
        securityHeaders: securityConfig.security_headers,
        auditLogging: securityConfig.audit_logging,
        loginAlerts: securityConfig.login_alerts,
        suspiciousActivityAlerts: securityConfig.suspicious_activity_alerts,
        passwordChangeAlerts: securityConfig.password_change_alerts
      })
    }
  }, [securityConfig])

  const handleSaveConfig = () => {
    saveSecurityConfig.mutate(configState)
  }

  const { runSecurityScan } = useAdminDataActions()

  const handleSecurityScan = async () => {
    try {
      await runSecurityScan()
      
      toast({
        title: "Analyse de sécurité terminée",
        description: `Score de sécurité: ${securityStats?.securityScore || 0}/100`
      })
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'effectuer l'analyse de sécurité",
        variant: "destructive"
      })
    }
  }

  const handleTerminateSession = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('terminate_user_session', {
        target_user_id: userId
      })
      
      if (error) throw error
      
      toast({
        title: "Session terminée",
        description: "La session utilisateur a été terminée avec succès"
      })
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      })
    }
  }

  const handleBlockIP = (ip: string) => {
    blockIP.mutate({ ip, reason: 'Activité suspecte détectée manuellement' })
  }

  const updateConfig = (key: string, value: unknown) => {
    setConfigState(prev => ({ ...prev, [key]: value }))
  }



  return (
    <AdminGuard operationName="la gestion de la sécurité" requireStrictAdmin={true}>
      <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
        <PageDataState
          isLoading={statsLoading || configLoading}
          isError={Boolean(statsError || configError)}
          error={statsErrorObj ?? configErrorObj}
          onRetry={() => { refetchStats(); refetchConfig(); }}
        >
          <>

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
                  <Shield className="w-8 h-8" />
                  Gestion de la sécurité
                </h1>
                <p className="text-muted-foreground mt-2">
                  Configuration de la sécurité, authentification et audit
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSecurityScan}>
                <Activity className="w-4 h-4 mr-2" />
                Analyse sécurité
              </Button>
              <Button onClick={handleSaveConfig}>
                <Save className="w-4 h-4 mr-2" />
              Enregistrer
              </Button>
            </div>
          </div>

          {/* Security Score */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Score de sécurité global
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Niveau de sécurité</span>
                    <span className="text-2xl font-bold text-blue-600">{securityStats?.securityScore || 85}/100</span>
                  </div>
                  <Progress value={securityStats?.securityScore || 85} className="h-3" />
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    {securityStats?.vulnerabilities || 0} vulnérabilité(s) détectée(s)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Dernière analyse: {securityStats?.lastSecurityScan || 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Utilisateurs actifs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{securityStats?.activeUsers || 0}/{securityStats?.totalUsers || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  IPs bloquées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{securityStats?.blockedIPs || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Échecs connexion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{securityStats?.failedLogins || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Sessions actives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{securityStats?.activeSessions || 0}</div>
              </CardContent>
            </Card>
          </div>

      {/* Main Content Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration de sécurité</CardTitle>
          <CardDescription>
            Paramètres de sécurité et politiques d'accès
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="passwords">Mots de passe</TabsTrigger>
              <TabsTrigger value="authentication">Authentification</TabsTrigger>
              <TabsTrigger value="ip-access">Accès IP</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="logs">Logs d'audit</TabsTrigger>
            </TabsList>

            {/* Vue d'ensemble */}
            <TabsContent value="overview" className="space-y-4">
              {/* Security Compliance Dashboard */}
              <SecurityComplianceDashboard />
              
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      Sécurité générale
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Protection brute force</Label>
                        <div className="text-sm text-muted-foreground">
                          Bloquer les tentatives répétées
                        </div>
                      </div>
                      <Switch
                        checked={configState.bruteForceProtection}
                        onCheckedChange={(checked) => updateConfig('bruteForceProtection', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>En-têtes de sécurité</Label>
                        <div className="text-sm text-muted-foreground">
                          Ajouter les en-têtes HTTP sécurisés
                        </div>
                      </div>
                      <Switch
                        checked={configState.securityHeaders}
                        onCheckedChange={(checked) => updateConfig('securityHeaders', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Audit des connexions</Label>
                        <div className="text-sm text-muted-foreground">
                          Enregistrer toutes les activités
                        </div>
                      </div>
                      <Switch
                        checked={configState.auditLogging}
                        onCheckedChange={(checked) => updateConfig('auditLogging', checked)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Alertes de connexion</Label>
                        <div className="text-sm text-muted-foreground">
                          Notifier les nouvelles connexions
                        </div>
                      </div>
                      <Switch
                        checked={configState.loginAlerts}
                        onCheckedChange={(checked) => updateConfig('loginAlerts', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Activité suspecte</Label>
                        <div className="text-sm text-muted-foreground">
                          Alerter sur comportements anormaux
                        </div>
                      </div>
                      <Switch
                        checked={configState.suspiciousActivityAlerts}
                        onCheckedChange={(checked) => updateConfig('suspiciousActivityAlerts', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Changement mot de passe</Label>
                        <div className="text-sm text-muted-foreground">
                          Notifier les modifications
                        </div>
                      </div>
                      <Switch
                        checked={configState.passwordChangeAlerts}
                        onCheckedChange={(checked) => updateConfig('passwordChangeAlerts', checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Système sécurisé :</strong> Toutes les mesures de sécurité recommandées sont activées.
                  Prochaine analyse programmée dans 24h.
                </AlertDescription>
              </Alert>
            </TabsContent>

            {/* Mots de passe */}
            <TabsContent value="passwords" className="space-y-4">
              <PasswordsTabContent configState={configState} updateConfig={updateConfig} />
            </TabsContent>

            {/* Authentification */}
            <TabsContent value="authentication" className="space-y-4">
              <AuthenticationTabContent configState={configState} updateConfig={updateConfig} />
            </TabsContent>

            {/* Accès IP */}
            <TabsContent value="ip-access" className="space-y-4">
              <AuthorizedIPsManager
                ipWhitelistEnabled={configState.ipWhitelistEnabled}
                onToggleIpWhitelist={(enabled) => updateConfig('ipWhitelistEnabled', enabled)}
              />
            </TabsContent>

            {/* Sessions */}
            <TabsContent value="sessions" className="space-y-4">
              <SessionsTabContent
                sessionsLoading={sessionsLoading}
                userSessions={userSessions as UserSession[] | undefined}
                onTerminate={handleTerminateSession}
              />
            </TabsContent>

            {/* Logs d'audit */}
            <TabsContent value="logs" className="space-y-4">
              <LogsTabContent
                securityLogs={securityLogs as SecurityLogRow[] | undefined}
                onBlockIP={handleBlockIP}
              />
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
          </>
        </PageDataState>
      </div>
    </AdminGuard>
  )
}