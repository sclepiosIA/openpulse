import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { debug } from '@/lib/debug'
import { configureAuthSessionPersistence, supabase } from '@/lib/supabaseBrowser'
import { useQueryClient } from '@tanstack/react-query'
import { isApercuTiers } from '@/lib/iframeDetection'
import { notifyDesktopDriveLogout } from '@/lib/desktopBridge'
import { checkLegacyTwoFactorMigrationRequired, checkTwoFactorRequired } from '@/hooks/auth/use2FA'

export type TwoFactorStatus =
  | 'unauthenticated'
  | 'checking'
  | 'not-required'
  | 'required'
  | 'enrollment-required'
  | 'verified'
  | 'denied'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  twoFactorStatus: TwoFactorStatus
  twoFactorError: string | null
  verify2FA: (token: string) => Promise<boolean>
  complete2FAEnrollment: () => Promise<boolean>
  signIn: (
    email: string,
    password: string,
    persistSession?: boolean
  ) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    userData: { prenom: string; nom: string }
  ) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Durée du cache de session (5 minutes pour éviter les déconnexions)
const SESSION_CACHE_DURATION = 5 * 60 * 1000
const TWO_FACTOR_CHECK_TIMEOUT_MS = 5_000

// Inner component that has access to QueryClient
function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const previousUserIdRef = useRef<string | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const initialSessionResolvedRef = useRef(false)
  const verificationGenerationRef = useRef(0)
  const pendingSessionRef = useRef<Session | null>(null)
  const suppressPendingSignOutRef = useRef(false)
  const mfaChallengeInProgressRef = useRef(false)

  // Try to restore session from sessionStorage to reduce initial loading time
  const getCachedSession = () => {
    try {
      // Vérifier si sessionStorage est disponible (peut être bloqué dans iframe tiers)
      if (typeof sessionStorage === 'undefined') {
        debug.warn('[Auth] sessionStorage unavailable')
        return null
      }
      const cached = sessionStorage.getItem('supabase.auth.session')
      if (cached) {
        const parsed = JSON.parse(cached)
        // Cache valide pendant 5 minutes pour réduire les appels API
        if (parsed.timestamp && Date.now() - parsed.timestamp < SESSION_CACHE_DURATION) {
          return parsed.session
        }
      }
    } catch (e) {
      // Storage bloqué (iframe tiers, mode privé, etc.)
      debug.warn('[Auth] sessionStorage access blocked:', e)
    }
    return null
  }

  const cachedSession = getCachedSession()
  // Ne jamais considérer le cache sessionStorage comme une auth valide : il sert
  // uniquement à lisser le chargement. La source de vérité est getSession(), qui
  // restaure la session Supabase depuis son storage avant que l'app protégée ne
  // lance des requêtes RLS. Sinon le client peut envoyer le JWT anon et boucler
  // vers /auth avec “missing sub claim”.
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus>('checking')
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null)

  // Cache session updates
  const cacheSession = useCallback((session: Session | null) => {
    try {
      if (typeof sessionStorage === 'undefined') return
      if (!session) {
        sessionStorage.removeItem('supabase.auth.session')
        return
      }
      sessionStorage.setItem(
        'supabase.auth.session',
        JSON.stringify({
          session,
          timestamp: Date.now(),
        })
      )
    } catch (e) {
      // Storage bloqué - ignoré silencieusement
    }
  }, [])

  const clearPublishedSession = useCallback(() => {
    setUser(null)
    setSession(null)
    previousUserIdRef.current = null
  }, [])

  const denyPendingSession = useCallback(
    async (message: string) => {
      pendingSessionRef.current = null
      clearPublishedSession()
      setTwoFactorStatus('denied')
      setTwoFactorError(message)
      setLoading(false)
      cacheSession(null)
      // The Supabase client itself must not retain an unchecked session: other
      // clients could otherwise make authenticated requests despite route gating.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    },
    [cacheSession, clearPublishedSession]
  )

  const resolveSession = useCallback(
    async (currentSession: Session | null, generation: number) => {
      pendingSessionRef.current = currentSession
      clearPublishedSession()

      if (!currentSession) {
        if (generation !== verificationGenerationRef.current) return
        setTwoFactorStatus('unauthenticated')
        setTwoFactorError(null)
        setLoading(false)
        cacheSession(null)
        return
      }

      setLoading(true)
      setTwoFactorStatus('checking')
      setTwoFactorError(null)

      // Chaque etape est nommee AVANT d'etre tentee. Sans cela, un echec ne
      // produisait qu'un « Impossible de verifier la politique 2FA », sans
      // jamais dire laquelle des quatre etapes avait cede ni combien de temps
      // elle avait pris. Sur une instance auto-hebergee, l'exploitant restait
      // devant un mur : la connexion refusee, aucune piste, et des traces
      // console qu'un navigateur ferme n'affiche pas.
      const departVerification = Date.now()
      let etape = 'preparation de la verification'

      try {
        const mfa = supabase.auth.mfa
        if (mfa?.getAuthenticatorAssuranceLevel) {
          etape = "lecture du niveau d'authentification"
          const assurance = await mfa.getAuthenticatorAssuranceLevel()
          if (assurance.error) throw assurance.error
          if (assurance.data.currentLevel === 'aal2') {
            setSession(currentSession)
            setUser(currentSession.user)
            previousUserIdRef.current = currentSession.user.id
            setTwoFactorStatus('verified')
            setLoading(false)
            cacheSession(currentSession)
            return
          }
        }

        etape = "inventaire des facteurs d'authentification"
        const required = await Promise.race([
          checkTwoFactorRequired(currentSession.user.id),
          new Promise<never>((_, reject) =>
            window.setTimeout(
              () => reject(new Error('La vérification 2FA a expiré.')),
              TWO_FACTOR_CHECK_TIMEOUT_MS
            )
          ),
        ])

        if (
          generation !== verificationGenerationRef.current ||
          pendingSessionRef.current?.access_token !== currentSession.access_token
        )
          return

        if (required) {
          // Conserver la session AAL1 dans le client sans la publier. Un
          // signOut({ scope: 'local' }) révoque aussi la session côté GoTrue :
          // le jeton gardé pour challengeAndVerify devient alors inutilisable.
          // Les routes restent fermées tant que user/session ne sont pas
          // publiés, et les politiques RLS imposent AAL2 aux comptes enrôlés.
          setTwoFactorStatus('required')
          setLoading(false)
          return
        }

        etape = 'lecture du profil'
        const migrationRequired = await checkLegacyTwoFactorMigrationRequired(
          currentSession.user.id
        )
        if (migrationRequired) {
          setTwoFactorStatus('enrollment-required')
          setLoading(false)
          return
        }

        setSession(currentSession)
        setUser(currentSession.user)
        previousUserIdRef.current = currentSession.user.id
        setTwoFactorStatus('not-required')
        setLoading(false)
        cacheSession(currentSession)
      } catch (error) {
        if (generation !== verificationGenerationRef.current) return
        const duree = Date.now() - departVerification
        const cause = error instanceof Error ? error.message : String(error)
        debug.error(
          `[Auth] verification 2FA interrompue a l'etape « ${etape} » apres ${duree} ms :`,
          error
        )
        await denyPendingSession(
          `Verification de securite interrompue a l'etape « ${etape} » ` +
            `apres ${(duree / 1000).toFixed(1)} s : ${cause}`
        )
      }
    },
    [cacheSession, clearPublishedSession, denyPendingSession]
  )

  const verify2FA = useCallback(
    async (token: string): Promise<boolean> => {
      const pendingSession = pendingSessionRef.current
      if (!pendingSession || twoFactorStatus !== 'required') return false

      setLoading(true)
      setTwoFactorError(null)
      try {
        mfaChallengeInProgressRef.current = true
        const mfa = supabase.auth.mfa
        if (!mfa?.listFactors || !mfa?.challengeAndVerify) {
          throw new Error('Supabase MFA indisponible')
        }
        const restored = await supabase.auth.setSession({
          access_token: pendingSession.access_token,
          refresh_token: pendingSession.refresh_token,
        })
        if (restored.error || restored.data.session?.user.id !== pendingSession.user.id) {
          throw restored.error ?? new Error('Session MFA non restaurée')
        }
        const factors = await mfa.listFactors()
        if (factors.error) throw factors.error
        const factor = factors.data.totp.find((candidate) => candidate.status === 'verified')
        if (!factor) {
          throw new Error('Aucun facteur TOTP vérifié pour cette session')
        }

        const verification = await mfa.challengeAndVerify({ factorId: factor.id, code: token })
        if (verification.error) {
          suppressPendingSignOutRef.current = true
          await supabase.auth.signOut({ scope: 'local' })
          mfaChallengeInProgressRef.current = false
          setTwoFactorError('Code 2FA invalide')
          setLoading(false)
          return false
        }
        const assurance = await mfa.getAuthenticatorAssuranceLevel()
        if (assurance.error || assurance.data.currentLevel !== 'aal2') {
          throw assurance.error ?? new Error('La session MFA n’a pas atteint le niveau AAL2')
        }
        const refreshed = await supabase.auth.getSession()
        const verifiedSession = refreshed.data.session
        if (
          !verifiedSession ||
          pendingSessionRef.current?.user.id !== pendingSession.user.id ||
          verifiedSession.user.id !== pendingSession.user.id
        ) {
          mfaChallengeInProgressRef.current = false
          setLoading(false)
          return false
        }
        mfaChallengeInProgressRef.current = false
        pendingSessionRef.current = verifiedSession
        setSession(verifiedSession)
        setUser(verifiedSession.user)
        previousUserIdRef.current = verifiedSession.user.id
        setTwoFactorStatus('verified')
        setLoading(false)
        cacheSession(verifiedSession)
        return true
      } catch (error) {
        mfaChallengeInProgressRef.current = false
        debug.error('[Auth] TOTP validation failed:', error)
        await denyPendingSession('La validation 2FA a échoué. Veuillez vous reconnecter.')
        return false
      }
    },
    [cacheSession, denyPendingSession, twoFactorStatus]
  )

  const complete2FAEnrollment = useCallback(async (): Promise<boolean> => {
    const pendingSession = pendingSessionRef.current
    if (!pendingSession || !['enrollment-required', 'not-required'].includes(twoFactorStatus))
      return false
    setLoading(true)
    setTwoFactorError(null)
    try {
      const factors = await supabase.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      if (!factors.data.totp.some((factor) => factor.status === 'verified')) {
        throw new Error('Aucun facteur TOTP vérifié après enrôlement')
      }
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance.error || assurance.data.currentLevel !== 'aal2') {
        throw assurance.error ?? new Error('La session MFA n’a pas atteint le niveau AAL2')
      }
      const refreshed = await supabase.auth.getSession()
      const verifiedSession = refreshed.data.session
      if (!verifiedSession || verifiedSession.user.id !== pendingSession.user.id) {
        throw new Error('Session MFA incohérente après enrôlement')
      }
      pendingSessionRef.current = verifiedSession
      setSession(verifiedSession)
      setUser(verifiedSession.user)
      previousUserIdRef.current = verifiedSession.user.id
      setTwoFactorStatus('verified')
      setLoading(false)
      cacheSession(verifiedSession)
      return true
    } catch (error) {
      debug.error('[Auth] MFA enrollment completion failed:', error)
      setTwoFactorError("L'enrôlement 2FA n'a pas pu être finalisé.")
      setLoading(false)
      return false
    }
  }, [cacheSession, twoFactorStatus])

  useEffect(() => {
    let isMounted = true

    // Détection de l'environnement pour adapter les timeouts
    const dansApercuTiers = isApercuTiers()
    const isThirdPartyIframe = (() => {
      try {
        return (
          window.self !== window.top &&
          !!document.referrer &&
          !document.referrer.includes(window.location.origin)
        )
      } catch {
        return true
      }
    })()

    // Timeout court pour éviter de bloquer l'écran /auth quand Supabase Auth
    // ou PostgREST est en incident : l'utilisateur doit voir le formulaire vite.
    const timeoutDuration = dansApercuTiers ? 5000 : isThirdPartyIframe ? 5000 : 5000

    const securityTimeout = setTimeout(() => {
      // Ne forcer loading=false que s'il n'y a ni session ni cache.
      // Évite de déconnecter l'utilisateur pendant un refresh token lent.
      if (loading && !session && !cachedSession && isMounted) {
        // Downgrade en debug : c'est un état attendu dans l'iframe la plateforme initiale
        // ou en mode privé où getSession() peut être lent au boot.
        debug.log('[Auth] Security timeout reached (no session) - releasing loading')
        setLoading(false)
      }
    }, timeoutDuration)

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return
      if (event === 'SIGNED_OUT' && suppressPendingSignOutRef.current) {
        suppressPendingSignOutRef.current = false
        return
      }
      if (mfaChallengeInProgressRef.current) {
        debug.log(`[Auth] ${event} ignored during internal MFA challenge`)
        return
      }

      // INITIAL_SESSION/TOKEN_REFRESHED sans session peuvent arriver pendant
      // la restauration storage ou un refresh transitoire. Ne pas vider l'état
      // auth ici : seul SIGNED_OUT est une déconnexion intentionnelle.
      if (!currentSession && event !== 'SIGNED_OUT') {
        debug.log(`[Auth] ${event} without session - transient state, ignoring`)
        return // Ne rien faire, attendre le prochain event
      }

      const newUserId = currentSession?.user?.id ?? null
      const previousUserId = previousUserIdRef.current

      // Detect user change or sign out - invalidate caches
      if (previousUserId !== newUserId) {
        debug.log('[Auth] User changed, invalidating caches', { previousUserId, newUserId, event })

        if (event === 'SIGNED_OUT' || !newUserId) {
          // Clear all caches on sign out
          queryClient.clear()
        } else if (event === 'SIGNED_IN') {
          // Only invalidate on actual sign-in (new user), not token refresh
          queryClient.invalidateQueries({ queryKey: ['current-profile'] })
          queryClient.invalidateQueries({ queryKey: ['pulse-conversations'] })
          queryClient.invalidateQueries({ queryKey: ['profiles'] })
        }
        // TOKEN_REFRESHED with user change is handled above but we skip
        // cache invalidation for routine token refreshes to avoid re-render storms

        previousUserIdRef.current = newUserId
      }

      const generation = ++verificationGenerationRef.current
      // DIFFÉRÉ HORS DU RAPPEL, ET C'EST INDISPENSABLE.
      //
      // Ce rappel est exécuté par le client d'authentification pendant qu'il
      // détient le verrou de session. Toute méthode d'authentification appelée
      // depuis l'intérieur -- et `resolveSession` en appelle deux -- redemande
      // ce même verrou et attend qu'il soit rendu : elle attend donc la fin de
      // ce rappel, qui attend qu'elle se termine.
      //
      // L'interblocage n'est pas systématique, ce qui l'a rendu difficile à
      // voir : il dépend de qui détient le verrou à cet instant. Mesuré sur
      // cette instance, une connexion sur deux environ :
      //
      //   « interrompue à l'étape "inventaire des facteurs d'authentification"
      //     après 5,7 s : La vérification 2FA a expiré »
      //
      // alors que la même séquence prend 387 ms hors navigateur, où ce verrou
      // n'existe pas. La documentation du client déconseille explicitement
      // d'appeler ses méthodes depuis ce rappel.
      //
      // Un `setTimeout` à zéro suffit : la suite ne s'exécute plus dans la
      // pile du rappel, donc plus sous le verrou.
      window.setTimeout(() => {
        void resolveSession(currentSession, generation)
      }, 0)
    })

    // Get session with retry logic for transient network issues
    const getSessionWithRetry = async (retries = 3): Promise<Session | null> => {
      for (let i = 0; i < retries; i++) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session) return session
          if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000))
        } catch (error) {
          debug.warn(`[Auth] getSession attempt ${i + 1} failed:`, error)
          if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000))
        }
      }
      return null
    }

    // Get initial session (verify cached session or get fresh one)
    getSessionWithRetry()
      .then((fetchedSession) => {
        if (!isMounted) return
        initialSessionResolvedRef.current = true

        const generation = ++verificationGenerationRef.current
        void resolveSession(fetchedSession, generation)
      })
      .catch((error) => {
        debug.error('[Auth] Failed to get session:', error)
        if (isMounted) {
          initialSessionResolvedRef.current = true
          setLoading(false)
        }
      })

    // Watchdog simplifié : vérifier la session, pas forcer le refresh
    // Supabase autoRefreshToken gère déjà le refresh automatique
    refreshIntervalRef.current = setInterval(
      async () => {
        if (!isMounted) return
        try {
          const {
            data: { session: s },
          } = await supabase.auth.getSession()
          if (s) {
            cacheSession(s) // Mettre à jour le cache uniquement
          }
        } catch (e) {
          debug.warn('[Auth] Watchdog check failed:', e)
        }
      },
      10 * 60 * 1000
    ) // 10 minutes

    return () => {
      isMounted = false
      verificationGenerationRef.current += 1
      clearTimeout(securityTimeout)
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      subscription.unsubscribe()
    }
  }, [cacheSession, resolveSession])

  const signIn = useCallback(async (email: string, password: string, persistSession = true) => {
    // Garde-fou réseau : si signInWithPassword n'a pas répondu rapidement, on
    // remonte une erreur claire au lieu de laisser le spinner bloqué.
    // Couvre BUG-079/080/081/082 (csm/copil spinner persistant > 20s).
    // 25s : GoTrue peut légitimement répondre en 7-15s sous charge (vu en prod).
    // Un timeout trop court (5s) rejetait des logins valides.
    const SIGN_IN_TIMEOUT_MS = 25000
    const withTimeout = async <T,>(p: Promise<T>): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => {
            timeoutId = setTimeout(
              () =>
                reject(
                  new Error(
                    "Le serveur d'authentification met trop de temps à répondre. Réessayez dans quelques minutes — incident temporaire possible."
                  )
                ),
              SIGN_IN_TIMEOUT_MS
            )
          }),
        ])
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    try {
      configureAuthSessionPersistence(persistSession)
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }))

      if (error) {
        // Si c'est une erreur de captcha, on peut essayer une approche différente
        if (error.message.includes('captcha')) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          const { error: retryError } = await withTimeout(
            supabase.auth.signInWithPassword({ email, password })
          )
          return { error: retryError }
        }
      }

      return { error }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, userData: { prenom: string; nom: string }) => {
      try {
        // Nettoyer l'état d'authentification existant avant l'inscription
        await supabase.auth.signOut({ scope: 'global' }).catch(() => {})

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: userData, // Role will be set to default by server
          },
        })
        return { error }
      } catch (err) {
        debug.error("Erreur lors de l'inscription:", err)
        return { error: err instanceof Error ? err : new Error(String(err)) }
      }
    },
    []
  )

  const signOut = useCallback(async () => {
    verificationGenerationRef.current += 1
    pendingSessionRef.current = null
    clearPublishedSession()
    notifyDesktopDriveLogout()
    setTwoFactorStatus('unauthenticated')
    setTwoFactorError(null)
    setLoading(false)
    // Best-effort signOut: on purge la session locale même si l'API distante échoue
    // (ex. token expiré, RLS deny côté serveur, network down).
    // BUG-078/BUG-069: ajout d'un timeout 3s sur signOut Supabase pour éviter
    // que le bouton « Déconnexion » reste bloqué quand l'API ne répond pas.
    const SIGN_OUT_TIMEOUT_MS = 3000
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'global' }),
        new Promise((resolve) => setTimeout(resolve, SIGN_OUT_TIMEOUT_MS)),
      ])
    } catch (err) {
      debug.error('signOut error (continuing local cleanup):', err)
    }
    // Purge des tokens locaux résiduels (localStorage + sessionStorage)
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
        .forEach((k) => localStorage.removeItem(k))
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
        .forEach((k) => sessionStorage.removeItem(k))
    } catch {}
    // Redirection forcée vers /auth pour garantir que l'utilisateur sort de la session
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
      window.location.replace('/auth')
    }
  }, [clearPublishedSession])

  // Mémoiser la valeur du contexte pour éviter les re-renders inutiles
  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      twoFactorStatus,
      twoFactorError,
      verify2FA,
      complete2FAEnrollment,
      signIn,
      signUp,
      signOut,
    }),
    [
      user,
      session,
      loading,
      twoFactorStatus,
      twoFactorError,
      verify2FA,
      complete2FAEnrollment,
      signIn,
      signUp,
      signOut,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Export wrapper that doesn't need QueryClient in its scope
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthProviderInner>{children}</AuthProviderInner>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Non-throwing variant of useAuth.
 * Use in chrome / boundary components that may render before the provider
 * mounts (lazy chunks, error boundaries) to avoid crashing the whole tree.
 */
export function useAuthSafe(): AuthContextType {
  const context = useContext(AuthContext)
  return (
    context ?? {
      user: null,
      session: null,
      loading: true,
      twoFactorStatus: 'unauthenticated',
      twoFactorError: null,
      verify2FA: async () => false,
      // Manquait au repli alors que le contrat l'exige : un composant rendu
      // avant le montage du fournisseur — un morceau charge en differe, une
      // frontiere d'erreur — qui aurait appele cette fonction aurait plante
      // sur « is not a function ». Le typage ne le voyait pas, personne ne le
      // lancait avec la bonne configuration.
      complete2FAEnrollment: async () => false,
      signIn: async () => ({ error: new Error('AuthProvider not mounted') }),
      signUp: async () => ({ error: new Error('AuthProvider not mounted') }),
      signOut: async () => {
        /* no-op */
      },
    }
  )
}
