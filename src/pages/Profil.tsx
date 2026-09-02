import { useState, useEffect, useCallback } from 'react'
import { debug } from '@/lib/debug'
import { Button } from "@/components/ui/button"
import { ArrowLeft, User, Mail, Bell, Plug } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileHero } from "@/components/profile/ProfileHero"
import { ProfileSettings } from "@/components/profile/ProfileSettings"
import { EmailSettings } from "@/components/profile/EmailSettings"
import { NotificationPreferences } from "@/components/settings/NotificationPreferences"
import { McpIntegrationGuide } from "@/components/profile/McpIntegrationGuide"
import { PageDataState } from "@/components/common/PageDataState"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from '@/lib/supabaseBrowser'
import { use2FA } from '@/hooks/auth/use2FA'
import { useToast } from '@/hooks/shared/use-toast'

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

export default function Profil() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'profile'
  const { user, loading: authLoading } = useAuth() as { user: any; loading?: boolean }
  const { toast } = useToast()
  const { check2FAEnabled } = use2FA()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userRole, setUserRole] = useState<string>('user')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [is2FAEnabled, setIs2FAEnabled] = useState(false)

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      // Pas d'utilisateur : on sort de l'état loading pour éviter un spinner infini.
      setProfile(null)
      setLoadError(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(false)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nom, prenom, email, two_factor_enabled, created_at, updated_at, email_signature, avatar_url, linkedin_url')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Profil introuvable')
      setProfile(data)

      // Un utilisateur peut avoir plusieurs rôles (ex : direction + rh).
      // .single() planterait avec PGRST116 — on prend simplement le premier rôle non-user.
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)

      if (roleRows && roleRows.length > 0) {
        const primary = roleRows.find(r => (r.role as string) !== 'user') ?? roleRows[0]
        setUserRole(primary.role)
      }
    } catch (error) {
      debug.error('Erreur chargement profil:', error)
      setLoadError(true)
      toast({
        title: "Erreur",
        description: "Impossible de charger le profil utilisateur",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  const check2FAStatus = useCallback(async () => {
    const enabled = await check2FAEnabled()
    setIs2FAEnabled(enabled)
  }, [check2FAEnabled])

  useEffect(() => {
    // Attendre la fin de l'init auth avant de décider.
    if (authLoading) return
    if (user) {
      loadProfile()
      check2FAStatus()
    } else {
      // Auth résolue sans utilisateur : ne pas rester bloqué en loading.
      setLoading(false)
      setLoadError(true)
    }
  }, [user, authLoading, loadProfile, check2FAStatus])

  if (loading || loadError || !profile) {
    return (
      <main className="p-4 md:p-6 max-w-5xl mx-auto" aria-labelledby="profil-heading">
        <h1 id="profil-heading" className="sr-only">Mon profil</h1>
        <PageDataState
          isLoading={loading && !loadError}
          isError={loadError || (!loading && !profile)}
          onRetry={loadProfile}
          emptyTitle="Profil indisponible"
          emptyDescription={user ? "Impossible de charger votre profil." : "Vous devez être connecté pour accéder à votre profil."}
        >
          <></>
        </PageDataState>
      </main>
    )
  }

  return (
    <main className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto" aria-labelledby="profil-heading">
      <h1 id="profil-heading" className="sr-only">Mon profil</h1>
      {/* Back button */}
      <Button 
        variant="ghost" 
        onClick={() => navigate('/parametres')}
        className="gap-2 -ml-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux paramètres
      </Button>

      {/* Profile Hero */}
      <ProfileHero 
        profile={profile}
        userRole={userRole}
        is2FAEnabled={is2FAEnabled}
        onAvatarChange={(url) => setProfile({ ...profile, avatar_url: url })}
      />

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 mx-auto">
          <TabsTrigger value="profile" className="flex items-center gap-2" aria-label="Profil">
            <User className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <span className="hidden sm:inline">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2" aria-label="Email">
            <Mail className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2" aria-label="Notifications">
            <Bell className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2" aria-label="Intégrations">
            <Plug className="h-4 w-4 text-purple-500" aria-hidden="true" />
            <span className="hidden sm:inline">Intégrations</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 animate-in fade-in-50 duration-300">
          <ProfileSettings 
            profile={profile}
            is2FAEnabled={is2FAEnabled}
            onProfileUpdate={(updated) => setProfile({ 
              ...profile, 
              ...updated 
            })}
            on2FAChange={setIs2FAEnabled}
          />
        </TabsContent>

        <TabsContent value="email" className="mt-6 animate-in fade-in-50 duration-300">
          <EmailSettings />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 animate-in fade-in-50 duration-300">
          <NotificationPreferences />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6 animate-in fade-in-50 duration-300">
          <McpIntegrationGuide />
        </TabsContent>
      </Tabs>
    </main>
  )
}