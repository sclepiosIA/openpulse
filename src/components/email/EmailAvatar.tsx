import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import marqueLogo from '@/assets/marque/logo.png'
import { useEmailSenderLogo } from '@/hooks/email/useEmailSenderLogo'
import { useProfileAvatarByEmail } from '@/hooks/profile/useProfileAvatarByEmail'
import { isMarqueEmail, normalizeEmail } from '@/lib/internalEmailConfig'

interface EmailAvatarProps {
  name?: string | null
  email?: string
  isUnread?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Force l'affichage du logo OpenPulse même si le domaine n'est pas interne (pour Gmail des membres) */
  forceInternal?: boolean
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

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  if (email) {
    const localPart = email.split('@')[0]
    return localPart.substring(0, 2).toUpperCase()
  }

  return '??'
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function EmailAvatar({
  name,
  email,
  isUnread,
  size = 'md',
  className,
  forceInternal,
}: EmailAvatarProps) {
  const normalizedEmail = normalizeEmail(email) || undefined
  const initials = getInitials(name, normalizedEmail)
  const colorClass = getAvatarColor(name || normalizedEmail || 'unknown')

  // Récupérer l'avatar du profil (direct email ou via alias email_specific_mappings)
  const { data: profileAvatar } = useProfileAvatarByEmail(normalizedEmail)

  const internalFromDomain = forceInternal || isMarqueEmail(normalizedEmail)
  const internalFromMapping = !!profileAvatar?.profileId
  const isInternal = internalFromDomain || internalFromMapping

  // Utiliser le hook pour récupérer le logo établissement/groupe
  const { data: senderLogo } = useEmailSenderLogo(normalizedEmail)

  // Priorité : Avatar profil (interne) → Logo OpenPulse (interne sans avatar) → Logo établissement/groupe
  let displayImage: string | null = null
  let altText = 'Avatar'
  let useMarqueStyle = false

  if (isInternal) {
    if (profileAvatar?.avatarUrl) {
      // Avatar personnel du membre
      displayImage = profileAvatar.avatarUrl
      altText = profileAvatar.displayName || name || 'Membre OpenPulse'
    } else {
      // Fallback vers le logo OpenPulse pour les membres sans avatar
      displayImage = marqueLogo
      altText = 'OpenPulse'
      useMarqueStyle = true
    }
  } else if (senderLogo?.logoUrl) {
    displayImage = senderLogo.logoUrl
    altText = senderLogo.entityName || 'Logo'
  }

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {displayImage && (
        <AvatarImage
          src={displayImage}
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
