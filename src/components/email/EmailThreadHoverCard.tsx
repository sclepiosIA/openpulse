import { useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Brain, Mail, Calendar, Tag, AlertCircle, Paperclip, Building2, MapPin, TrendingUp, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { fixMalformedEncoding } from "@/lib/emailUtils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TaskQuickAddDialog } from "./TaskQuickAddDialog";
import { useThreadGroupeParticipants } from "@/hooks/email/useThreadGroupeParticipants";
import { useGroupeEtablissements } from "@/hooks/crm/useGroupeEtablissements";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { EmailThread } from "@/types/email";
import { fetchEtablissementForHover } from '@/services/email/emailContextQueries';
interface EmailThreadHoverCardProps {
  thread: EmailThread;
  children: React.ReactNode;
}

export function EmailThreadHoverCard({ thread, children }: EmailThreadHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <HoverCard openDelay={200} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="top" align="end" sideOffset={8} avoidCollisions={true} collisionPadding={24} className="w-80 sm:w-96 max-w-[min(92vw,30rem)]">
        {isOpen && <EmailThreadHoverCardContent thread={thread} />}
      </HoverCardContent>
    </HoverCard>
  );
}

// Composant exporté pour être utilisé directement avec la composition correcte de Radix
export function EmailThreadHoverCardContent({ thread }: { thread: any }) {
  const navigate = useNavigate();
  
  // Détecter si c'est un thread GHT/groupe
  const groupeInfo = useThreadGroupeParticipants(thread);
  
  // Charger tous les établissements du groupe si applicable
  const { data: etablissementsGroupe } = useGroupeEtablissements(
    groupeInfo?.hasMultipleEtablissementsInGroupe && groupeInfo.groupeId
      ? groupeInfo.groupeId
      : null
  );
  
  const { data: etablissement } = useQuery({
    queryKey: ['etablissement-hover', thread.etablissement?.id],
    queryFn: async () => {
      if (!thread.etablissement?.id) return null;
      return await fetchEtablissementForHover(thread.etablissement.id);
    },
    enabled: !!thread.etablissement?.id,
    staleTime: 30000,
  });

  const nextTask = etablissement?.taches
    ?.filter((t: any) => t.statut !== 'termine' && t.echeance)
    ?.sort((a: any, b: any) => {
      if (a.priorite !== b.priorite) {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priorite as keyof typeof priorityOrder] - priorityOrder[b.priorite as keyof typeof priorityOrder];
      }
      return new Date(a.echeance!).getTime() - new Date(b.echeance!).getTime();
    })?.[0];

  return (
    <div className="space-y-4">
      {/* AI Summary Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Résumé des échanges</h4>
        </div>
        {thread.ai_summary ? (
          <div className="relative">
            <div className="max-h-48 overflow-y-auto prose prose-sm text-sm leading-relaxed text-muted-foreground pr-2">
              {fixMalformedEncoding(thread.ai_summary)}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-popover to-transparent pointer-events-none" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Aucun résumé disponible</p>
        )}
      </div>

      {/* Thread Metadata Section */}
      <div className="border-t pt-3">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm">Informations du thread</h4>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              {thread.message_count} message{thread.message_count > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              Dernier message: {format(new Date(thread.last_message_date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </span>
          </div>
          {thread.category && (
            <div className="flex items-center gap-2">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">
                {thread.category}
              </Badge>
            </div>
          )}
          {thread.priority === "high" && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-destructive" />
              <Badge variant="destructive" className="text-xs">
                Priorité haute
              </Badge>
            </div>
          )}
          {thread.has_attachments && (
            <div className="flex items-center gap-2">
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Pièces jointes</span>
            </div>
          )}
        </div>
      </div>

      {/* Section Groupe/GHT avec plusieurs établissements */}
      {groupeInfo?.hasMultipleEtablissementsInGroupe && etablissementsGroupe && etablissementsGroupe.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm">
              {groupeInfo.groupeNom || 'Groupe'} ({etablissementsGroupe.length} établissements)
            </h4>
          </div>
          
          {/* Métriques agrégées */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline" className="text-xs">
              Progression moyenne: {Math.round(
                etablissementsGroupe.reduce((sum, e) => sum + (e.progression || 0), 0) / etablissementsGroupe.length
              )}%
            </Badge>
            <Badge variant="outline" className="text-xs">
              {etablissementsGroupe.reduce((sum, e) => sum + (e.taches?.length || 0), 0)} tâches actives
            </Badge>
          </div>
          
          {/* Liste des établissements en accordéon */}
          <Accordion type="single" collapsible className="w-full">
            {etablissementsGroupe.map((etab) => {
              const etabNextTask = etab.taches
                ?.filter((t: any) => t.statut !== 'Terminé' && t.echeance)
                ?.sort((a: any, b: any) => {
                  if (a.priorite !== b.priorite) {
                    const priorityOrder = { high: 0, medium: 1, low: 2 };
                    return priorityOrder[a.priorite as keyof typeof priorityOrder] - priorityOrder[b.priorite as keyof typeof priorityOrder];
                  }
                  return new Date(a.echeance!).getTime() - new Date(b.echeance!).getTime();
                })?.[0];

              return (
                <AccordionItem key={etab.id} value={etab.id} className="border-b-0">
                  <AccordionTrigger className="text-sm py-2 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium truncate">{etab.nom}</span>
                        {etab.ville && (
                          <span className="text-muted-foreground text-xs truncate">({etab.ville})</span>
                        )}
                      </div>
                      {etab.taches && etab.taches.length > 0 && (
                        <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
                          {etab.taches.length}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-2 pt-1">
                      {/* Badges de statut */}
                      <div className="flex flex-wrap gap-2">
                        {etab.statut && (
                          <Badge variant="secondary" className="text-xs">
                            {etab.statut}
                          </Badge>
                        )}
                        {etab.progression !== null && etab.progression !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {etab.progression}%
                          </Badge>
                        )}
                        {etab.engagement_score !== null && etab.engagement_score !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            Score: {etab.engagement_score}/100
                          </Badge>
                        )}
                      </div>
                      
                      {/* Prochaine tâche */}
                      {etabNextTask && etabNextTask.echeance && (
                        <div className="mt-2 p-2 bg-muted/50 rounded-md">
                          <div className="flex items-start gap-2">
                            <Clock className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium mb-0.5">Prochaine tâche</p>
                              <p className="text-xs text-muted-foreground truncate">{etabNextTask.titre}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {format(new Date(etabNextTask.echeance), "d MMM", { locale: fr })}
                                </Badge>
                                {etabNextTask.priorite === 'high' && (
                                  <Badge variant="destructive" className="text-xs">Haute</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Lien vers la fiche établissement */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/etablissements/${etab.id}`);
                        }}
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors mt-2"
                      >
                        Voir la fiche
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      {/* Section Établissement unique (fallback) */}
      {!groupeInfo?.hasMultipleEtablissementsInGroupe && etablissement && (
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Établissement</h4>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/etablissements/${etablissement.id}`);
              }}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              Voir la fiche
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <p className="font-medium">{etablissement.nom}</p>
              {etablissement.ville && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{etablissement.ville}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {etablissement.statut && (
                <Badge variant="secondary" className="text-xs">
                  {etablissement.statut}
                </Badge>
              )}
              {etablissement.progression !== undefined && etablissement.progression !== null && (
                <Badge variant="outline" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {etablissement.progression}%
                </Badge>
              )}
              {etablissement.engagement_score !== undefined && etablissement.engagement_score !== null && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs cursor-help">
                        Score: {etablissement.engagement_score}/100
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs font-semibold mb-1">Score d'engagement</p>
                      <ul className="text-xs space-y-0.5">
                        <li>• Récence des contacts (40 pts)</li>
                        <li>• Fréquence des échanges (30 pts)</li>
                        <li>• Réactivité aux emails (30 pts)</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {nextTask && nextTask.echeance && (
              <div className="mt-2 p-2 bg-muted/50 rounded-md">
                <div className="flex items-start gap-2">
                  <Clock className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium mb-0.5">Prochaine tâche</p>
                    <p className="text-xs text-muted-foreground truncate">{nextTask.titre}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(nextTask.echeance), "d MMM", { locale: fr })}
                      </Badge>
                      {nextTask.priorite === 'high' && (
                        <Badge variant="destructive" className="text-xs">Haute</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Task Creation */}
            <div className="mt-3 pt-3 border-t">
              <TaskQuickAddDialog
                etablissementId={etablissement.id}
                etablissementNom={etablissement.nom}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
