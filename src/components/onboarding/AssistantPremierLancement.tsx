/**
 * Assistant de premier lancement.
 *
 * Une instance fraîchement installée porte encore l'identité de l'éditeur
 * d'origine. Rien n'échoue pour autant : les écrans s'affichent, les factures se
 * génèrent, les courriels partent — au nom de quelqu'un d'autre. Cet assistant
 * force donc le passage, une fois, avant que l'administrateur n'entre dans
 * l'application.
 *
 * Il n'écrit que dans `app_config`, sur les clés que les hooks existants lisent
 * déjà. Rien n'est inventé ici que le reste de l'application ne sache consommer.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/shared/use-toast'
import { useEnregistrerConfiguration } from '@/hooks/shared/useEnregistrerConfiguration'
import { CLE_INSTANCE_CONFIGUREE, VERSION_ASSISTANT } from '@/hooks/shared/useConfigurationInstance'
import { ETAPES, verifierChamp } from './champsConfiguration'
import logoMarque from '@/assets/marque/logo.svg'

type Saisies = Record<string, Record<string, string>>

export function AssistantPremierLancement() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const enregistrer = useEnregistrerConfiguration()

  const [indice, setIndice] = useState(0)
  const [saisies, setSaisies] = useState<Saisies>({})
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  const etape = ETAPES[indice]
  const derniere = indice === ETAPES.length - 1

  const valeurs = saisies[etape.cle] ?? {}

  const definir = (nom: string, valeur: string) => {
    setSaisies((s) => ({ ...s, [etape.cle]: { ...(s[etape.cle] ?? {}), [nom]: valeur } }))
    setErreurs((e) => {
      const { [nom]: _retire, ...reste } = e
      return reste
    })
  }

  /** Contrôle de l'étape courante. Rend la liste des messages, vide si tout va bien. */
  const controlerEtape = (): Record<string, string> => {
    const trouves: Record<string, string> = {}
    for (const champ of etape.champs) {
      const message = verifierChamp(champ, valeurs[champ.nom] ?? '')
      if (message) trouves[champ.nom] = message
    }
    return trouves
  }

  const suivant = () => {
    const trouves = controlerEtape()
    if (Object.keys(trouves).length) {
      setErreurs(trouves)
      return
    }
    setErreurs({})
    if (!derniere) setIndice((i) => i + 1)
  }

  const terminer = async () => {
    const trouves = controlerEtape()
    if (Object.keys(trouves).length) {
      setErreurs(trouves)
      return
    }

    // Les étapes vides ne sont pas écrites : une clé posée à blanc masquerait
    // l'absence de configuration derrière une configuration vide.
    const entrees = ETAPES.map((e) => {
      const valeursEtape = saisies[e.cle] ?? {}
      const remplies = Object.fromEntries(
        Object.entries(valeursEtape)
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v !== '')
      )
      return { etape: e, remplies }
    })
      .filter(({ remplies }) => Object.keys(remplies).length > 0)
      .map(({ etape: e, remplies }) => ({
        cle: e.cle,
        valeur: remplies,
        categorie: e.categorie,
        description: e.description,
      }))

    entrees.push({
      cle: CLE_INSTANCE_CONFIGUREE,
      valeur: { fait: true, le: new Date().toISOString(), version: VERSION_ASSISTANT },
      categorie: 'instance',
      description: 'Marqueur de fin de la configuration initiale',
    })

    try {
      await enregistrer.mutateAsync(entrees)
      toast({
        title: 'Configuration enregistrée',
        description: 'Vous pourrez la modifier à tout moment depuis les paramètres.',
      })
      navigate('/', { replace: true })
    } catch {
      // Le message d'échec est déjà présenté par le hook ; on reste sur place
      // pour que la saisie ne soit pas perdue.
    }
  }

  const progression = useMemo(() => Math.round(((indice + 1) / ETAPES.length) * 100), [indice])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <img src={logoMarque} alt="" className="h-10 w-auto mb-6" width={430} height={100} />
          <div className="flex items-baseline justify-between gap-4">
            <CardTitle className="text-2xl">{etape.titre}</CardTitle>
            <span className="text-sm text-muted-foreground shrink-0">
              Étape {indice + 1} sur {ETAPES.length}
            </span>
          </div>
          <CardDescription className="text-base">{etape.intention}</CardDescription>
          <div
            className="h-1 w-full bg-muted rounded-full overflow-hidden mt-4"
            role="progressbar"
            aria-valuenow={progression}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression de la configuration"
          >
            <div
              className="h-full bg-marque-point transition-all duration-300"
              style={{ width: `${progression}%` }}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {indice === 0 && (
            <Alert>
              <AlertDescription>
                Cette instance porte encore les réglages livrés par défaut. Tant qu’ils ne sont pas
                remplacés, vos documents et vos courriels sortent sous une autre identité que la
                vôtre — sans qu’aucun message ne le signale.
              </AlertDescription>
            </Alert>
          )}

          {etape.champs.map((champ) => {
            const id = `${etape.cle}-${champ.nom}`
            const erreur = erreurs[champ.nom]
            return (
              <div key={champ.nom} className="space-y-1.5">
                <Label htmlFor={id}>
                  {champ.libelle}
                  {champ.obligatoire && <span className="text-marque-point ml-1">*</span>}
                </Label>
                {champ.type === 'zone' ? (
                  <Textarea
                    id={id}
                    value={valeurs[champ.nom] ?? ''}
                    onChange={(e) => definir(champ.nom, e.target.value)}
                    placeholder={champ.exemple}
                    rows={2}
                    aria-invalid={Boolean(erreur)}
                    aria-describedby={
                      erreur ? `${id}-erreur` : champ.aide ? `${id}-aide` : undefined
                    }
                  />
                ) : (
                  <Input
                    id={id}
                    type={
                      champ.type === 'courriel' ? 'email' : champ.type === 'url' ? 'url' : 'text'
                    }
                    value={valeurs[champ.nom] ?? ''}
                    onChange={(e) => definir(champ.nom, e.target.value)}
                    placeholder={champ.exemple}
                    aria-invalid={Boolean(erreur)}
                    aria-describedby={
                      erreur ? `${id}-erreur` : champ.aide ? `${id}-aide` : undefined
                    }
                  />
                )}
                {erreur ? (
                  <p id={`${id}-erreur`} className="text-sm text-destructive">
                    {erreur}
                  </p>
                ) : (
                  champ.aide && (
                    <p id={`${id}-aide`} className="text-sm text-muted-foreground">
                      {champ.aide}
                    </p>
                  )
                )}
              </div>
            )
          })}

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIndice((i) => Math.max(0, i - 1))}
              disabled={indice === 0 || enregistrer.isPending}
            >
              Retour
            </Button>

            <Button onClick={derniere ? terminer : suivant} disabled={enregistrer.isPending}>
              {enregistrer.isPending
                ? 'Enregistrement…'
                : derniere
                  ? 'Terminer la configuration'
                  : 'Continuer'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AssistantPremierLancement
