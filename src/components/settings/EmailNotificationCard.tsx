import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { cn } from '@/lib/utils'

export function EmailNotificationCard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-lg transition-all duration-200 bg-card/80 backdrop-blur-sm border-l-4 border-l-blue-500 group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isMobile && 'p-0'
      )}
      onClick={() => navigate('/profil?tab=notifications')}
      role="link"
      tabIndex={0}
      aria-label="Ouvrir les préférences de notifications email"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate('/profil?tab=notifications')
        }
      }}
    >
      <CardHeader className={cn('pb-2', isMobile && 'p-3 pb-1')}>
        <CardTitle className={cn('flex items-center gap-2', isMobile ? 'text-sm' : 'text-base')}>
          <div
            className={cn(
              'rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors relative',
              isMobile ? 'p-1.5' : 'p-2'
            )}
          >
            <Mail className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-blue-600')} />
            <Bell
              className={cn(
                'absolute -top-1 -right-1 text-blue-600',
                isMobile ? 'h-2 w-2' : 'h-2.5 w-2.5'
              )}
            />
          </div>
          Notifications Email
        </CardTitle>
        <CardDescription className={cn(isMobile ? 'text-xs line-clamp-1' : 'text-sm')}>
          Sons, alertes bureau et fréquence
        </CardDescription>
      </CardHeader>
      {!isMobile && (
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Configurez les notifications pour les nouveaux emails, sons et aperçus.
          </p>
        </CardContent>
      )}
    </Card>
  )
}
