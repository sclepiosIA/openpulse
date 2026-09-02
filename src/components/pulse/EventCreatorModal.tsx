import { useState, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, Loader2, Users, UserPlus } from 'lucide-react';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useCalendars } from '@/hooks/calendar/useCalendars';
import { usePulseConversation } from '@/hooks/pulse/usePulseConversations';
import { useTeamMembers } from '@/hooks/hr/useTeamCalendars';
import { VideoConferenceSelector } from '@/components/calendrier/VideoConferenceSelector';
import { useCreateCalendarEvent } from '@/hooks/calendar/useCalendarEventActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

interface EventCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onEventCreated: (event: { id: string; title: string }) => void;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  return {
    value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
});

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '60', label: '1 heure' },
  { value: '90', label: '1h30' },
  { value: '120', label: '2 heures' },
];

const REMINDER_OPTIONS = [
  { value: '15', label: '15 min avant' },
  { value: '60', label: '1 heure avant' },
  { value: '1440', label: '1 jour avant' },
];

export function EventCreatorModal({
  open,
  onOpenChange,
  conversationId,
  onEventCreated,
}: EventCreatorModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [reminder, setReminder] = useState('15');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  
  const { user } = useAuth();
  const { data: currentProfile } = useCurrentProfile();
  const { data: calendars } = useCalendars();
  const { data: conversation } = usePulseConversation(conversationId);
  const { data: teamMembers } = useTeamMembers();
  const calendarActions = useCreateCalendarEvent();
  const queryClient = useQueryClient();

  // Get default calendar
  const defaultCalendar = calendars?.find(c => c.is_default) || calendars?.[0];

  // Get conversation members for attendees (excluding current user)
  const conversationMembers = conversation?.members?.filter(m => m.user_id !== currentProfile?.id) || [];
  
  // Get team members not in conversation (for additional participants)
  const conversationMemberIds = conversation?.members?.map(m => m.user_id) || [];
  const otherTeamMembers = teamMembers?.filter(tm => 
    tm.id !== currentProfile?.id && !conversationMemberIds.includes(tm.id)
  ) || [];

  // Reset form when opening
  useEffect(() => {
    if (open) {
      const now = new Date();
      const nextHour = setMinutes(setHours(now, now.getHours() + 1), 0);
      setStartDate(nextHour);
      setStartTime(format(nextHour, 'HH:mm'));
      setSelectedParticipants([]);
    }
  }, [open]);

  const createEvent = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id || !title.trim() || !defaultCalendar) {
        throw new Error('Données manquantes');
      }

      // Calculate start and end times
      const [startH, startM] = startTime.split(':').map(Number);
      const startDateTime = setMinutes(setHours(startDate, startH), startM);
      const endDateTime = addHours(startDateTime, parseInt(duration) / 60);

      // Create event via hook
      const event = await calendarActions.createEvent({
        calendarId: defaultCalendar.id,
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        videoConferenceUrl: videoUrl.trim() || undefined,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        createdBy: currentProfile.id,
      });

      // Resolve auth user
      if (!user) throw new Error('Non authentifié');

      // Add reminder if selected
      if (reminder && event) {
        await calendarActions.addReminder({
          event_id: event.id,
          user_id: user.id,
          minutes_before: parseInt(reminder),
        });
      }

      // Add attendees
      if (selectedParticipants.length > 0 && event) {
        const selectedConversationProfileIds = conversationMembers
          .filter(m => selectedParticipants.includes(m.user_id))
          .map(m => m.user_id);

        const selectedOtherProfileIds = otherTeamMembers
          .filter(tm => selectedParticipants.includes(tm.id))
          .map(tm => tm.id);

        const selectedProfileIds = Array.from(
          new Set([...selectedConversationProfileIds, ...selectedOtherProfileIds])
        );

        if (selectedProfileIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, user_id, email, prenom, nom')
            .in('id', selectedProfileIds);

          if (profilesError) throw profilesError;

          const attendeeInserts = (profiles || [])
            .filter(p => p.email)
            .map(p => {
              const isRequired = selectedConversationProfileIds.includes(p.id);
              return {
                event_id: event.id,
                user_id: p.user_id ?? null,
                email: p.email!,
                display_name: `${p.prenom || ''} ${p.nom || ''}`.trim() || null,
                status: 'pending',
                role: isRequired ? 'required' : 'optional',
              };
            });

          if (attendeeInserts.length > 0) {
            await calendarActions.addAttendees(attendeeInserts);
          }
        }
      }

      return event as { id: string; title: string };
    },
    onSuccess: (data) => {
      calendarActions.invalidateCalendar();
      toast.success('Réunion créée');
      onEventCreated(data);
      handleClose();
    },
    onError: (error: Error) => {
      debug.error('Error creating event:', error);
      toast.error('Erreur lors de la création de la réunion');
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setTitle('');
    setDescription('');
    setLocation('');
    setVideoUrl('');
    setSelectedParticipants([]);
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Nouvelle réunion
          </DialogTitle>
          <DialogDescription>
            Créer un événement dans votre calendrier
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="event-title">Titre *</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la réunion..."
              autoFocus
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    {format(startDate, 'dd MMM yyyy', { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Heure</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration and Reminder */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Durée</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rappel</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="event-location" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Lieu (optionnel)
            </Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Salle de réunion, adresse..."
            />
          </div>

          {/* Video Conference */}
          <VideoConferenceSelector
            value={videoUrl}
            onChange={setVideoUrl}
            eventTitle={title}
          />

          {/* Participants from conversation */}
          {conversationMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participants de la conversation
              </Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                {conversationMembers.map((member) => (
                  <label
                    key={member.user_id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors",
                      selectedParticipants.includes(member.user_id)
                        ? "bg-primary/10 border-primary"
                        : "bg-background hover:bg-muted"
                    )}
                  >
                    <Checkbox
                      checked={selectedParticipants.includes(member.user_id)}
                      onCheckedChange={() => toggleParticipant(member.user_id)}
                      className="sr-only"
                    />
                    <span className="text-sm">
                      {member.user?.prenom} {member.user?.nom}
                    </span>
                    {selectedParticipants.includes(member.user_id) && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        ✓
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Additional team members (not in conversation) */}
          {otherTeamMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Autres membres de l'équipe
              </Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                {otherTeamMembers.map((member) => (
                  <label
                    key={member.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors",
                      selectedParticipants.includes(member.id)
                        ? "bg-secondary/50 border-secondary"
                        : "bg-background hover:bg-muted"
                    )}
                  >
                    <Checkbox
                      checked={selectedParticipants.includes(member.id)}
                      onCheckedChange={() => toggleParticipant(member.id)}
                      className="sr-only"
                    />
                    <span className="text-sm">
                      {member.prenom} {member.nom}
                    </span>
                    {selectedParticipants.includes(member.id) && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        ✓
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="event-description">Description (optionnel)</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ordre du jour, notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={() => createEvent.mutate()}
            disabled={!title.trim() || !defaultCalendar || createEvent.isPending}
          >
            {createEvent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer la réunion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
