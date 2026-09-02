import { Link } from "react-router-dom";
import { Building2, MapPin, Mail, Phone, Package, Star, Pencil, Trash2, FileDown, Send, MoreVertical } from "lucide-react";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { GroupeBadge } from "@/components/ui/groupe-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GroupeHeaderProps {
  groupe: {
    id: string;
    nom: string;
    type: string;
    description?: string | null;
    ville_siege?: string | null;
    region?: string | null;
    email?: string | null;
    telephone?: string | null;
    logo_url?: string | null;
    nombre_etablissements: number;
    modules_deployes?: string[] | null;
  };
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExportPDF: () => void;
}

export function GroupeHeader({
  groupe,
  isFavorite,
  onToggleFavorite,
  onEdit,
  onDelete,
  onExportPDF,
}: GroupeHeaderProps) {
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
                <Link to="/groupes">Groupes</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{groupe.nom}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header principal */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <EntityAvatar
            name={groupe.nom}
            logoUrl={groupe.logo_url}
            size="xl"
            className="flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">
                {groupe.nom}
              </h1>
              <GroupeBadge type={groupe.type as any} />
            </div>

            {groupe.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{groupe.description}</p>
            )}

            {/* Sous-ligne infos */}
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
              {groupe.ville_siege && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {groupe.ville_siege}{groupe.region ? `, ${groupe.region}` : ''}
                </span>
              )}
              {groupe.email && (
                <span className="hidden md:flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {groupe.email}
                </span>
              )}
              {groupe.telephone && (
                <span className="hidden md:flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {groupe.telephone}
                </span>
              )}
            </div>

            {/* Indicateurs desktop */}
            <div className="hidden sm:flex items-center gap-2 mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 hover:bg-primary/10 text-xs font-medium text-muted-foreground transition-colors">
                    <Building2 className="h-3.5 w-3.5" />
                    {groupe.nombre_etablissements} établissement{groupe.nombre_etablissements !== 1 ? "s" : ""}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-3" side="bottom" align="start">
                  <p className="text-sm font-medium">Établissements</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {groupe.nombre_etablissements} établissement{groupe.nombre_etablissements !== 1 ? "s" : ""} dans ce groupe
                  </p>
                </PopoverContent>
              </Popover>

              {groupe.modules_deployes && groupe.modules_deployes.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 hover:bg-primary/10 text-xs font-medium text-muted-foreground transition-colors">
                      <Package className="h-3.5 w-3.5" />
                      {groupe.modules_deployes.length} module{groupe.modules_deployes.length !== 1 ? "s" : ""}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" side="bottom" align="start">
                    <p className="text-sm font-medium">Modules</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {groupe.modules_deployes.join(", ")}
                    </p>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Indicateurs mobile */}
            <div className="flex sm:hidden items-center gap-1.5 mt-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />
                {groupe.nombre_etablissements}
              </Badge>
              {groupe.modules_deployes && groupe.modules_deployes.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  {groupe.modules_deployes.length}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant={isFavorite ? "default" : "outline"}
            size="sm"
            onClick={onToggleFavorite}
            aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            aria-pressed={isFavorite}
            className="h-9 w-9 rounded-xl"
            title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Plus d'options"
                title="Plus d'options"
                className="h-9 w-9 rounded-xl hover:bg-primary/10 transition-all"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border border-border shadow-lg bg-popover w-48">
              <DropdownMenuItem onClick={onEdit} className="rounded-lg">
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportPDF} className="rounded-lg">
                <FileDown className="h-4 w-4 mr-2" />
                Exporter PDF
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg">
                <Send className="h-4 w-4 mr-2" />
                Envoyer email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive rounded-lg">
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
