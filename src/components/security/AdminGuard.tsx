import { useEffect, useState } from 'react'
import { debug } from '@/lib/debug'
import { useAuth } from '@/components/AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Shield, Lock, CheckCircle2 } from 'lucide-react'
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'

interface AdminGuardProps {
  children: React.ReactNode
  operationName?: string
  requireStrictAdmin?: boolean
}

interface AdminStatus {
  isAdmin: boolean
  has2FA: boolean
  isStrict: boolean
}

export function AdminGuard({ children, operationName = "cette opération", requireStrictAdmin = true }: AdminGuardProps) {
  const { user, twoFactorStatus, complete2FAEnrollment } = useAuth()
  const { toast } = useToast()
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [show2FASetup, setShow2FASetup] = useState(false)

  useEffect(() => {
    if (user) {
      checkAdminStatus()
    }
  }, [user, twoFactorStatus])

  const checkAdminStatus = async () => {
    try {
      const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin')
      if (adminError) {
        throw new Error('Erreur lors de la vérification des permissions')
      }

      const hasVerifiedMfa = twoFactorStatus === 'verified'

      setAdminStatus({
        isAdmin: isAdminData || false,
        has2FA: hasVerifiedMfa,
        isStrict: Boolean(isAdminData && hasVerifiedMfa)
      })
    } catch (error) {
      debug.error('Error checking admin status:', error)
      toast({
        title: "Erreur de sécurité",
        description: "Impossible de vérifier vos permissions d'administrateur",
        variant: "destructive"
      })
      setAdminStatus({
        isAdmin: false,
        has2FA: false,
        isStrict: false
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handle2FASetupComplete = async () => {
    const completed = await complete2FAEnrollment()
    if (!completed) {
      toast({
        title: "Enrôlement 2FA incomplet",
        description: "La session n'a pas atteint le niveau AAL2. Reconnectez-vous puis réessayez.",
        variant: "destructive"
      })
      return
    }
    setShow2FASetup(false)
    setAdminStatus((current) => current && {
      ...current,
      has2FA: true,
      isStrict: current.isAdmin,
    })
    toast({
      title: "2FA activé avec succès",
      description: "Vous pouvez maintenant accéder aux fonctions d'administration",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // User is not an admin at all
  if (!adminStatus?.isAdmin) {
    return (
      <Card
        className="max-w-md mx-auto mt-8"
        role="alert"
        aria-labelledby="admin-guard-denied-title"
        data-testid="access-denied"
      >
        <CardHeader>
          <CardTitle
            id="admin-guard-denied-title"
            className="flex items-center gap-2 text-destructive"
            data-testid="access-denied-title"
          >
            <Lock className="h-5 w-5" aria-hidden="true" />
            Accès refusé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert className="border-destructive/20">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription data-testid="access-denied-reason">
              Vous n'avez pas les permissions d'administrateur nécessaires pour accéder à {operationName}.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground" data-testid="access-denied-required-role">
            Rôle requis : <strong className="text-foreground">admin{requireStrictAdmin ? ' (avec 2FA)' : ''}</strong>
          </p>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={() => window.history.back()} data-testid="access-denied-back">
              Retour
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }


  // Admin user but 2FA not enabled (critical security issue)
  if (requireStrictAdmin && !adminStatus.has2FA) {
    if (show2FASetup) {
      return (
        <div className="max-w-md mx-auto mt-8">
          <TwoFactorSetup 
            onComplete={handle2FASetupComplete}
            onCancel={() => setShow2FASetup(false)}
          />
        </div>
      )
    }

    return (
      <Card className="max-w-2xl mx-auto mt-8 border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Configuration de sécurité requise
          </CardTitle>
          <CardDescription>
            Pour des raisons de sécurité, l'authentification à deux facteurs (2FA) est obligatoire pour les administrateurs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-destructive/20">
            <Shield className="h-4 w-4" />
            <AlertDescription className="font-medium">
              <strong>SÉCURITÉ CRITIQUE :</strong> Vous devez activer le 2FA avant d'accéder à {operationName}.
            </AlertDescription>
          </Alert>

          <div className="bg-background rounded-lg p-4 border">
            <h4 className="font-medium mb-2">État actuel de votre compte :</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Rôle Administrateur
                </Badge>
                <span className="text-sm text-muted-foreground">Vérifié</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  2FA Non Configuré
                </Badge>
                <span className="text-sm text-muted-foreground">Requis pour continuer</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Pourquoi le 2FA est-il obligatoire ?</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Protection contre l'accès non autorisé à des données sensibles</li>
              <li>• Conformité aux standards de sécurité</li>
              <li>• Protection des informations clients et établissements</li>
              <li>• Audit de sécurité et traçabilité des actions</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              onClick={() => setShow2FASetup(true)}
              className="flex-1"
            >
              <Shield className="h-4 w-4 mr-2" />
              Configurer le 2FA maintenant
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Admin with 2FA - allow access
  if (adminStatus.isStrict || !requireStrictAdmin) {
    return <>{children}</>
  }

  // Fallback - should not reach here
  return (
    <Card
      className="max-w-md mx-auto mt-8"
      role="alert"
      aria-labelledby="admin-guard-fallback-title"
      data-testid="access-denied"
    >
      <CardHeader>
        <CardTitle
          id="admin-guard-fallback-title"
          className="flex items-center gap-2 text-destructive"
          data-testid="access-denied-title"
        >
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          Accès refusé
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="border-destructive/20">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription data-testid="access-denied-reason">
            Une erreur inattendue s'est produite lors de la vérification de vos permissions.
            Veuillez vous reconnecter et réessayer.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
