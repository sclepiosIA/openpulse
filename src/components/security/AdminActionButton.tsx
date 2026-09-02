import { useState, ReactNode, forwardRef } from 'react'
import { debug } from '@/lib/debug'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Shield } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

interface AdminActionButtonProps {
  children: ReactNode
  operationName: string
  description: string
  onConfirm: () => void | Promise<void>
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  disabled?: boolean
  className?: string
  requireConfirmation?: boolean
}

export const AdminActionButton = forwardRef<HTMLButtonElement, AdminActionButtonProps>(({ 
  children, 
  operationName, 
  description, 
  onConfirm, 
  variant = "default",
  size = "default",
  disabled = false,
  className = "",
  requireConfirmation = true
}, ref) => {
  const { toast } = useToast()
  const [isExecuting, setIsExecuting] = useState(false)

  const executeAction = async () => {
    setIsExecuting(true)
    try {
      // Check admin 2FA status before executing
      const { data: isStrictAdmin, error } = await supabase.rpc('require_admin_2fa', {
        operation_name: operationName
      })

      if (error) {
        throw error
      }

      if (!isStrictAdmin) {
        toast({
          title: "Accès refusé",
          description: "Cette opération nécessite des privilèges d'administrateur avec 2FA",
          variant: "destructive"
        })
        return
      }

      // Execute the actual operation
      await onConfirm()
      
    } catch (error: unknown) {
      debug.error('Admin operation error:', error)
      
      const errMsg = error instanceof Error ? error.message : '';
      if (errMsg.includes('2FA')) {
        toast({
          title: "2FA requis",
          description: "Vous devez activer l'authentification à deux facteurs pour effectuer cette action",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Erreur",
          description: sanitizeSupabaseError(error),
          variant: "destructive"
        })
      }
    } finally {
      setIsExecuting(false)
    }
  }

  const buttonContent = (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      disabled={disabled || isExecuting}
      className={className}
    >
      {isExecuting ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
          Exécution...
        </>
      ) : (
        children
      )}
    </Button>
  )

  if (!requireConfirmation) {
    return (
      <div onClick={executeAction} style={{ display: 'inline-block' }}>
        {buttonContent}
      </div>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {buttonContent}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Confirmer l'opération d'administration
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Action d'administration :</strong> Cette opération sera auditée et nécessite des privilèges d'administrateur avec 2FA activé.
          </AlertDescription>
        </Alert>

        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={executeAction} disabled={isExecuting}>
            {isExecuting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Exécution...
              </>
            ) : (
              'Confirmer'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})

AdminActionButton.displayName = 'AdminActionButton'