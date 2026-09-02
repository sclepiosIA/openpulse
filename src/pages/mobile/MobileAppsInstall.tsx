import { useState, useEffect } from 'react'
import { debug } from '@/lib/debug'
import { Link } from 'react-router-dom'
import {
  Smartphone,
  Mail,
  CheckSquare,
  MessageCircle,
  Calendar,
  LayoutDashboard,
  Bot,
  ExternalLink,
  Download,
  Share,
  Plus,
} from 'lucide-react'
import QRCode from 'qrcode'
import { MobileAppLayout } from '@/components/layouts/MobileAppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const MOBILE_APPS = [
  {
    name: 'OpenPulse',
    key: 'dashboard',
    path: '/',
    icon: LayoutDashboard,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    logoIcon: '/placeholder.svg',
    description: 'Application complète - Dashboard, CRM, RH, Trésorerie',
    isPrimary: true,
  },
  {
    name: 'Jarvis',
    key: 'jarvis',
    path: '/m/jarvis',
    icon: Bot,
    color: 'text-[#353a46]',
    bgColor: 'bg-[#353a46]/10',
    logoIcon: '/icons/app-jarvis-512.png',
    description: 'Assistant IA intelligent - GPT-5',
  },
  {
    name: 'Mail',
    key: 'mail',
    path: '/m/mail',
    icon: Mail,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    logoIcon: '/icons/app-mail-512.png',
    description: 'Accédez à votre messagerie professionnelle',
  },
  {
    name: 'Todos',
    key: 'todos',
    path: '/m/todos',
    icon: CheckSquare,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    logoIcon: '/icons/app-todos-512.png',
    description: 'Gérez vos tâches et todos Pulse',
  },
  {
    name: 'Pulse',
    key: 'pulse',
    path: '/m/pulse',
    icon: MessageCircle,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    logoIcon: '/icons/app-pulse-512.png',
    description: "Messagerie d'équipe en temps réel",
  },
  {
    name: 'Calendrier',
    key: 'calendrier',
    path: '/m/calendrier',
    icon: Calendar,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    logoIcon: '/icons/app-calendar-512.png',
    description: 'Votre agenda et événements',
  },
]

export default function MobileAppsInstall() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isAndroid = /Android/.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isMobile = isIOS || isAndroid

  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})

  // Generate QR codes on mount - pointing to install pages for proper manifest loading
  useEffect(() => {
    const generateQRCodes = async () => {
      const codes: Record<string, string> = {}
      for (const app of MOBILE_APPS) {
        // Point to /install page so manifest loads before auth
        const fullUrl = `${window.location.origin}${app.path}/install`
        try {
          codes[app.path] = await QRCode.toDataURL(fullUrl, {
            width: 120,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' },
          })
        } catch (err) {
          debug.error(`Failed to generate QR code for ${app.path}:`, err)
        }
      }
      setQrCodes(codes)
    }
    generateQRCodes()
  }, [])

  return (
    <MobileAppLayout
      title="Apps mobiles"
      icon={Smartphone}
      iconColor="text-primary"
      showBackButton
      backPath="/"
    >
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Installez vos apps</h2>
          <p className="text-muted-foreground text-sm">
            {isMobile
              ? "Accédez rapidement à vos outils depuis l'écran d'accueil"
              : 'Scannez le QR code avec votre téléphone pour installer'}
          </p>
        </div>

        {/* Apps Grid */}
        <div className="grid grid-cols-2 gap-3">
          {MOBILE_APPS.map((app) => (
            <Link key={app.path} to={app.path}>
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardContent className="p-4 text-center space-y-3">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={app.logoIcon}
                    alt={app.name}
                    className="w-16 h-16 rounded-2xl mx-auto shadow-md"
                  />
                  <div>
                    <h3 className="font-semibold text-sm">{app.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {app.description}
                    </p>
                  </div>

                  {/* QR Code - show on desktop only */}
                  {!isMobile && qrCodes[app.path] && (
                    <div className="pt-2">
                      <div className="bg-card p-2 rounded-lg inline-block shadow-sm">
                        <img
                          loading="lazy"
                          decoding="async"
                          src={qrCodes[app.path]}
                          alt={`QR Code ${app.name}`}
                          className="w-20 h-20"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Scanner pour ouvrir</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Installation Instructions */}
        {!isStandalone && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-5 w-5" />
                Comment installer
              </CardTitle>
              <CardDescription>
                Ajoutez cette app à votre écran d'accueil pour un accès rapide
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isIOS && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">1</span>
                    </div>
                    <p className="text-sm">
                      Appuyez sur le bouton <Share className="inline h-4 w-4 mx-1" /> Partager dans
                      Safari
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">2</span>
                    </div>
                    <p className="text-sm">
                      Faites défiler et appuyez sur <Plus className="inline h-4 w-4 mx-1" /> "Sur
                      l'écran d'accueil"
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">3</span>
                    </div>
                    <p className="text-sm">Confirmez en appuyant sur "Ajouter"</p>
                  </div>
                </div>
              )}

              {isAndroid && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">1</span>
                    </div>
                    <p className="text-sm">Appuyez sur le menu ⋮ dans Chrome</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">2</span>
                    </div>
                    <p className="text-sm">
                      Sélectionnez "Installer l'application" ou "Ajouter à l'écran d'accueil"
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">3</span>
                    </div>
                    <p className="text-sm">Confirmez l'installation</p>
                  </div>
                </div>
              )}

              {!isIOS && !isAndroid && (
                <p className="text-sm text-muted-foreground">
                  Ouvrez cette page sur votre téléphone pour voir les instructions d'installation.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isStandalone && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Download className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">App installée !</p>
                <p className="text-sm text-muted-foreground">
                  Vous utilisez déjà l'application en mode standalone
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Access */}
        <div className="pt-4 border-t">
          <p className="text-xs text-center text-muted-foreground">
            Accédez directement à chaque app en cliquant dessus ci-dessus
          </p>
        </div>
      </div>
    </MobileAppLayout>
  )
}
