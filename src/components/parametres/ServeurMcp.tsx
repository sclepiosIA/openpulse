import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plug, CheckCircle2, XCircle, Loader2, KeyRound, ExternalLink, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'

/**
 * État du serveur MCP de l'instance, pour un administrateur.
 *
 * Le guide de connexion vit dans la page de profil : il est destiné à chaque
 * utilisateur, qui y génère SON jeton. Ce panneau-ci répond à une autre
 * question — le serveur répond-il, et qu'expose-t-il ? — et n'a donc pas à
 * dupliquer le guide, seulement à y renvoyer.
 */

const URL_MCP = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-server`
const CLE_ANONYME = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

type Etat =
  | { phase: 'repos' }
  | { phase: 'appel' }
  | { phase: 'ok'; version: string; nom: string; outils: string[]; nombre: number; latenceMs: number }
  | { phase: 'echec'; raison: string; latenceMs?: number }

export function ServeurMcp() {
  const [etat, setEtat] = useState<Etat>({ phase: 'repos' })

  const interroger = async () => {
    setEtat({ phase: 'appel' })
    const debut = performance.now()
    try {
      const reponse = await fetch(`${URL_MCP}?health=1`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', apikey: CLE_ANONYME },
      })
      const latenceMs = Math.round(performance.now() - debut)

      if (!reponse.ok) {
        setEtat({ phase: 'echec', raison: `Le serveur a répondu ${reponse.status}.`, latenceMs })
        return
      }

      const donnees = await reponse.json()
      const outils: string[] = Array.isArray(donnees.tools) ? donnees.tools : []
      setEtat({
        phase: 'ok',
        nom: typeof donnees.name === 'string' ? donnees.name : 'serveur MCP',
        version: typeof donnees.version === 'string' ? donnees.version : '—',
        nombre: typeof donnees.tools_count === 'number' ? donnees.tools_count : outils.length,
        outils,
        latenceMs,
      })
    } catch (erreur) {
      // Un serveur injoignable et un serveur en erreur ne se soignent pas
      // pareil : on distingue les deux plutôt que d'afficher « échec ».
      setEtat({
        phase: 'echec',
        raison: erreur instanceof Error ? erreur.message : 'Le serveur est injoignable.',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          Serveur MCP
        </CardTitle>
        <CardDescription>
          Il expose les outils de l’application à un client compatible — un assistant, un agent —
          qui peut alors lire et écrire vos données avec les droits de la personne connectée.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={interroger} disabled={etat.phase === 'appel'}>
            {etat.phase === 'appel' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Interrogation…
              </>
            ) : (
              'Interroger le serveur'
            )}
          </Button>

          {etat.phase === 'ok' && (
            <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              Répond en {etat.latenceMs} ms
            </span>
          )}

          {etat.phase === 'echec' && (
            <span className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {etat.raison}
            </span>
          )}
        </div>

        {etat.phase === 'ok' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{etat.nom}</Badge>
              <Badge variant="outline">version {etat.version}</Badge>
              <Badge variant="outline">{etat.nombre} outils exposés</Badge>
            </div>

            {etat.outils.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 px-0">
                    <ChevronDown className="h-4 w-4" />
                    Voir les outils exposés
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-md border p-3">
                    <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {etat.outils.map((outil) => (
                        <li key={outil} className="truncate font-mono text-xs text-muted-foreground">
                          {outil}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Connecter un client
          </p>
          <p className="text-muted-foreground">
            Chaque personne génère son propre jeton depuis son profil : les outils s’exécutent
            avec ses droits, pas avec les vôtres. Un jeton partagé donnerait à son porteur les
            accès de celui qui l’a émis.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/profil">
              <ExternalLink className="mr-2 h-4 w-4" />
              Ouvrir le guide de connexion
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Adresse du serveur : <code className="rounded bg-muted px-1 py-0.5">{URL_MCP}</code>
        </p>
      </CardContent>
    </Card>
  )
}

export default ServeurMcp
