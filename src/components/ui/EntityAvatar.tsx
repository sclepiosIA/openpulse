import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import marqueLogo from '@/assets/marque/logo.png'
import { useEmailSenderLogo } from '@/hooks/email/useEmailSenderLogo'
import { useProfileAvatarByEmail } from '@/hooks/profile/useProfileAvatarByEmail'
import { isMarqueEmail } from '@/lib/internalEmailConfig'

interface EntityAvatarProps {
  name: string
  logoUrl?: string | null
  email?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  isUnread?: boolean
  /** Force l'affichage du logo OpenPulse même si le domaine n'est pas interne (pour Gmail des membres) */
  forceInternal?: boolean
  /** Avatar de profil interne déjà récupéré (évite requête dupliquée) */
  internalProfileAvatarUrl?: string | null
}

// Generate consistent color based on string hash
function getAvatarColor(str: string): string {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-pink-500',
  ]

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const sizeClasses = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
}

export function EntityAvatar({
  name,
  logoUrl,
  email,
  size = 'md',
  className,
  isUnread,
  forceInternal,
  internalProfileAvatarUrl,
}: EntityAvatarProps) {
  const initials = getInitials(name)
  const colorClass = getAvatarColor(name)

  // Vérifier si c'est un email interne via domaine
  const internalFromDomain = forceInternal || isMarqueEmail(email)

  // Récupérer l'avatar du profil si c'est un membre équipe (sauf si déjà fourni)
  const { data: profileAvatar } = useProfileAvatarByEmail(
    internalProfileAvatarUrl !== undefined ? undefined : email
  )

  // Si on a trouvé un profil via mapping, c'est aussi un membre interne
  const internalFromMapping = !!profileAvatar?.profileId
  const isInternal = internalFromDomain || internalFromMapping

  // Avatar de profil effectif (prop ou récupéré via hook)
  const effectiveProfileAvatarUrl = internalProfileAvatarUrl ?? profileAvatar?.avatarUrl

  // Utiliser le hook pour récupérer le logo établissement/groupe via email_domain_mappings
  const { data: senderLogo } = useEmailSenderLogo(email)

  // Priorité :
  // 1. Avatar profil personnel (membre interne avec photo)
  // 2. Logo OpenPulse (membre interne sans photo)
  // 3. Logo fourni en prop
  // 4. Logo récupéré via email_domain_mappings
  // 5. Initiales (fallback automatique via AvatarFallback)
  let displayLogo: string | null = null
  let altText = name
  let useMarqueStyle = false

  if (isInternal) {
    if (effectiveProfileAvatarUrl) {
      // Avatar personnel du membre
      displayLogo = effectiveProfileAvatarUrl
      altText = profileAvatar?.displayName || name
    } else {
      // Fallback vers le logo OpenPulse pour les membres sans avatar
      displayLogo = logoUrl || marqueLogo
      altText = 'OpenPulse'
      useMarqueStyle = true
    }
  } else if (logoUrl) {
    displayLogo = logoUrl
  } else if (senderLogo?.logoUrl) {
    displayLogo = senderLogo.logoUrl
    altText = senderLogo.entityName || name
  }
  // Sinon: pas de displayLogo → on affichera les initiales

  return (
    <Avatar
      className={cn(
        sizeClasses[size],
        className,
        isUnread && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      {displayLogo && (
        <AvatarImage
          src={displayLogo}
          alt={altText}
          className={cn('object-cover', useMarqueStyle && 'p-1 bg-plaque')}
        />
      )}
      <AvatarFallback
        className={cn(
          colorClass,
          'text-white font-medium',
          isUnread && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
