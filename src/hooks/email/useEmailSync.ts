import { useCallback, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useErrorHandler } from '../shared/useErrorHandler'
import { debug } from '@/lib/debug'
import { fromExtended } from '@/lib/supabaseTyped'

interface EmailAccount {
  id: string
  email_address: string
}

/**
 * Hook pour gérer la synchronisation des emails
 * Centralise la logique de sync avec les edge functions
 * Supporte le mode "all" pour synchroniser tous les comptes
 */
export function useEmailSync(accountId?: string, allAccounts?: EmailAccount[]) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [deletedCount, setDeletedCount] = useState(0)
  const queryClient = useQueryClient()
  const { handleError } = useErrorHandler()

  // Réconciliation : détecte et supprime les emails supprimés depuis le client mail
  const reconcileEmails = useCallback(
    async (specificAccountId?: string): Promise<number> => {
      const targetAccountId = specificAccountId || accountId
      if (!targetAccountId || targetAccountId === 'all') return 0

      try {
        debug.log('🔄 Starting email reconciliation (deletion detection)...')

        const { data, error } = await supabase.functions.invoke('sync-emails', {
          body: {
            account_id: targetAccountId,
            reconcile_only: true,
          },
        })

        if (error) throw error

        const deleted = data?.deleted_count || 0
        debug.log('✅ Reconciliation completed:', { deleted })

        return deleted
      } catch (error) {
        debug.error('Error during reconciliation:', error)
        return 0
      }
    },
    [accountId]
  )

  // Synchronise un seul compte avec continuation automatique si has_more
  const syncSingleAccount = useCallback(
    async (targetAccountId: string, fullResync = false): Promise<number> => {
      let totalSynced = 0
      let hasMore = true
      let iterations = 0
      const MAX_ITERATIONS = 10 // Limite de sécurité anti-boucle infinie

      while (hasMore && iterations < MAX_ITERATIONS) {
        iterations++

        const { data, error } = await supabase.functions.invoke('sync-emails', {
          body: {
            account_id: targetAccountId,
            full_resync: fullResync,
          },
        })

        if (error) throw error

        const syncedThisRound = data?.messages_synced || data?.emailsSynced || data?.emailsSync || 0
        totalSynced += syncedThisRound
        hasMore = data?.has_more === true

        // Log progress for debugging
        if (hasMore) {
          debug.log(`📧 Sync iteration ${iterations}: ${totalSynced} total synced, continuing...`)
        }
      }

      if (iterations >= MAX_ITERATIONS && hasMore) {
        debug.log(`⚠️ Max iterations reached (${MAX_ITERATIONS}), some emails may remain`)
      }

      return totalSynced
    },
    []
  )

  const syncEmails = useCallback(
    async (fullSync = false) => {
      if (!accountId) {
        toast.error('Aucun compte email sélectionné')
        return
      }

      setIsSyncing(true)
      setSyncProgress(0)
      setDeletedCount(0)

      try {
        // Mode "all" : synchroniser tous les comptes un par un
        if (accountId === 'all' && allAccounts && allAccounts.length > 0) {
          debug.log('🔄 Starting sync for ALL accounts:', allAccounts.length)
          let totalSynced = 0
          let totalDeleted = 0

          const failedAccounts: string[] = []

          for (let i = 0; i < allAccounts.length; i++) {
            const account = allAccounts[i]
            setSyncProgress(Math.round(((i + 0.5) / allAccounts.length) * 100))

            let success = false
            for (let attempt = 0; attempt < 2 && !success; attempt++) {
              try {
                if (attempt > 0) {
                  debug.log(`🔁 Retry ${attempt} for ${account.email_address}`)
                  await new Promise((r) => setTimeout(r, 2000))
                }
                const synced = await syncSingleAccount(account.id, fullSync)
                totalSynced += synced

                // Reconcile each account
                const deleted = await reconcileEmails(account.id)
                totalDeleted += deleted
                success = true
              } catch (error) {
                debug.error(
                  `Sync error for ${account.email_address} (attempt ${attempt + 1}):`,
                  error
                )
                if (attempt === 1) {
                  failedAccounts.push(account.email_address)
                }
              }
            }
          }

          const successCount = allAccounts.length - failedAccounts.length

          if (failedAccounts.length === 0) {
            toast.success(
              fullSync
                ? `Synchronisation complète : ${totalSynced} emails sur ${allAccounts.length} comptes`
                : `${totalSynced} nouveaux emails synchronisés sur ${allAccounts.length} comptes`
            )
          } else {
            toast.warning(
              `${totalSynced} emails synchronisés (${successCount}/${allAccounts.length} comptes OK). Échec : ${failedAccounts.join(', ')}`
            )
          }

          if (totalDeleted > 0) {
            toast.info(
              `${totalDeleted} email${totalDeleted > 1 ? 's' : ''} supprimé${totalDeleted > 1 ? 's' : ''}`
            )
          }

          setDeletedCount(totalDeleted)
        } else {
          // Mode compte unique
          debug.log('🔄 Starting email sync:', { accountId, fullSync })

          const syncedCount = await syncSingleAccount(accountId, fullSync)

          toast.success(
            fullSync
              ? `Synchronisation complète effectuée (${syncedCount} emails)`
              : `${syncedCount} nouveaux emails synchronisés`
          )

          // Réconciliation pour détecter les suppressions
          const deleted = await reconcileEmails()
          setDeletedCount(deleted)

          if (deleted > 0) {
            toast.info(
              `${deleted} email${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''} depuis votre client mail`
            )
          }
        }

        // Dispatch event to trigger incremental refresh instead of full cache invalidation
        window.dispatchEvent(new CustomEvent('email-realtime-update'))
        queryClient.invalidateQueries({ queryKey: ['email-counts'] })

        setSyncProgress(100)
      } catch (error) {
        handleError(error, 'Erreur lors de la synchronisation des emails')
      } finally {
        setIsSyncing(false)
        setSyncProgress(0)
      }
    },
    [accountId, allAccounts, queryClient, handleError, reconcileEmails, syncSingleAccount]
  )

  const syncNow = useCallback(() => {
    return syncEmails(false)
  }, [syncEmails])

  const fullSyncFn = useCallback(() => {
    return syncEmails(true)
  }, [syncEmails])

  const getLastSyncDate = useCallback(async () => {
    if (!accountId || accountId === 'all') return null

    try {
      // Using safe view to avoid exposing encrypted_password
      const { data } = await fromExtended('user_email_accounts_safe')
        .select('last_sync_at')
        .eq('id', accountId)
        .maybeSingle()

      return (data as { last_sync_at: string | null } | null)?.last_sync_at
    } catch (error) {
      debug.error('Error fetching last sync date:', error)
      return null
    }
  }, [accountId])

  return {
    isSyncing,
    syncProgress,
    deletedCount,
    syncNow,
    fullSync: fullSyncFn,
    reconcileEmails,
    getLastSyncDate,
  }
}
