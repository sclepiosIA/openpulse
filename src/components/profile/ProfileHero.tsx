import { Badge } from "@/components/ui/badge"
import { Shield, Calendar } from "lucide-react"
import { useAuth } from "@/components/AuthProvider"
import { UserAvatarUpload } from '@/components/ui/UserAvatarUpload'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface ProfileData {
  id: string
  nom: string
  prenom: string
  email: string
  avatar_url?: string | null
  created_at: string
  two_factor_enabled: boolean
}

interface ProfileHeroProps {
  profile: ProfileData | null
  userRole: string
  is2FAEnabled: boolean
  onAvatarChange?: (url: string | null) => void
}

export function ProfileHero({ profile, userRole, is2FAEnabled, onAvatarChange }: ProfileHeroProps) {
  const { user } = useAuth()

  if (!profile) return null

  const roleLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    admin: { label: "Administrateur", variant: "destructive" },
    manager: { label: "Manager", variant: "default" },
    chef_projet: { label: "Chef de projet", variant: "default" },
    csm: { label: "CSM", variant: "secondary" },
    commercial: { label: "Commercial", variant: "secondary" },
    rh: { label: "RH", variant: "secondary" },
    user: { label: "Utilisateur", variant: "outline" },
  }

  const roleInfo = roleLabels[userRole] || roleLabels.user

  const formattedDate = format(new Date(profile.created_at), 'MMMM yyyy', { locale: fr })

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border/50 p-6 md:p-8">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar */}
        <div className="shrink-0">
          <UserAvatarUpload
            currentAuthUserId={user?.id || ''}
            profileId={profile.id}
            currentAvatarUrl={profile.avatar_url}
            userName={`${profile.prenom} ${profile.nom}`}
            onAvatarChange={onAvatarChange}
            size="lg"
          />
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left space-y-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {profile.prenom} {profile.nom}
            </h1>
            <p className="text-muted-foreground mt-1">
              {profile.email}
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Badge variant={roleInfo.variant} className="text-xs px-2.5 py-0.5">
              {roleInfo.label}
            </Badge>
            
            {is2FAEnabled && (
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 bg-green-500/10 text-green-600 border-green-500/30">
                <Shield className="w-3 h-3 mr-1" />
                2FA activé
              </Badge>
            )}
          </div>

          {/* Member since */}
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Membre depuis {formattedDate}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
