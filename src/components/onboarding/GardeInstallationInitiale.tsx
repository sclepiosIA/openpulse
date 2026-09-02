import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Check, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { supabase } from '@/integrations/supabase/client'
import logoMarque from '@/assets/marque/logo.svg'

type EtatInstallation = 'chargement' | 'requise' | 'terminee' | 'indisponible'

interface ReponseBootstrap {
  installation_requise?: boolean
  success?: boolean
  error?: string
}

export function GardeInstallationInitiale({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatInstallation>('chargement')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [codeInstallation] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.hash.slice(1)).get('installation')?.trim() ?? ''
  })
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    let actif = true
    void supabase.functions
      .invoke<ReponseBootstrap>('bootstrap-admin', { body: { action: 'status' } })
      .then(({ data, error }) => {
        if (!actif) return
        if (error || typeof data?.installation_requise !== 'boolean') {
          setEtat('indisponible')
          return
        }
        setEtat(data.installation_requise ? 'requise' : 'terminee')
      })
    return () => {
      actif = false
    }
  }, [])

  useEffect(() => {
    if (!codeInstallation || typeof window === 'undefined') return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [codeInstallation])

  if (etat === 'chargement') return <FullPageLoader />
  if (etat === 'terminee') return <>{children}</>

  if (etat === 'indisponible') {
    return (
      <main className="min-h-dvh grid place-items-center bg-background p-6">
        <Alert className="max-w-xl border-destructive/30 bg-card">
          <AlertDescription>
            Impossible de vérifier l’état d’installation de cette instance. Réessayez dans quelques
            instants ou contactez l’exploitant OpenPulse.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const creerAdministrateur = async (event: FormEvent) => {
    event.preventDefault()
    setErreur('')
    if (password !== confirmation) {
      setErreur('Les deux mots de passe doivent être identiques.')
      return
    }
    if (password.length < 12) {
      setErreur('Choisissez un mot de passe d’au moins 12 caractères.')
      return
    }

    setEnvoi(true)
    const { data, error } = await supabase.functions.invoke<ReponseBootstrap>('bootstrap-admin', {
      body: {
        action: 'create',
        email: email.trim(),
        password,
        prenom: prenom.trim(),
        nom: nom.trim(),
        installation_code: codeInstallation.trim(),
      },
    })

    if (error || !data?.success) {
      setErreur(data?.error || 'La création du compte administrateur a échoué.')
      setEnvoi(false)
      return
    }

    setEtat('terminee')
    setEnvoi(false)
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-background px-4 py-10 sm:px-6">
      <Card
        data-onboarding-card
        className="mx-auto w-full max-w-5xl overflow-hidden border-border/80 bg-card shadow-none hover:shadow-none"
      >
        <CardContent className="grid p-0 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="flex flex-col justify-between border-b border-border bg-primary/[0.045] p-8 lg:border-b-0 lg:border-r lg:p-12">
            <div>
              <img
                src={logoMarque}
                alt="OpenPulse"
                className="h-11 w-auto"
                width={430}
                height={100}
              />
              <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background px-3 py-1.5 text-sm text-primary">
                <Sparkles className="h-4 w-4" />
                Première installation
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Créez votre compte administrateur
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
                Votre espace OpenPulse est neuf et indépendant. Commencez par créer le seul compte
                autorisé à configurer l’organisation.
              </p>
            </div>

            <ul className="mt-10 space-y-4 text-sm text-foreground">
              {[
                'Aucune donnée Gestion n’est importée',
                'Inscriptions publiques fermées après cette étape',
                'Authentification forte proposée dès la première session',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <form onSubmit={creerAdministrateur} className="p-8 lg:p-12">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">Administrateur principal</p>
                <p className="text-sm text-muted-foreground">
                  Étape 1 sur 2 · identité de connexion
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bootstrap-prenom">Prénom</Label>
                <Input
                  id="bootstrap-prenom"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bootstrap-nom">Nom</Label>
                <Input
                  id="bootstrap-nom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bootstrap-email">Adresse e-mail</Label>
                <Input
                  id="bootstrap-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bootstrap-password">Mot de passe</Label>
                <Input
                  id="bootstrap-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bootstrap-confirmation">Confirmer le mot de passe</Label>
                <Input
                  id="bootstrap-confirmation"
                  type="password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {!codeInstallation && (
              <Alert className="mt-6 border-primary/25 bg-primary/[0.045]">
                <AlertDescription>
                  Pour sécuriser le premier compte, ouvrez le lien d’activation affiché à la fin de
                  l’installation OpenPulse. Aucun code n’est à recopier.
                </AlertDescription>
              </Alert>
            )}

            {erreur && (
              <Alert variant="destructive" className="mt-6">
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-8 w-full"
              disabled={envoi || !codeInstallation}
            >
              {envoi ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {envoi ? 'Création de votre espace…' : 'Créer mon espace OpenPulse'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default GardeInstallationInitiale
