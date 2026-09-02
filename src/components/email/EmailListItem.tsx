import { Paperclip, Star, FileText, Users, UserCheck, ImageIcon } from "lucide-react";
import { EmailAvatar } from "./EmailAvatar";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { sanitizeEmailSubject, sanitizeDisplayName, getThreadMainSender } from "@/lib/emailUtils";
import { cn } from "@/lib/utils";
import { EmailEtablissementBadge } from "./EmailEtablissementBadge";
import { EmailThreadHoverCard } from "./EmailThreadHoverCard";
import { PartenaireBadge } from "@/components/ui/partenaire-badge";
import { GroupeBadge } from "@/components/ui/groupe-badge";
import { SharedDomainBadge } from "./SharedDomainBadge";
import { ImageLightbox } from "./ImageLightbox";
import { QuickClassificationDialog } from "./QuickClassificationDialog";
import { useQuickClassification } from "@/hooks/email/useQuickClassification";
import { ContactRoleBadge } from "@/components/contacts/ContactRoleBadge";
import { useContacts } from "@/hooks/crm/useContacts";
import { useState } from "react";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { EmailListItemMobile } from "./EmailListItemMobile";
import type { ThreadEnrichedData } from "@/hooks/email/useThreadsEnrichedData";
import type { EmailThread } from "@/types/email";
import { updateThreadPriority } from '@/services/email/emailThreadMutations';
interface EmailMessage {
  body_html?: string | null;
  body_text?: string | null;
}

interface CcBccAddress {
  email: string;
  name?: string;
}

interface EmailListItemProps {
  thread: EmailThread;
  selected?: boolean;
  isNew?: boolean;
  enrichedData?: ThreadEnrichedData;
  onSelect?: (selected: boolean) => void;
  onClick?: () => void;
}

export function EmailListItem({ thread, selected = false, isNew = false, enrichedData, onSelect, onClick }: EmailListItemProps) {
  const isMobile = useIsMobile();

  // V3a: tous les hooks doivent être appelés avant tout early-return.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [classificationDialogOpen, setClassificationDialogOpen] = useState(false);
  const [classificationType, setClassificationType] = useState<"etablissement" | "partenaire" | "groupe">("etablissement");
  const { classifyThread } = useQuickClassification();
  const { updateContactRole } = useContacts(thread.etablissement_id || "");

  // Sur mobile, utiliser le composant simplifié
  if (isMobile) {
    return (
      <EmailListItemMobile
        thread={thread}
        selected={selected}
        isNew={isNew}
        enrichedData={enrichedData}
        onSelect={onSelect}
        onClick={onClick}
      />
    );
  }

  const isUnread = thread.unread_count > 0;
  const mainSender = getThreadMainSender(thread, thread.account?.email_address || '');
  const isLastMessageFromUser = mainSender?.isCurrentUser || false;

  // Toujours utiliser enrichedData (pas de fallback N+1 queries)
  const groupeInfo = enrichedData?.groupeInfo || { hasMultipleEtablissementsInGroupe: false, groupeNom: null, groupeId: null, etablissementNames: [] };
  const contact = enrichedData?.contact || null;
  const internalRole = enrichedData?.internalRole || null;
  const imageCount = enrichedData?.imageCount || 0;

  // Images vides pour l'instant (affichage du compteur uniquement)
  const images: Array<{ id: string; url: string; filename: string; }> = [];

  const handleImageClick = (index: number) => {
    setLightboxInitialIndex(index);
    setLightboxOpen(true);
  };

  const handleQuickClassify = (type: "etablissement" | "partenaire" | "groupe") => {
    setClassificationType(type);
    setClassificationDialogOpen(true);
  };

  const handleClassificationSelect = (id: string, name: string) => {
    if (classificationType === "etablissement") {
      classifyThread({
        threadId: thread.id,
        etablissementId: id,
        etablissementNom: name,
      });
    } else if (classificationType === "partenaire") {
      classifyThread({
        threadId: thread.id,
        partenaireId: id,
        partenaireNom: name,
      });
    } else {
      classifyThread({
        threadId: thread.id,
        groupeId: id,
        groupeNom: name,
      });
    }
  };

  const handleRoleAssigned = (contactId: string, newRole: string) => {
    updateContactRole(contactId, newRole);
  };

  const content = (
    <div
      role="article"
      aria-label={`Email de ${mainSender?.name || mainSender?.email}, sujet: ${thread.subject}, ${isUnread ? 'non lu' : 'lu'}`}
      
      data-selected={selected || undefined}
      tabIndex={0}
      className={cn(
        "group grid grid-cols-[auto_auto_auto_minmax(140px,200px)_minmax(200px,260px)_1fr_minmax(100px,140px)] gap-3 px-4 py-3 border-b transition-colors cursor-pointer items-start",
        "hover:bg-accent/50 w-full",
        selected && "bg-accent",
        isUnread && "bg-muted/30",
        isNew && "animate-in fade-in slide-in-from-top-2 bg-primary/5 border-l-4 border-l-primary"
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Star/Important - Hidden on mobile */}
      <button
        className="hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={async (e) => {
          e.stopPropagation();
          try {
            await updateThreadPriority(thread.id, thread.priority === 'high' ? null : 'high');
            window.dispatchEvent(new CustomEvent('email-thread-updated', { detail: { threadId: thread.id } }));
          } catch {
            /* toast handled globally */
          }
        }}
      >
        <Star className={cn(
          "h-4 w-4 transition-colors",
          thread.priority === "high" ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground hover:text-yellow-500"
        )} />
      </button>

      {/* Email Avatar - Hidden on mobile */}
      <div className="hidden sm:flex items-center justify-center">
        <EmailAvatar
          name={mainSender?.name}
          email={mainSender?.email}
          isUnread={isUnread}
          size="sm"
          forceInternal={internalRole !== null}
        />
      </div>

      {/* Sender - Affiche l'expéditeur principal ou les participants */}
      <div className={cn("min-w-0 overflow-hidden", isUnread && "font-semibold")}>
        <div className="flex flex-col gap-1 min-w-0">
          {mainSender ? (
            <>
              <span className="truncate text-sm block">
                {isLastMessageFromUser ? (
                  <span className="text-muted-foreground">
                    Vous → {sanitizeDisplayName(mainSender.name) || mainSender.name}
                  </span>
                ) : (
                  sanitizeDisplayName(mainSender.name) || mainSender.name
                )}
              </span>
              <span className="hidden sm:block truncate text-xs text-muted-foreground">
                {mainSender.email.split('@')[0]}
              </span>
              {contact && contact.id && contact.nom && (
                <ContactRoleBadge
                  contact={{
                    id: contact.id,
                    nom: contact.nom,
                    prenom: contact.prenom || undefined,
                    email: contact.email || undefined,
                    type_contact: contact.type_contact ?? null,
                  }}
                  onRoleAssigned={handleRoleAssigned}
                  size="sm"
                />
              )}

              {!contact && internalRole?.title && (
                <Badge 
                  variant="outline" 
                  className="text-xs w-fit max-w-full truncate border-amber-500/50 text-amber-700 dark:text-amber-400"
                >
                  {internalRole.title}
                </Badge>
              )}
            </>
          ) : (
            <span className="truncate text-sm text-muted-foreground">
              Sans expéditeur
            </span>
          )}
          
          {thread.messages && thread.messages.length > 0 && 
           thread.messages.every((msg: EmailMessage) => !msg.body_html && !msg.body_text) && (
            <Badge variant="destructive" className="text-xs w-fit">
              <FileText className="h-3 w-3" />
            </Badge>
          )}
        </div>
      </div>

      {/* Classification Badge - Hidden on mobile, shown on md+ */}
      <div className="hidden md:flex min-w-0 overflow-hidden">
        {groupeInfo.hasMultipleEtablissementsInGroupe ? (
          <SharedDomainBadge 
            etablissementNames={groupeInfo.etablissementNames} 
            groupeNom={groupeInfo.groupeNom}
          />
        ) : thread.partenaire_id && thread.partenaire ? (
          <PartenaireBadge
            type={(thread.partenaire.type_partenaire || "prestataire") as "industriel" | "institutionnel" | "prestataire"}
            nom={thread.partenaire.nom}
            ville={thread.partenaire.ville}
            partenaireId={thread.partenaire.id}
            size="sm"
          />
        ) : thread.groupe_id && thread.groupe ? (
          <GroupeBadge
            type={(thread.groupe.type || "Autre") as "Autre" | "Consortium" | "GHT" | "Groupe Cliniques"}
            nom={thread.groupe.nom}
            className="text-xs"
          />
        ) : thread.category && typeof thread.category === 'string' && thread.category.includes("Interne") ? (
          <Badge 
            variant="secondary" 
            className="gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 text-xs font-medium"
          >
            <Mail className="h-3 w-3" />
            Interne OpenPulse
          </Badge>
        ) : (
          <EmailEtablissementBadge
            etablissementId={thread.etablissement?.id}
            etablissementNom={thread.etablissement?.nom}
            etablissementVille={thread.etablissement?.ville}
            size="sm"
            threadData={{
              id: thread.id,
              subject: thread.subject,
              participants: thread.participants,
            }}
            onUnclassifiedClick={() => handleQuickClassify("etablissement")}
          />
        )}
      </div>

      {/* Content - Spans to fill remaining space on mobile */}
      <div className="col-span-2 sm:col-span-1 min-w-0 overflow-hidden">
        <div className="flex flex-col gap-1">
          {/* Ligne 1: Sujet seul avec tooltip */}
          <div className="flex items-center gap-2 min-w-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn("truncate block min-w-0", isUnread && "font-semibold")}>
                    {sanitizeEmailSubject(thread.ai_generated_title || thread.subject)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-md">
                  <p className="text-sm">{sanitizeEmailSubject(thread.ai_generated_title || thread.subject)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {thread.priority === "high" && (
              <Badge variant="destructive" className="text-xs shrink-0">
                Haute
              </Badge>
            )}
          </div>
          
          {/* Ligne 2: Badges (catégorie, tags, pièces jointes, CC/BCC) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {thread.category && (
              <Badge variant="secondary" className="text-xs shrink-0 bg-primary/10 text-primary border-primary/20">
                {thread.category}
              </Badge>
            )}
            {thread.tags && thread.tags.length > 0 && (
              <>
                {thread.tags.slice(0, 2).map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="outline" 
                    className="text-xs shrink-0 border-muted-foreground/30 text-muted-foreground hidden sm:inline-flex"
                  >
                    #{tag}
                  </Badge>
                ))}
                {thread.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">
                    +{thread.tags.length - 2}
                  </Badge>
                )}
              </>
            )}
            {thread.message_count > 0 && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div 
                    className="hidden lg:flex items-center gap-1 shrink-0 cursor-help"
                    onClick={(e) => {
                      if (images.length > 0) {
                        e.stopPropagation();
                      }
                    }}
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    {imageCount > 0 && (
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                        <ImageIcon className="h-2.5 w-2.5 mr-0.5" />
                        {imageCount}
                      </Badge>
                    )}
                  </div>
                </HoverCardTrigger>
                {imageCount > 0 && (
                  <HoverCardContent
                    side="top" 
                    className="w-80 p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs font-semibold mb-2">
                      Images ({imageCount})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {imageCount} image{imageCount > 1 ? 's' : ''} attachée{imageCount > 1 ? 's' : ''} à ce fil
                    </p>
                  </HoverCardContent>
                )}
              </HoverCard>
            )}
            {thread.messages?.[0]?.cc_addresses && thread.messages[0].cc_addresses.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="text-xs shrink-0 hidden lg:inline-flex border-blue-500/50 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-help transition-colors"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      CC: {thread.messages[0].cc_addresses.length}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs font-semibold mb-1">En copie :</p>
                    <p className="text-xs">
                      {Array.isArray(thread.messages[0].cc_addresses) 
                        ? thread.messages[0].cc_addresses.map((cc: unknown) => 
                            typeof cc === 'string' ? cc : (cc as CcBccAddress).email
                          ).join(', ')
                        : ''}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {thread.messages?.[0]?.bcc_addresses && thread.messages[0].bcc_addresses.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="text-xs shrink-0 hidden lg:inline-flex border-purple-500/50 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 cursor-help transition-colors"
                    >
                      <UserCheck className="h-3 w-3 mr-1" />
                      BCC: {thread.messages[0].bcc_addresses.length}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs font-semibold mb-1">Copie cachée :</p>
                    <p className="text-xs">
                      {Array.isArray(thread.messages[0].bcc_addresses)
                        ? thread.messages[0].bcc_addresses.map((bcc: unknown) => 
                            typeof bcc === 'string' ? bcc : (bcc as CcBccAddress).email
                          ).join(', ')
                        : ''}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {/* Ligne 3: Résumé AI */}
          <p className="text-sm text-muted-foreground truncate block">
            {sanitizeEmailSubject(thread.ai_summary) || "Aucun résumé disponible"}
          </p>
        </div>
      </div>

      {/* Date and count */}
      <div className="flex flex-col items-end justify-center gap-1 min-w-0">
        <p className="text-xs text-muted-foreground whitespace-nowrap truncate">
          {formatDistanceToNow(new Date(thread.last_message_date), {
            addSuffix: true,
            locale: fr,
          })}
        </p>
        {thread.message_count > 1 && (
          <Badge variant="outline" className="text-xs">
            {thread.message_count}
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <>
      <EmailThreadHoverCard thread={thread}>
        {content}
      </EmailThreadHoverCard>
      
      {/* Image Lightbox */}
      {images.length > 0 && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxInitialIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}

      <QuickClassificationDialog
        open={classificationDialogOpen}
        onOpenChange={setClassificationDialogOpen}
        type={classificationType}
        onSelect={handleClassificationSelect}
        threadData={{
          subject: thread.subject,
          participants: thread.participants,
        }}
      />
    </>
  );
}
