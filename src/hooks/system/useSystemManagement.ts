import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { debug } from '@/lib/debug'
import { useAuth } from '@/components/AuthProvider'

export interface DatabaseStats {
  totalSize: string
  tables: number
  records: number
  indexes: number
  connections: number
  uptime: string
  queryTime: number
  cacheHitRatio: number
  tableStats: TableStat[]
  lastCheck?: string
}

export interface TableStat {
  name: string
  records: number
  size: string
  lastUpdated: string
}

export interface BackupFile {
  id: string
  name: string
  size: string
  date: string
  type: 'auto' | 'manual'
  status: 'completed' | 'in_progress' | 'failed'
}

export interface SecurityStats {
  totalUsers: number
  activeUsers: number
  blockedIPs: number
  failedLogins: number
  lastSecurityScan: string
  securityScore: number
  vulnerabilities: number
  activeSessions: number
}

export interface SecurityLog {
  id: string
  timestamp: string
  type: 'login' | 'logout' | 'failed_login' | 'password_change' | 'suspicious_activity'
  user: string
  ip: string
  userAgent: string
  location: string
  risk: 'low' | 'medium' | 'high'
}

export interface NotificationStats {
  totalSent: number
  emailsSent: number
  failedDeliveries: number
  deliveryRate: number
  lastSent: string
}

// Hook pour les statistiques de base de données
export function useDatabaseStats() {
  return useQuery({
    queryKey: ['database-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_db_stats')

      if (error) {
        debug.error('Error fetching database stats:', error)
        throw error
      }

      const stats =
        (
          data as {
            storage_size?: string
            table_count?: number
            total_records?: number
            cache_hit_ratio?: number
          }[]
        )?.[0] || {}

      // Get table details for more comprehensive stats
      const [
        { count: totalProfiles },
        { count: totalEtablissements },
        { count: totalTaches },
        { count: totalCategories },
        { count: totalContacts },
        { count: totalModeles },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('etablissements').select('id', { count: 'exact', head: true }),
        supabase.from('taches').select('id', { count: 'exact', head: true }),
        supabase.from('categories_taches').select('id', { count: 'exact', head: true }),
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('modeles_taches').select('id', { count: 'exact', head: true }),
        supabase
          .from('system_stats')
          .select('recorded_at')
          .eq('metric_name', 'database_optimized')
          .order('recorded_at', { ascending: false })
          .limit(1),
      ])

      // Récupérer la dernière vérification depuis system_stats
      const { data: lastCheckData } = await supabase
        .from('system_stats')
        .select('recorded_at')
        .eq('metric_name', 'db_connection_test')
        .order('recorded_at', { ascending: false })
        .limit(1)

      const lastCheck = lastCheckData?.[0]?.recorded_at
      const lastCheckFormatted = lastCheck
        ? `${formatTimeAgo(new Date(lastCheck))}`
        : 'Jamais vérifié'

      const tableStats: TableStat[] = [
        {
          name: 'etablissements',
          records: totalEtablissements || 0,
          size: `${Math.max(2, (totalEtablissements || 0) * 0.5).toFixed(1)}KB`,
          lastUpdated: 'N/A',
        },
        {
          name: 'taches',
          records: totalTaches || 0,
          size: `${Math.max(5, (totalTaches || 0) * 0.3).toFixed(1)}KB`,
          lastUpdated: 'N/A',
        },
        {
          name: 'profiles',
          records: totalProfiles || 0,
          size: `${Math.max(1, (totalProfiles || 0) * 0.2).toFixed(1)}KB`,
          lastUpdated: 'N/A',
        },
        {
          name: 'categories_taches',
          records: totalCategories || 0,
          size: `${Math.max(0.1, (totalCategories || 0) * 0.1).toFixed(1)}KB`,
          lastUpdated: 'N/A',
        },
        {
          name: 'contacts',
          records: totalContacts || 0,
          size: `${Math.max(1, (totalContacts || 0) * 0.3).toFixed(1)}KB`,
          lastUpdated: 'N/A',
        },
        {
          name: 'modeles_taches',
          records: totalModeles || 0,
          size: `${Math.max(0.5, (totalModeles || 0) * 0.2).toFixed(1)}KB`,
          lastUpdated: 'N/A',
        },
      ]

      const dbStats: DatabaseStats = {
        totalSize: stats.storage_size || '0 bytes',
        tables: Number(stats.table_count || 0),
        records: Number(stats.total_records || 0),
        indexes: 12, // Valeur fixe basée sur la structure DB connue
        connections: 0, // Non disponible côté client - afficher N/A
        uptime: 'Géré par Supabase',
        queryTime: 0, // Non disponible côté client
        cacheHitRatio: Number(stats.cache_hit_ratio || 95),
        tableStats,
        lastCheck: lastCheckFormatted,
      }

      return dbStats
    },
    refetchInterval: 2 * 60 * 1000, // 2 minutes - admin page rarely open
    staleTime: 2 * 60 * 1000,
  })
}

// Fonction utilitaire pour formater le temps écoulé
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return "À l'instant"
  if (diffMinutes < 60) return `il y a ${diffMinutes}min`
  if (diffHours < 24) return `il y a ${diffHours}h`
  return `il y a ${diffDays}j`
}

// Hook pour les statistiques de sécurité avec score dynamique
export function useSecurityStats() {
  return useQuery({
    queryKey: ['security-stats'],
    queryFn: async () => {
      const [securityStatsResult, securityConfigResult, admin2FAResult, lastScanResult] =
        await Promise.all([
          supabase.rpc('get_security_stats'),
          supabase
            .from('security_config')
            .select(
              'id, password_min_length, password_require_uppercase, password_require_lowercase, password_require_numbers, password_require_symbols, password_expiration, two_factor_required, session_timeout, max_login_attempts, lockout_duration, ip_whitelist_enabled, brute_force_protection, security_headers, audit_logging, login_alerts, suspicious_activity_alerts, password_change_alerts, created_at, updated_at'
            )
            .maybeSingle(),
          // Vérifier combien d'admins ont 2FA activé
          supabase.from('profiles').select('id, two_factor_enabled').eq('actif', true).limit(200),
          // Dernière analyse de sécurité
          supabase
            .from('system_stats')
            .select('recorded_at')
            .eq('metric_name', 'security_scan')
            .order('recorded_at', { ascending: false })
            .limit(1),
        ])

      const stats =
        (
          securityStatsResult.data as {
            total_users?: number
            blocked_ips?: number
            failed_logins?: number
            active_sessions?: number
            security_incidents?: number
          }[]
        )?.[0] || {}
      const secConfig = securityConfigResult.data
      const profiles = admin2FAResult.data || []
      const lastScan = lastScanResult.data?.[0]?.recorded_at

      // Calculer le score de sécurité dynamiquement
      let securityScore = 0
      const maxScore = 100

      // 2FA activé pour admins (+20 pts max)
      const usersWithTwoFA = profiles.filter((p) => p.two_factor_enabled).length
      const twoFAPercentage = profiles.length > 0 ? usersWithTwoFA / profiles.length : 0
      securityScore += Math.round(twoFAPercentage * 20)

      // Complexité mots de passe activée (+15 pts)
      if (secConfig?.password_require_uppercase && secConfig?.password_require_numbers) {
        securityScore += 15
      }

      // Audit logging activé (+15 pts)
      if (secConfig?.audit_logging) {
        securityScore += 15
      }

      // Protection brute force (+15 pts)
      if (secConfig?.brute_force_protection) {
        securityScore += 15
      }

      // Pas d'incidents de sécurité récents (+35 pts)
      const securityIncidents = Number(stats.security_incidents || 0)
      if (securityIncidents === 0) {
        securityScore += 35
      } else if (securityIncidents < 3) {
        securityScore += 20
      } else if (securityIncidents < 10) {
        securityScore += 10
      }

      // Formater la dernière analyse
      const lastSecurityScan = lastScan ? formatTimeAgo(new Date(lastScan)) : 'Jamais effectuée'

      return {
        totalUsers: Number(stats.total_users || 0),
        activeUsers: Number(stats.total_users || 0),
        blockedIPs: Number(stats.blocked_ips || 0),
        failedLogins: Number(stats.failed_logins || 0),
        activeSessions: Number(stats.active_sessions || 0),
        securityIncidents,
        lastSecurityScan,
        securityScore: Math.min(securityScore, maxScore),
        vulnerabilities: securityIncidents,
      }
    },
    refetchInterval: 2 * 60 * 1000, // 2 minutes - admin page rarely open
    staleTime: 2 * 60 * 1000,
  })
}

// Hook pour la configuration de sécurité
export function useSecurityConfig() {
  return useQuery({
    queryKey: ['security-config'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('security_config')
          .select(
            'id, password_min_length, password_require_uppercase, password_require_lowercase, password_require_numbers, password_require_symbols, password_expiration, two_factor_required, session_timeout, max_login_attempts, lockout_duration, ip_whitelist_enabled, brute_force_protection, security_headers, audit_logging, login_alerts, suspicious_activity_alerts, password_change_alerts, created_at, updated_at'
          )
          .single()

        if (error) throw error
        return data
      } catch (error) {
        debug.error('Error fetching security config:', error)
        throw error
      }
    },
  })
}

// Hook pour les logs de sécurité
export function useSecurityLogs() {
  return useQuery({
    queryKey: ['security-logs'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('security_logs')
          .select(
            `
            *,
            profiles:user_id(nom, prenom)
          `
          )
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        return data || []
      } catch (error) {
        debug.error('Error fetching security logs:', error)
        throw error
      }
    },
  })
}

// Hook pour les IPs bloquées
export function useBlockedIPs() {
  return useQuery({
    queryKey: ['blocked-ips'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('blocked_ips')
          .select(
            `
            *,
            profiles:blocked_by(nom, prenom)
          `
          )
          .order('blocked_at', { ascending: false })

        if (error) throw error
        return data || []
      } catch (error) {
        debug.error('Error fetching blocked IPs:', error)
        throw error
      }
    },
  })
}

// Hook pour les statistiques de notifications
export function useNotificationStats() {
  return useQuery({
    queryKey: ['notification-stats'],
    queryFn: async () => {
      // Get real notification stats from notifications_history table
      const { data: history, error } = await supabase
        .from('notifications_history')
        .select('status, sent_at')
        .order('sent_at', { ascending: false })
        .limit(100)

      if (error) {
        debug.error('Error fetching notification stats:', error)
        // Return default stats if error
        return {
          totalSent: 0,
          emailsSent: 0,
          failedDeliveries: 0,
          deliveryRate: 100,
          lastSent: 'Aucune notification envoyée',
        }
      }

      const totalSent = history?.length || 0
      const emailsSent = history?.filter((n) => n.status === 'sent').length || 0
      const failedDeliveries = history?.filter((n) => n.status === 'failed').length || 0
      const deliveryRate = totalSent > 0 ? Math.round((emailsSent / totalSent) * 100) : 100
      const lastSent = history?.[0]?.sent_at
        ? new Date(history[0].sent_at).toLocaleString('fr-FR')
        : 'Aucune notification envoyée'

      const stats: NotificationStats = {
        totalSent,
        emailsSent,
        failedDeliveries,
        deliveryRate,
        lastSent,
      }

      return stats
    },
  })
}

// Hook pour les actions de maintenance de base de données
export function useDatabaseActions() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return {
    createBackup: useMutation({
      mutationFn: async () => {
        // Enregistrer l'action dans les stats système
        await supabase.from('system_stats').insert({
          metric_name: 'backup_requested',
          metric_value: new Date().toISOString(),
          metric_type: 'event',
        })

        // Note: Les vraies sauvegardes sont gérées par Supabase automatiquement
        return { success: true }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['database-stats'] })
        toast({
          title: 'Demande enregistrée',
          description: 'Les sauvegardes automatiques sont gérées par Supabase',
        })
      },
      onError: () => {
        toast({
          title: 'Erreur',
          description: "Impossible d'enregistrer la demande",
          variant: 'destructive',
        })
      },
    }),

    optimizeDatabase: useMutation({
      mutationFn: async () => {
        await supabase.from('system_stats').insert({
          metric_name: 'database_optimized',
          metric_value: new Date().toISOString(),
          metric_type: 'event',
        })

        // Note: L'optimisation automatique est gérée par Supabase
        return { success: true }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['database-stats'] })
        toast({
          title: 'Demande enregistrée',
          description: "L'optimisation automatique est gérée par Supabase",
        })
      },
      onError: () => {
        toast({
          title: 'Erreur',
          description: "Impossible d'enregistrer la demande",
          variant: 'destructive',
        })
      },
    }),

    testConnection: useMutation({
      mutationFn: async () => {
        // Tester la connexion à la base de données
        const { error } = await supabase.from('profiles').select('id').limit(1)
        if (error) throw error

        // Enregistrer le test de connexion
        await supabase.from('system_stats').insert({
          metric_name: 'db_connection_test',
          metric_value: 'success',
          metric_type: 'event',
        })

        return { success: true }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['database-stats'] })
        toast({
          title: 'Connexion réussie',
          description: 'La connexion à la base de données fonctionne correctement',
        })
      },
      onError: () => {
        toast({
          title: 'Erreur de connexion',
          description: 'Impossible de se connecter à la base de données',
          variant: 'destructive',
        })
      },
    }),
  }
}

// Hook pour les sessions utilisateurs actives
export function useUserSessions() {
  return useQuery({
    queryKey: ['user-sessions'],
    queryFn: async () => {
      // Get active sessions from security logs (login events within last hour)
      const { data, error } = await supabase
        .from('security_logs')
        .select('user_id, user_email, ip_address, user_agent, created_at')
        .eq('log_type', 'login_success')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        debug.error('Error fetching user sessions:', error)
        // Fallback to profiles data - sans données simulées
        const { data: profiles } = await supabase
          .from('profiles')
          .select(
            `
            id,
            user_id,
            email,
            nom,
            prenom,
            actif,
            updated_at
          `
          )
          .eq('actif', true)
          .order('updated_at', { ascending: false })
          .limit(10)

        const sessions = (profiles || []).map((profile) => {
          const lastActivity = new Date(profile.updated_at)

          return {
            id: profile.user_id,
            userId: profile.user_id,
            email: profile.email,
            userName: `${profile.prenom} ${profile.nom}`,
            lastActivity: lastActivity.toISOString(),
            ipAddress: 'Non disponible',
            userAgent: 'Non disponible',
            location: 'Non disponible',
            sessionStart: profile.updated_at,
            isActive: true,
            deviceType: 'unknown' as const,
          }
        })

        return sessions
      }

      // Group by user_id to get unique sessions
      type SessionAcc = {
        id: string;
        userId: string;
        userName: string;
        email?: string;
        ipAddress: string;
        userAgent: string;
        lastActivity: string;
        isActive: boolean;
        sessionStart: string;
        deviceType: 'mobile' | 'desktop' | 'unknown';
        location: string;
      };
      const uniqueSessions =
        data?.reduce((acc: SessionAcc[], log) => {
          if (!log.user_id) return acc;
          if (!acc.find((session) => session.userId === log.user_id)) {
            acc.push({
              id: log.user_id,
              userId: log.user_id,
              userName: log.user_email || 'Utilisateur inconnu',
              email: log.user_email || undefined,
              ipAddress: String(log.ip_address ?? 'IP inconnue'),
              userAgent: log.user_agent || 'User-Agent inconnu',
              lastActivity: log.created_at ?? '',
              isActive: true,
              sessionStart: log.created_at ?? '',
              deviceType: (log.user_agent || '').toLowerCase().includes('mobile')
                ? 'mobile'
                : 'desktop',
              location: 'Localisation inconnue',
            })
          }
          return acc
        }, []) || []

      return uniqueSessions
    },
    refetchInterval: 2 * 60 * 1000, // 2 minutes - admin page rarely open
  })
}
export function useSecurityActions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return {
    saveSecurityConfig: useMutation({
      mutationFn: async (config: Record<string, unknown>) => {
        const { data, error } = await supabase
          .from('security_config')
          .update({
            password_min_length: config.passwordMinLength as number,
            password_require_uppercase: config.passwordRequireUppercase as boolean,
            password_require_lowercase: config.passwordRequireLowercase as boolean,
            password_require_numbers: config.passwordRequireNumbers as boolean,
            password_require_symbols: config.passwordRequireSymbols as boolean,
            password_expiration: config.passwordExpiration as number,
            two_factor_required: config.twoFactorRequired as boolean,
            session_timeout: config.sessionTimeout as number,
            max_login_attempts: config.maxLoginAttempts as number,
            lockout_duration: config.lockoutDuration as number,
            ip_whitelist_enabled: config.ipWhitelistEnabled as boolean,
            brute_force_protection: config.bruteForceProtection as boolean,
            security_headers: config.securityHeaders as boolean,
            audit_logging: config.auditLogging as boolean,
            login_alerts: config.loginAlerts as boolean,
            suspicious_activity_alerts: config.suspiciousActivityAlerts as boolean,
            password_change_alerts: config.passwordChangeAlerts as boolean,
          })
          .eq('id', (await supabase.from('security_config').select('id').single()).data?.id || '')

        if (error) throw error
        return data
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['security-config'] })
        toast({
          title: 'Configuration sauvegardée',
          description: 'Les paramètres de sécurité ont été mis à jour',
        })
      },
      onError: () => {
        toast({
          title: 'Erreur',
          description: 'Impossible de sauvegarder la configuration',
          variant: 'destructive',
        })
      },
    }),

    blockIP: useMutation({
      mutationFn: async ({ ip, reason }: { ip: string; reason?: string }) => {
        const { data, error } = await supabase.from('blocked_ips').insert({
          ip_address: ip,
          reason: reason || 'Activité suspecte détectée',
          blocked_by: (
            await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', user?.id || '')
              .single()
          ).data?.id,
        })

        if (error) throw error
        return data
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['blocked-ips'] })
        toast({
          title: 'Adresse IP bloquée',
          description: `L'adresse ${variables.ip} a été ajoutée à la liste noire`,
        })
      },
      onError: () => {
        toast({
          title: 'Erreur',
          description: "Impossible de bloquer l'adresse IP",
          variant: 'destructive',
        })
      },
    }),

    unblockIP: useMutation({
      mutationFn: async (ipId: string) => {
        const { error } = await supabase.from('blocked_ips').delete().eq('id', ipId)

        if (error) throw error
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['blocked-ips'] })
        toast({
          title: 'Adresse IP débloquée',
          description: "L'adresse IP a été retirée de la liste noire",
        })
      },
      onError: () => {
        toast({
          title: 'Erreur',
          description: "Impossible de débloquer l'adresse IP",
          variant: 'destructive',
        })
      },
    }),

    logSecurityEvent: useMutation({
      mutationFn: async (logData: {
        log_type: string
        user_id?: string
        user_email?: string
        ip_address?: string
        user_agent?: string
        location?: string
        risk_level?: string
        metadata?: Record<string, unknown>
      }) => {
        const { data, error } = await supabase.from('security_logs').insert(logData as never)

        if (error) throw error
        return data
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['security-logs'] })
      },
    }),
  }
}
