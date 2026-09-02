import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { debug } from '@/lib/debug'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  FileText,
  Pencil,
  FileDown,
  Send,
  FileEdit,
  Building2,
  User,
  Calendar,
  Euro,
  History,
  FileStack,
  AlertTriangle,
  CheckCircle2,
  FileSignature,
} from 'lucide-react'
import { useContrat, useContratAvenants, useContratAlertes } from '@/hooks/contracts/useContrats'
import { PageDataState } from '@/components/common/PageDataState'
import { CONTRAT_STATUT_LABELS, CONTRAT_STATUT_COLORS, CONTRAT_TYPE_LABELS } from '@/types/contrats'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { exportContratPdf } from '@/lib/pdf/contratPdf'

// Lazy load le dialog de modification
const ContratFormDialog = lazy(() => import('@/components/contrats/ContratFormDialog'))
const SignatureDialog = lazy(() => import('@/components/contrats/SignatureDialog'))
const SignatureTab = lazy(() => import('@/components/contrats/signature/SignatureTab'))

// UUID v4 lax — protège contre /contrats/999999 (numérique) qui déclenche un 400 PostgREST
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ContratDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'resume')
  useEffect(() => {
    const t = searchParams.get('tab')
    if (t) setActiveTab(t)
  }, [searchParams])
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showSignatureDialog, setShowSignatureDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Garde-fou : ID non-UUID → 404 propre (évite un 400 PostgREST et une entrée bruit dans le monitoring).
  useEffect(() => {
    if (id && !UUID_RE.test(id)) {
      navigate('/404', { replace: true })
    }
  }, [id, navigate])

  const { data: contrat, isLoading, isError, error, refetch } = useContrat(id)
  const { data: avenants = [] } = useContratAvenants(id)
  const { data: allAlertes = [] } = useContratAlertes()

  // Filtrer les alertes pour ce contrat
  const alertes = allAlertes.filter((a) => a.contrat_id === id)

  const handleExportPDF = async () => {
    if (!contrat) return
    setIsExporting(true)
    try {
      await exportContratPdf(contrat)
      toast.success('PDF exporté avec succès')
    } catch (error) {
      debug.error('Erreur export PDF:', error)
      toast.error("Erreur lors de l'export PDF")
    } finally {
      setIsExporting(false)
    }
  }

  const formatMontant = (montant: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant)
  }

  if (isLoading || isError || !contrat) {
    return (
      <PageDataState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!isLoading && !isError && !contrat}
        emptyTitle="Contrat introuvable"
        emptyDescription="Le contrat demandé n'existe pas ou a été supprimé."
        onRetry={() => refetch()}
      >
        <></>
      </PageDataState>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header avec bouton retour et actions */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/contrats')}
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary hidden sm:block" />
              <h1 className="text-base sm:text-lg font-bold truncate">{contrat.titre}</h1>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Contrat n° {contrat.numero || 'Non numéroté'} • {contrat.client_nom}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate(`/contrats/builder/${id}`)}>
            <FileEdit className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Builder</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
            <Pencil className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Modifier</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
            <FileDown className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{isExporting ? 'Export...' : 'PDF'}</span>
          </Button>
          <Button size="sm" onClick={() => setShowSignatureDialog(true)}>
            <Send className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Signature</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* Badges statut et type */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Badge className={CONTRAT_STATUT_COLORS[contrat.statut]}>
            {CONTRAT_STATUT_LABELS[contrat.statut]}
          </Badge>
          <Badge variant="outline">{CONTRAT_TYPE_LABELS[contrat.type]}</Badge>
          {contrat.reconduction_tacite && <Badge variant="secondary">Reconduction tacite</Badge>}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="resume" className="gap-2">
              <FileText className="h-4 w-4" />
              Résumé
            </TabsTrigger>
            <TabsTrigger value="avenants" className="gap-2">
              <FileStack className="h-4 w-4" />
              Avenants
              {avenants.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {avenants.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="alertes" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertes
              {alertes.filter((a) => !a.est_traitee).length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {alertes.filter((a) => !a.est_traitee).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="signature" className="gap-2">
              <FileSignature className="h-4 w-4" />
              Signature
            </TabsTrigger>
            <TabsTrigger value="historique" className="gap-2">
              <History className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resume" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Informations client */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4" />
                    Client
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Nom</p>
                    <p className="font-medium">{contrat.client_nom}</p>
                  </div>
                  {contrat.client_adresse && (
                    <div>
                      <p className="text-sm text-muted-foreground">Adresse</p>
                      <p>{contrat.client_adresse}</p>
                    </div>
                  )}
                  {contrat.client_siret && (
                    <div>
                      <p className="text-sm text-muted-foreground">SIRET</p>
                      <p className="font-mono">{contrat.client_siret}</p>
                    </div>
                  )}
                  {contrat.client_representant && (
                    <div>
                      <p className="text-sm text-muted-foreground">Représentant</p>
                      <p>{contrat.client_representant}</p>
                    </div>
                  )}
                  {contrat.etablissement && (
                    <div className="pt-2 border-t">
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => navigate(`/etablissements/${contrat.etablissement?.id}`)}
                      >
                        Voir l'établissement →
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Montants */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Euro className="h-4 w-4" />
                    Montants
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-sm text-muted-foreground">Montant annuel HT</p>
                    <p className="font-semibold text-lg">
                      {formatMontant(contrat.montant_annuel_ht)}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-muted-foreground">Montant mensuel HT</p>
                    <p className="font-medium">{formatMontant(contrat.montant_mensuel_ht)}</p>
                  </div>
                  {contrat.remise_pourcent && contrat.remise_pourcent > 0 && (
                    <div className="flex justify-between">
                      <p className="text-sm text-muted-foreground">Remise</p>
                      <p className="text-green-600">{contrat.remise_pourcent}%</p>
                    </div>
                  )}
                  {contrat.conditions_paiement && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">Conditions de paiement</p>
                      <p>{contrat.conditions_paiement}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dates et durée */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4" />
                    Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-sm text-muted-foreground">Date d'émission</p>
                    <p>{format(new Date(contrat.date_emission), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                  {contrat.date_debut && (
                    <div className="flex justify-between">
                      <p className="text-sm text-muted-foreground">Date de début</p>
                      <p>{format(new Date(contrat.date_debut), 'dd/MM/yyyy', { locale: fr })}</p>
                    </div>
                  )}
                  {contrat.date_fin && (
                    <div className="flex justify-between">
                      <p className="text-sm text-muted-foreground">Date de fin</p>
                      <p>{format(new Date(contrat.date_fin), 'dd/MM/yyyy', { locale: fr })}</p>
                    </div>
                  )}
                  {contrat.date_signature && (
                    <div className="flex justify-between">
                      <p className="text-sm text-muted-foreground">Date de signature</p>
                      <p>
                        {format(new Date(contrat.date_signature), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <p className="text-sm text-muted-foreground">Durée initiale</p>
                    <p>{contrat.duree_initiale_mois} mois</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-muted-foreground">Préavis</p>
                    <p>{contrat.preavis_jours} jours</p>
                  </div>
                </CardContent>
              </Card>

              {/* Commercial et contact */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4" />
                    Interlocuteurs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {contrat.commercial && (
                    <div>
                      <p className="text-sm text-muted-foreground">Commercial</p>
                      <p className="font-medium">
                        {contrat.commercial.prenom} {contrat.commercial.nom}
                      </p>
                    </div>
                  )}
                  {contrat.contact && (
                    <div>
                      <p className="text-sm text-muted-foreground">Contact client</p>
                      <p className="font-medium">
                        {contrat.contact.prenom} {contrat.contact.nom}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Notes internes */}
            {contrat.notes_internes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes internes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{contrat.notes_internes}</p>
                </CardContent>
              </Card>
            )}

            {/* Conditions particulières */}
            {contrat.conditions_particulieres && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Conditions particulières</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{contrat.conditions_particulieres}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="avenants" className="space-y-4">
            {avenants.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileStack className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Aucun avenant</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Les avenants permettent de modifier un contrat existant.
                  </p>
                  <Button variant="outline">Créer un avenant</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {avenants.map((avenant) => (
                  <Card key={avenant.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Avenant n°{avenant.numero}</p>
                          <p className="text-sm text-muted-foreground">{avenant.titre}</p>
                        </div>
                        <div className="text-right">
                          <Badge className={CONTRAT_STATUT_COLORS[avenant.statut]}>
                            {CONTRAT_STATUT_LABELS[avenant.statut]}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Effet:{' '}
                            {format(new Date(avenant.date_effet), 'dd/MM/yyyy', { locale: fr })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="alertes" className="space-y-4">
            {alertes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-medium mb-2">Aucune alerte</p>
                  <p className="text-sm text-muted-foreground">
                    Ce contrat n'a aucune alerte en cours.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {alertes.map((alerte) => (
                  <Card key={alerte.id} className={alerte.est_traitee ? 'opacity-60' : ''}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle
                            className={`h-5 w-5 ${alerte.est_traitee ? 'text-muted-foreground' : 'text-amber-500'}`}
                          />
                          <div>
                            <p className="font-medium">{alerte.titre}</p>
                            {alerte.description && (
                              <p className="text-sm text-muted-foreground">{alerte.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            {format(new Date(alerte.date_alerte), 'dd/MM/yyyy', { locale: fr })}
                          </p>
                          {alerte.est_traitee ? (
                            <Badge variant="secondary">Traitée</Badge>
                          ) : (
                            <Badge variant="outline">À traiter</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="signature" className="space-y-4">
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <SignatureTab
                contratId={id!}
                contratStatut={contrat.statut}
                onOpenSendDialog={() => setShowSignatureDialog(true)}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="historique" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historique des événements</CardTitle>
                <CardDescription>Traçabilité des actions effectuées sur ce contrat</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div>
                      <p className="font-medium">Contrat créé</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(contrat.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>
                  </div>

                  {contrat.date_signature && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                      <div>
                        <p className="font-medium">Contrat signé</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(contrat.date_signature), 'dd MMMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  )}

                  {contrat.updated_at !== contrat.created_at && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="font-medium">Dernière modification</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(contrat.updated_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <Suspense fallback={null}>
        {showEditDialog && (
          <ContratFormDialog
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            contrat={contrat}
          />
        )}
        {showSignatureDialog && (
          <SignatureDialog
            open={showSignatureDialog}
            onOpenChange={setShowSignatureDialog}
            contratId={id!}
            contratTitre={contrat.titre}
            clientNom={contrat.client_nom}
            contactEmail={(contrat.contact as any)?.email}
          />
        )}
      </Suspense>
    </div>
  )
}
