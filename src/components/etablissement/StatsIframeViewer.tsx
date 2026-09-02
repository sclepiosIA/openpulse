import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, BarChart3, Save, RefreshCw } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "@/hooks/shared/use-toast"
import { supabase } from "@/integrations/supabase/client";

interface StatsIframeViewerProps {
  url: string | null | undefined
  title: string
  description?: string
  etablissementId?: string
  fieldName?: 'stats_utilisation_url' | 'stats_urgences_url'
}

const IFRAME_TIMEOUT_MS = 20000

export function StatsIframeViewer({ url, title, description, etablissementId, fieldName }: StatsIframeViewerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const queryClient = useQueryClient()

  // Timeout de sécurité pour les iframes qui ne chargent pas
  useEffect(() => {
    if (!url || !isLoading) return
    const timer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false)
        setHasTimedOut(true)
      }
    }, IFRAME_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [url, isLoading, retryKey])

  const handleRetry = () => {
    setIsLoading(true)
    setHasError(false)
    setHasTimedOut(false)
    setRetryKey(k => k + 1)
  }

  const isValidUrl = (value: string) => {
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  }

  const handleSave = async () => {
    if (!etablissementId || !fieldName) return
    if (!isValidUrl(urlInput)) {
      toast({ title: "URL invalide", description: "Veuillez saisir une URL valide (ex: https://...)", variant: "destructive" })
      return
    }

    setIsSaving(true)
    const { error } = await supabase
      .from('etablissements')
      .update({ [fieldName]: urlInput } as never)
      .eq('id', etablissementId)

    setIsSaving(false)

    if (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder l'URL", variant: "destructive" })
    } else {
      toast({ title: "URL enregistrée" })
      queryClient.invalidateQueries({ queryKey: ['etablissement-detail', etablissementId] })
    }
  }

  if (!url) {
    return (
      <Card className="flex-1">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <BarChart3 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium">URL non configurée</p>
            <p className="text-sm text-muted-foreground">
              {etablissementId && fieldName
                ? "Saisissez l'URL pour afficher les statistiques"
                : "Les statistiques ne sont pas encore configurées pour cet établissement"}
            </p>
          </div>
          {etablissementId && fieldName && (
            <div className="flex w-full max-w-md gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                type="url"
              />
              <Button onClick={handleSave} disabled={isSaving || !urlInput.trim()}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative flex-1">
      <CardContent className="p-0 h-full">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10 rounded-lg gap-3">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Chargement de l'interface…</p>
          </div>
        )}
        
        {(hasError || hasTimedOut) ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium">
              {hasTimedOut ? "Délai de chargement dépassé" : "Erreur de chargement"}
            </p>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {hasTimedOut 
                ? "L'interface externe ne répond pas. Vérifiez votre connexion ou l'URL configurée."
                : "Impossible de charger les statistiques. Vérifiez l'URL configurée."}
            </p>
            <Button onClick={handleRetry} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>
          </div>
        ) : (
          <iframe
            key={retryKey}
            src={url}
            title={title}
            className="w-full border-0 rounded-lg h-[calc(100vh-80px)]"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setHasError(true)
            }}
            allow="private-network"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        )}
      </CardContent>
    </Card>
  )
}
