import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Check, Copy, Loader2, Shield, QrCode, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabaseBrowser'
import { debug } from '@/lib/debug'
import QRCode from 'qrcode'

interface TwoFactorSetupProps {
  onComplete: () => void
  onCancel: () => void
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'generate' | 'verify'>('generate')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const generateSecret = async () => {
    setIsLoading(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expirée. Veuillez vous reconnecter.')
      const existing = await supabase.auth.mfa.listFactors()
      if (existing.error) throw existing.error
      if (existing.data.totp.some((item) => item.status === 'verified')) {
        throw new Error('Un authentificateur est déjà configuré pour ce compte.')
      }
      // `mfa.listFactors().data.totp` ne rend QUE les facteurs verifies : le
      // filtre sur « unverified » ne pouvait jamais rien selectionner, et ce
      // nettoyage ne faisait donc rien. Les facteurs en attente vivent dans
      // `data.all`, d'ou on les tire ici.
      // `all` peut manquer sur une version ancienne du client, ou dans un
      // simulacre de test : on ne plante pas pour autant — l'enrôlement doit
      // rester possible même si le nettoyage préalable ne trouve rien.
      const enAttente = (existing.data.all ?? []).filter(
        (item) => item.factor_type === 'totp' && item.status !== 'verified'
      )
      for (const factor of enAttente) {
        const cleanup = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (cleanup.error) throw cleanup.error
      }
      const enrollment = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Gestion OpenPulse',
      })
      if (enrollment.error) throw enrollment.error
      const qrCodeDataUrl = await QRCode.toDataURL(enrollment.data.totp.uri)
      setFactorId(enrollment.data.id)
      setSecret(enrollment.data.totp.secret)
      setQrCodeUrl(qrCodeDataUrl)
      setStep('verify')
    } catch (err: unknown) {
      debug.error('[2FA] Generation error:', err instanceof Error ? err.message : 'Unknown error')
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération du facteur 2FA')
    } finally {
      setIsLoading(false)
    }
  }

  const verifyAndActivate = async () => {
    if (verificationCode.length !== 6 || !factorId) {
      setError('Le code doit contenir 6 chiffres')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const verification = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verificationCode,
      })
      if (verification.error) throw verification.error
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance.error) throw assurance.error
      if (assurance.data.currentLevel !== 'aal2') {
        throw new Error("L'authentificateur n'a pas pu être confirmé. Réessayez avec un nouveau code.")
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        // Compatibilité d'affichage historique uniquement. La connexion se fie
        // exclusivement au facteur vérifié dans Supabase Auth.
        const profileSync = await supabase
          .from('profiles')
          .update({ two_factor_enabled: true })
          .eq('user_id', user.id)
        if (profileSync.error) {
          debug.warn('[2FA] Profile flag sync skipped:', profileSync.error.message)
        }
      }
      onComplete()
    } catch (err: unknown) {
      debug.error('[2FA] Verification exception:', err instanceof Error ? err.message : 'Unknown')
      setError(err instanceof Error ? err.message : 'Code de vérification invalide')
    } finally {
      setIsLoading(false)
    }
  }

  const cancelEnrollment = async () => {
    setIsLoading(true)
    try {
      if (factorId) {
        const result = await supabase.auth.mfa.unenroll({ factorId })
        if (result.error) throw result.error
      }
      onCancel()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible d'annuler l'enrôlement 2FA")
    } finally {
      setIsLoading(false)
    }
  }

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copie impossible. Sélectionnez la clé manuellement.')
    }
  }

  useEffect(() => {
    if (step === 'generate') {
      generateSecret()
    }
  }, [step])

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-primary" />
        <CardTitle>Configuration 2FA</CardTitle>
        <CardDescription>
          Sécurisez votre compte avec l'authentification à deux facteurs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'generate' && (
          <div className="space-y-4">
            {isLoading && (
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Génération de votre clé secrète...
                </p>
              </div>
            )}

            {error && (
              <>
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Button onClick={generateSecret} className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Réessayer
                  </Button>
                  <Button variant="outline" onClick={() => void cancelEnrollment()} className="w-full">
                    Annuler
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="text-center">
              <QrCode className="w-8 h-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold mb-2">Scannez ce QR code</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Utilisez Google Authenticator, Authy ou une autre app 2FA
              </p>
              {qrCodeUrl && (
                <div className="flex justify-center mb-4">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={qrCodeUrl}
                    alt="QR Code 2FA"
                    className="border rounded"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="two-factor-secret">Code secret (si vous ne pouvez pas scanner)</Label>
              <div className="flex gap-2">
                <Input
                  id="two-factor-secret"
                  value={secret}
                  readOnly
                  className="font-mono text-sm text-center"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void copySecret()}
                  aria-label={copied ? 'Clé secrète copiée' : 'Copier la clé secrète'}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <span className="sr-only" role="status" aria-live="polite">
                {copied ? 'Clé secrète copiée' : ''}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification-code">
                <Smartphone className="w-4 h-4 inline mr-2" />
                Code de vérification
              </Label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Button
                onClick={verifyAndActivate}
                className="w-full"
                disabled={isLoading || verificationCode.length !== 6}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activer le 2FA
              </Button>
              <Button
                variant="outline"
                onClick={() => void cancelEnrollment()}
                disabled={isLoading}
                className="w-full"
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
