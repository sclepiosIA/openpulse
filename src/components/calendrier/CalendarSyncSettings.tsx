import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { Users, User, Plus, Copy, Trash2, Calendar, Info, CheckCircle2, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const API_BASE_URL = import.meta.env.VITE_SUPABASE_URL

interface CalendarSyncSettingsProps {
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
}

interface CalendarToken {
  id: string
  type: 'global' | 'user'
  token: string
  name: string
  created_at: string
  last_accessed_at: string | null
  access_count: number
  expires_at: string | null
}

export function CalendarSyncSettings({ isOpen, onClose, isAdmin }: CalendarSyncSettingsProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: userProfile } = useCurrentProfile()
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // Fetch global token
  const { data: globalToken } = useQuery({
    queryKey: ['calendar-token', 'global'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_feed_tokens')
        .select('id, token, name, type, target_user_id, etablissement_id, is_active, created_at, expires_at, last_accessed_at, access_count, created_by_user_id')
        .eq('type', 'global')
        .eq('is_active', true)
        .maybeSingle()
      
      if (error) throw error
      return data as CalendarToken | null
    },
    enabled: isOpen,
  })

  // Fetch user token
  const { data: userToken } = useQuery({
    queryKey: ['calendar-token', 'user', userProfile?.id],
    queryFn: async () => {
      if (!userProfile?.id) return null
      
      const { data, error } = await supabase
        .from('calendar_feed_tokens')
        .select('id, token, name, type, target_user_id, etablissement_id, is_active, created_at, expires_at, last_accessed_at, access_count, created_by_user_id')
        .eq('type', 'user')
        .eq('target_user_id', userProfile.id)
        .eq('is_active', true)
        .maybeSingle()
      
      if (error) throw error
      return data as CalendarToken | null
    },
    enabled: isOpen && !!userProfile?.id,
  })

  // Create global token
  const createGlobalToken = useMutation({
    mutationFn: async () => {
      if (!userProfile?.id) throw new Error('Utilisateur non connecté')
      
      const { data, error } = await supabase
        .from('calendar_feed_tokens')
        .insert({
          type: 'global' as const,
          name: 'Calendrier Équipe',
          created_by_user_id: userProfile.id,
        })
        .select()
        .single() // safe: guaranteed-row
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-token', 'global'] })
      toast({ title: 'Abonnement global créé avec succès' })
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erreur', 
        description: sanitizeSupabaseError(error), 
        variant: 'destructive' 
      })
    },
  })

  // Create user token
  const createUserToken = useMutation({
    mutationFn: async () => {
      if (!userProfile?.id) throw new Error('Utilisateur non connecté')
      
      const { data, error } = await supabase
        .from('calendar_feed_tokens')
        .insert({
          type: 'user' as const,
          name: 'Mes tâches',
          created_by_user_id: userProfile.id,
          target_user_id: userProfile.id,
        })
        .select()
        .single() // safe: guaranteed-row
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-token', 'user'] })
      toast({ title: 'Abonnement personnel créé avec succès' })
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erreur', 
        description: sanitizeSupabaseError(error), 
        variant: 'destructive' 
      })
    },
  })

  // Revoke token
  const revokeToken = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from('calendar_feed_tokens')
        .update({ is_active: false })
        .eq('id', tokenId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-token'] })
      toast({ title: 'Abonnement révoqué' })
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erreur', 
        description: sanitizeSupabaseError(error), 
        variant: 'destructive' 
      })
    },
  })

  const getWebcalUrl = (token: string) => {
    return `${API_BASE_URL}/functions/v1/calendar-feed?token=${token}`
  }

  const copyToClipboard = async (url: string, tokenId: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(tokenId)
      toast({ title: 'URL copiée dans le presse-papiers' })
      setTimeout(() => setCopiedToken(null), 2000)
    } catch (error) {
      toast({ 
        title: 'Erreur', 
        description: 'Impossible de copier l\'URL', 
        variant: 'destructive' 
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Synchronisation Calendrier
          </DialogTitle>
          <DialogDescription>
            Synchronisez vos tâches et événements (visios acceptées) avec votre calendrier externe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Section Admin - Abonnement Global */}
          {isAdmin && (
            <>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <h3 className="font-semibold text-base sm:text-lg">Abonnement Équipe</h3>
                  <Badge variant="secondary" className="text-xs w-fit">Admin uniquement</Badge>
                </div>
                
                {globalToken ? (
                  <TokenCard 
                    token={globalToken}
                    webcalUrl={getWebcalUrl(globalToken.token)}
                    onCopy={(url) => copyToClipboard(url, globalToken.id)}
                    onRevoke={() => revokeToken.mutate(globalToken.id)}
                    isCopied={copiedToken === globalToken.id}
                  />
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <Button 
                        onClick={() => createGlobalToken.mutate()}
                        disabled={createGlobalToken.isPending}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Créer un abonnement équipe
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Section Utilisateur - Abonnement Personnel */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <User className="h-5 w-5 text-green-600 flex-shrink-0" />
              <h3 className="font-semibold text-base sm:text-lg">Mon Abonnement Personnel</h3>
            </div>
            
            {userToken ? (
              <TokenCard 
                token={userToken}
                webcalUrl={getWebcalUrl(userToken.token)}
                onCopy={(url) => copyToClipboard(url, userToken.id)}
                onRevoke={() => revokeToken.mutate(userToken.id)}
                isCopied={copiedToken === userToken.id}
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <Button 
                    onClick={() => createUserToken.mutate()}
                    disabled={createUserToken.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Créer mon abonnement personnel
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Instructions */}
          <NextcloudInstructions />
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface TokenCardProps {
  token: CalendarToken
  webcalUrl: string
  onCopy: (url: string) => void
  onRevoke: () => void
  isCopied: boolean
}

function TokenCard({ token, webcalUrl, onCopy, onRevoke, isCopied }: TokenCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{token.name}</CardTitle>
        <CardDescription className="text-xs">
          Créé le {format(new Date(token.created_at), 'dd MMMM yyyy', { locale: fr })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">URL d'abonnement</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 p-2 bg-muted rounded text-xs break-words overflow-hidden max-w-full">
              {webcalUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto flex-shrink-0"
              onClick={() => onCopy(webcalUrl)}
            >
              {isCopied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  <span className="sm:inline">Copié!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  <span className="sm:inline">Copier</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
          <div className="flex justify-between sm:block">
            <span className="text-muted-foreground">Accès total:</span>
            <span className="ml-2 font-medium">{token.access_count}</span>
          </div>
          {token.last_accessed_at && (
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Dernier accès:</span>
              <span className="ml-2 font-medium">
                {format(new Date(token.last_accessed_at), 'dd/MM/yyyy', { locale: fr })}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open(webcalUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Tester l'URL
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={onRevoke}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Révoquer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function NextcloudInstructions() {
  return (
    <Alert className="text-xs sm:text-sm">
      <Info className="h-4 w-4 flex-shrink-0" />
      <AlertDescription className="space-y-3">
        <div className="font-medium text-sm sm:text-base">📅 Pour ajouter ce calendrier :</div>
        
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Ce flux iCal inclut vos <strong>tâches</strong> et vos <strong>événements</strong> (visioconférences acceptées depuis les emails).
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-xs">Nextcloud :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
            <li>Calendrier → "+ Nouvel abonnement depuis un lien"</li>
            <li>Collez l'URL ci-dessus</li>
          </ol>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-xs">Google Agenda :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
            <li>Paramètres → "Ajouter un agenda" → "À partir de l'URL"</li>
            <li>Collez l'URL ci-dessus</li>
          </ol>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-xs">Outlook :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
            <li>Ajouter un calendrier → "S'abonner depuis le web"</li>
            <li>Collez l'URL ci-dessus</li>
          </ol>
        </div>

        <div className="mt-3 p-2 bg-muted rounded text-xs break-words">
          <strong>⚠️ Important :</strong> Ce calendrier est en <strong>lecture seule</strong> et se synchronise automatiquement. 
          Les modifications doivent être faites dans Marque.
        </div>
      </AlertDescription>
    </Alert>
  )
}
