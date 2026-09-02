import { ReactNode, useEffect } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EnqueteShellProps {
  title: string
  subtitle?: string
  children: ReactNode
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
  isSuccess: boolean
  isError?: string | null
  isLoading?: boolean
}

export function EnqueteShell({
  title,
  subtitle,
  children,
  onSubmit,
  isSubmitting,
  isSuccess,
  isError,
  isLoading,
}: EnqueteShellProps) {
  // Notifie le DPI hôte (OpenPulse, HM, etc.) qui aurait intégré cette page en iframe / web view
  // pour qu'il puisse fermer automatiquement la pop-up à la soumission.
  // Déclaré en tête du composant (avant les early returns) pour respecter les Rules of Hooks ;
  // le garde conserve exactement le comportement d'origine (chargement/erreur prioritaires).
  useEffect(() => {
    // On ne notifie l'hôte que si l'écran de succès est réellement affiché :
    // le chargement et l'erreur ont la priorité sur le succès (mêmes early returns qu'au rendu).
    if (!isSuccess || isLoading || isError) return
    try {
      const payload = { type: 'marque:enquete:completed', source: 'marque-ia' }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*')
      }
      // Pour les WebView mobiles (OpenPulse iOS/Android) qui exposent un handler natif
      const w = window as unknown as {
        ReactNativeWebView?: { postMessage: (msg: string) => void }
        webkit?: { messageHandlers?: { marqueEnquete?: { postMessage: (msg: unknown) => void } } }
      }
      w.ReactNativeWebView?.postMessage(JSON.stringify(payload))
      w.webkit?.messageHandlers?.marqueEnquete?.postMessage(payload)
    } catch {
      /* no-op */
    }
  }, [isSuccess, isLoading, isError])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Lien invalide</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {isError === 'token_invalide'
                ? "Ce lien d'enquête est inconnu ou n'existe plus."
                : isError === 'token_expire'
                  ? "Ce lien d'enquête a expiré."
                  : isError === 'deja_repondu'
                    ? 'Cette enquête a déjà été remplie. Merci !'
                    : 'Une erreur est survenue.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Merci pour votre retour !</h2>
            <p className="text-muted-foreground">
              Vos réponses ont bien été enregistrées et vont permettre d'améliorer OpenPulse.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </header>

        <form onSubmit={onSubmit} className="space-y-6">
          {children}

          <div className="sticky bottom-4">
            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full shadow-lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours…
                </>
              ) : (
                'Envoyer mes réponses'
              )}
            </Button>
          </div>
        </form>

        <footer className="text-center text-xs text-muted-foreground mt-8 pt-4 border-t">
          Vos réponses sont confidentielles et utilisées uniquement pour améliorer OpenPulse.
        </footer>
      </div>
    </div>
  )
}
