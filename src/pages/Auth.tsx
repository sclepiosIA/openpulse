import React, { useState, useEffect, useMemo } from 'react'
import { debug } from '@/lib/debug'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, ArrowLeft } from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup'
import { use2FA } from '@/hooks/auth/use2FA'
import { supabase } from '@/integrations/supabase/client'
import { EmailValidationIndicator, validateEmail } from '@/components/auth/EmailValidationIndicator'
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator'
import { AuthBrandingPanel } from '@/components/auth/AuthBrandingPanel'
import { AnimatedFormCard, AnimatedFormItem } from '@/components/auth/AnimatedFormCard'
import { MobileAuthHeader } from '@/components/auth/MobileAuthHeader'
import { configureAuthSessionPersistence } from '@/lib/authPersistenceStorage'

const AUTH_RETURN_TO_KEY = 'auth_returnTo'

export default function Auth() {
  const auth = useAuth()
  const {
    signIn,
    user,
    loading,
    twoFactorStatus,
    twoFactorError,
    verify2FA,
    complete2FAEnrollment,
  } = auth
  const secureTwoFactorFlow = twoFactorStatus !== undefined && typeof verify2FA === 'function'
  const { validate2FAToken, check2FAEnabled } = use2FA()
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const authentikSsoEnabled = import.meta.env.VITE_AUTHENTIK_SSO_ENABLED === 'true'

  // Sign in form state
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [persistSession, setPersistSession] = useState(true)

  // 2FA state
  const [show2FA, setShow2FA] = useState(false)
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [pendingAuth, setPendingAuth] = useState<{
    email: string
    password: string
    persistSession: boolean
  } | null>(null)
  const [needsInitial2FASetup, setNeedsInitial2FASetup] = useState(false)

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetCooldown, setResetCooldown] = useState(0)

  // Cooldown court (anti-spam) pour coller aux limites Supabase (ex: 14s)
  useEffect(() => {
    if (resetCooldown <= 0) return
    const id = window.setInterval(() => {
      setResetCooldown((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => window.clearInterval(id)
  }, [resetCooldown])

  useEffect(() => {
    if (!secureTwoFactorFlow) return
    setShow2FA(twoFactorStatus === 'required')
    setShow2FASetup(twoFactorStatus === 'enrollment-required')
    if (twoFactorError) setError(twoFactorError)
  }, [secureTwoFactorFlow, twoFactorStatus, twoFactorError])

  // Safe localStorage helpers
  const safeLocalStorageGet = (key: string): string | null => {
    try {
      return localStorage.getItem(key)
    } catch (e) {
      debug.warn('[Auth] localStorage.getItem failed:', e)
      return null
    }
  }
  const safeLocalStorageSet = (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      debug.warn('[Auth] localStorage.setItem failed:', e)
    }
  }
  const safeLocalStorageRemove = (key: string): void => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      debug.warn('[Auth] localStorage.removeItem failed:', e)
    }
  }

  // Safe sessionStorage helpers
  const safeSessionStorageGet = (key: string): string | null => {
    try {
      return sessionStorage.getItem(key)
    } catch (e) {
      debug.warn('[Auth] sessionStorage.getItem failed:', e)
      return null
    }
  }
  const safeSessionStorageSet = (key: string, value: string): void => {
    try {
      sessionStorage.setItem(key, value)
    } catch (e) {
      debug.warn('[Auth] sessionStorage.setItem failed:', e)
    }
  }
  const safeSessionStorageRemove = (key: string): void => {
    try {
      sessionStorage.removeItem(key)
    } catch (e) {
      debug.warn('[Auth] sessionStorage.removeItem failed:', e)
    }
  }

  // Get returnTo from URL params
  const searchParams = new URLSearchParams(location.search)

  const getSmartDefault = (): string => {
    if (location.pathname.startsWith('/m/')) {
      const match = location.pathname.match(/^(\/m\/[^/]+)/)
      if (match) {
        debug.log('[Auth] Using mobile route as default returnTo:', match[1])
        return match[1]
      }
    }
    return '/dashboard'
  }

  const rawReturnTo = searchParams.get('returnTo') || getSmartDefault()

  const returnTo = useMemo(() => {
    const savedReturnTo = safeSessionStorageGet(AUTH_RETURN_TO_KEY)
    const targetReturnTo = savedReturnTo || rawReturnTo
    if (import.meta.env.DEV) {
      debug.log('[Auth] Computing returnTo', { savedReturnTo, rawReturnTo, targetReturnTo })
    }
    if (
      !targetReturnTo.startsWith('/') ||
      targetReturnTo.startsWith('//') ||
      targetReturnTo.includes(':')
    ) {
      return '/dashboard'
    }
    if (targetReturnTo.startsWith('/auth')) {
      return '/dashboard'
    }
    return targetReturnTo
  }, [rawReturnTo])

  useEffect(() => {
    if (rawReturnTo && rawReturnTo !== '/dashboard' && rawReturnTo.startsWith('/')) {
      debug.log('[Auth] Saving returnTo to sessionStorage:', rawReturnTo)
      safeSessionStorageSet(AUTH_RETURN_TO_KEY, rawReturnTo)
    }
  }, [rawReturnTo])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (user) {
    debug.log('[Auth] User authenticated, redirecting to:', returnTo)
    safeSessionStorageRemove(AUTH_RETURN_TO_KEY)
    return <Navigate to={returnTo} replace />
  }

  const handleAuthentikSso = async () => {
    setIsLoading(true)
    setError('')
    safeSessionStorageSet(AUTH_RETURN_TO_KEY, returnTo)

    try {
      configureAuthSessionPersistence(persistSession)
      const redirectTo = `${window.location.origin}/auth?returnTo=${encodeURIComponent(returnTo)}`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'custom:openpulse-authentik',
        options: {
          redirectTo,
          scopes: 'openid profile email',
        },
      })
      if (oauthError) {
        const safe = sanitizeSupabaseError(oauthError)
        setError(safe)
        toast({ title: 'Erreur SSO', description: safe, variant: 'destructive' })
      }
    } catch (oauthError) {
      const safe = sanitizeSupabaseError(oauthError)
      setError(safe)
      toast({ title: 'Erreur SSO', description: safe, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Garde-fou : timeout dur de 6s pour éviter un spinner persistant si
    // signIn ou check2FAEnabled ne résout jamais (cas observés pour csm/copil).
    const hardTimeout = window.setTimeout(() => {
      debug.warn('[Auth] handleSignIn hard timeout (6s) — forcing reset')
      setIsLoading(false)
      setError('La connexion prend trop de temps. Veuillez réessayer.')
    }, 6000)

    try {
      const { error } = await signIn(signInEmail, signInPassword, persistSession)

      if (error) {
        const safe = sanitizeSupabaseError(error)
        setError(safe)
        toast({ title: 'Erreur de connexion', description: safe, variant: 'destructive' })
        return
      }

      if (secureTwoFactorFlow) {
        // AuthProvider conserve la session hors publication jusqu'à la décision
        // 2FA. La redirection ne peut intervenir qu'après not-required/verified.
        toast({ title: 'Identité vérifiée', description: 'Vérification de la politique 2FA…' })
      } else {
        // Compatibilité des anciens hôtes/tests qui ne fournissent pas encore le
        // contrat AuthProvider enrichi. Le runtime Gestion moderne ne passe pas ici.
        const has2FA = await check2FAEnabled()
        if (has2FA) {
          setPendingAuth({ email: signInEmail, password: signInPassword, persistSession })
          setShow2FA(true)
        } else {
          toast({ title: 'Connexion réussie', description: 'Bienvenue dans OpenPulse' })
        }
      }
    } catch (err) {
      debug.error('[Auth] handleSignIn unexpected error:', err)
      setError('Erreur inattendue. Veuillez réessayer.')
    } finally {
      window.clearTimeout(hardTimeout)
      setIsLoading(false)
    }
  }

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    if (secureTwoFactorFlow) {
      if (twoFactorStatus !== 'required') {
        setIsLoading(false)
        return
      }
      const isValid = await verify2FA(twoFactorCode)
      if (!isValid) {
        setError('Code 2FA invalide')
        setIsLoading(false)
        return
      }
      setShow2FA(false)
      setTwoFactorCode('')
      toast({ title: 'Connexion réussie', description: '2FA validée' })
      setIsLoading(false)
      return
    }
    if (!pendingAuth || !(await validate2FAToken(twoFactorCode))) {
      setError('Code 2FA invalide')
      setIsLoading(false)
      return
    }
    const { error: secondError } = await signIn(
      pendingAuth.email,
      pendingAuth.password,
      pendingAuth.persistSession
    )
    if (secondError) {
      const safe = sanitizeSupabaseError(secondError)
      setError(safe)
      toast({ title: 'Erreur de connexion', description: safe, variant: 'destructive' })
      setShow2FA(false)
      setPendingAuth(null)
      setTwoFactorCode('')
    } else {
      toast({ title: 'Connexion réussie', description: 'Bienvenue dans OpenPulse' })
    }
    setIsLoading(false)
  }

  const getCanonicalRedirectUrl = (): string => {
    const hostname = window.location.hostname
    const PROD_DOMAIN = 'https://pp-gestion.exploitant.example.org'
    if (hostname === 'pp-gestion.exploitant.example.org') {
      return `${window.location.origin}/auth/reset-password`
    }
    if (
      hostname.includes('apercu.example.org') ||
      hostname.includes('previsualisation.example.org') ||
      hostname.includes('preview--')
    ) {
      return `${PROD_DOMAIN}/auth/reset-password`
    }
    return `${window.location.origin}/auth/reset-password`
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const redirectUrl = getCanonicalRedirectUrl()
      debug.log('[Auth] Password reset redirectTo:', redirectUrl)

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      })

      if (error) {
        const isRateLimit =
          error.message.toLowerCase().includes('rate') ||
          error.message.toLowerCase().includes('limit') ||
          error.message.includes('429') ||
          (error as any).status === 429
        if (isRateLimit) {
          const minutesMatch = error.message.match(/(\d+)\s*minute/i)
          const cooldownSeconds = minutesMatch ? parseInt(minutesMatch[1]) * 60 : 60
          setResetCooldown(cooldownSeconds)
          toast({
            title: 'Limite temporaire atteinte',
            description: `Trop de demandes. Patientez ${Math.ceil(cooldownSeconds / 60)} minute(s) puis réessayez.`,
            variant: 'destructive',
          })
          setError(
            `Limite d'envoi atteinte. Réessayez dans ${Math.ceil(cooldownSeconds / 60)} min.`
          )
          return
        }
        throw error
      }

      toast({
        title: '✅ Email envoyé',
        description: `Un lien de réinitialisation a été envoyé à ${resetEmail}. Vérifiez vos spams. Le lien est valide 1h.`,
        duration: 15000,
      })
      setShowForgotPassword(false)
      setResetEmail('')
    } catch (error: unknown) {
      debug.error('Password reset error:', error)
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setShow2FA(false)
    setShow2FASetup(false)
    setTwoFactorCode('')
    setError('')
    setShowForgotPassword(false)
    setResetEmail('')
  }

  const handle2FASetupComplete = async () => {
    if (secureTwoFactorFlow && twoFactorStatus === 'enrollment-required') {
      const completed = await complete2FAEnrollment()
      if (!completed) {
        setError("L'enrôlement 2FA n'a pas pu être finalisé.")
        return
      }
    }
    setShow2FASetup(false)
    setNeedsInitial2FASetup(false)
    toast({
      title: '2FA activé',
      description: "L'authentification à deux facteurs a été configurée avec succès",
    })
  }

  const handle2FASetupCancel = () => {
    setShow2FASetup(false)
    setNeedsInitial2FASetup(false)
    if (twoFactorStatus === 'enrollment-required') void auth.signOut()
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left Panel - Branding (Desktop only) */}
      <div
        data-testid="auth-brand-panel"
        className="relative hidden overflow-hidden bg-[var(--h-openpulse)] lg:flex lg:w-[40%] animate-auth-panel-slide-in"
      >
        {/*
          Un seul cercle, a peine plus clair que le fond, en bas a gauche :
          c'est tout le decor que retient la maquette de charte.

          Les vagues et les halos flottants qui occupaient cette place ont ete
          retires. Ils venaient de la charte precedente, et leur premiere
          faute etait d'etre bleus sur un fond devenu chaud ; la seconde, plus
          serieuse, etait d'etre nombreux -- trois vagues, six halos, deux
          formes geometriques et seize points -- la ou la maquette ne pose
          qu'un aplat. Les composants restent dans le depot : l'ecran cesse
          seulement de les monter.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[22%] -left-[12%] h-[62%] w-[62%] rounded-full bg-marque-douce/[0.035]"
        />
        <AuthBrandingPanel />
      </div>

      {/* Mobile Immersive Header */}
      <MobileAuthHeader />

      {/* Right Panel - Form */}
      <div
        data-testid="auth-form-panel"
        className="flex w-full flex-1 items-center justify-center bg-marque-papier p-6 animate-auth-fade-in [animation-delay:200ms] sm:p-8 lg:w-[60%] lg:p-12"
      >
        <div className="w-full max-w-md">
          <AnimatedFormCard className="w-full">
            {show2FASetup ? (
              <TwoFactorSetup onComplete={handle2FASetupComplete} onCancel={handle2FASetupCancel} />
            ) : showForgotPassword ? (
              <div className="space-y-6 animate-auth-slide-left">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-marque-point/15 flex items-center justify-center animate-auth-scale-in [animation-delay:100ms]">
                    <Shield className="w-8 h-8 text-marque-orange" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Mot de passe oublié ?</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Entrez votre adresse email pour recevoir un lien de réinitialisation
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <AnimatedFormItem>
                    <Label htmlFor="reset-email" className="text-sm font-medium">
                      Email
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="votre.email@exploitant.example.org"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="mt-1.5 h-champ bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      required
                    />
                  </AnimatedFormItem>

                  {error && (
                    <div className="animate-auth-error-in">
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <AnimatedFormItem className="space-y-3 pt-2">
                    <Button
                      type="submit"
                      className="h-champ w-full bg-primary font-medium text-primary-foreground shadow-none transition-colors hover:bg-primary/90 hover:shadow-none"
                      disabled={isLoading || resetCooldown > 0}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {resetCooldown > 0 ? `Patientez ${resetCooldown}s` : 'Envoyer le lien'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-champ w-full text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setShowForgotPassword(false)
                        setResetEmail('')
                        setError('')
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Retour à la connexion
                    </Button>
                  </AnimatedFormItem>
                </form>
              </div>
            ) : show2FA ? (
              <div className="space-y-6 animate-auth-slide-left">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-marque-point/15 flex items-center justify-center animate-auth-scale-in [animation-delay:100ms]">
                    <Shield className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Authentification 2FA</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Entrez le code à 6 chiffres de votre application
                  </p>
                </div>

                <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
                  <AnimatedFormItem>
                    <Label htmlFor="2fa-code" className="text-sm font-medium">
                      Code de vérification
                    </Label>
                    <Input
                      id="2fa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      placeholder="000000"
                      value={twoFactorCode}
                      onChange={(e) =>
                        setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      className="mt-1.5 h-champ bg-background text-center font-mono text-2xl tracking-[0.5em] border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      maxLength={6}
                      required
                    />
                  </AnimatedFormItem>

                  {error && (
                    <div className="animate-auth-error-in">
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <AnimatedFormItem className="space-y-3 pt-2">
                    <Button
                      type="submit"
                      className="h-champ w-full bg-primary font-medium text-primary-foreground shadow-none transition-colors hover:bg-primary/90 hover:shadow-none"
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Vérifier
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-champ w-full text-muted-foreground hover:text-foreground"
                      onClick={resetForm}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Retour
                    </Button>
                  </AnimatedFormItem>
                </form>
              </div>
            ) : (
              <div className="animate-auth-fade-in">
                {/*
                  Titre aligne sur la maquette : grand et LEGER, aligne a
                  gauche. Le gras condense de la version precedente donnait un
                  en-tete d'alerte la ou la charte pose un titre de page.
                */}
                <div className="mb-8">
                  <h2 className="text-3xl font-light tracking-tight text-foreground">Connexion</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Accédez à votre espace de travail.
                  </p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-5">
                  <AnimatedFormItem>
                    <Label htmlFor="signin-email" className="text-sm font-medium">
                      Adresse e-mail
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="votre.email@exploitant.example.org"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      className={`mt-1.5 h-champ bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors ${signInEmail && !validateEmail(signInEmail).isValid ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                      required
                      aria-describedby="email-validation"
                    />
                    <div id="email-validation" className="mt-1">
                      <EmailValidationIndicator email={signInEmail} />
                    </div>
                  </AnimatedFormItem>

                  <AnimatedFormItem>
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor="signin-password" className="text-sm font-medium">
                        Mot de passe
                      </Label>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-medium text-marque-orange underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className="mt-1.5 h-champ bg-background pr-24 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                        required
                        aria-describedby="password-strength"
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                        }
                        className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-sm px-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? 'masquer' : 'afficher'}
                      </button>
                    </div>
                    <div id="password-strength" className="mt-1">
                      <PasswordStrengthIndicator password={signInPassword} />
                    </div>
                  </AnimatedFormItem>

                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="persist-session"
                      checked={persistSession}
                      onChange={(event) => setPersistSession(event.target.checked)}
                      className="size-[17px] rounded border-border accent-primary"
                    />
                    <span>Rester connecté 30 jours</span>
                  </label>

                  {error && (
                    <div className="animate-auth-error-in">
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <AnimatedFormItem className="pt-2">
                    <Button
                      type="submit"
                      size="lg"
                      className="h-champ w-full bg-primary font-semibold text-primary-foreground shadow-none transition-colors hover:bg-primary/90 hover:shadow-none"
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Se connecter
                    </Button>
                  </AnimatedFormItem>
                </form>

                {authentikSsoEnabled && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-3" aria-hidden="true">
                      <span className="h-px flex-1 bg-border" />
                      <span className="font-mono text-xs uppercase text-muted-foreground">ou</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-champ w-full bg-card font-semibold shadow-none hover:shadow-none"
                      disabled={isLoading}
                      onClick={() => void handleAuthentikSso()}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Continuer avec Authentik
                    </Button>
                  </div>
                )}

                <p className="mt-8 font-mono text-xs leading-relaxed text-muted-foreground">
                  Instance {window.location.hostname || 'locale'} · 5 tentatives puis verrouillage
                  15 min
                </p>
              </div>
            )}
          </AnimatedFormCard>

          {/* Footer — CONF-01 : liens légaux publics */}
          <div className="mt-8 space-y-1 text-center text-xs text-foreground/80 animate-auth-fade-in [animation-delay:800ms] lg:hidden">
            <p>© 2026 OpenPulse — Tous droits réservés</p>
            <p className="flex flex-wrap items-center justify-center gap-x-2">
              <a
                href="/mentions-legales"
                className="inline-flex min-h-11 items-center rounded-sm px-1 hover:text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Mentions légales
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="/politique-confidentialite"
                className="inline-flex min-h-11 items-center rounded-sm px-1 hover:text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Politique de confidentialité
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
