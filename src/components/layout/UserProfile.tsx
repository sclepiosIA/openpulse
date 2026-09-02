import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Shield,
  User,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Settings2,
  Linkedin,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabaseBrowser'
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup'
import { useToast } from '@/hooks/shared/use-toast'
import { use2FA } from '@/hooks/auth/use2FA'
import { EmailSignatureEditor } from '@/components/email/EmailSignatureEditor'
import { UserAvatarUpload } from '@/components/ui/UserAvatarUpload'
import { debug } from '@/lib/debug'

interface UserProfile {
  id: string
  nom: string
  prenom: string
  email: string
  two_factor_enabled: boolean
  created_at: string
  updated_at: string
  email_signature?: string | null
  avatar_url?: string | null
  linkedin_url?: string | null
}

export default function UserProfile() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { check2FAEnabled } = use2FA()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userRole, setUserRole] = useState<string>('user')
  const [loading, setLoading] = useState(true)
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [is2FAEnabled, setIs2FAEnabled] = useState(false)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [isSavingLinkedin, setIsSavingLinkedin] = useState(false)

  useEffect(() => {
    if (user) {
      loadProfile()
      check2FAStatus()
    }
  }, [user])

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, user_id, nom, prenom, email, telephone, fonction, actif, avatar_url, linkedin_url, created_at, updated_at, date_embauche, type_contrat, two_factor_enabled, email_signature'
        )
        .eq('user_id', user?.id || '')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Profil introuvable')
      setProfile(data)
      setLinkedinUrl(data.linkedin_url || '')

      // Fetch user role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id || '')
        .maybeSingle()

      if (roleData) {
        setUserRole(roleData.role)
      }
    } catch (error) {
      debug.error('Erreur chargement profil:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger le profil utilisateur',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const check2FAStatus = async () => {
    const enabled = await check2FAEnabled()
    setIs2FAEnabled(enabled)
  }

  const handle2FASetupComplete = async () => {
    debug.log("2FA setup terminé, mise à jour de l'état...")

    try {
      // Vérifier que l'utilisateur est toujours connecté
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        debug.error('Session perdue après activation 2FA')
        return
      }

      // Recharger le statut 2FA depuis la base de données
      await check2FAStatus()

      setShow2FASetup(false)

      toast({
        title: '2FA activé',
        description: "L'authentification à deux facteurs a été configurée avec succès",
      })

      debug.log('2FA setup terminé avec succès')
    } catch (error) {
      debug.error('Erreur lors de la finalisation 2FA:', error)
      toast({
        title: 'Attention',
        description: '2FA activé mais erreur de mise à jour. Veuillez actualiser la page.',
        variant: 'destructive',
      })
    }
  }

  const handle2FASetupCancel = () => {
    setShow2FASetup(false)
  }

  const disable2FA = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: false,
          two_factor_secret: null,
          temp_2fa_secret: null,
        } as never)
        .eq('user_id', user!.id)

      if (error) throw error

      setIs2FAEnabled(false)
      toast({
        title: '2FA désactivé',
        description: "L'authentification à deux facteurs a été désactivée",
      })
    } catch (error) {
      debug.error('Erreur désactivation 2FA:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de désactiver le 2FA',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Impossible de charger les informations du profil utilisateur.
        </AlertDescription>
      </Alert>
    )
  }

  if (show2FASetup) {
    return (
      <div className="max-w-2xl mx-auto">
        <TwoFactorSetup onComplete={handle2FASetupComplete} onCancel={handle2FASetupCancel} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Informations du profil
          </CardTitle>
          <CardDescription>Informations personnelles et détails du compte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <UserAvatarUpload
              currentAuthUserId={user?.id || ''}
              profileId={profile.id}
              currentAvatarUrl={profile.avatar_url}
              userName={`${profile.prenom} ${profile.nom}`}
              onAvatarChange={(url: string | null) => setProfile({ ...profile, avatar_url: url })}
            />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Photo de profil</p>
              <p className="text-xs text-muted-foreground">Cliquez sur la photo pour la modifier</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input id="prenom" value={profile.prenom} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" value={profile.nom} disabled className="bg-muted" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <Input id="email" value={profile.email} disabled className="bg-muted" />
            </div>
          </div>

          {/* LinkedIn URL */}
          <div className="space-y-2">
            <Label htmlFor="linkedin">Profil LinkedIn</Label>
            <div className="flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-muted-foreground" />
              <Input
                id="linkedin"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/votre-profil"
                className="flex-1"
              />
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <Button
                size="sm"
                onClick={async () => {
                  setIsSavingLinkedin(true)
                  try {
                    const { error } = await supabase
                      .from('profiles')
                      .update({ linkedin_url: linkedinUrl || null })
                      .eq('id', profile.id)

                    if (error) throw error

                    setProfile({ ...profile, linkedin_url: linkedinUrl || null })
                    toast({
                      title: 'Succès',
                      description: 'URL LinkedIn mise à jour',
                    })
                  } catch (error) {
                    debug.error('Error updating LinkedIn URL:', error)
                    toast({
                      title: 'Erreur',
                      description: "Impossible de mettre à jour l'URL LinkedIn",
                      variant: 'destructive',
                    })
                  } finally {
                    setIsSavingLinkedin(false)
                  }
                }}
                disabled={isSavingLinkedin || linkedinUrl === (profile.linkedin_url || '')}
              >
                {isSavingLinkedin ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Votre photo de profil LinkedIn sera utilisée comme avatar par défaut
            </p>
          </div>

          <div className="space-y-2">
            <Label>Rôle</Label>
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-sm">
                {userRole.charAt(0).toUpperCase() + userRole.slice(1).replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Compte créé le</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(profile.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dernière mise à jour</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(profile.updated_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Sécurité du compte
          </CardTitle>
          <CardDescription>
            Configuration de l'authentification à deux facteurs et sécurité
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <div>
                <h4 className="font-medium">Authentification à deux facteurs (2FA)</h4>
                <p className="text-sm text-muted-foreground">
                  Renforcez la sécurité de votre compte avec une authentification supplémentaire
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {is2FAEnabled ? (
                <>
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Activé
                  </Badge>
                  <Button variant="outline" size="sm" onClick={disable2FA}>
                    Désactiver
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
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

          {is2FAEnabled && (
            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                L'authentification à deux facteurs est active sur votre compte. Vous devrez saisir
                un code de votre application d'authentification à chaque connexion.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Email Signature Section */}
      <EmailSignatureEditor
        profileId={profile.id}
        initialSignature={profile.email_signature || ''}
      />
    </div>
  )
}
