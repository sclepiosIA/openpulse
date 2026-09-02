import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useCandidates, useUpdateCandidateStatus } from "@/hooks/recrutement/useCandidates";
import { useJobOffers } from "@/hooks/recrutement/useJobOffers";
import { CANDIDATE_PIPELINE_COLUMNS, Candidate, CandidateStatus } from "@/types/recrutement";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertCircle, GripVertical, Star, Calendar, Phone, Mail, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";

interface CandidatePipelineProps {
  onCandidateClick?: (candidate: Candidate) => void;
}

export default function CandidatePipeline({ onCandidateClick }: CandidatePipelineProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [draggedCandidate, setDraggedCandidate] = useState<Candidate | null>(null);

  const { data: jobOffers = [], isError: jobOffersIsError, error: jobOffersError, refetch: refetchJobOffers } = useJobOffers({ status: ['published', 'paused'] });
  const { data: candidates = [], isLoading, isError, error, refetch } = useCandidates({
    jobOfferId: selectedJobId !== "all" ? selectedJobId : undefined,
  });
  const { mutate: updateStatus } = useUpdateCandidateStatus();

  // Group candidates by status
  const candidatesByStatus = CANDIDATE_PIPELINE_COLUMNS.reduce((acc, col) => {
    acc[col.status] = candidates.filter(c => c.statut === col.status);
    return acc;
  }, {} as Record<CandidateStatus, Candidate[]>);

  const handleDragStart = (e: React.DragEvent, candidate: Candidate) => {
    setDraggedCandidate(candidate);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: CandidateStatus) => {
    e.preventDefault();
    if (draggedCandidate && draggedCandidate.statut !== newStatus) {
      updateStatus({
        id: draggedCandidate.id,
        status: newStatus,
      });
    }
    setDraggedCandidate(null);
  };

  const handleDragEnd = () => {
    setDraggedCandidate(null);
  };

  const getInitials = (prenom: string, nom: string) => {
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Chargement du pipeline...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError || jobOffersIsError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-destructive">
          <AlertCircle className="h-6 w-6" />
          <p>{sanitizeSupabaseError(error || jobOffersError)}</p>
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchJobOffers(); }} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter by job offer */}
      <div className="flex items-center gap-4">
        <Select value={selectedJobId} onValueChange={setSelectedJobId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Filtrer par offre..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les offres</SelectItem>
            {jobOffers.map(offer => (
              <SelectItem key={offer.id} value={offer.id}>{offer.titre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {candidates.length} candidat{candidates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Pipeline Kanban */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {CANDIDATE_PIPELINE_COLUMNS.map((column) => (
            <div
              key={column.status}
              className={cn(
                "w-[280px] rounded-lg border",
                column.color
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              <div className="p-3 border-b bg-background/50">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{column.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {candidatesByStatus[column.status]?.length || 0}
                  </Badge>
                </div>
              </div>

              <div className="p-2 space-y-2 min-h-[400px]">
                {candidatesByStatus[column.status]?.map((candidate) => (
                  <Card
                    key={candidate.id}
                    className={cn(
                      "cursor-grab hover:shadow-md transition-shadow",
                      draggedCandidate?.id === candidate.id && "opacity-50"
                    )}
                    draggable
                    onDragStart={(e) => handleDragStart(e, candidate)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onCandidateClick?.(candidate)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center">
                          <GripVertical className="h-4 w-4 text-muted-foreground mr-1" />
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs">
                              {getInitials(candidate.prenom, candidate.nom)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {candidate.prenom} {candidate.nom}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {candidate.job_offer?.titre || 'Offre non définie'}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {candidate.note_globale && (
                              <div className="flex items-center gap-1 text-amber-500">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="text-xs">{candidate.note_globale}</span>
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(candidate.date_candidature), 'dd MMM', { locale: fr })}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick actions */}
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                        {candidate.telephone && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`tel:${candidate.telephone}`);
                            }} aria-label="Appeler">
                            <Phone className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`mailto:${candidate.email}`);
                          }} aria-label="E-mail">
                          <Mail className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info('Fonctionnalité en cours de développement', { description: 'La planification d\'entretien sera disponible prochainement.' });
                          }} aria-label="Calendrier">
                          <Calendar className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {candidatesByStatus[column.status]?.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                    Aucun candidat
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
