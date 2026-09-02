import { Loader2, AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface FullPageLoaderProps {
  /** Délai (ms) avant d'afficher un état "ça prend trop de temps". 0 désactive. */
  timeoutMs?: number
}

export function FullPageLoader({ timeoutMs = 8000 }: FullPageLoaderProps) {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    if (!timeoutMs) return
    const t = setTimeout(() => setStuck(true), timeoutMs)
    return () => clearTimeout(t)
  }, [timeoutMs])

  if (stuck) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-foreground font-medium">Le chargement prend trop de temps</p>
          <p className="text-sm text-muted-foreground">
            Une ressource n'a pas pu se charger. Vérifiez votre connexion ou vos permissions, puis réessayez.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Recharger la page</Button>
            <Button variant="outline" onClick={() => { window.location.href = '/__safe' }}>Mode sûr</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    </div>
  )
}
