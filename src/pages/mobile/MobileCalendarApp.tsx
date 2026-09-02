import Calendrier from '@/pages/Calendrier'
import { AppInstallPrompt } from '@/components/pwa/AppInstallPrompt'

export default function MobileCalendarApp() {
  return (
    <div className="h-screen flex flex-col">
      <Calendrier />
      <AppInstallPrompt
        appName="OpenPulse Calendrier"
        appIcon="/icons/app-calendar-192.png"
        themeColor="#C3518E"
      />
    </div>
  )
}
