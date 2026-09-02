import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'

interface EmailValidationIndicatorProps {
  email: string
  className?: string
}

export function validateEmail(email: string): { isValid: boolean; message: string } {
  if (!email) {
    return { isValid: false, message: '' }
  }

  // Vérification basique du format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { isValid: false, message: "Format d'email invalide" }
  }

  // Vérification du domaine
  const domain = email.split('@')[1]
  if (!domain || domain.length < 3) {
    return { isValid: false, message: 'Domaine invalide' }
  }

  // Vérification des caractères spéciaux
  const localPart = email.split('@')[0]
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { isValid: false, message: "L'email ne peut pas commencer ou finir par un point" }
  }

  return { isValid: true, message: 'Email valide' }
}

export function EmailValidationIndicator({ email, className }: EmailValidationIndicatorProps) {
  const validation = validateEmail(email)

  if (!email) return null

  return (
    <div className={cn('flex items-center gap-2 text-xs animate-fade-in', className)}>
      {validation.isValid ? (
        <>
          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
          <span className="text-green-600 dark:text-green-400">{validation.message}</span>
        </>
      ) : (
        <>
          <X className="h-3 w-3 text-destructive" />
          <span className="text-destructive">{validation.message}</span>
        </>
      )}
    </div>
  )
}
