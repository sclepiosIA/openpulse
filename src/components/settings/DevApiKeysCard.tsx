import { supabase } from '@/integrations/supabase/client'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/shared/useApi'
import { useToast } from '@/hooks/shared/use-toast'

import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { ApiPermission } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_SUPABASE_URL

export function DevApiKeysCard() {
  const { toast } = useToast()
  const { data: apiKeys, isLoading } = useApiKeys()
  const createApiKey = useCreateApiKey()
  const revokeApiKey = useRevokeApiKey()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyDescription, setNewKeyDescription] = useState('')
  const [newKeyExpiry, setNewKeyExpiry] = useState('90')
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return

    const expiryDays = parseInt(newKeyExpiry)
    const expiresAt =
      expiryDays > 0
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined

    try {
      const result = await createApiKey.mutateAsync({
        nom: newKeyName.trim(),
        description: newKeyDescription.trim() || undefined,
        permissions: ['read', 'write'] as ApiPermission[],
        rate_limit_per_minute: 30,
        rate_limit_per_day: 1000,
        expires_at: expiresAt,
      })

      setGeneratedKey(result.full_key)
      setNewKeyName('')
      setNewKeyDescription('')
    } catch {
      // Error handled by mutation
    }
  }

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey)
      toast({ title: 'Clé copiée dans le presse-papier' })
    }
  }

  const handleCloseDialog = () => {
    setShowCreateDialog(false)
    setGeneratedKey(null)
    setShowKey(false)
    setNewKeyName('')
    setNewKeyDescription('')
  }

  const activeKeys = apiKeys?.filter((k) => k.est_active && !k.revoked_at) || []

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-orange-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="rounded-lg bg-orange-500/10 p-2">
            <Key className="h-4 w-4 text-orange-600" />
          </div>
          Clés API
          <Badge variant="secondary" className="ml-auto text-xs">
            {activeKeys.length} active{activeKeys.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
        <CardDescription className="text-sm">
          Générez des clés pour utiliser l'API REST OpenPulse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500" />
          </div>
        ) : activeKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            Aucune clé API active. Créez-en une pour commencer.
          </p>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{key.nom}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {key.key_prefix}...
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{key.total_requests || 0} requêtes</span>
                    {key.expires_at && (
                      <span>
                        Expire le {format(new Date(key.expires_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    )}
                    {key.last_used_at && (
                      <span>
                        Dernière utilisation{' '}
                        {format(new Date(key.last_used_at), 'dd/MM HH:mm', { locale: fr })}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => revokeApiKey.mutate(key.id)}
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Dialog
          open={showCreateDialog}
          onOpenChange={(open) => (open ? setShowCreateDialog(true) : handleCloseDialog())}
        >
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full gap-2 rounded-xl">
              <Plus className="h-4 w-4" />
              Créer une clé API
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvelle clé API</DialogTitle>
              <DialogDescription>
                La clé ne sera affichée qu'une seule fois. Copiez-la immédiatement.
              </DialogDescription>
            </DialogHeader>

            {generatedKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Copiez cette clé maintenant. Elle ne sera plus visible après fermeture.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={showKey ? generatedKey : '••••••••••••••••••••••••'}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowKey(!showKey)}
                    aria-label="Masquer"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleCopyKey} aria-label="Copier">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium">Exemple d'utilisation :</p>
                  <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-all font-mono">
                    {`curl -X POST \\
  ${API_BASE_URL}/functions/v1/api-v1-tickets \\
  -H "X-API-Key: ${generatedKey.substring(0, 16)}..." \\
  -H "Content-Type: application/json" \\
  -d '{"titre": "Mon ticket", "priorite": "haute"}'`}
                  </pre>
                </div>
                <Button className="w-full" onClick={handleCloseDialog}>
                  Fermer
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Nom de la clé *</Label>
                  <Input
                    id="key-name"
                    placeholder="Ex: CI/CD Pipeline, Monitoring..."
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-desc">Description</Label>
                  <Input
                    id="key-desc"
                    placeholder="Usage prévu de cette clé..."
                    value={newKeyDescription}
                    onChange={(e) => setNewKeyDescription(e.target.value)}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration</Label>
                  <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 jours</SelectItem>
                      <SelectItem value="90">90 jours</SelectItem>
                      <SelectItem value="180">6 mois</SelectItem>
                      <SelectItem value="365">1 an</SelectItem>
                      <SelectItem value="0">Jamais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    • Permissions :{' '}
                    <Badge variant="outline" className="text-[10px]">
                      read
                    </Badge>{' '}
                    <Badge variant="outline" className="text-[10px]">
                      write
                    </Badge>
                  </p>
                  <p>• Rate limit : 30 req/min, 1000 req/jour</p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || createApiKey.isPending}
                >
                  {createApiKey.isPending ? 'Création...' : 'Générer la clé'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
