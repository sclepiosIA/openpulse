import { useNavigate } from 'react-router-dom'
import { JarvisPremiumPanel } from '@/components/jarvis/JarvisPremiumPanel'
import { AppInstallPrompt } from '@/components/pwa/AppInstallPrompt'

/**
 * MobileJarvisApp - Application PWA autonome pour Jarvis (v14.0)
 *
 * Interface plein écran avec:
 * - Surface plane conforme à la charte OpenPulse
 * - Animations fluides et immersives
 * - Support complet des safe areas iOS
 * - UX premium avec suggestions intelligentes
 * - Input smart avec quick actions
 */
export default function MobileJarvisApp() {
  const navigate = useNavigate()

  const handleBack = () => {
    navigate('/m/install')
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background pt-[env(safe-area-inset-top)]">
      {/* Main content - Jarvis Premium Panel v14.0 */}
      <main className="flex-1 overflow-hidden border-t-4 border-[var(--h-jarvis)]">
        <JarvisPremiumPanel onClose={handleBack} className="h-full" />
      </main>

      {/* Prompt d'installation PWA */}
      <AppInstallPrompt appName="Jarvis" appIcon="/icons/app-jarvis-512.png" themeColor="#0099AD" />
    </div>
  )
}
