import { useState, useMemo } from "react";
import { debug } from "@/lib/debug";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Briefcase,
  CreditCard,
  FileText,
  Calendar,
  Mail,
  UserCircle,
  Pencil,
  Trash2,
  Upload,
  UserCheck,
  Save,
} from "lucide-react";
import { useRHSalaires } from "@/hooks/hr/useRHSalaires";
import { useRHAbsences } from "@/hooks/hr/useRHAbsences";
import { useRHDocuments } from "@/hooks/hr/useRHDocuments";
import { useOnboardingByProfile, useUpsertOnboarding, type DossierRH, type Materiel } from "@/hooks/tasks/useOnboardingOffboarding";
import { SalairesHistoryChart } from "./SalairesHistoryChart";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { EditEmployeeDialog } from "./EditEmployeeDialog";
import { OnboardingStatusCard } from "./onboarding/OnboardingStatusCard";
import { DossierRHChecklist } from "./onboarding/DossierRHChecklist";
import { ComptesAccesChecklist } from "./onboarding/ComptesAccesChecklist";
import { MaterielList } from "./onboarding/MaterielList";
import { OffboardingActionDialog } from "./onboarding/OffboardingActionDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteProfile } from "@/hooks/profile/useProfiles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RHDocumentsAccordion } from "./RHDocumentsAccordion";

export function RHDossierEmploye() {
  const { data: profiles, isLoading } = useProfilesWithRoles();
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteProfile = useDeleteProfile();

  const selectedProfile = profiles?.find(p => p.id === selectedProfileId);
  
  const { salaires, isLoading: salairesLoading } = useRHSalaires();
  const { absences, isLoading: absencesLoading } = useRHAbsences(selectedProfileId);
  const { documents, isLoading: documentsLoading, uploadDocument, deleteDocument, getDocumentUrl } = useRHDocuments(selectedProfileId);
  const { data: onboardingData } = useOnboardingByProfile(selectedProfileId || null);
  const upsertOnboarding = useUpsertOnboarding();

  // Filtrer les salaires du profil sélectionné
  const profileSalaires = salaires?.filter(s => s.profile_id === selectedProfileId) || [];
  
  // Calculer les statistiques des salaires
  const salaireBrutMoyen = profileSalaires.length > 0
    ? profileSalaires.reduce((sum, s) => sum + s.salaire_brut, 0) / profileSalaires.length
    : 0;
  const totalPrimes = profileSalaires.reduce((sum, s) => sum + (s.primes || 0), 0);
  const totalHeuresSupp = profileSalaires.reduce((sum, s) => sum + (s.heures_supplementaires || 0), 0);

  // État du formulaire onboarding
  const [onboardingFormData, setOnboardingFormData] = useState<{
    date_entree: string | null;
    date_sortie: string | null;
    statut: 'en_cours' | 'actif' | 'sortie_prevue' | 'sorti';
    motif_sortie: string | null;
    dossier_rh: DossierRH;
    comptes_acces: Record<string, boolean>;
    materiel: Materiel;
  }>({
    date_entree: null,
    date_sortie: null,
    statut: 'en_cours',
    motif_sortie: null,
    dossier_rh: {} as DossierRH,
    comptes_acces: {} as Record<string, boolean>,
    materiel: {} as Materiel,
  });

  // Mettre à jour formData onboarding quand les données changent
  useMemo(() => {
    if (onboardingData) {
      setOnboardingFormData({
        date_entree: onboardingData.date_entree || '',
        date_sortie: onboardingData.date_sortie || '',
        statut: onboardingData.statut,
        motif_sortie: onboardingData.motif_sortie || '',
        dossier_rh: onboardingData.dossier_rh,
        comptes_acces: onboardingData.comptes_acces,
        materiel: onboardingData.materiel,
      });
    } else if (selectedProfileId) {
      setOnboardingFormData({
        date_entree: null,
        date_sortie: null,
        statut: 'en_cours' as const,
        motif_sortie: null,
        dossier_rh: {
          cv: { status: null, ref: null, date: null },
          contrat: { status: null, ref: null, type: null, date: null },
          mutuelle: { status: null, ref: null, organisme: null, date: null },
          charte: { status: null, date: null },
          solde_tout_compte: { status: null, date: null },
        },
        comptes_acces: {
          mail: false,
          vpn: false,
          bookstack: false,
          passbolt: false,
          espocrm: false,
          google_workspace: false,
          penpot: false,
          nextcloud: false,
          gitea: false,
          kimai: false,
          calcom: false,
          ssh: false,
          azure: false,
          ovh: false,
          openai: false,
          reseaux_sociaux: false,
          ausha: false,
          brevo: false,
        },
        materiel: {
          pc_mac: { assigne: false, numero_serie: null, modele: null },
          laptop: { assigne: false, numero_serie: null, modele: null },
          smartphone: { assigne: false, numero_serie: null, modele: null, numero: null },
          licences: [],
        },
      });
    }
  }, [onboardingData, selectedProfileId]);

  const profileName = selectedProfile ? `${selectedProfile.prenom} ${selectedProfile.nom}` : '';

  // Calculer le taux de complétion onboarding
  const completionRate = useMemo(() => {
    if (!selectedProfileId) return 0;
    
    let completed = 0;
    let total = 0;

    total += 2;
    if (onboardingFormData.date_entree) completed += 1;
    if (onboardingFormData.statut === 'actif') completed += 1;

    total += 5;
    Object.values(onboardingFormData.dossier_rh || {}).forEach((item: any) => {
      if (item?.status === true) completed += 1;
    });

    total += 18;
    Object.values(onboardingFormData.comptes_acces || {}).forEach((value) => {
      if (value === true) completed += 1;
    });

    total += 3;
    if (onboardingFormData.materiel?.pc_mac?.assigne) completed += 1;
    if (onboardingFormData.materiel?.laptop?.assigne) completed += 1;
    if (onboardingFormData.materiel?.smartphone?.assigne) completed += 1;

    return Math.round((completed / total) * 100);
  }, [onboardingFormData, selectedProfileId]);

  const handleUpload = async (data: { file: File; type_document: string; titre: string; description?: string; date_document?: string }) => {
    if (!selectedProfileId) {
      throw new Error("Aucun employé sélectionné");
    }
    
    const result = await uploadDocument({
      file: data.file,
      profileId: selectedProfileId,
      typeDocument: data.type_document as any,
      titre: data.titre,
      description: data.description,
      dateDocument: data.date_document,
    });
    
    if (!result) {
      throw new Error("Échec de l'upload");
    }
    
    return {
      id: result.id,
      storage_path: result.storage_path || '',
    };
  };

  const handleDeleteEmployee = async () => {
    if (!selectedProfileId) return;

    try {
      await deleteProfile.mutateAsync(selectedProfileId);
      toast.success("Employé supprimé avec succès");
      setSelectedProfileId("");
      setDeleteDialogOpen(false);
    } catch (error) {
      debug.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression de l'employé");
    }
  };

  const handleOpenDocument = async (doc: any) => {
    try {
      if (!doc.storage_path) {
        toast.error("Chemin de stockage manquant");
        return;
      }
      
      const signedUrl = await getDocumentUrl(doc.storage_path);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        toast.error("Impossible de générer l'URL du document");
      }
    } catch (error) {
      debug.error("Erreur d'accès au document:", error);
      toast.error("Erreur lors de l'ouverture du document");
    }
  };

  const handleSaveOnboarding = async () => {
    if (!selectedProfileId) {
      toast.error('Veuillez sélectionner un collaborateur');
      return;
    }

    try {
      const cleanedData = {
        profile_id: selectedProfileId,
        date_entree: onboardingFormData.date_entree || null,
        date_sortie: onboardingFormData.date_sortie || null,
        statut: onboardingFormData.statut,
        motif_sortie: onboardingFormData.motif_sortie || null,
        dossier_rh: onboardingFormData.dossier_rh,
        comptes_acces: onboardingFormData.comptes_acces,
        materiel: onboardingFormData.materiel,
      };
      
      await upsertOnboarding.mutateAsync(cleanedData);
    } catch (error) {
      debug.error('Error saving onboarding:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!profiles || profiles.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Aucun employé trouvé
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sélection de l'employé */}
      <Card>
        <CardHeader>
          <CardTitle>Dossier RH Complet</CardTitle>
          <CardDescription>Toutes les informations d'un collaborateur en un seul endroit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {selectedProfile ? (
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {selectedProfile.prenom[0]}{selectedProfile.nom[0]}
                </AvatarFallback>
              ) : (
                <AvatarFallback>
                  <UserCircle className="h-8 w-8" />
                </AvatarFallback>
              )}
            </Avatar>
            
            <div className="flex-1">
              <Label htmlFor="employee-select">Employé</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger id="employee-select" className="w-full">
                  <SelectValue placeholder="Sélectionner un employé..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.prenom} {profile.nom} {profile.fonction ? `- ${profile.fonction}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProfile && (
              <Badge variant={selectedProfile.actif ? "default" : "secondary"}>
                {selectedProfile.actif ? "Actif" : "Inactif"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Onglets du dossier employé */}
      {selectedProfile && (
        <Tabs defaultValue="infos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="infos" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Informations
            </TabsTrigger>
            <TabsTrigger value="salaires" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Salaires
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="absences" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Absences
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Onboarding
            </TabsTrigger>
          </TabsList>

          {/* ONGLET 1: INFORMATIONS */}
          <TabsContent value="infos" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informations Personnelles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nom complet</span>
                    <p className="font-medium">{selectedProfile.prenom} {selectedProfile.nom}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedProfile.email}</span>
                  </div>
                  {selectedProfile.fonction && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedProfile.fonction}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Informations Professionnelles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Rôle</span>
                    <p className="font-medium">
                      <Badge variant="outline">{selectedProfile.role}</Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Statut</span>
                    <p className="font-medium">
                      <Badge variant={selectedProfile.actif ? "default" : "secondary"}>
                        {selectedProfile.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </p>
                  </div>
                  {profileSalaires.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Salaire brut actuel</span>
                      <p className="font-medium">{profileSalaires[0].salaire_brut.toFixed(2)} €</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ONGLET 2: SALAIRES */}
          <TabsContent value="salaires" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setUploadDialogOpen(true)} variant="default">
                <Upload className="mr-2 h-4 w-4" />
                Uploader un bulletin
              </Button>
            </div>
            
            {profileSalaires.length > 0 && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Salaire Actuel</CardTitle>
                    <CardDescription>
                      Dernier salaire enregistré - {new Date(profileSalaires[0].mois).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Salaire Brut</p>
                        <p className="text-2xl font-bold">{profileSalaires[0].salaire_brut.toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Salaire Net</p>
                        <p className="text-2xl font-bold text-primary">{profileSalaires[0].salaire_net.toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Primes</p>
                        <p className="text-2xl font-bold text-green-600">{(profileSalaires[0].primes || 0).toFixed(2)} €</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Heures Supp.</p>
                        <p className="text-2xl font-bold">{(profileSalaires[0].heures_supplementaires || 0).toFixed(2)} €</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <SalairesHistoryChart salaires={profileSalaires} />

                <Card>
                  <CardHeader>
                    <CardTitle>Historique des Salaires</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mois</TableHead>
                            <TableHead className="text-right">Brut</TableHead>
                            <TableHead className="text-right">Net</TableHead>
                            <TableHead className="text-right">Primes</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profileSalaires.slice(0, 12).map((salaire) => (
                            <TableRow key={salaire.id}>
                              <TableCell>
                                {new Date(salaire.mois).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                              </TableCell>
                              <TableCell className="text-right font-medium">{salaire.salaire_brut.toFixed(2)} €</TableCell>
                              <TableCell className="text-right font-medium text-primary">{salaire.salaire_net.toFixed(2)} €</TableCell>
                              <TableCell className="text-right">{(salaire.primes || 0).toFixed(2)} €</TableCell>
                              <TableCell>
                                {salaire.source_type === 'auto_bulletin' ? (
                                  <Badge variant="default">🤖 Auto</Badge>
                                ) : salaire.source_type === 'corrected' ? (
                                  <Badge variant="secondary">⚠️ Corrigé</Badge>
                                ) : (
                                  <Badge variant="outline">✏️ Manuel</Badge>
                                )
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ONGLET 3: DOCUMENTS */}
          <TabsContent value="documents" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setUploadDialogOpen(true)} variant="default">
                <Upload className="mr-2 h-4 w-4" />
                Ajouter un document
              </Button>
            </div>

            <RHDocumentsAccordion
              documents={documents}
              documentsLoading={documentsLoading}
              handleOpenDocument={handleOpenDocument}
              deleteDocument={deleteDocument}
            />
          </TabsContent>

          {/* ONGLET 4: ABSENCES */}
          <TabsContent value="absences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historique des absences</CardTitle>
              </CardHeader>
              <CardContent>
                {absencesLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : absences && absences.length > 0 ? (
                  <div className="space-y-3">
                    {absences.map((absence) => (
                      <div key={absence.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{absence.type_absence}</p>
                          <p className="text-sm text-muted-foreground">
                            Du {format(new Date(absence.date_debut), 'dd MMM', { locale: fr })} 
                            {' '}au {format(new Date(absence.date_fin), 'dd MMM yyyy', { locale: fr })}
                          </p>
                        </div>
                        <Badge variant={absence.statut === 'Validé' ? 'default' : 'secondary'}>
                          {absence.statut}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">Aucune absence enregistrée</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ONGLET 5: ONBOARDING/OFFBOARDING */}
          <TabsContent value="onboarding" className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2">
              <OffboardingActionDialog
                profileId={selectedProfile.id}
                profileName={`${selectedProfile.prenom ?? ''} ${selectedProfile.nom ?? ''}`.trim() || (selectedProfile.email ?? 'collaborateur')}
              />
              <Button onClick={handleSaveOnboarding} disabled={upsertOnboarding.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
            </div>

            {/* Dates et statut */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_entree">Date d'entrée</Label>
                    <Input
                      id="date_entree"
                      type="date"
                      value={onboardingFormData.date_entree ?? ''}
                      onChange={(e) => setOnboardingFormData({ ...onboardingFormData, date_entree: e.target.value || null })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select
                      value={onboardingFormData.statut}
                      onValueChange={(value) => setOnboardingFormData({ ...onboardingFormData, statut: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en_cours">En cours</SelectItem>
                        <SelectItem value="actif">Actif</SelectItem>
                        <SelectItem value="sortie_prevue">Sortie prévue</SelectItem>
                        <SelectItem value="sorti">Sorti</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(onboardingFormData.statut === 'sortie_prevue' || onboardingFormData.statut === 'sorti') && (
                    <div className="space-y-2">
                      <Label htmlFor="date_sortie">Date de sortie</Label>
                      <Input
                        id="date_sortie"
                        type="date"
                        value={onboardingFormData.date_sortie ?? ''}
                        onChange={(e) => setOnboardingFormData({ ...onboardingFormData, date_sortie: e.target.value || null })}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {onboardingData && (
              <>
                <OnboardingStatusCard
                  data={{ ...onboardingData, ...onboardingFormData }}
                  profileName={profileName}
                  completionRate={completionRate}
                />

                <Accordion type="multiple" defaultValue={['dossier', 'comptes', 'materiel']} className="space-y-4">
                  <AccordionItem value="dossier" className="border rounded-lg px-4">
                    <AccordionTrigger>Dossier RH</AccordionTrigger>
                    <AccordionContent>
                      <DossierRHChecklist 
                        dossier={onboardingFormData.dossier_rh}
                        onUpdate={(dossier) => setOnboardingFormData({ ...onboardingFormData, dossier_rh: dossier })}
                        profileId={selectedProfileId}
                        onboardingId={onboardingData?.id || null}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="comptes" className="border rounded-lg px-4">
                    <AccordionTrigger>Comptes et accès</AccordionTrigger>
                    <AccordionContent>
                      <ComptesAccesChecklist
                        comptes={onboardingFormData.comptes_acces}
                        onUpdate={(comptes) => setOnboardingFormData({ ...onboardingFormData, comptes_acces: comptes })}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="materiel" className="border rounded-lg px-4">
                    <AccordionTrigger>Matériel</AccordionTrigger>
                    <AccordionContent>
                      <MaterielList
                        materiel={onboardingFormData.materiel}
                        onUpdate={(materiel) => setOnboardingFormData({ ...onboardingFormData, materiel })}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}

            {!onboardingData && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    Aucune fiche d'entrée/sortie pour ce collaborateur.
                  </p>
                  <Button onClick={handleSaveOnboarding} className="mt-4">
                    Créer une fiche
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs */}
      {selectedProfile && (
        <>
          <UploadDocumentDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            onUpload={handleUpload}
            profileId={selectedProfileId}
          />

          <EditEmployeeDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            profile={selectedProfile}
          />

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer {selectedProfile.prenom} {selectedProfile.nom} ?
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteEmployee}>
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
