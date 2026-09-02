import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, AlertTriangle, CheckCircle, Users } from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import { useAuth } from '@/components/AuthProvider'
import { useUserRole } from '@/hooks/shared/useUserRole'

interface ComplianceCheck {
  check_name: string
  status: string
  details: string
  recommendation: string
}

/**
 * V5.4 perf — RPC `get_security_compliance_report` est très coûteuse (mean ~200 ms,
 * #1 sur pg_stat_statements). Désormais : admin-only + cache React Query 15 min,
 * pas de refetch focus/reconnect, action "Actualiser" force l'invalidation.
 */
export function SecurityComplianceDashboard() {
  const { user } = useAuth()
  const { isAdmin } = useUserRole()
  const { toast } = useToast()

  const { data: complianceData = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['security-compliance-report', user?.id],
    enabled: !!user && isAdmin,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_security_compliance_report')
      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger le rapport de conformité',
          variant: 'destructive',
        })
        throw error
      }
      return (data as ComplianceCheck[] | null) || []
    },
  })

  const loadComplianceReport = () => { refetch() }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return 'destructive'
      case 'WARNING':
        return 'secondary'
      case 'OK':
        return 'default'
      default:
        return 'outline'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return <AlertTriangle className="h-4 w-4 text-destructive" />
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'OK':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <Shield className="h-4 w-4" />
    }
  }

  const criticalIssues = complianceData.filter(item => item.status === 'CRITICAL')
  const warningIssues = complianceData.filter(item => item.status === 'WARNING')
  const okIssues = complianceData.filter(item => item.status === 'OK')

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Conformité Sécurité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Chargement du rapport de conformité...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Tableau de Bord Sécurité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="text-2xl font-bold text-red-600">{criticalIssues.length}</div>
              <div className="text-sm text-red-700">Problèmes Critiques</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{warningIssues.length}</div>
              <div className="text-sm text-yellow-700">Avertissements</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-2xl font-bold text-green-600">{okIssues.length}</div>
              <div className="text-sm text-green-700">Conformes</div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={loadComplianceReport} variant="outline" size="sm" disabled={isFetching}>
              {isFetching ? 'Actualisation…' : 'Actualiser'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {criticalIssues.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Action immédiate requise :</strong> {criticalIssues.length} problème(s) critique(s) détecté(s). 
            Certaines fonctions administratives sont restreintes jusqu'à la résolution.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {complianceData.map((item) => (
          <Card key={item.check_name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {getStatusIcon(item.status)}
                  {item.check_name}
                </CardTitle>
                <Badge variant={getStatusColor(item.status)}>
                  {item.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">État actuel</div>
                  <div className="text-sm">{item.details}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Recommandation</div>
                  <div className="text-sm">{item.recommendation}</div>
                </div>
                
                {item.check_name === 'Admin 2FA Compliance' && item.status === 'CRITICAL' && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                      <Users className="h-4 w-4" />
                      Action requise
                    </div>
                    <div className="text-sm text-blue-700">
                      Les administrateurs sans 2FA doivent activer l'authentification à deux facteurs 
                      immédiatement. Rendez-vous dans votre profil utilisateur pour configurer 2FA.
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions de Sécurité Recommandées</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Authentification à deux facteurs (2FA)</div>
                <div className="text-muted-foreground">
                  Activée pour toutes les opérations sensibles des administrateurs
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Audit des opérations critiques</div>
                <div className="text-muted-foreground">
                  Toutes les actions administratives sensibles sont enregistrées
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Protection des données clients</div>
                <div className="text-muted-foreground">
                  Contrôles d'accès renforcés sur les informations de contact
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}