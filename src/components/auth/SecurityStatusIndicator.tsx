import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useUserRole } from '@/hooks/shared/useUserRole'

interface ComplianceCheck {
  check_name: string
  status: string
  details: string
  recommendation: string
}

/**
 * V5.3 perf — avant : RPC `get_security_compliance_report` (mean 201 ms) appelée
 * sur chaque montage de sidebar pour TOUS les utilisateurs → 60 K appels / mois
 * et 12 K secondes de DB time. Désormais :
 *  - rendu réservé aux admins / direction (information non actionnable pour les autres)
 *  - React Query avec staleTime 15 min + gcTime 30 min (la conformité change lentement)
 *  - une seule requête par session par utilisateur admin
 */
export function SecurityStatusIndicator() {
  const { user } = useAuth()
  const { isAdmin } = useUserRole()

  const { data, isLoading } = useQuery({
    queryKey: ['security-compliance-report', user?.id],
    enabled: !!user && isAdmin,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_security_compliance_report')
      if (error) throw error
      return (data as ComplianceCheck[] | null) || []
    },
  })

  if (!user || !isAdmin || isLoading || !data) return null

  const critical = data.filter((i) => i.status === 'CRITICAL').length
  const warnings = data.filter((i) => i.status === 'WARNING').length

  if (critical > 0) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        {critical} Critique{critical > 1 ? 's' : ''}
      </Badge>
    )
  }
  if (warnings > 0) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        {warnings} Alerte{warnings > 1 ? 's' : ''}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-200">
      <CheckCircle className="h-3 w-3" />
      Sécurisé
    </Badge>
  )
}
