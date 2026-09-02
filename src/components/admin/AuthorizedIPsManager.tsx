import { useState } from 'react'
import { debug } from '@/lib/debug'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Shield, AlertCircle, Lock } from 'lucide-react'
import { useAuthorizedIPs, useAddAuthorizedIP, useDeleteAuthorizedIP } from '@/hooks/auth/useAuthorizedIPs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface AuthorizedIPsManagerProps {
  ipWhitelistEnabled: boolean
  onToggleIpWhitelist: (enabled: boolean) => void
}

export function AuthorizedIPsManager({ ipWhitelistEnabled, onToggleIpWhitelist }: AuthorizedIPsManagerProps) {
  const [newIP, setNewIP] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: authorizedIPs, isLoading, error } = useAuthorizedIPs()
  const addIPMutation = useAddAuthorizedIP()
  const deleteIPMutation = useDeleteAuthorizedIP()

  const handleAddIP = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newIP.trim()) return

    try {
      await addIPMutation.mutateAsync({
        ip_address: newIP.trim(),
        description: newDescription.trim()
      })
      
      setNewIP('')
      setNewDescription('')
      setShowAddForm(false)
    } catch (error) {
      debug.error('Error adding IP:', error)
    }
  }

  const handleDeleteIP = async (id: string) => {
    try {
      await deleteIPMutation.mutateAsync(id)
    } catch (error) {
      debug.error('Error deleting IP:', error)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Gestion des IP Autorisées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Chargement...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Gestion des IP Autorisées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-destructive/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erreur lors du chargement des IP autorisées. Seuls les administrateurs peuvent accéder à cette fonctionnalité.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toggle de gestion des IP autorisées */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                Gestion des IP Autorisées
              </CardTitle>
              <CardDescription className="mt-2">
                Activez cette fonctionnalité pour restreindre l'accès à l'application aux seules IP autorisées.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="ip-whitelist-toggle" className="text-sm font-medium">
                {ipWhitelistEnabled ? 'Activé' : 'Désactivé'}
              </Label>
              <Switch
                id="ip-whitelist-toggle"
                checked={ipWhitelistEnabled}
                onCheckedChange={onToggleIpWhitelist}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className={ipWhitelistEnabled ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
            <AlertCircle className={`h-4 w-4 ${ipWhitelistEnabled ? "text-green-600" : "text-amber-600"}`} />
            <AlertDescription className={ipWhitelistEnabled ? "text-green-800" : "text-amber-800"}>
              {ipWhitelistEnabled ? (
                <span>
                  <strong>Sécurité renforcée :</strong> Seules les IP listées ci-dessous peuvent accéder à l'application.
                  Assurez-vous que votre IP actuelle est dans la liste.
                </span>
              ) : (
                <span>
                  <strong>Accès libre :</strong> Toutes les adresses IP peuvent accéder à l'application.
                  Activez la gestion des IP pour renforcer la sécurité.
                </span>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Gestion des IP (seulement si activée) */}
      {ipWhitelistEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Configuration des IP Autorisées
            </CardTitle>
            <CardDescription>
              Gérez la liste des adresses IP autorisées à accéder au système.
            </CardDescription>
          </CardHeader>
      <CardContent className="space-y-4">
        {/* Avertissement de sécurité */}
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Attention :</strong> Supprimer votre IP actuelle vous empêchera d'accéder à l'application. 
            Assurez-vous d'être connecté au VPN avant de faire des modifications.
          </AlertDescription>
        </Alert>

        {/* Liste des IP autorisées */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">IP Autorisées Actuelles</h3>
          {authorizedIPs && authorizedIPs.length > 0 ? (
            <div className="space-y-2">
              {authorizedIPs.map((ip) => (
                <div key={ip.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {ip.ip_address}
                      </Badge>
                      {ip.description && (
                        <span className="text-sm text-muted-foreground">
                          {ip.description}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Ajoutée le {new Date(ip.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Supprimer cette IP autorisée"
                        title="Supprimer"
                        className="text-destructive hover:text-destructive"
                        disabled={deleteIPMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer l'IP autorisée</AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir supprimer l'IP <strong>{ip.ip_address}</strong> ?
                          Cette action est irréversible et pourrait vous empêcher d'accéder à l'application
                          si c'est votre IP actuelle.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteIP(ip.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Aucune IP autorisée trouvée.
            </div>
          )}
        </div>

        {/* Formulaire d'ajout */}
        {!showAddForm ? (
          <Button onClick={() => setShowAddForm(true)} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une nouvelle IP
          </Button>
        ) : (
          <form onSubmit={handleAddIP} className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="ip">Adresse IP</Label>
              <Input
                id="ip"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                placeholder="192.168.1.1 ou 2001:db8::1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="VPN bureau, IP fixe, etc."
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={addIPMutation.isPending || !newIP.trim()}
                className="flex-1"
              >
                {addIPMutation.isPending ? 'Ajout...' : 'Ajouter'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false)
                  setNewIP('')
                  setNewDescription('')
                }}
              >
                Annuler
              </Button>
            </div>
          </form>
        )}
        </CardContent>
      </Card>
      )}
    </div>
  )
}