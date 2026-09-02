import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Edit, Mail, Building2, Users, AlertCircle } from "lucide-react";
import { usePendingContacts, useApprovePendingContact, useRejectPendingContact, PendingContact } from "@/hooks/crm/usePendingContacts";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeEmailSubject } from "@/lib/emailUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEtablissements } from "@/hooks/crm/useEtablissements";
import { usePartenaires } from "@/hooks/crm/usePartenaires";
import { useGroupes } from "@/hooks/crm/useGroupes";

const contactSchema = z.object({
  nom: z.string()
    .trim()
    .min(1, "Le nom est requis")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  prenom: z.string()
    .trim()
    .max(100, "Le prénom ne peut pas dépasser 100 caractères")
    .optional(),
  fonction: z.string()
    .trim()
    .max(100, "La fonction ne peut pas dépasser 100 caractères")
    .optional(),
  email: z.string()
    .trim()
    .email("Email invalide")
    .max(255, "L'email ne peut pas dépasser 255 caractères")
    .optional()
    .or(z.literal("")),
  telephone: z.string()
    .trim()
    .max(20, "Le téléphone ne peut pas dépasser 20 caractères")
    .optional(),
  entityType: z.enum(['etablissement', 'partenaire', 'groupe']).optional(),
  etablissementId: z.string().optional(),
  partenaireId: z.string().optional(),
  groupeId: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

export function PendingContactsValidation() {
  const { data: pendingContacts, isLoading } = usePendingContacts();
  const approveMutation = useApprovePendingContact();
  const rejectMutation = useRejectPendingContact();
  const { data: etablissements } = useEtablissements();
  const { data: partenaires } = usePartenaires();
  const { data: groupes } = useGroupes();

  const [selectedContact, setSelectedContact] = useState<PendingContact | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState<'etablissement' | 'partenaire' | 'groupe'>('etablissement');

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nom: "",
      prenom: "",
      fonction: "",
      email: "",
      telephone: "",
      entityType: 'etablissement',
      etablissementId: "",
      partenaireId: "",
      groupeId: "",
    },
  });

  const handleEdit = (contact: PendingContact) => {
    setSelectedContact(contact);
    
    // Déterminer le type d'entité actuel
    let entityType: 'etablissement' | 'partenaire' | 'groupe' = 'etablissement';
    if (contact.partenaire_id) entityType = 'partenaire';
    else if (contact.groupe_id) entityType = 'groupe';
    
    setSelectedEntityType(entityType);
    
    form.reset({
      nom: contact.extracted_data.nom || "",
      prenom: contact.extracted_data.prenom || "",
      fonction: contact.extracted_data.fonction || "",
      email: contact.extracted_data.email || "",
      telephone: contact.extracted_data.telephone || "",
      entityType,
      etablissementId: contact.etablissement_id || "",
      partenaireId: contact.partenaire_id || "",
      groupeId: contact.groupe_id || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleApprove = (contact: PendingContact) => {
    approveMutation.mutate({
      id: contact.id,
      contactData: contact.extracted_data,
    });
  };

  const handleApproveEdited = (data: ContactFormData) => {
    if (!selectedContact) return;

    approveMutation.mutate(
      {
        id: selectedContact.id,
        contactData: {
          nom: data.nom,
          prenom: data.prenom,
          fonction: data.fonction,
          email: data.email,
          telephone: data.telephone,
        },
        ...(data.entityType === 'etablissement' && data.etablissementId ? { etablissementId: data.etablissementId } : {}),
        ...(data.entityType === 'partenaire' && data.partenaireId ? { partenaireId: data.partenaireId } : {}),
        ...(data.entityType === 'groupe' && data.groupeId ? { groupeId: data.groupeId } : {}),
      },
      {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setSelectedContact(null);
          form.reset();
        },
      }
    );
  };

  const handleReject = (contact: PendingContact) => {
    setSelectedContact(contact);
    setRejectionReason("");
    setIsRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (!selectedContact) return;

    rejectMutation.mutate(
      {
        id: selectedContact.id,
        reason: rejectionReason || "Non spécifié",
      },
      {
        onSuccess: () => {
          setIsRejectDialogOpen(false);
          setSelectedContact(null);
          setRejectionReason("");
        },
      }
    );
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return <Badge variant="default" className="bg-green-500">Élevée ({Math.round(confidence * 100)}%)</Badge>;
    } else if (confidence >= 0.7) {
      return <Badge variant="secondary" className="bg-yellow-500">Moyenne ({Math.round(confidence * 100)}%)</Badge>;
    } else {
      return <Badge variant="destructive">Faible ({Math.round(confidence * 100)}%)</Badge>;
    }
  };

  const getEntityIcon = (contact: PendingContact) => {
    if (contact.etablissement_id) return <Building2 className="h-4 w-4" />;
    if (contact.partenaire_id) return <Users className="h-4 w-4" />;
    if (contact.groupe_id) return <Building2 className="h-4 w-4 text-primary" />;
    return null;
  };

  const getEntityName = (contact: PendingContact) => {
    if (contact.etablissements) return contact.etablissements.nom;
    if (contact.partenaires) return contact.partenaires.nom;
    if (contact.groupes_etablissements) return contact.groupes_etablissements.nom;
    return "Inconnu";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={`pending-contacts-skeleton-${i}`} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pendingContacts || pendingContacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Contacts en attente de validation
          </CardTitle>
          <CardDescription>Validez les contacts extraits automatiquement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>Aucun contact en attente de validation</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Contacts en attente de validation
            <Badge variant="secondary">{pendingContacts.length}</Badge>
          </CardTitle>
          <CardDescription>
            Ces contacts ont été extraits automatiquement avec un niveau de confiance nécessitant validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingContacts.map((contact) => (
              <Card key={contact.id} className="border-l-4 border-l-yellow-500">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">
                            {contact.extracted_data.prenom} {contact.extracted_data.nom}
                          </h4>
                          {getConfidenceBadge(contact.confidence)}
                        </div>
                        
                        {contact.extracted_data.fonction && (
                          <p className="text-sm text-muted-foreground">
                            {contact.extracted_data.fonction}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          {getEntityIcon(contact)}
                          <span className="font-medium">{getEntityName(contact)}</span>
                        </div>

                        {contact.email_threads && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{sanitizeEmailSubject(contact.email_threads.subject)}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {contact.extracted_data.email && (
                            <div>
                              <span className="text-muted-foreground">Email: </span>
                              <span>{contact.extracted_data.email}</span>
                            </div>
                          )}
                          {contact.extracted_data.telephone && (
                            <div>
                              <span className="text-muted-foreground">Tél: </span>
                              <span>{contact.extracted_data.telephone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(contact)}
                        disabled={approveMutation.isPending}
                        className="flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(contact)}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(contact)}
                        disabled={rejectMutation.isPending}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeter
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le contact</DialogTitle>
            <DialogDescription>
              Corrigez les informations avant de créer le contact
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleApproveEdited)} className="space-y-4">
              {/* Sélection du type d'entité */}
              <FormField
                control={form.control}
                name="entityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classer dans *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedEntityType(value as 'etablissement' | 'partenaire' | 'groupe');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="etablissement">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span>Établissement</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="partenaire">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>Partenaire</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="groupe">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span>Groupe</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sélection de l'entité spécifique */}
              {selectedEntityType === 'etablissement' && (
                <FormField
                  control={form.control}
                  name="etablissementId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Établissement *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un établissement" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {etablissements?.map((etab) => (
                            <SelectItem key={etab.id} value={etab.id}>
                              {etab.nom} - {etab.ville}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedEntityType === 'partenaire' && (
                <FormField
                  control={form.control}
                  name="partenaireId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Partenaire *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un partenaire" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {partenaires?.map((part) => (
                            <SelectItem key={part.id} value={part.id}>
                              {part.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedEntityType === 'groupe' && (
                <FormField
                  control={form.control}
                  name="groupeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Groupe *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un groupe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groupes?.map((grp) => (
                            <SelectItem key={grp.id} value={grp.id}>
                              {grp.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="prenom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom *</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="fonction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fonction</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={100} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" maxLength={255} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={20} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? "Création..." : "Approuver et créer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le contact</DialogTitle>
            <DialogDescription>
              Indiquez pourquoi vous rejetez ce contact (optionnel)
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Raison du rejet..."
            maxLength={500}
            rows={4}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejet..." : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
