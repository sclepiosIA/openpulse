import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Video, CalendarIcon, Clock, Users, X, Sparkles } from "lucide-react";
import { format, addHours, setHours, setMinutes, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { VideoConferenceSelector } from "@/components/calendrier/VideoConferenceSelector";
import { generateVisioInvitationICS } from "@/lib/calendarUtils";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateCalendarEvent } from "@/hooks/calendar/useCalendarEventActions";
import { invokeEdge } from "@/services/edgeFunctions";

interface Participant {
  email: string;
  name?: string;
}

interface EmailVisioInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadParticipants: Participant[];
  threadSubject: string;
  threadMessages?: Array<{ from_name?: string; from_address: string; body_text?: string; sent_date: string }>;
  onInvitationGenerated: (editorHtml: string, icsContent?: string, richHtml?: string) => void;
}

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 heure" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2 heures" },
];

export function EmailVisioInviteDialog({
  open,
  onOpenChange,
  threadParticipants,
  threadSubject,
  threadMessages = [],
  onInvitationGenerated,
}: EmailVisioInviteDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const calendarActions = useCreateCalendarEvent();
  const [visioUrl, setVisioUrl] = useState("");
  const [date, setDate] = useState<Date>(addHours(new Date(), 1));
  const [time, setTime] = useState("14:00");
  const [duration, setDuration] = useState(60);
  const [title, setTitle] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [hasSuggestions, setHasSuggestions] = useState(false);
  const [hasGeneratedSummary, setHasGeneratedSummary] = useState(false);

  // Initialize when dialog opens
  useEffect(() => {
    if (!open) {
      setHasGeneratedSummary(false);
      return;
    }
    
    setTitle(threadSubject ? `Visio: ${threadSubject.replace(/^(Re:|Fwd?:|Tr:)\s*/gi, '').trim()}` : "Visioconférence");
    setSelectedParticipants(threadParticipants.filter(p => p.email));
    setAiSummary("");
    setVisioUrl("");
    setHasSuggestions(false);
  }, [open, threadSubject, threadParticipants]);

  // Generate AI summary separately when dialog opens with messages
  useEffect(() => {
    if (open && threadMessages.length > 0 && !hasGeneratedSummary) {
      setHasGeneratedSummary(true);
      generateAISummary();
    }
  }, [open, threadMessages.length, hasGeneratedSummary]);

  const generateAISummary = async () => {
    if (threadMessages.length === 0) return;
    
    setIsGeneratingSummary(true);
    try {
      const messagesContext = threadMessages
        .slice(-5)
        .map(m => `De: ${m.from_name || m.from_address}\n${m.body_text?.substring(0, 500) || ''}`)
        .join('\n\n---\n\n');

      const data = await invokeEdge<any>('generate-visio-summary', {
          subject: threadSubject,
          messages: messagesContext,
          participants: threadParticipants.map(p => p.name || p.email).join(', ')
        });
    const error = null;

      if (error) throw error;
      
      setAiSummary(data?.summary || "");
      
      if (data?.suggestedTitle) {
        setTitle(data.suggestedTitle);
        setHasSuggestions(true);
      }
      
      if (data?.suggestedDate) {
        try {
          const parsedDate = parseISO(data.suggestedDate);
          if (!isNaN(parsedDate.getTime()) && parsedDate >= new Date()) {
            setDate(parsedDate);
            setHasSuggestions(true);
          }
        } catch (e) {
          if (import.meta.env.DEV) debug.warn('Invalid suggested date:', data.suggestedDate);
        }
      }
      
      if (data?.suggestedTime) {
        const timeMatch = data.suggestedTime.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          setTime(data.suggestedTime);
          setHasSuggestions(true);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) debug.error('Error generating AI summary:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const toggleParticipant = (participant: Participant) => {
    setSelectedParticipants(prev => {
      const exists = prev.some(p => p.email === participant.email);
      if (exists) {
        return prev.filter(p => p.email !== participant.email);
      }
      return [...prev, participant];
    });
  };

  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email?.substring(0, 2).toUpperCase() || '??';
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Veuillez saisir un titre pour la visioconférence");
      return;
    }

    if (!visioUrl) {
      toast.error("Veuillez générer un lien de visioconférence");
      return;
    }

    setIsGenerating(true);
    try {
      // Build date/time
      const [hours, minutes] = time.split(':').map(Number);
      const meetingDate = setMinutes(setHours(date, hours), minutes);

      // Generate HTML invitation with AI summary
      const participantsList = selectedParticipants
        .map(p => p.name || p.email.split('@')[0])
        .join(', ');

      // Simplified HTML for TipTap editor (only tags TipTap supports)
      const editorHtml = [
        `<p><strong>📹 Invitation à une visioconférence</strong></p>`,
        `<p><strong>Titre :</strong> ${title}</p>`,
        `<p><strong>Date :</strong> ${format(meetingDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>`,
        `<p><strong>Durée :</strong> ${DURATION_OPTIONS.find(d => d.value === duration)?.label || `${duration} min`}</p>`,
        `<p><strong>Participants :</strong> ${participantsList || 'À confirmer'}</p>`,
        aiSummary ? `<p><em>✨ Résumé :</em> ${aiSummary}</p>` : '',
        `<p><a href="${visioUrl}">🔗 Rejoindre la visioconférence</a></p>`,
      ].filter(Boolean).join('\n');

      // Rich HTML for actual SMTP email delivery
      const richHtml = `
<div style="border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; background: #f0f9ff; border-radius: 0 8px 8px 0;">
  <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1e40af;">
    📹 Invitation à une visioconférence
  </p>
  <table style="border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 4px 8px 4px 0; color: #6b7280; font-size: 14px; vertical-align: top;"><strong>Titre :</strong></td>
      <td style="padding: 4px 0; font-size: 14px;">${title}</td>
    </tr>
    <tr>
      <td style="padding: 4px 8px 4px 0; color: #6b7280; font-size: 14px; vertical-align: top;"><strong>Date :</strong></td>
      <td style="padding: 4px 0; font-size: 14px;">${format(meetingDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}</td>
    </tr>
    <tr>
      <td style="padding: 4px 8px 4px 0; color: #6b7280; font-size: 14px; vertical-align: top;"><strong>Durée :</strong></td>
      <td style="padding: 4px 0; font-size: 14px;">${DURATION_OPTIONS.find(d => d.value === duration)?.label || `${duration} min`}</td>
    </tr>
    <tr>
      <td style="padding: 4px 8px 4px 0; color: #6b7280; font-size: 14px; vertical-align: top;"><strong>Participants :</strong></td>
      <td style="padding: 4px 0; font-size: 14px;">${participantsList || 'À confirmer'}</td>
    </tr>
  </table>
  ${aiSummary ? `
  <div style="margin: 16px 0; padding: 12px; background: #fefce8; border-radius: 6px; border: 1px solid #fef08a;">
    <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #854d0e;">
      ✨ Résumé des échanges et objectif de la réunion
    </p>
    <p style="margin: 0; font-size: 13px; color: #713f12; line-height: 1.5;">
      ${aiSummary}
    </p>
  </div>
  ` : ''}
  <div style="margin-top: 16px;">
    <a href="${visioUrl}" 
       style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;"
       target="_blank">
      🔗 Rejoindre la visioconférence
    </a>
  </div>
</div>
`.trim();

      // Generate ICS for calendar invitation with Accept/Decline buttons
      const icsContent = generateVisioInvitationICS({
        id: crypto.randomUUID(),
        title: title,
        start: meetingDate,
        durationMinutes: duration,
        visioUrl: visioUrl,
        description: aiSummary || `Visioconférence: ${title}\n\nLien: ${visioUrl}`,
        organizer: {
          name: user?.email?.split('@')[0] || 'Organisateur',
          email: user?.email || 'noreply@exploitant.example.org'
        },
        attendees: selectedParticipants.map(p => ({
          email: p.email,
          name: p.name
        }))
      });

      // AUTO-AJOUTER L'ÉVÉNEMENT AU CALENDRIER DE L'ORGANISATEUR
      let calendarEventCreated = false;
      try {
        if (import.meta.env.DEV) debug.log('[EmailVisioInviteDialog] Adding event to organizer calendar for user:', user!.id);
        
        const calendarId = await calendarActions.getOrCreateDefaultCalendar(user!.id);
        const endTime = new Date(meetingDate.getTime() + duration * 60 * 1000);

        const event = await calendarActions.createEvent({
          calendarId,
          title,
          startTime: meetingDate.toISOString(),
          endTime: endTime.toISOString(),
          videoConferenceUrl: visioUrl,
          description: aiSummary || `Visioconférence: ${title}`,
          status: 'confirmed',
          visibility: 'private',
          createdBy: user!.id,
        });

        if (import.meta.env.DEV) debug.log('[EmailVisioInviteDialog] Event created:', event.id);

        // Add attendees
        const attendeeInserts = [
          {
            event_id: event.id,
            email: user!.email!,
            display_name: user!.email?.split('@')[0] || 'Moi',
            role: 'organizer',
            status: 'accepted',
          },
          ...selectedParticipants.map(p => ({
            event_id: event.id,
            email: p.email,
            display_name: p.name || null,
            role: 'attendee',
            status: 'pending',
          }))
        ];

        await calendarActions.addAttendees(attendeeInserts);
        calendarActions.invalidateCalendar();
        calendarEventCreated = true;

        if (import.meta.env.DEV) debug.log('[EmailVisioInviteDialog] Event successfully added to organizer calendar:', event.id);
      } catch (calError: any) {
        if (import.meta.env.DEV) debug.error('[EmailVisioInviteDialog] Error adding event to organizer calendar:', calError);
      }

      onInvitationGenerated(editorHtml, icsContent, richHtml);
      onOpenChange(false);
      
      if (calendarEventCreated) {
        toast.success("Invitation créée et ajoutée à votre calendrier");
      } else {
        toast.warning("Invitation envoyée, mais l'ajout au calendrier a échoué");
      }
      
    } catch (error: unknown) {
      if (import.meta.env.DEV) debug.error('Error creating visio invitation:', error);
      toast.error(sanitizeSupabaseError(error));
    } finally {
      setIsGenerating(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Créer une invitation visio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider selection with VideoConferenceSelector */}
          <VideoConferenceSelector
            value={visioUrl}
            onChange={setVisioUrl}
            eventTitle={title}
          />
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="visio-title" className="flex items-center gap-2">
              Titre de la réunion
              {hasSuggestions && title && (
                <Badge variant="secondary" className="text-xs py-0 px-1.5 gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  IA
                </Badge>
              )}
            </Label>
            <Input
              id="visio-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Point de suivi projet"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Date
                {hasSuggestions && (
                  <Badge variant="secondary" className="text-xs py-0 px-1.5 gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    IA
                  </Badge>
                )}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    disabled={(date) => date < new Date()}
                    locale={fr}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Heure</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="w-full">
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Heure" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 48 }, (_, i) => {
                    const h = Math.floor(i / 2);
                    const m = (i % 2) * 30;
                    const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    return (
                      <SelectItem key={val} value={val}>
                        {val}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Durée</Label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI Summary */}
          {isGeneratingSummary && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Analyse de la conversation en cours...</span>
            </div>
          )}

          {aiSummary && !isGeneratingSummary && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Résumé IA</span>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">{aiSummary}</p>
            </div>
          )}

          {/* Participants */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants ({selectedParticipants.length})
            </Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30 max-h-40 overflow-y-auto">
              {threadParticipants.filter(p => p.email).map((participant) => {
                const isSelected = selectedParticipants.some(p => p.email === participant.email);
                return (
                  <button
                    key={participant.email}
                    onClick={() => toggleParticipant(participant)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-sm",
                      isSelected
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(participant.name, participant.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[150px]">
                      {participant.name || participant.email}
                    </span>
                    {isSelected && (
                      <X className="h-3 w-3 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
              {threadParticipants.filter(p => p.email).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun participant détecté</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isGenerating || !title.trim() || !visioUrl}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Video className="h-4 w-4" />
            )}
            Créer l'invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
