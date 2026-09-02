import { useState } from "react";
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
  Download,
  Upload,
  Trash2,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { useRHSalaires } from "@/hooks/hr/useRHSalaires";
import { useRHAbsences } from "@/hooks/hr/useRHAbsences";
import { useRHDocuments } from "@/hooks/hr/useRHDocuments";
import { SalairesHistoryChart } from "./SalairesHistoryChart";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { EditEmployeeDialog } from "./EditEmployeeDialog";
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

export function RHFicheEmploye() {
  const { data: profiles, isLoading } = useProfilesWithRoles();
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteProfile = useDeleteProfile();

  const selectedProfile = profiles?.find(p => p.id === selectedProfileId);
  
  const { salaires, isLoading: salairesLoading } = useRHSalaires();
  const { absences, isLoading: absencesLoading } = useRHAbsences(selectedProfileId);
  const { documents, isLoading: documentsLoading, uploadDocument, deleteDocument } = useRHDocuments(selectedProfileId);

  // Filtrer les salaires du profil sélectionné
  const profileSalaires = salaires?.filter(s => s.profile_id === selectedProfileId) || [];
  
  // Calculer les statistiques des salaires
  const salaireBrutMoyen = profileSalaires.length > 0
    ? profileSalaires.reduce((sum, s) => sum + s.salaire_brut, 0) / profileSalaires.length
    : 0;
  const totalPrimes = profileSalaires.reduce((sum, s) => sum + (s.primes || 0), 0);
  const totalHeuresSupp = profileSalaires.reduce((sum, s) => sum + (s.heures_supplementaires || 0), 0);

  // Masquer partiellement les données sensibles
  const maskIBAN = (iban?: string | null) => {
    if (!iban) return "Non renseigné";
    return iban.substring(0, 4) + " **** **** **** " + iban.substring(iban.length - 4);
  };

  const maskSecu = (secu?: string | null) => {
    if (!secu) return "Non renseigné";
    return secu.substring(0, 1) + " ** ** ** ** *** " + secu.substring(secu.length - 3);
  };

  const handleUpload = async (data: { file: File; type_document: string; titre: string; description?: string; date_document?: string }) => {
    if (!selectedProfileId) {
      throw new Error("Aucun employé sélectionné");
    }
    
    const result = await uploadDocument({
      file: data.file,
      profileId: selectedProfileId,
      typeDocument: data.type_document as 'contrat' | 'bulletin_salaire' | 'attestation' | 'autre',
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

  const handleSalaireCreated = () => {
    // Notification avec lien vers l'onglet Salaires
    toast.success(
      `✅ Salaire créé pour ${selectedProfile?.prenom} ${selectedProfile?.nom}`,
      {
        description: "Le salaire a été enregistré automatiquement",
        action: {
          label: "Voir dans Salaires",
          onClick: () => window.location.hash = 'salaires'
        }
      }
    );
    // Pas besoin de recharger toute la page, React Query va invalider le cache
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
          <CardTitle>Sélectionner un employé</CardTitle>
          <CardDescription>Choisir un employé pour consulter sa fiche complète</CardDescription>
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

      {/* Onglets de la fiche employé */}
      {selectedProfile && (
        <Tabs defaultValue="infos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
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
          </TabsList>

          {/* ONGLET 1: INFORMATIONS */}
          <TabsContent value="infos" className="space-y-4">
            {/* Boutons d'action */}
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
              {/* Informations personnelles */}
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

              {/* Informations professionnelles */}
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
            {/* Bouton d'upload en haut */}
            <div className="flex justify-end">
              <Button onClick={() => setUploadDialogOpen(true)} variant="default">
                <Upload className="mr-2 h-4 w-4" />
                Uploader un bulletin
              </Button>
            </div>
            
            {/* Salaire actuel */}
            {profileSalaires.length > 0 && (
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
            )}

            {/* Graphiques */}
            {profileSalaires.length > 0 && (
              <SalairesHistoryChart salaires={profileSalaires} />
            )}

            {/* Statistiques */}
            {profileSalaires.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Statistiques (12 derniers mois)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Salaire brut moyen</p>
                      <p className="text-2xl font-bold">{salaireBrutMoyen.toFixed(2)} €</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total des primes</p>
                      <p className="text-2xl font-bold text-green-600">{totalPrimes.toFixed(2)} €</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total heures supp.</p>
                      <p className="text-2xl font-bold">{totalHeuresSupp.toFixed(2)} €</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Historique des salaires */}
            <Card>
              <CardHeader>
                <CardTitle>Historique des Salaires</CardTitle>
              </CardHeader>
              <CardContent>
                {salairesLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : profileSalaires.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mois</TableHead>
                          <TableHead className="text-right">Brut</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead className="text-right">Primes</TableHead>
                          <TableHead className="text-right">H. Supp.</TableHead>
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
                            <TableCell className="text-right">{(salaire.heures_supplementaires || 0).toFixed(2)} €</TableCell>
                            <TableCell>
                              {salaire.source_type === 'auto_bulletin' ? (
                                <Badge variant="default" className="gap-1">
                                  🤖 Auto
                                </Badge>
                              ) : salaire.source_type === 'corrected' ? (
                                <Badge variant="secondary" className="gap-1">
                                  ⚠️ Corrigé
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1">
                                  ✏️ Manuel
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun historique de salaire disponible
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ONGLET 3: DOCUMENTS */}
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Documents RH</CardTitle>
                    <CardDescription>
                      Contrats, bulletins de salaire, attestations, etc.
                    </CardDescription>
                  </div>
                  <Button onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Uploader
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {documentsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : documents && documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{doc.titre}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <Badge variant="outline" className="text-xs">
                                {doc.type_document.replace('_', ' ')}
                              </Badge>
                              {doc.date_document && (
                                <span>{new Date(doc.date_document).toLocaleDateString('fr-FR')}</span>
                              )}
                              {doc.taille_octets && (
                                <span>{(doc.taille_octets / 1024).toFixed(2)} KB</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {doc.fichier_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(doc.fichier_url, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm('Supprimer ce document ?')) {
                                deleteDocument(doc.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Aucun document disponible</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setUploadDialogOpen(true)}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Uploader le premier document
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ONGLET 4: ABSENCES */}
          <TabsContent value="absences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historique des Absences</CardTitle>
              </CardHeader>
              <CardContent>
                {absencesLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : absences && absences.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Début</TableHead>
                          <TableHead>Fin</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Motif</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {absences.map((absence) => (
                          <TableRow key={absence.id}>
                            <TableCell>
                              <Badge variant="outline">{absence.type_absence}</Badge>
                            </TableCell>
                            <TableCell>{new Date(absence.date_debut).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>{new Date(absence.date_fin).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  absence.statut === 'approuve' ? 'default' :
                                  absence.statut === 'refuse' ? 'destructive' :
                                  'secondary'
                                }
                              >
                                {absence.statut}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {absence.motif || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune absence enregistrée
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs */}
      {selectedProfileId && selectedProfile && (
        <>
          <UploadDocumentDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            profileId={selectedProfileId}
            onUpload={handleUpload}
            onSalaireCreated={handleSalaireCreated}
          />

          <EditEmployeeDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            profile={selectedProfile}
          />

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Confirmer la suppression
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer <strong>{selectedProfile.prenom} {selectedProfile.nom}</strong> ?
                  Cette action est irréversible et supprimera toutes les données associées (salaires, documents, absences).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteEmployee}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer définitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
