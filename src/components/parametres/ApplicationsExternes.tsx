import { useEffect, useState } from 'react'
import { Plus, Trash2, ExternalLink, AlertTriangle } from 'lucide-react'
import { ICONES_PAR_NOM, iconeApplication } from '@/config/iconesApplications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ApplicationExterne, ICONES_APPLICATION,
  estApplicationAffichable, useApplicationsExternes, useEnregistrerApplicationsExternes,
} from '@/hooks/shared/useApplicationsExternes'

/**
 * Déclaration des applications externes affichées dans le menu.
 *
 * La liste était compilée : libellé, icône, section et équipes vivaient dans le
 * code, et seule l'adresse de cinq emplacements prédéfinis pouvait être
 * changée. Un exploitant ne pouvait donc ni ajouter l'outil qu'il utilise, ni
 * retirer ceux qu'il n'a pas.
 */

/** Les sections du menu où une application peut être rangée. */
const SECTIONS = ['Général', 'CRM', 'Prospection', 'CSM', 'Marketing', 'Technique', 'Direction']

function identifiant(): string {
  return `app-${crypto.randomUUID()}`
}

export function ApplicationsExternes() {
  const { applications, isLoading } = useApplicationsExternes()
  const enregistrer = useEnregistrerApplicationsExternes()
  const [brouillon, setBrouillon] = useState<ApplicationExterne[]>([])

  // Le brouillon suit la base tant que l'utilisateur n'a rien modifié.
  useEffect(() => { setBrouillon(applications) }, [applications])

  const modifier = (id: string, champ: keyof ApplicationExterne, valeur: unknown) => {
    setBrouillon((liste) => liste.map((a) => (a.id === id ? { ...a, [champ]: valeur } : a)))
  }

  const ajouter = () => {
    setBrouillon((liste) => [
      ...liste,
      { id: identifiant(), libelle: '', url: '', icone: 'lien', section: 'Général', equipes: [] },
    ])
  }

  const retirer = (id: string) => {
    setBrouillon((liste) => liste.filter((a) => a.id !== id))
  }

  const modifie = JSON.stringify(brouillon) !== JSON.stringify(applications)
  const incompletes = brouillon.filter((a) => !estApplicationAffichable(a))

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement des applications…</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-primary" />
          Applications externes
        </CardTitle>
        <CardDescription>
          Les outils que votre organisation utilise à côté d’OpenPulse. Ils apparaissent dans le
          menu, dans la section que vous choisissez.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {brouillon.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune application déclarée. Le menu n’affiche donc aucun lien externe.
          </p>
        )}

        {brouillon.map((app) => {
          const Icone = iconeApplication(app.icone)
          const affichable = estApplicationAffichable(app)
          return (
            <div key={app.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Icone className="h-5 w-5 mt-2 shrink-0 text-muted-foreground" />

                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`libelle-${app.id}`}>Libellé</Label>
                    <Input
                      id={`libelle-${app.id}`}
                      value={app.libelle}
                      placeholder="Nom affiché dans le menu"
                      onChange={(e) => modifier(app.id, 'libelle', e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`url-${app.id}`}>Adresse</Label>
                    <Input
                      id={`url-${app.id}`}
                      value={app.url}
                      placeholder="https://exemple.mon-domaine.fr"
                      onChange={(e) => modifier(app.id, 'url', e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`icone-${app.id}`}>Icône</Label>
                    <Select
                      value={app.icone}
                      onValueChange={(v) => modifier(app.id, 'icone', v)}
                    >
                      <SelectTrigger id={`icone-${app.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICONES_APPLICATION.map((nom) => {
                          const I = ICONES_PAR_NOM[nom]
                          return (
                            <SelectItem key={nom} value={nom}>
                              <span className="flex items-center gap-2">
                                <I className="h-4 w-4" />
                                {nom}
                              </span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`section-${app.id}`}>Section du menu</Label>
                    <Select
                      value={app.section}
                      onValueChange={(v) => modifier(app.id, 'section', v)}
                    >
                      <SelectTrigger id={`section-${app.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Retirer ${app.libelle || 'cette application'}`}
                  onClick={() => retirer(app.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {!affichable && (
                <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Tant que le libellé et une adresse en http(s) ne sont pas renseignés, cette
                  entrée n’apparaît pas dans le menu.
                </p>
              )}
            </div>
          )
        })}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant="outline" onClick={ajouter}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une application
          </Button>

          <Button
            onClick={() => enregistrer.mutate({ applications: brouillon, base: applications })}
            disabled={!modifie || enregistrer.isPending}
          >
            {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>

          {incompletes.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {incompletes.length} entrée{incompletes.length > 1 ? 's' : ''} incomplète
              {incompletes.length > 1 ? 's' : ''} ne sera pas affichée.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ApplicationsExternes
