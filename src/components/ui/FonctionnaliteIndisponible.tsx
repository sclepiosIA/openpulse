/**
 * OpenPulse — affichage de l'indisponibilite d'un module.
 *
 * Remplace un ecran vide, un plantage ou un message technique par une
 * explication : ce que fait le module, pourquoi il est absent, et ce qu'il faut
 * renseigner pour l'activer. Les variables cote serveur sont distinguees des
 * variables cote client, parce que ce ne sont pas les memes personnes qui les
 * renseignent ni le meme fichier.
 *
 * `ModuleOuIndisponible` est le garde a utiliser dans les pages : il rend son
 * contenu quand le module est actif, et cet ecran sinon. C'est ce qui evite
 * qu'une page appelle une integration absente et casse le rendu.
 */
import type { ReactNode } from 'react'
import { AlertTriangle, ExternalLink, Info, PowerOff, Server, Settings2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  evaluerFonctionnalite,
  libelleEtat,
  type EtatFonctionnalite,
  type EtatInterrupteur,
  type IdFonctionnalite,
  type SourceConfiguration,
  type VariableAttendue,
} from '@/config/fonctionnalites'

type VarianteBadge = 'muted' | 'warning' | 'info' | 'success'

function varianteBadge(etat: EtatFonctionnalite): VarianteBadge {
  if (etat === 'active') return 'success'
  if (etat === 'desactivee_par_configuration') return 'muted'
  return 'warning'
}

function IconeEtat({ etat }: { readonly etat: EtatFonctionnalite }): JSX.Element {
  if (etat === 'desactivee_par_configuration') {
    return <PowerOff aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
  }
  return <AlertTriangle aria-hidden="true" className="h-5 w-5 text-warning" />
}

function LigneVariable({ variable }: { readonly variable: VariableAttendue }): JSX.Element {
  const surServeur = variable.portee === 'serveur'
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all rounded bg-background px-1.5 py-0.5 font-mono text-xs">
          {variable.nom}
        </code>
        <Badge variant={surServeur ? 'warning' : 'info'} className="gap-1">
          {surServeur ? (
            <Server aria-hidden="true" className="h-3 w-3" />
          ) : (
            <Settings2 aria-hidden="true" className="h-3 w-3" />
          )}
          {surServeur ? 'serveur' : 'client'}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{variable.description}</p>
    </li>
  )
}

export interface FonctionnaliteIndisponibleProps {
  /** Etat deja evalue. Utiliser `idFonctionnalite` pour laisser le composant evaluer. */
  readonly etat: EtatInterrupteur
  /** `encart` s'insere dans une page existante, `page` occupe la zone entiere. */
  readonly presentation?: 'encart' | 'page' | undefined
  /** Lien vers la section du guide d'installation correspondante. */
  readonly urlDocumentation?: string | undefined
  /** Actions supplementaires : contacter un administrateur, revenir en arriere. */
  readonly children?: ReactNode
  readonly className?: string | undefined
}

export function FonctionnaliteIndisponible({
  etat,
  presentation = 'encart',
  urlDocumentation,
  children,
  className,
}: FonctionnaliteIndisponibleProps): JSX.Element {
  const { definition } = etat
  const clientes = etat.variablesManquantes.filter((variable) => variable.portee === 'client')
  const serveurs = etat.variablesManquantes.filter((variable) => variable.portee === 'serveur')

  return (
    <Card
      role="region"
      aria-label={`Module indisponible : ${definition.libelle}`}
      className={cn(
        presentation === 'page' ? 'mx-auto w-full max-w-2xl' : 'w-full',
        className
      )}
    >
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <IconeEtat etat={etat.etat} />
            <div className="space-y-1">
              <CardTitle className="text-base">{definition.libelle}</CardTitle>
              <CardDescription>{definition.description}</CardDescription>
            </div>
          </div>
          <Badge variant={varianteBadge(etat.etat)}>{libelleEtat(etat.etat)}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-foreground">{etat.raison}</p>

        {!etat.etatServeurConnu ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Cet ecran peut disparaitre seul : la plateforme attend encore la reponse du serveur
              sur l&apos;etat de ce module.
            </span>
          </p>
        ) : null}

        {clientes.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">A renseigner dans la configuration du client</h3>
            <p className="text-xs text-muted-foreground">
              Ces valeurs sont publiques et figees a la construction du paquet : apres
              modification, reconstruire puis redeployer l&apos;interface.
            </p>
            <ul className="space-y-2">
              {clientes.map((variable) => (
                <LigneVariable key={variable.nom} variable={variable} />
              ))}
            </ul>
          </section>
        ) : null}

        {serveurs.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">A renseigner dans la configuration du serveur</h3>
            <p className="text-xs text-muted-foreground">
              Ce sont des secrets : ils ne doivent jamais porter de prefixe destine au navigateur,
              ni etre versionnes.
            </p>
            <ul className="space-y-2">
              {serveurs.map((variable) => (
                <LigneVariable key={variable.nom} variable={variable} />
              ))}
            </ul>
          </section>
        ) : null}

        {urlDocumentation !== undefined && urlDocumentation !== '' ? (
          <a
            href={urlDocumentation}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
          >
            Guide d&apos;installation : {definition.ancreDocumentation}
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">
            Section du guide d&apos;installation :{' '}
            <code className="font-mono">{definition.ancreDocumentation}</code>
          </p>
        )}

        {children}
      </CardContent>
    </Card>
  )
}

export interface ModuleOuIndisponibleProps {
  readonly idFonctionnalite: IdFonctionnalite
  readonly children: ReactNode
  readonly presentation?: 'encart' | 'page' | undefined
  readonly urlDocumentation?: string | undefined
  /** Injection explicite, pour les tests et les previsualisations. */
  readonly source?: SourceConfiguration | undefined
  readonly className?: string | undefined
}

/**
 * Garde a placer autour de tout contenu qui depend d'une integration externe.
 * L'evaluation est une fonction pure : elle ne peut ni lever ni declencher
 * d'appel reseau pendant le rendu.
 */
export function ModuleOuIndisponible({
  idFonctionnalite,
  children,
  presentation,
  urlDocumentation,
  source,
  className,
}: ModuleOuIndisponibleProps): JSX.Element {
  const etat =
    source === undefined
      ? evaluerFonctionnalite(idFonctionnalite)
      : evaluerFonctionnalite(idFonctionnalite, source)

  if (etat.etat === 'active') {
    return <>{children}</>
  }

  return (
    <FonctionnaliteIndisponible
      etat={etat}
      presentation={presentation}
      urlDocumentation={urlDocumentation}
      className={className}
    />
  )
}
