import { TodoPage } from '@/components/todos/TodoPage'
import { AppInstallPrompt } from '@/components/pwa/AppInstallPrompt'

export default function MobileTodosApp() {
  return (
    <div className="h-dvh flex flex-col bg-background">
      <TodoPage isPWAMode={true} />
      <AppInstallPrompt
        appName="OpenPulse Tâches"
        appIcon="/icons/app-todos-192.png"
        themeColor="#31983D"
      />
    </div>
  )
}
