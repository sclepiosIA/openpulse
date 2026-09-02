import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Eye, Mail, Trash2, Pencil, Sparkles, Handshake } from "lucide-react";
import { Partenaire, useDeletePartenaire } from "@/hooks/crm/usePartenaires";
import { PartenaireBadge } from "@/components/ui/partenaire-badge";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CRMTableWrapper } from "@/components/layout/CRMTableWrapper";
import { CRMSortableHeader } from "@/components/layout/CRMSortableHeader";
import { CRMEmptyState } from "@/components/layout/CRMEmptyState";

interface PartenairesTableViewProps {
  partenaires: Partenaire[];
  selectedIds: string[];
  onSelectAll: (selected: boolean) => void;
  onSelectOne: (id: string) => void;
  onSort?: (field: string) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onEdit?: (partenaire: Partenaire) => void;
  pendingCounts?: Record<string, number>;
  onCreate?: () => void;
}

export function PartenairesTableView({ 
  partenaires, 
  selectedIds, 
  onSelectAll, 
  onSelectOne,
  onSort,
  sortField,
  sortDirection,
  onEdit,
  pendingCounts = {},
  onCreate
}: PartenairesTableViewProps) {
  const navigate = useNavigate();
  const deletePartenaire = useDeletePartenaire();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partenaireToDelete, setPartenaireToDelete] = useState<Partenaire | null>(null);
  
  const [visibleColumns] = useState({
    nom: true,
    statut: true,
    ville: true,
    responsable: true,
    dernier_contact: true,
    prochaine_action: true,
    valeur: true,
    engagement: true,
  });

  const allSelected = partenaires.length > 0 && selectedIds.length === partenaires.length;

  // Client-side sorting
  const sortedPartenaires = useMemo(() => {
    if (!sortField) return partenaires;
    
    return [...partenaires].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'nom':
          aVal = a.nom?.toLowerCase() || '';
          bVal = b.nom?.toLowerCase() || '';
          break;
        case 'ville':
          aVal = a.ville?.toLowerCase() || '';
          bVal = b.ville?.toLowerCase() || '';
          break;
        case 'dernier_contact':
          aVal = a.dernier_contact ? new Date(a.dernier_contact).getTime() : 0;
          bVal = b.dernier_contact ? new Date(b.dernier_contact).getTime() : 0;
          break;
        case 'prochaine_action':
          aVal = a.prochaine_action ? new Date(a.prochaine_action).getTime() : 0;
          bVal = b.prochaine_action ? new Date(b.prochaine_action).getTime() : 0;
          break;
        case 'valeur_partenariat':
          aVal = a.valeur_partenariat || 0;
          bVal = b.valeur_partenariat || 0;
          break;
        case 'engagement_score':
          aVal = a.engagement_score || 0;
          bVal = b.engagement_score || 0;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [partenaires, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (onSort) {
      onSort(field);
    }
  };

  const handleDelete = async () => {
    if (!partenaireToDelete) return;
    
    try {
      await deletePartenaire.mutateAsync(partenaireToDelete.id);
      toast.success(`${partenaireToDelete.nom} supprimé`);
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteDialogOpen(false);
      setPartenaireToDelete(null);
    }
  };

  if (partenaires.length === 0) {
    return (
      <CRMEmptyState
        icon={Handshake}
        title="Aucun partenaire"
        description="Commencez par ajouter votre premier partenaire pour développer votre réseau."
        onCreate={onCreate}
        createLabel="Nouveau partenaire"
      />
    );
  }

  return (
    <>
      <CRMTableWrapper minWidth="1100px" withCard={false}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                  aria-label="Sélectionner tout"
                />
              </TableHead>
              {visibleColumns.nom && (
                <CRMSortableHeader 
                  field="nom" 
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Nom
                </CRMSortableHeader>
              )}
              {visibleColumns.statut && <TableHead>Statut</TableHead>}
              {visibleColumns.ville && (
                <CRMSortableHeader 
                  field="ville" 
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Localisation
                </CRMSortableHeader>
              )}
              {visibleColumns.responsable && <TableHead>Responsable</TableHead>}
              {visibleColumns.dernier_contact && (
                <CRMSortableHeader 
                  field="dernier_contact" 
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Dernier contact
                </CRMSortableHeader>
              )}
              {visibleColumns.prochaine_action && (
                <CRMSortableHeader 
                  field="prochaine_action" 
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Prochaine action
                </CRMSortableHeader>
              )}
              {visibleColumns.valeur && (
                <CRMSortableHeader 
                  field="valeur_partenariat" 
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Valeur
                </CRMSortableHeader>
              )}
              {visibleColumns.engagement && (
                <CRMSortableHeader 
                  field="engagement_score" 
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                >
                  Engagement
                </CRMSortableHeader>
              )}
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPartenaires.map((partenaire, index) => {
              const isSelected = selectedIds.includes(partenaire.id);
              const isActionPassed = partenaire.prochaine_action && new Date(partenaire.prochaine_action) < new Date();
              const pendingCount = pendingCounts[partenaire.id] || 0;

              return (
                <TableRow
                  key={partenaire.id}
                  className={cn(
                    "cursor-pointer transition-colors group",
                    "hover:bg-muted/50",
                    isSelected && "bg-muted",
                    "animate-in fade-in-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  style={{ animationDelay: `${index * 20}ms` }}
                  onClick={() => navigate(`/partenaires/${partenaire.id}`)}
                  role="link"
                  tabIndex={0}
                  aria-label={`Ouvrir la fiche partenaire ${partenaire.nom}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/partenaires/${partenaire.id}`)
                    }
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onSelectOne(partenaire.id)}
                      aria-label={`Sélectionner ${partenaire.nom}`}
                    />
                  </TableCell>
                  
                  {visibleColumns.nom && (
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <EntityAvatar 
                          name={partenaire.nom} 
                          logoUrl={partenaire.logo_url} 
                          size="sm"
                        />
                        <span className="truncate group-hover:text-primary transition-colors">{partenaire.nom}</span>
                        <PartenaireBadge
                          type={partenaire.type_partenaire}
                          nom=""
                          partenaireId={partenaire.id}
                          size="sm"
                          showLink={false}
                        />
                        {pendingCount > 0 && (
                          <Badge className="bg-primary/10 text-primary flex items-center gap-1" variant="secondary">
                            <Sparkles className="h-3 w-3" />
                            {pendingCount}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns.statut && (
                    <TableCell>
                      <Badge variant={
                        partenaire.statut_relation === 'actif' ? 'default' :
                        partenaire.statut_relation === 'prospect' ? 'secondary' :
                        partenaire.statut_relation === 'termine' ? 'destructive' : 'outline'
                      }>
                        {partenaire.statut_relation}
                      </Badge>
                    </TableCell>
                  )}

                  {visibleColumns.ville && (
                    <TableCell className="text-muted-foreground">
                      {partenaire.ville && `${partenaire.ville}${partenaire.region ? ` • ${partenaire.region}` : ''}`}
                    </TableCell>
                  )}

                  {visibleColumns.responsable && (
                    <TableCell>
                      {partenaire.responsable && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {partenaire.responsable.prenom[0]}{partenaire.responsable.nom[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">
                            {partenaire.responsable.prenom} {partenaire.responsable.nom}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  )}

                  {visibleColumns.dernier_contact && (
                    <TableCell className="text-sm text-muted-foreground">
                      {partenaire.dernier_contact ? (
                        formatDistanceToNow(new Date(partenaire.dernier_contact), { addSuffix: true, locale: fr })
                      ) : '-'}
                    </TableCell>
                  )}

                  {visibleColumns.prochaine_action && (
                    <TableCell className={cn(
                      "text-sm",
                      isActionPassed ? "text-destructive font-medium" : "text-muted-foreground"
                    )}>
                      {partenaire.prochaine_action ? (
                        new Date(partenaire.prochaine_action).toLocaleDateString('fr-FR')
                      ) : '-'}
                    </TableCell>
                  )}

                  {visibleColumns.valeur && (
                    <TableCell className="font-medium tabular-nums text-primary">
                      {partenaire.valeur_partenariat ? `${(partenaire.valeur_partenariat / 1000).toFixed(0)}k€` : '-'}
                    </TableCell>
                  )}

                  {visibleColumns.engagement && (
                    <TableCell>
                      {partenaire.engagement_score > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-[100px] bg-muted rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${partenaire.engagement_score}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground min-w-[2rem] tabular-nums">
                            {partenaire.engagement_score}%
                          </span>
                        </div>
                      ) : '-'}
                    </TableCell>
                  )}

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Plus d'options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/partenaires/${partenaire.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Voir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit?.(partenaire)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        {partenaire.email && (
                          <DropdownMenuItem onClick={() => {
                            const params = new URLSearchParams({ compose: 'true', to: partenaire.email! });
                            params.set('toName', partenaire.nom);
                            navigate(`/emails?${params.toString()}`);
                          }}>
                            <Mail className="mr-2 h-4 w-4" />
                            Email
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            setPartenaireToDelete(partenaire);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CRMTableWrapper>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le partenaire "{partenaireToDelete?.nom}" ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
