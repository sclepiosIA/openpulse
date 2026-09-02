import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Mail, Phone, User, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { useContactsGroupe, useCreateContactGroupe, useUpdateContactGroupe, useDeleteContactGroupe, type ContactGroupe } from "@/hooks/crm/useContactsGroupe"
import { ContactForm } from "@/components/forms/ContactForm"
import { AdminActionButton } from "@/components/security/AdminActionButton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface GroupeContactsProps {
  groupeId: string
}

export function GroupeContacts({ groupeId }: GroupeContactsProps) {
  const navigate = useNavigate()
  const { data: contacts, isLoading, error } = useContactsGroupe(groupeId)
  const createContact = useCreateContactGroupe()
  const updateContact = useUpdateContactGroupe()
  const deleteContact = useDeleteContactGroupe()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactGroupe | null>(null)
  const [deletingContact, setDeletingContact] = useState<ContactGroupe | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getTypeContactBadge = (type: string | null | undefined) => {
    switch (type?.toLowerCase()) {
      case "cliniciens":
        return <Badge className="bg-blue-500 text-white">Cliniciens</Badge>
      case "administration":
        return <Badge className="bg-purple-500 text-white">Administration</Badge>
      case "informatique":
        return <Badge className="bg-green-500 text-white">Informatique</Badge>
      case "dim":
        return <Badge className="bg-orange-500 text-white">DIM</Badge>
      case "secretariat":
        return <Badge className="bg-pink-500 text-white">Secrétariat</Badge>
      default:
        return <Badge variant="outline">Autre</Badge>
    }
  }

  const handleAddContact = async (data: any) => {
    setIsSubmitting(true)
    try {
      await createContact.mutateAsync({
        groupe_id: groupeId,
        nom: data.nom,
        prenom: data.prenom || undefined,
        fonction: data.fonction,
        email: data.email || undefined,
        telephone: data.telephone || undefined,
        type_contact: data.type_contact || undefined,
        est_contact_principal: data.est_contact_principal || false,
      })
      setIsFormOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateContact = async (data: any) => {
    if (!editingContact) return
    setIsSubmitting(true)
    try {
      await updateContact.mutateAsync({
        id: editingContact.id,
        data: {
          nom: data.nom,
          prenom: data.prenom || undefined,
          fonction: data.fonction,
          email: data.email || undefined,
          telephone: data.telephone || undefined,
          type_contact: data.type_contact || undefined,
          est_contact_principal: data.est_contact_principal || false,
        }
      })
      setEditingContact(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteContact = async () => {
    if (!deletingContact) return
    setIsSubmitting(true)
    try {
      await deleteContact.mutateAsync({ 
        id: deletingContact.id,
        groupeId 
      })
      setDeletingContact(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Impossible de charger les contacts du groupe. Vérifiez vos permissions ou contactez un administrateur.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contacts du groupe</h3>
          <p className="text-sm text-muted-foreground">
            {contacts?.length || 0} contact{(contacts?.length || 0) > 1 ? 's' : ''}
          </p>
        </div>
        <AdminActionButton
          operationName="Ajouter un contact"
          description="Ajouter un nouveau contact au groupe"
          onConfirm={() => setIsFormOpen(true)}
          variant="default"
          size="sm"
          requireConfirmation={false}
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un contact
        </AdminActionButton>
      </div>

      {contacts && contacts.length > 0 ? (
        <>
          {/* Vue Desktop */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Fonction</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {contact.prenom} {contact.nom}
                              {contact.est_contact_principal && (
                                <Badge variant="secondary" className="ml-2">Principal</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{contact.fonction}</TableCell>
                      <TableCell>{getTypeContactBadge(contact.type_contact)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.telephone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span>{contact.telephone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Plus d'options">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {contact.email && (
                              <DropdownMenuItem onClick={() => {
                                const params = new URLSearchParams({ compose: 'true', to: contact.email! });
                                const name = `${contact.prenom || ''} ${contact.nom}`.trim();
                                if (name) params.set('toName', name);
                                navigate(`/emails?${params.toString()}`);
                              }}>
                                <Mail className="w-4 h-4 mr-2" />
                                Envoyer un email
                              </DropdownMenuItem>
                            )}
                            {contact.telephone && (
                              <DropdownMenuItem asChild>
                                <a href={`tel:${contact.telephone}`}>
                                  <Phone className="w-4 h-4 mr-2" />
                                  Appeler
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeletingContact(contact)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Vue Mobile */}
          <div className="md:hidden space-y-4">
            {contacts.map((contact) => (
              <Card key={contact.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {contact.prenom} {contact.nom}
                      </CardTitle>
                      {contact.est_contact_principal && (
                        <Badge variant="secondary" className="mt-1">Principal</Badge>
                      )}
                      <CardDescription className="mt-1">{contact.fonction}</CardDescription>
                      <div className="mt-2">
                        {getTypeContactBadge(contact.type_contact)}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Plus d'options">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {contact.email && (
                          <DropdownMenuItem onClick={() => {
                            const params = new URLSearchParams({ compose: 'true', to: contact.email! });
                            const name = `${contact.prenom || ''} ${contact.nom}`.trim();
                            if (name) params.set('toName', name);
                            navigate(`/emails?${params.toString()}`);
                          }}>
                            <Mail className="w-4 h-4 mr-2" />
                            Envoyer un email
                          </DropdownMenuItem>
                        )}
                        {contact.telephone && (
                          <DropdownMenuItem asChild>
                            <a href={`tel:${contact.telephone}`}>
                              <Phone className="w-4 h-4 mr-2" />
                              Appeler
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeletingContact(contact)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                {(contact.email || contact.telephone) && (
                  <CardContent>
                    <div className="space-y-2">
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span>{contact.email}</span>
                        </div>
                      )}
                      {contact.telephone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{contact.telephone}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">Aucun contact</p>
            <p className="text-sm text-muted-foreground mb-4">
              Commencez par ajouter un contact pour ce groupe
            </p>
            <AdminActionButton
              operationName="Ajouter un contact"
              description="Ajouter le premier contact au groupe"
              onConfirm={() => setIsFormOpen(true)}
              size="sm"
              requireConfirmation={false}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter le premier contact
            </AdminActionButton>
          </CardContent>
        </Card>
      )}

      <ContactForm
        isOpen={isFormOpen || !!editingContact}
        onClose={() => {
          setIsFormOpen(false)
          setEditingContact(null)
        }}
        onSubmit={editingContact ? handleUpdateContact : handleAddContact}
        contact={editingContact ? {
          ...editingContact,
          etablissement_id: (editingContact as any).etablissement_id || null,
          prenom: editingContact.prenom || null,
          email: editingContact.email || null,
          telephone: editingContact.telephone || null,
          type_contact: editingContact.type_contact || null,
          updated_by: null,
          created_metadata: null as any,
          created_source: 'manual',
          engagement: (editingContact as any).engagement || null,
          influence: (editingContact as any).influence || null,
          interlocuteur_csm: (editingContact as any).interlocuteur_csm || null,
        } as any : undefined}
        isLoading={isSubmitting}
      />

      <AlertDialog open={!!deletingContact} onOpenChange={(open) => !open && setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le contact "{deletingContact?.prenom} {deletingContact?.nom}" ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteContact}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
