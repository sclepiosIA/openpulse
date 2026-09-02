import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { cleanEmailSignature } from '@/lib/emailUtils'
import { debug } from '@/lib/debug'

/**
 * Hook to load user's email signature from their profile
 * Returns decoded HTML signature ready to be inserted in emails
 */
export function useEmailSignature() {
  const [signature, setSignature] = useState('')
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    const loadSignature = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email_signature')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error

        if (data?.email_signature) {
          setSignature(cleanEmailSignature(data.email_signature))
        }
      } catch (error) {
        // Silent fail - signature is optional
        if (import.meta.env.DEV) debug.warn('Could not load email signature:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSignature()
  }, [user])

  return { signature, loading }
}
