import { Link } from "react-router-dom";
import { Users, Sparkles, MapPin, Mail, Phone } from "lucide-react";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { PartenaireBadge } from "@/components/ui/partenaire-badge";
import { QuickActionsBar } from "@/components/etablissement/QuickActionsBar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";

interface PartenaireHeaderProps {
  partenaire: {
    id: string;
    nom: string;
    type_partenaire: string;
    ville?: string | null;
    statut_relation?: string | null;
    logo_url?: string | null;
    email?: string | null;
    telephone?: string | null;
    email_domains?: string[] | null;
  };
  contactsCount?: number;
  suggestionsCount?: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function PartenaireHeader({
  partenaire,
  contactsCount = 0,
  suggestionsCount = 0,
  onEdit,
  onDelete,
}: PartenaireHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Breadcrumb */}
      <div className="bg-gradient-to-r from-primary/5 to-transparent rounded-xl p-2 backdrop-blur-sm">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Accueil</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/partenaires">Partenaires</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{partenaire.nom}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header principal */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <EntityAvatar
            name={partenaire.nom}
            logoUrl={partenaire.logo_url}
            size="xl"
            className="flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">
                {partenaire.nom}
              </h1>
              <PartenaireBadge
                type={partenaire.type_partenaire as any}
                nom=""
                partenaireId={partenaire.id}
                showLink={false}
              />
            </div>

            {/* Sous-ligne infos */}
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
              {partenaire.ville && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {partenaire.ville}
                </span>
              )}
              {partenaire.statut_relation && (
                <span className="hidden sm:inline">•</span>
              )}
              {partenaire.statut_relation && (
                <span>{partenaire.statut_relation}</span>
              )}
              {partenaire.email && (
                <span className="hidden md:flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {partenaire.email}
                </span>
              )}
              {partenaire.telephone && (
                <span className="hidden md:flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {partenaire.telephone}
                </span>
              )}
            </div>

            {/* Indicateurs desktop */}
            <div className="hidden sm:flex items-center gap-2 mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 hover:bg-primary/10 text-xs font-medium text-muted-foreground transition-colors">
                    <Users className="h-3.5 w-3.5" />
                    {contactsCount} contact{contactsCount !== 1 ? "s" : ""}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3" side="bottom" align="start">
                  <p className="text-sm font-medium">Contacts</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {contactsCount} contact{contactsCount !== 1 ? "s" : ""} associé{contactsCount !== 1 ? "s" : ""}
                  </p>
                </PopoverContent>
              </Popover>

              {suggestionsCount > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 text-xs font-medium text-amber-700 transition-colors">
                      <Sparkles className="h-3.5 w-3.5" />
                      {suggestionsCount} suggestion{suggestionsCount !== 1 ? "s" : ""} IA
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" side="bottom" align="start">
                    <p className="text-sm font-medium">Suggestions IA</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestionsCount} suggestion{suggestionsCount !== 1 ? "s" : ""} en attente de validation
                    </p>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Indicateurs mobile */}
            <div className="flex sm:hidden items-center gap-1.5 mt-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {contactsCount}
              </Badge>
              {suggestionsCount > 0 && (
                <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {suggestionsCount}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <QuickActionsBar onEdit={onEdit} etablissementNom={partenaire.nom} />
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteDialog(true)}
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce partenaire ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
