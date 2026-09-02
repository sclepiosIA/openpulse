import { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { usePulseUnreadCount } from '@/hooks/pulse/usePulseUnreadCount'
import { pulseConversationKeys } from '@/hooks/pulse/usePulseConversations'
import { pulseMessageKeys } from '@/hooks/pulse/usePulseMessages'
import { playNotificationSound } from '@/lib/notificationSound'
import { isPulseSoundEnabled, isPulseDesktopEnabled } from '@/lib/pulsePreferences'
import { notifyDesktopShell } from '@/lib/desktopBridge'

/**
 * Hook that listens for new Pulse messages globally via realtime
 * and triggers a "new message" state to pulse the floating chat bubble.
 * Enriched notifications with sender name + message preview + click-to-open.
 */
export function usePulseNewMessageNotifier() {
  const { data: currentProfile } = useCurrentProfile()
  const profileId = currentProfile?.id
  const queryClient = useQueryClient()
  const [hasNewMessage, setHasNewMessage] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { invalidate } = usePulseUnreadCount()

  const clearPulse = useCallback(() => {
    setHasNewMessage(false)
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }, [])

  const showBrowserNotification = useCallback(
    (title: string, body: string, conversationId?: string) => {
      if (!('Notification' in window)) return
      const show = () => {
        const notif = new Notification(title, {
          body,
          icon: '/placeholder.svg',
          badge: '/placeholder.svg',
          tag: conversationId ? `pulse-${conversationId}` : 'pulse-message',
        })
        notif.onclick = () => {
          window.focus()
          if (conversationId) {
            window.location.href = `/pulse?conversation=${conversationId}`
          }
          notif.close()
        }
      }
      if (Notification.permission === 'granted') {
        show()
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((p) => {
          if (p === 'granted') show()
        })
      }
    },
    []
  )

  useEffect(() => {
    if (!profileId) return

    const channel = supabase
      .channel(`pulse-new-msg-notifier-${profileId}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pulse_messages',
        },
        async (payload) => {
          const newMsg = payload.new as {
            id?: string
            conversation_id?: string
            user_id?: string
            content?: string
            message_type?: string
            metadata?: Record<string, unknown>
          } | null
          if (!newMsg) return

          if (newMsg.conversation_id) {
            queryClient.invalidateQueries({ queryKey: pulseConversationKeys.all })
            queryClient.invalidateQueries({
              queryKey: pulseMessageKeys.byConversation(newMsg.conversation_id),
            })
          }

          // Don't ignore external messages even if user_id matches current profile
          const isExternal = newMsg.metadata?.is_external_message === true
          if (newMsg.user_id === profileId && !isExternal) return

          // Verify current user is a member of this conversation before notifying
          if (newMsg.conversation_id) {
            const { data: member } = await supabase
              .from('pulse_conversation_members')
              .select('user_id')
              .eq('conversation_id', newMsg.conversation_id)
              .eq('user_id', profileId)
              .maybeSingle()
            if (!member) return // Not a member — ignore
          }

          setHasNewMessage(true)
          invalidate()

          // Play notification sound (respect user preference)
          if (isPulseSoundEnabled()) {
            playNotificationSound()
          }

          // Browser notification when tab is hidden (respect user preference)
          if (document.hidden && isPulseDesktopEnabled()) {
            // Fetch sender + conversation name for a rich notification
            const [{ data: sender }, { data: conv }] = await Promise.all([
              newMsg.user_id
                ? supabase
                    .from('profiles')
                    .select('prenom, nom')
                    .eq('id', newMsg.user_id)
                    .maybeSingle()
                : Promise.resolve({ data: null }),
              newMsg.conversation_id
                ? supabase
                    .from('pulse_conversations')
                    .select('name')
                    .eq('id', newMsg.conversation_id)
                    .maybeSingle()
                : Promise.resolve({ data: null }),
            ])

            const senderName = sender
              ? `${sender.prenom || ''} ${sender.nom || ''}`.trim() || "Quelqu'un"
              : 'Nouveau message'
            const convName = (conv as { name?: string } | null)?.name
            const title = convName ? `${senderName} · ${convName}` : senderName
            const preview =
              newMsg.message_type && newMsg.message_type !== 'text'
                ? `[${newMsg.message_type}]`
                : (newMsg.content || '').slice(0, 140) || 'Nouveau message'

            const sentToDesktop = notifyDesktopShell({ module: 'pulse', title, body: preview })
            if (!sentToDesktop) showBrowserNotification(title, preview, newMsg.conversation_id)
          }

          // Auto-reset after 5s
          if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
          resetTimerRef.current = setTimeout(() => {
            setHasNewMessage(false)
            resetTimerRef.current = null
          }, 5000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [profileId, invalidate, queryClient, showBrowserNotification])

  return { hasNewMessage, clearPulse }
}
