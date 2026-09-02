import { useState, useEffect } from 'react'
import { debug } from '@/lib/debug'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, User, Linkedin, ExternalLink, CheckCircle, XCircle, FileSignature } from "lucide-react"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from '@/lib/supabaseBrowser'
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup'
import { useToast } from '@/hooks/shared/use-toast'
import { EmailSignatureEditor } from '@/components/email/EmailSignatureEditor'

interface UserProfile {
  id: string
  nom: string
  prenom: string
  email: string
  two_factor_enabled: boolean
  email_signature?: string | null
  linkedin_url?: string | null
}

interface ProfileSettingsProps {
  profile: UserProfile | null
  is2FAEnabled: boolean
  onProfileUpdate: (profile: UserProfile) => void
  on2FAChange: (enabled: boolean) => void
}

export function ProfileSettings({ profile, onProfileUpdate, on2FAChange }: ProfileSettingsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [native2FAEnabled, setNative2FAEnabled] = useState(false)
  const [isChecking2FA, setIsChecking2FA] = useState(true)
  const [twoFactorStatusError, setTwoFactorStatusError] = useState<string | null>(null)
  const [twoFactorStatusReload, setTwoFactorStatusReload] = useState(0)
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedin_url || '')
  const [isSavingLinkedin, setIsSavingLinkedin] = useState(false)

  useEffect(() => {
    if (profile) {
      setLinkedinUrl(profile.linkedin_url || '')
    }
  }, [profile])

  useEffect(() => {
    let active = true
    const loadNativeStatus = async () => {
      setIsChecking2FA(true)
      setTwoFactorStatusError(null)
      try {
        const factors = await supabase.auth.mfa.listFactors()
        if (factors.error) throw factors.error
        const enabled = factors.data.totp.some((factor) => factor.status === 'verified')
        if (!active) return
        setNative2FAEnabled(enabled)
      } catch (error) {
        debug.error('Erreur lecture des facteurs 2FA:', error)
        if (active) setTwoFactorStatusError('Impossible de vérifier le statut 2FA.')
      } finally {
        if (active) setIsChecking2FA(false)
      }
    }
    void loadNativeStatus()
    return () => {
      active = false
    }
  }, [user?.id, twoFactorStatusReload])

  const handle2FASetupComplete = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      on2FAChange(true)
      setNative2FAEnabled(true)
      setShow2FASetup(false)
      
      toast({
        title: "2FA activé",
        description: "L'authentification à deux facteurs a été configurée avec succès"
      })
    } catch (error) {
      debug.error('Erreur lors de la finalisation 2FA:', error)
    }
  }

  const disable2FA = async () => {
    try {
      const factors = await supabase.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      for (const factor of factors.data.totp) {
        const result = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (result.error) throw result.error
      }

      if (user?.id) {
        const profileSync = await supabase
          .from('profiles')
          .update({ two_factor_enabled: false })
          .eq('user_id', user.id)
        if (profileSync.error) {
          debug.warn('[2FA] Profile flag sync skipped:', profileSync.error.message)
        }
      }

      setNative2FAEnabled(false)
      on2FAChange(false)
      toast({
        title: "2FA désactivé",
        description: "L'authentification à deux facteurs a été désactivée"
      })
    } catch (error) {
      debug.error('Erreur désactivation 2FA:', error)
      toast({
        title: "Erreur",
        description: "Impossible de désactiver le 2FA",
        variant: "destructive"
      })
    }
  }

  const saveLinkedinUrl = async () => {
    if (!profile) return

    const trimmed = (linkedinUrl || '').trim()
    if (trimmed) {
      try {
        const u = new URL(trimmed)
        if (!/^https?:$/.test(u.protocol) || !/(^|\.)linkedin\.com$/i.test(u.hostname)) {
          throw new Error('invalid')
        }
      } catch {
        toast({
          title: 'URL LinkedIn invalide',
          description: 'Le lien doit commencer par https:// et pointer vers linkedin.com',
          variant: 'destructive'
        })
        return
      }
    }

    setIsSavingLinkedin(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ linkedin_url: linkedinUrl || null })
        .eq('id', profile.id)
      
      if (error) throw error
      
      onProfileUpdate({ ...profile, linkedin_url: linkedinUrl || null })
      toast({
        title: "Succès",
        description: "URL LinkedIn mise à jour"
      })
    } catch (error) {
      debug.error('Error updating LinkedIn URL:', error)
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'URL LinkedIn",
        variant: "destructive"
      })
    } finally {
      setIsSavingLinkedin(false)
    }
  }

  if (!profile) return null

  if (show2FASetup) {
    return (
      <div className="max-w-2xl mx-auto">
        <TwoFactorSetup
          onComplete={handle2FASetupComplete}
          onCancel={() => setShow2FASetup(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-500" />
            Informations personnelles
          </CardTitle>
          <CardDescription>
            Vos informations de profil
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                type="text"
                value={profile.prenom}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                type="text"
                value={profile.nom}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              disabled
              className="bg-muted"
            />
          </div>

          {/* LinkedIn URL */}
          <div className="space-y-2">
            <Label htmlFor="linkedin">Profil LinkedIn</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="linkedin"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/votre-profil"
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {profile.linkedin_url && (
                  <Button
                    variant="outline"
                    size="icon"
                    asChild aria-label="Ouvrir le lien">
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                )}
                <Button
                  onClick={saveLinkedinUrl}
                  disabled={isSavingLinkedin || linkedinUrl === (profile.linkedin_url || '')}
                >
                  {isSavingLinkedin ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Sécurité du compte
          </CardTitle>
          <CardDescription>
            Authentification à deux facteurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <h4 className="font-medium">Authentification 2FA</h4>
                <p className="text-sm text-muted-foreground">
                  Sécurisez votre compte avec un code temporaire
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isChecking2FA ? (
                <Badge variant="outline">Vérification…</Badge>
              ) : twoFactorStatusError ? null : native2FAEnabled ? (
                <>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Activé
                  </Badge>
                  <Button variant="outline" size="sm" onClick={disable2FA}>
                    Désactiver
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                    <XCircle className="w-3 h-3 mr-1" />
                    Désactivé
                  </Badge>
                  <Button size="sm" onClick={() => setShow2FASetup(true)}>
                    Configurer
                  </Button>
                </>
              )}
            </div>
          </div>

          {twoFactorStatusError && (
            <Alert variant="destructive" className="mt-4" role="alert">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{twoFactorStatusError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTwoFactorStatusReload((value) => value + 1)}
                >
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {native2FAEnabled && (
            <Alert className="mt-4">
              <Shield className="w-4 h-4" />
              <AlertDescription>
                L'authentification à deux facteurs est active. Vous devrez saisir un code à chaque connexion.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Email Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-purple-500" />
            Signature email
          </CardTitle>
          <CardDescription>
            Personnalisez la signature de vos emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSignatureEditor 
            profileId={profile.id}
            initialSignature={profile.email_signature || ""}
          />
        </CardContent>
      </Card>
    </div>
  )
}
