import { useEffect, useState, useMemo } from 'react';
import { debug } from '@/lib/debug';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EntityAvatar } from '@/components/ui/EntityAvatar';
import { Video, Calendar, Clock, Users, CalendarPlus, ExternalLink, Download, Check, X, Loader2, CheckCircle2, ArrowRight, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/shared/use-toast';
import { useAcceptVisioToCalendar } from '@/hooks/bookings/useAcceptVisioToCalendar';
import { downloadEventICS } from '@/lib/calendarUtils';
import { useMessageAttachments } from '@/hooks/email/useThreadImages';
import { parseICSClient } from '@/lib/icsParserClient';

import {
  detectVisioLink,
  extractDateFromEmail,
  extractAttendees,
  cleanSubjectForDisplay,
} from './EmailVisioInvitationCard.parsers';

interface EmailVisioInvitationCardProps {
  messageId: string;
  threadId?: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  subject?: string;
  fromAddress?: string;
  fromName?: string;
}

interface ICSDateInfo {
  start: Date;
  end?: Date;
  summary?: string;
  location?: string;
}

export function EmailVisioInvitationCard({ 
  messageId, 
  threadId,
  bodyHtml, 
  bodyText, 
  subject,
  fromAddress,
  fromName
}: EmailVisioInvitationCardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [isIgnored, setIsIgnored] = useState(false);
  // State pour saisie manuelle si date non détectée
  const [manualStartTime, setManualStartTime] = useState<string>('');
  const [manualDuration, setManualDuration] = useState<number>(60);
  // State pour la confirmation après acceptation
  const [acceptedEventId, setAcceptedEventId] = useState<string | null>(null);
  // State pour les données ICS parsées depuis les attachments
  const [icsDateInfo, setIcsDateInfo] = useState<ICSDateInfo | null>(null);
  const [icsLoading, setIcsLoading] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Récupérer les attachments du message pour chercher les fichiers ICS
  const { attachments, isLoading: loadingAttachments } = useMessageAttachments(messageId);

  // Persistance (au moins durant la session) : utile si la card est rendue plusieurs fois dans le thread
  const storageKey = `visioAcceptedEvent:${threadId ?? messageId}`;
  useEffect(() => {
    if (acceptedEventId) return;
    const storedEventId = sessionStorage.getItem(storageKey);
    if (storedEventId) setAcceptedEventId(storedEventId);
  }, [acceptedEventId, storageKey]);

  // Chercher et parser le fichier ICS dans les attachments
  useEffect(() => {
    const icsAttachment = attachments.find(
      att => att.mime_type === 'text/calendar' || 
             att.mime_type === 'application/ics' ||
             att.filename?.toLowerCase().endsWith('.ics')
    );
    
    if (icsAttachment?.url && !icsDateInfo && !icsLoading) {
      setIcsLoading(true);
      fetch(icsAttachment.url)
        .then(res => res.text())
        .then(content => {
          debug.log('[EmailVisioInvitationCard] Parsing ICS content from attachment:', icsAttachment.filename);
          const events = parseICSClient(content);
          if (events.length > 0 && events[0].dtstart) {
            const event = events[0];
            debug.log('[EmailVisioInvitationCard] Parsed ICS event:', event);
            setIcsDateInfo({
              start: new Date(event.dtstart),
              end: event.dtend ? new Date(event.dtend) : undefined,
              summary: event.summary,
              location: event.location
            });
          }
        })
        .catch(err => {
          debug.error('[EmailVisioInvitationCard] Error parsing ICS:', err);
        })
        .finally(() => {
          setIcsLoading(false);
        });
    }
  }, [attachments, icsDateInfo, icsLoading]);

  const acceptVisio = useAcceptVisioToCalendar();

  const visioInfo = detectVisioLink(bodyHtml, bodyText);
  // Extraction de date : Priorité ICS > extraction regex du body/subject
  // Wrapped in useMemo to avoid recalculating on every render
  const regexDateInfo = useMemo(
    () => extractDateFromEmail(subject, bodyText, bodyHtml),
    [subject, bodyText, bodyHtml]
  );
  
  // Priorité : ICS (le plus fiable) > regex extraction
  const dateInfo = icsDateInfo 
    ? { start: icsDateInfo.start, end: icsDateInfo.end, allDay: false }
    : regexDateInfo;
    
  const attendees = extractAttendees(bodyText);

  // Don't render if no visio link detected or ignored
  if (!visioInfo || isIgnored) return null;

  // Calculer les dates : si dateInfo existe on l'utilise, sinon on attend la saisie manuelle
  const hasAutoDate = !!dateInfo;
  const hasIcsAttachment = attachments.some(
    att => att.mime_type === 'text/calendar' || 
           att.mime_type === 'application/ics' ||
           att.filename?.toLowerCase().endsWith('.ics')
  );
  const startTime = dateInfo?.start || (manualStartTime ? new Date(manualStartTime) : null);
  const endTime = dateInfo?.end || (startTime ? new Date(startTime.getTime() + manualDuration * 60 * 1000) : null);

  // Valider que la date n'est pas dans le passé
  const canAccept = startTime && endTime && startTime > new Date(Date.now() - 24 * 60 * 60 * 1000);

  const handleAccept = async () => {
    if (!startTime || !endTime) {
      toast({
        title: "Date requise",
        description: "Veuillez saisir la date et l'heure de la visio",
        variant: "destructive",
      });
      return;
    }
    
    const result = await acceptVisio.mutateAsync({
      messageId,
      threadId,
      subject: subject || `Réunion ${visioInfo.providerName}`,
      visioLink: visioInfo.link,
      visioProvider: visioInfo.providerName,
      startTime,
      endTime,
      attendees,
      fromAddress
    });
    
    // Fermer le dialog et mettre à jour l'état
    setAcceptedEventId(result.eventId);
    sessionStorage.setItem(storageKey, result.eventId);
    setShowDialog(false);
  };
  

  const handleCloseDialog = () => {
    setShowDialog(false);
  };

  const handleDownloadICS = () => {
    if (!startTime || !endTime) {
      toast({
        title: "Date requise",
        description: "Sélectionnez d'abord une date pour télécharger le fichier .ics",
        variant: "destructive",
      });
      return;
    }
    
    downloadEventICS({
      id: messageId,
      title: subject || `Réunion ${visioInfo.providerName}`,
      description: `Visioconférence ${visioInfo.providerName}\n\nParticipants:\n${attendees.map(a => `• ${a.email}`).join('\n')}\n\nOrganisateur: ${fromName || fromAddress || 'Non spécifié'}`,
      start: startTime,
      end: endTime,
      videoUrl: visioInfo.link,
      organizer: fromAddress ? { name: fromName || fromAddress, email: fromAddress } : undefined,
      attendees
    });
    
    toast({
      title: "Fichier .ics téléchargé",
      description: "Importez-le dans votre calendrier préféré",
    });
  };

  const handleIgnore = () => {
    setIsIgnored(true);
    toast({
      title: "Invitation ignorée",
      description: "Cette invitation ne sera plus affichée",
    });
  };

  return (
    <>
      {/* Main Card - Prominent Accept Button */}
      <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 mb-4 shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-col gap-4">
            {/* Header with provider info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-full ${visioInfo.color} shadow-sm`}>
                  <Video className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">Invitation visioconférence</span>
                    <Badge className={`${visioInfo.color} text-white text-xs`}>
                      {visioInfo.providerName}
                    </Badge>
                  </div>
                  {dateInfo && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <Calendar className="h-3.5 w-3.5 inline mr-1" />
                      {format(dateInfo.start, 'EEEE d MMMM à HH:mm', { locale: fr })}
                      {dateInfo.end && (
                        <span className="ml-2">
                          <Clock className="h-3.5 w-3.5 inline mr-1" />
                          {Math.round((dateInfo.end.getTime() - dateInfo.start.getTime()) / 60000)} min
                        </span>
                      )}
                    </p>
                  )}
                  {!dateInfo && !icsLoading && !loadingAttachments && (
                    <p className="text-sm text-amber-600 mt-0.5">
                      <Clock className="h-3.5 w-3.5 inline mr-1" />
                      Date à renseigner manuellement
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Participants preview */}
            {attendees.length > 0 && (
              <div className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-2">
                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {attendees.length} participant{attendees.length > 1 ? 's' : ''}
                </span>
                <div className="flex -space-x-2 ml-2">
                  {attendees.slice(0, 5).map((a, i) => (
                    <EntityAvatar 
                      key={i} 
                      name={a.name || a.email} 
                      email={a.email}
                      size="sm"
                      className="h-6 w-6 border-2 border-background ring-1 ring-background"
                    />
                  ))}
                  {attendees.length > 5 && (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                      +{attendees.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {/* Primary Accept Button - changes after acceptance */}
              {acceptedEventId ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 min-w-[200px] border-primary text-primary hover:bg-primary/5"
                  onClick={() => navigate(`/calendrier?event=${acceptedEventId}`)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                  Invitation acceptée - Voir dans l'agenda
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="flex-1 min-w-[200px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  onClick={() => setShowDialog(true)}
                  disabled={acceptVisio.isPending}
                >
                  {acceptVisio.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Ajout en cours...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Accepter et ajouter à l'agenda
                    </>
                  )}
                </Button>
              )}

              {/* Secondary actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  title="Rejoindre la visio" aria-label="Ouvrir le lien">
                  <a href={visioInfo.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDownloadICS}
                  title="Télécharger .ics" aria-label="Télécharger">
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleIgnore}
                  title="Ignorer"
                  className="text-muted-foreground hover:text-destructive" aria-label="Fermer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Ajouter à votre agenda
            </DialogTitle>
            <DialogDescription>
              L'événement sera ajouté avec un résumé IA des échanges précédents.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${visioInfo.color}`}>
                <Video className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium">{cleanSubjectForDisplay(subject)}</p>
                <Badge variant="secondary" className="mt-1">
                  {visioInfo.providerName}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-3 text-sm bg-muted/50 rounded-lg p-3">
              {hasAutoDate ? (
                <>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>
                      {format(dateInfo!.start, 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
                    </span>
                  </div>
                  {dateInfo!.end && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>
                        Durée: {Math.round((dateInfo!.end.getTime() - dateInfo!.start.getTime()) / 60000)} minutes
                      </span>
                    </div>
                  )}
                </>
              ) : icsLoading || loadingAttachments ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Recherche de données calendrier...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">
                      {visioInfo.provider === 'teams' 
                        ? "Ce lien Teams ne contient pas de date" 
                        : "Date non détectée automatiquement"}
                    </span>
                  </div>
                  {hasIcsAttachment ? (
                    <p className="text-xs text-muted-foreground">
                      <FileText className="h-3 w-3 inline mr-1" />
                      Un fichier .ics est présent mais la date n'a pas pu être extraite.
                    </p>
                  ) : visioInfo.provider === 'teams' ? (
                    <p className="text-xs text-muted-foreground">
                      Cet email contient uniquement un lien de réunion Teams sans date associée. 
                      Veuillez saisir la date manuellement.
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <label className="block text-xs text-muted-foreground">Date et heure de début *</label>
                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={manualStartTime}
                        onChange={(e) => setManualStartTime(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md text-sm bg-background"
                        required
                      />
                      {/* Quick actions for common times */}
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        className="text-xs whitespace-nowrap"
                        onClick={() => {
                          const now = new Date();
                          // Arrondir à la prochaine demi-heure
                          const minutes = now.getMinutes();
                          const roundedMinutes = minutes < 30 ? 30 : 0;
                          if (roundedMinutes === 0) now.setHours(now.getHours() + 1);
                          now.setMinutes(roundedMinutes);
                          now.setSeconds(0);
                          // Format for datetime-local input
                          const formatted = now.toISOString().slice(0, 16);
                          setManualStartTime(formatted);
                        }}
                      >
                        Prochaine ½h
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs text-muted-foreground">Durée</label>
                    <select
                      value={manualDuration}
                      onChange={(e) => setManualDuration(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 heure</option>
                      <option value={90}>1h30</option>
                      <option value={120}>2 heures</option>
                    </select>
                  </div>
                </div>
              )}
              {attendees.length > 0 && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-primary mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {attendees.slice(0, 5).map((a, i) => (
                      <span key={i} className="text-xs bg-background px-2 py-0.5 rounded">
                        {a.email}
                      </span>
                    ))}
                    {attendees.length > 5 && (
                      <span className="text-xs text-muted-foreground">
                        +{attendees.length - 5} autres
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              💡 Un résumé IA des échanges précédents sera automatiquement ajouté à la description de l'événement.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog}>
              Annuler
            </Button>
            <Button 
              onClick={handleAccept} 
              disabled={acceptVisio.isPending || !canAccept}
              className="gap-2"
            >
              {acceptVisio.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération du résumé IA...
                </>
              ) : !canAccept ? (
                <>
                  <Calendar className="h-4 w-4" />
                  Sélectionnez une date
                </>
              ) : (
                <>
                  <CalendarPlus className="h-4 w-4" />
                  Accepter la visio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
