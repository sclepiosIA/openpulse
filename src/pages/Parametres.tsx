import { useState } from 'react'
import { debug } from '@/lib/debug'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Users,
  Database,
  Shield,
  Bell,
  RefreshCw,
  Monitor,
  FileText,
  Wrench,
  User,
  Video,
  ListTodo,
  Brain,
  Code2,
  MessageSquare,
  Activity,
  Building2,
  HardDrive,
  Plug,
} from 'lucide-react'
import { CronEmailMonitoringCard } from '@/components/settings/CronEmailMonitoringCard'
import { DevApiKeysCard } from '@/components/settings/DevApiKeysCard'
import { useIsDevGroupMember } from '@/hooks/auth/useIsDevGroupMember'
import { EmailNotificationCard } from '@/components/settings/EmailNotificationCard'
import { SipSettingsForm } from '@/components/cti/SipSettingsForm'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSystemStats, useSystemMaintenanceActions } from '@/hooks/system/useSystemConfig'
import { useUserRole } from '@/hooks/shared/useUserRole'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlassmorphismUnderlineTabs } from '@/components/ui/glassmorphism-underline-tabs'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ParametresMobileHeader } from '@/components/settings/ParametresMobileHeader'
import { ParametresTabsCompact } from '@/components/settings/ParametresTabsCompact'
import { cn } from '@/lib/utils'

export default function Parametres() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useUserRole()
  const isMobile = useIsMobile()
  const { isDevMember } = useIsDevGroupMember()
  const { data: systemStats, isLoading: statsLoading } = useSystemStats()
  const maintenanceActions = useSystemMaintenanceActions()

  const [activeTab, setActiveTab] = useState('general')
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)

  const showGlobalNav = !location.pathname.startsWith('/m/')

  const mobileToolbar = (
    <ParametresTabsCompact activeTab={activeTab} onTabChange={setActiveTab} isAdmin={isAdmin} />
  )

  const handleSettingClick = (setting: string) => {
    if (setting === 'profil') {
      navigate('/profil')
      return
    }

    if (setting === 'utilisateurs') {
      navigate('/gestion-utilisateurs')
      return
    }

    if (setting === 'système') {
      navigate('/configuration-systeme')
      return
    }

    if (setting === 'base de données') {
      navigate('/gestion-base-donnees')
      return
    }

    if (setting === 'sécurité') {
      navigate('/gestion-securite')
      return
    }

    if (setting === 'notifications') {
      navigate('/profil?tab=notifications')
      return
    }

    if (setting === 'visioconference') {
      navigate('/parametres/visioconference')
      return
    }

    if (setting === 'templates-taches') {
      navigate('/parametres/templates-taches')
      return
    }

    if (setting === 'webdav') {
      navigate('/parametres/webdav')
      return
    }
  }

  const handleQuickAction = async (action: string) => {
    switch (action) {
      case 'sauvegarde':
        maintenanceActions.runBackup.mutate()
        break
      case 'cache':
        maintenanceActions.clearCache.mutate()
        break
      case 'maintenance':
        navigate('/configuration-systeme')
        break
      case 'logs':
        navigate('/logs-systeme')
        break
      default:
        debug.log(`Action ${action} non reconnue`)
    }
  }

  const tabs = [
    { value: 'general', label: 'Général', shortLabel: 'Général' },
    ...(isAdmin ? [{ value: 'admin', label: 'Administration', shortLabel: 'Admin' }] : []),
  ]

  return (
    <div className="min-h-dvh bg-gradient-page">
      {isMobile ? (
        <ParametresMobileHeader
          isAdmin={isAdmin}
          onSearchClick={() => setShowGlobalSearch(true)}
          onLogsClick={() => navigate('/logs-systeme')}
          toolbar={mobileToolbar}
          showGlobalNav={showGlobalNav}
        />
      ) : (
        <ImmersivePageHeader
          title="Paramètres"
          subtitle="Configuration et administration de l'application"
          icon={Settings}
          searchPlaceholder="Rechercher un paramètre..."
          onSearchClick={() => setShowGlobalSearch(true)}
          actions={
            <Button
              size="sm"
              className="h-9 px-3 gap-1.5 bg-card/10 border border-white/20 text-white hover:bg-card/20 backdrop-blur-sm rounded-xl"
              onClick={() => navigate('/logs-systeme')}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">Logs</span>
            </Button>
          }
        >
          <GlassmorphismUnderlineTabs value={activeTab} onValueChange={setActiveTab} tabs={tabs} />
        </ImmersivePageHeader>
      )}

      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      <div className={cn('py-4 space-y-6', isMobile ? 'px-2' : 'px-3 sm:px-4 lg:px-6 sm:py-6')}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Onglet Général */}
          <TabsContent value="general" className="space-y-6 mt-0">
            <div
              className={cn(
                'grid gap-4',
                isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              )}
            >
              {/* Mon profil */}
              <Card
                className={cn(
                  'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-primary group',
                  isMobile && 'p-0'
                )}
                onClick={() => handleSettingClick('profil')}
              >
                <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                  <CardTitle
                    className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                  >
                    <div
                      className={cn(
                        'rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors',
                        isMobile ? 'p-1.5' : 'p-2'
                      )}
                    >
                      <User className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-primary')} />
                    </div>
                    Mon profil
                  </CardTitle>
                  <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                    Gérer votre profil et configuration 2FA
                  </CardDescription>
                </CardHeader>
                {!isMobile && (
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Modifier vos informations personnelles et configurer l'authentification à deux
                      facteurs.
                    </p>
                  </CardContent>
                )}
              </Card>

              {/* Notifications */}
              <Card
                className={cn(
                  'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-amber-500 group',
                  isMobile && 'p-0'
                )}
                onClick={() => handleSettingClick('notifications')}
              >
                <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                  <CardTitle
                    className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                  >
                    <div
                      className={cn(
                        'rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors',
                        isMobile ? 'p-1.5' : 'p-2'
                      )}
                    >
                      <Bell
                        className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-amber-600')}
                      />
                    </div>
                    Notifications
                  </CardTitle>
                  <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                    Notifications push, emails et alertes
                  </CardDescription>
                </CardHeader>
                {!isMobile && (
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Configurez les notifications push, la fréquence des emails et les types
                      d'alertes.
                    </p>
                  </CardContent>
                )}
              </Card>

              {/* Notifications Email */}
              <EmailNotificationCard />

              {/* Visioconférence */}
              <Card
                className={cn(
                  'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-violet-500 group',
                  isMobile && 'p-0'
                )}
                onClick={() => handleSettingClick('visioconference')}
              >
                <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                  <CardTitle
                    className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                  >
                    <div
                      className={cn(
                        'rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors',
                        isMobile ? 'p-1.5' : 'p-2'
                      )}
                    >
                      <Video
                        className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-violet-600')}
                      />
                    </div>
                    Visioconférence
                  </CardTitle>
                  <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                    Configurer les services de visioconférence
                  </CardDescription>
                </CardHeader>
                {!isMobile && (
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Connectez Google Meet, Nextcloud Talk et configurez vos préférences de
                      réunion.
                    </p>
                  </CardContent>
                )}
              </Card>

              {/* Lecteur réseau WebDAV */}
              <Card
                className={cn(
                  'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-emerald-500 group',
                  isMobile && 'p-0'
                )}
                onClick={() => handleSettingClick('webdav')}
              >
                <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                  <CardTitle
                    className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                  >
                    <div
                      className={cn(
                        'rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors',
                        isMobile ? 'p-1.5' : 'p-2'
                      )}
                    >
                      <HardDrive
                        className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-emerald-600')}
                      />
                    </div>
                    Lecteur réseau
                  </CardTitle>
                  <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                    Monter les documents sur votre ordinateur
                  </CardDescription>
                </CardHeader>
                {!isMobile && (
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Accédez à vos documents depuis l'explorateur de fichiers comme avec OneDrive
                      ou Nextcloud.
                    </p>
                  </CardContent>
                )}
              </Card>

              {/* Clés API - visible pour les devs et admins */}
              {(isDevMember || isAdmin) && <DevApiKeysCard />}
            </div>

            {/* Téléphonie SIP — pleine largeur */}
            <div className="mt-4">
              <SipSettingsForm />
            </div>
          </TabsContent>

          {/* Onglet Administration (admin only) */}
          {isAdmin && (
            <TabsContent value="admin" className="space-y-6 mt-0">
              <div
                className={cn(
                  'grid gap-4',
                  isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                )}
              >
                {/* Gestion des utilisateurs */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-primary group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => handleSettingClick('utilisateurs')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Users
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-primary')}
                        />
                      </div>
                      Utilisateurs
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Gérer les comptes, rôles et permissions
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Ajouter, modifier ou supprimer des utilisateurs et définir les permissions.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* Configuration système */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-amber-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => handleSettingClick('système')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Settings
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-amber-600')}
                        />
                      </div>
                      Système
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Paramètres généraux de l'application
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Configurer les paramètres généraux et les options système.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* Configuration générale */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-teal-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => navigate('/parametres/configuration')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Building2
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-teal-600')}
                        />
                      </div>
                      Configuration
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Infos société, emails et référentiel
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Informations légales, adresses email, URLs et données de référence
                        centralisées.
                      </p>
                    </CardContent>
                  )}
                </Card>
                {/* Base de données */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-violet-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => handleSettingClick('base de données')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Database
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-violet-600')}
                        />
                      </div>
                      Base de données
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Sauvegarde et maintenance
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Gérer les sauvegardes, maintenance et optimisation.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* Sécurité */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-emerald-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => handleSettingClick('sécurité')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Shield
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-emerald-600')}
                        />
                      </div>
                      Sécurité
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Authentification et politiques
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Configurer les politiques de sécurité et l'authentification.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* Retours utilisateurs */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-rose-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => navigate('/parametres/feedbacks')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-rose-500/10 group-hover:bg-rose-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <MessageSquare
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-rose-600')}
                        />
                      </div>
                      Feedbacks
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Bugs, améliorations et questions
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Consulter et gérer les retours de l'équipe.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* Gestion notifications */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-cyan-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => navigate('/gestion-notifications')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Bell
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-cyan-600')}
                        />
                      </div>
                      Notifications
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Règles avancées et historique
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Règles de notification et modèles d'emails.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* Templates de tâches */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-indigo-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => handleSettingClick('templates-taches')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <ListTodo
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-indigo-600')}
                        />
                      </div>
                      Templates tâches
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Tâches automatiques par phase
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Tâches créées automatiquement par phase.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* Utilisation IA */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-fuchsia-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => navigate('/parametres/ia-usage')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-fuchsia-500/10 group-hover:bg-fuchsia-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Brain
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-fuchsia-600')}
                        />
                      </div>
                      Utilisation IA
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Suivi GPT-5 et coûts
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Dashboard des tokens et coûts estimés.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* API Développeur */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-orange-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => navigate('/api-developer')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Code2
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-orange-600')}
                        />
                      </div>
                      API
                      <span
                        className={cn(
                          'bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full ml-auto',
                          isMobile ? 'text-[10px]' : 'text-xs'
                        )}
                      >
                        Tech
                      </span>
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Documentation et accès
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Clés API, webhooks, OAuth2 et documentation.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* OpenPulse Monitor */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-red-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => navigate('/parametres/monitor')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Activity
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-red-600')}
                        />
                      </div>
                      Monitor
                      <span
                        className={cn(
                          'bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-auto',
                          isMobile ? 'text-[10px]' : 'text-xs'
                        )}
                      >
                        Diag
                      </span>
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Diagnostic centralisé des erreurs
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Logs IA, syncs email, sécurité et feedbacks bugs.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* Portail client */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-cyan-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => navigate('/parametres/portail-client')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Building2
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-cyan-600')}
                        />
                      </div>
                      Portail client
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Comptes et demandes du portail externe
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Création/désactivation des accès clients, suivi des demandes
                        contact/factures.
                      </p>
                    </CardContent>
                  )}
                </Card>

                {/* Platform API */}
                <Card
                  className={cn(
                    'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-violet-500 group',
                    isMobile && 'p-0'
                  )}
                  onClick={() => navigate('/parametres/platform-api')}
                >
                  <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                    <CardTitle
                      className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                    >
                      <div
                        className={cn(
                          'rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors',
                          isMobile ? 'p-1.5' : 'p-2'
                        )}
                      >
                        <Plug
                          className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-violet-600')}
                        />
                      </div>
                      Platform API
                    </CardTitle>
                    <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
                      Intégration Gestion ⇄ Site Web ⇄ Backend Produit
                    </CardDescription>
                  </CardHeader>
                  {!isMobile && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Clés API, endpoints webhooks signés HMAC, bus d'événements et mappings
                        clients externes.
                      </p>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Monitoring CRON Email */}
              <CronEmailMonitoringCard />

              {/* Actions rapides */}
              <Card
                className={cn(
                  'bg-card/80 backdrop-blur-sm border-t-4 border-t-amber-500',
                  isMobile && 'p-0'
                )}
              >
                <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                  <CardTitle
                    className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                  >
                    <div className={cn('rounded-lg bg-amber-500/10', isMobile ? 'p-1.5' : 'p-2')}>
                      <Wrench
                        className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-amber-600')}
                      />
                    </div>
                    Actions rapides
                  </CardTitle>
                  {!isMobile && (
                    <CardDescription className="text-sm">
                      Accès rapide aux fonctions administratives courantes
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className={cn(isMobile && 'p-3 pt-1')}>
                  <div className={cn('flex flex-wrap', isMobile ? 'gap-1.5' : 'gap-2')}>
                    <Button
                      variant="outline"
                      className={cn(
                        'rounded-xl bg-card/50 hover:bg-card border-primary/20',
                        isMobile ? 'h-8 text-xs px-2' : 'h-9'
                      )}
                      onClick={() => handleQuickAction('sauvegarde')}
                      disabled={maintenanceActions.runBackup.isPending}
                    >
                      <Database
                        className={cn('mr-1.5', isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4 mr-2')}
                      />
                      {maintenanceActions.runBackup.isPending
                        ? '...'
                        : isMobile
                          ? 'Backup'
                          : 'Créer une sauvegarde'}
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        'rounded-xl bg-card/50 hover:bg-card border-primary/20',
                        isMobile ? 'h-8 text-xs px-2' : 'h-9'
                      )}
                      onClick={() => handleQuickAction('logs')}
                    >
                      <FileText
                        className={cn('mr-1.5', isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4 mr-2')}
                      />
                      {isMobile ? 'Logs' : 'Consulter les logs'}
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        'rounded-xl bg-card/50 hover:bg-card border-primary/20',
                        isMobile ? 'h-8 text-xs px-2' : 'h-9'
                      )}
                      onClick={() => handleQuickAction('maintenance')}
                    >
                      <Wrench className={cn('mr-1.5', isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4 mr-2')} />
                      {isMobile ? 'Maint.' : 'Mode maintenance'}
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        'rounded-xl bg-card/50 hover:bg-card border-primary/20',
                        isMobile ? 'h-8 text-xs px-2' : 'h-9'
                      )}
                      onClick={() => handleQuickAction('cache')}
                      disabled={maintenanceActions.clearCache.isPending}
                    >
                      <RefreshCw
                        className={cn('mr-1.5', isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4 mr-2')}
                      />
                      {maintenanceActions.clearCache.isPending
                        ? '...'
                        : isMobile
                          ? 'Cache'
                          : 'Vider le cache'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Informations système */}
              <Card
                className={cn(
                  'bg-card/80 backdrop-blur-sm border-t-4 border-t-emerald-500',
                  isMobile && 'p-0'
                )}
              >
                <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
                  <CardTitle
                    className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}
                  >
                    <div className={cn('rounded-lg bg-emerald-500/10', isMobile ? 'p-1.5' : 'p-2')}>
                      <Monitor
                        className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-emerald-600')}
                      />
                    </div>
                    Informations système
                  </CardTitle>
                </CardHeader>
                <CardContent className={cn(isMobile && 'p-3 pt-1')}>
                  {statsLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'grid gap-4',
                        isMobile ? 'grid-cols-2 gap-2' : 'grid-cols-2 md:grid-cols-4'
                      )}
                    >
                      <div className={cn('rounded-lg bg-muted/50', isMobile ? 'p-2' : 'p-3')}>
                        <p
                          className={cn(
                            'text-muted-foreground',
                            isMobile ? 'text-[10px]' : 'text-xs'
                          )}
                        >
                          Version
                        </p>
                        <p className={cn('font-semibold', isMobile ? 'text-xs' : 'text-sm')}>
                          {(systemStats as { version?: string })?.version || '1.0.0'}
                        </p>
                      </div>
                      <div className={cn('rounded-lg bg-muted/50', isMobile ? 'p-2' : 'p-3')}>
                        <p
                          className={cn(
                            'text-muted-foreground',
                            isMobile ? 'text-[10px]' : 'text-xs'
                          )}
                        >
                          Base de données
                        </p>
                        <p
                          className={cn('font-semibold truncate', isMobile ? 'text-xs' : 'text-sm')}
                        >
                          PG ({systemStats?.dbSize})
                        </p>
                      </div>
                      <div className={cn('rounded-lg bg-muted/50', isMobile ? 'p-2' : 'p-3')}>
                        <p
                          className={cn(
                            'text-muted-foreground',
                            isMobile ? 'text-[10px]' : 'text-xs'
                          )}
                        >
                          Uptime
                        </p>
                        <p className={cn('font-semibold', isMobile ? 'text-xs' : 'text-sm')}>
                          {systemStats?.uptime || 'N/A'}
                        </p>
                      </div>
                      <div className={cn('rounded-lg bg-muted/50', isMobile ? 'p-2' : 'p-3')}>
                        <p
                          className={cn(
                            'text-muted-foreground',
                            isMobile ? 'text-[10px]' : 'text-xs'
                          )}
                        >
                          Utilisateurs
                        </p>
                        <p
                          className={cn(
                            'font-semibold text-emerald-600',
                            isMobile ? 'text-xs' : 'text-sm'
                          )}
                        >
                          {systemStats?.activeUsers}/{systemStats?.totalUsers}
                        </p>
                      </div>
                      <div className={cn('rounded-lg bg-muted/50', isMobile ? 'p-2' : 'p-3')}>
                        <p
                          className={cn(
                            'text-muted-foreground',
                            isMobile ? 'text-[10px]' : 'text-xs'
                          )}
                        >
                          Établissements
                        </p>
                        <p className={cn('font-semibold', isMobile ? 'text-xs' : 'text-sm')}>
                          {systemStats?.totalEstablishments}
                        </p>
                      </div>
                      <div className={cn('rounded-lg bg-muted/50', isMobile ? 'p-2' : 'p-3')}>
                        <p
                          className={cn(
                            'text-muted-foreground',
                            isMobile ? 'text-[10px]' : 'text-xs'
                          )}
                        >
                          Tâches
                        </p>
                        <p className={cn('font-semibold', isMobile ? 'text-xs' : 'text-sm')}>
                          {systemStats?.completedTasks}/{systemStats?.totalTasks}
                        </p>
                      </div>
                      <div className={cn('rounded-lg bg-muted/50', isMobile ? 'p-2' : 'p-3')}>
                        <p
                          className={cn(
                            'text-muted-foreground',
                            isMobile ? 'text-[10px]' : 'text-xs'
                          )}
                        >
                          Cache
                        </p>
                        <p className={cn('font-semibold', isMobile ? 'text-xs' : 'text-sm')}>
                          {systemStats?.cacheSize}
                        </p>
                      </div>
                      <div className={cn('rounded-lg bg-muted/50', isMobile ? 'p-2' : 'p-3')}>
                        <p
                          className={cn(
                            'text-muted-foreground',
                            isMobile ? 'text-[10px]' : 'text-xs'
                          )}
                        >
                          Statut
                        </p>
                        <p
                          className={cn(
                            'font-semibold text-emerald-600',
                            isMobile ? 'text-xs' : 'text-sm'
                          )}
                        >
                          OK
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
