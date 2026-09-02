import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import {
  Mail,
  CheckSquare,
  MessageCircle,
  Calendar,
  Download,
  Share,
  Plus,
  ArrowRight,
  Smartphone,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AppConfig {
  name: string
  fullName: string
  path: string
  icon: typeof Mail
  color: string
  bgColor: string
  themeColor: string
  manifest: string
  appleIcon: string
  description: string
}

const APP_CONFIGS: Record<string, AppConfig> = {
  mail: {
    name: 'Mail',
    fullName: 'OpenPulse Mail',
    path: '/m/mail',
    icon: Mail,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    themeColor: '#3280DD',
    manifest: '/manifest-mail.json',
    appleIcon: '/icons/app-mail-192.png',
    description: 'Votre messagerie professionnelle',
  },
  todos: {
    name: 'Todos',
    fullName: 'OpenPulse Todos',
    path: '/m/todos',
    icon: CheckSquare,
    color: 'text-green-500',
    bgColor: 'bg-green-500',
    themeColor: '#31983D',
    manifest: '/manifest-todos.json',
    appleIcon: '/icons/app-todos-192.png',
    description: 'Gérez vos tâches efficacement',
  },
  pulse: {
    name: 'Pulse',
    fullName: 'OpenPulse Pulse',
    path: '/m/pulse',
    icon: MessageCircle,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500',
    themeColor: '#9065D0',
    manifest: '/manifest-pulse.json',
    appleIcon: '/icons/app-pulse-192.png',
    description: "Messagerie d'équipe en temps réel",
  },
  calendrier: {
    name: 'Calendrier',
    fullName: 'OpenPulse Calendrier',
    path: '/m/calendrier',
    icon: Calendar,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500',
    themeColor: '#C3518E',
    manifest: '/manifest-calendar.json',
    appleIcon: '/icons/app-calendar-192.png',
    description: 'Votre agenda et événements',
  },
}

export default function MobileAppInstallPage() {
  const { app } = useParams<{ app: string }>()
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isAndroid = /Android/.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  const appConfig = app ? APP_CONFIGS[app] : null
  const Icon = appConfig?.icon ?? null

  // V3a: hooks doivent être appelés avant tout early-return (Navigate plus bas).
  // Load the correct manifest and theme for this app
  useEffect(() => {
    if (!appConfig) return
    // Update manifest link
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
    if (!manifestLink) {
      manifestLink = document.createElement('link')
      manifestLink.rel = 'manifest'
      document.head.appendChild(manifestLink)
    }
    manifestLink.href = appConfig.manifest

    // Update apple-touch-icon
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement
    if (!appleIcon) {
      appleIcon = document.createElement('link')
      appleIcon.rel = 'apple-touch-icon'
      document.head.appendChild(appleIcon)
    }
    appleIcon.href = appConfig.appleIcon

    // Update theme-color
    let themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
    if (!themeColor) {
      themeColor = document.createElement('meta')
      themeColor.name = 'theme-color'
      document.head.appendChild(themeColor)
    }
    themeColor.content = appConfig.themeColor

    // Update page title
    document.title = `Installer ${appConfig.fullName}`
  }, [appConfig])

  // Listen for install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    }
  }

  // V3a: early-return APRÈS tous les hooks pour respecter rules-of-hooks.
  if (!appConfig) {
    return <Navigate to="/m/install" replace />
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ backgroundColor: appConfig.themeColor }}>
      {/* Header with app icon and name */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
        <img
          loading="lazy"
          decoding="async"
          src={`/icons/app-${app}-512.png`}
          alt={appConfig.fullName}
          className="w-28 h-28 rounded-3xl shadow-xl mb-6"
        />

        <h1 className="text-2xl font-bold mb-2">{appConfig.fullName}</h1>
        <p className="text-white/80 text-center mb-8">{appConfig.description}</p>

        {/* Install status */}
        {isStandalone || isInstalled ? (
          <Card className="w-full max-w-sm border-white/20 bg-card/10 backdrop-blur">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-card/20 flex items-center justify-center">
                <Download className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">App installée !</p>
                <p className="text-sm text-white/70">Retrouvez-la sur votre écran d'accueil</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="w-full max-w-sm space-y-4">
            {/* Native install button (Android/Desktop) */}
            {deferredPrompt && (
              <Button
                onClick={handleInstall}
                size="lg"
                className="w-full bg-card text-foreground hover:bg-card/90 font-semibold"
              >
                <Download className="h-5 w-5 mr-2" />
                Installer l'application
              </Button>
            )}

            {/* iOS instructions */}
            {isIOS && !deferredPrompt && (
              <Card className="border-white/20 bg-card/10 backdrop-blur">
                <CardContent className="p-4 space-y-4">
                  <p className="text-white font-medium text-center">Pour installer sur iOS :</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-card/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">1</span>
                      </div>
                      <p className="text-sm text-white/90">
                        Appuyez sur <Share className="inline h-4 w-4 mx-1" /> Partager
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-card/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">2</span>
                      </div>
                      <p className="text-sm text-white/90">
                        Sélectionnez <Plus className="inline h-4 w-4 mx-1" /> "Sur l'écran
                        d'accueil"
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-card/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">3</span>
                      </div>
                      <p className="text-sm text-white/90">Confirmez en appuyant "Ajouter"</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Android instructions (if no prompt available) */}
            {isAndroid && !deferredPrompt && (
              <Card className="border-white/20 bg-card/10 backdrop-blur">
                <CardContent className="p-4 space-y-4">
                  <p className="text-white font-medium text-center">Pour installer sur Android :</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-card/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">1</span>
                      </div>
                      <p className="text-sm text-white/90">Appuyez sur le menu ⋮ dans Chrome</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-card/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">2</span>
                      </div>
                      <p className="text-sm text-white/90">
                        Sélectionnez "Installer l'application"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Desktop instructions */}
            {!isIOS && !isAndroid && !deferredPrompt && (
              <Card className="border-white/20 bg-card/10 backdrop-blur">
                <CardContent className="p-4 text-center">
                  <Smartphone className="h-8 w-8 mx-auto mb-2 text-white/70" />
                  <p className="text-sm text-white/90">
                    Scannez ce QR code avec votre téléphone pour installer l'app
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Footer with link to app */}
      <div className="p-6 pb-8">
        <Link to={appConfig.path}>
          <Button
            variant="outline"
            size="lg"
            className="w-full border-white/30 bg-card/10 text-white hover:bg-card/20"
          >
            Ouvrir {appConfig.name}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>

        <p className="text-xs text-center text-white/60 mt-4">
          Connexion requise pour accéder à l'application
        </p>
      </div>
    </div>
  )
}
