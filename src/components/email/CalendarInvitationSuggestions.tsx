import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, MapPin, Clock, User, Check, X, AlertCircle, Video, CalendarPlus, ListTodo, Users } from 'lucide-react';
import { useCalendarSuggestions } from '@/hooks/calendar/useCalendarSuggestions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useQuery } from '@tanstack/react-query';
import { fetchEtablissementsLiteWithVille } from '@/services/etablissements/etablissementsLite';

function getVideoProviderInfo(url?: string): { name: string; color: string; icon: string } | null {
  if (!url) return null;
  
  if (url.includes('meet.google.com')) {
    return { name: 'Google Meet', color: 'bg-green-500', icon: '🎥' };
  }
  if (url.includes('teams.microsoft.com')) {
    return { name: 'Microsoft Teams', color: 'bg-blue-600', icon: '📹' };
  }
  if (url.includes('zoom.us')) {
    return { name: 'Zoom', color: 'bg-blue-500', icon: '🔵' };
  }
  if (url.includes('webex.com')) {
    return { name: 'Webex', color: 'bg-green-600', icon: '🟢' };
  }
  return { name: 'Visio', color: 'bg-purple-500', icon: '📹' };
}

export function CalendarInvitationSuggestions() {
  const { 
    suggestions, 
    isLoading, 
    acceptSuggestion, 
    acceptToCalendar,
    rejectSuggestion, 
    isAccepting, 
    isAcceptingToCalendar,
    isRejecting 
  } = useCalendarSuggestions();
  
  const [selectedEtablissements, setSelectedEtablissements] = useState<Record<string, string>>({});
  const [showTaskOptions, setShowTaskOptions] = useState<Record<string, boolean>>({});

  const { data: etablissements } = useQuery({
    queryKey: ['etablissements-list'],
    queryFn: async () => {
      return await fetchEtablissementsLiteWithVille();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Invitations visio en attente
          </CardTitle>
          <CardDescription>
            Chargement des invitations...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Ne rien afficher s'il n'y a pas d'invitations en attente
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Invitations visio en attente
        </CardTitle>
        <CardDescription>
          {suggestions.length} invitation{suggestions.length > 1 ? 's' : ''} en attente de traitement
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((suggestion) => {
          const eventDate = new Date(suggestion.event_dtstart);
          const eventEnd = suggestion.event_dtend ? new Date(suggestion.event_dtend) : null;
          const duration = eventEnd ? Math.round((eventEnd.getTime() - eventDate.getTime()) / 60000) : null;
          const videoProvider = getVideoProviderInfo(suggestion.event_meeting_link);
          const attendees = suggestion.event_attendees || [];

          return (
            <Card key={suggestion.id} className="border-l-4 border-l-primary overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {videoProvider && (
                        <Badge 
                          className={`${videoProvider.color} text-white shrink-0`}
                        >
                          {videoProvider.icon} {videoProvider.name}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="shrink-0">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        En attente
                      </Badge>
                    </div>
                    <CardTitle className="text-base truncate">{suggestion.event_summary}</CardTitle>
                    <CardDescription className="text-sm truncate">
                      📧 {suggestion.thread?.subject || 'N/A'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Event details */}
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>{format(eventDate, 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}</span>
                  </div>
                  {duration && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>{duration} minutes</span>
                    </div>
                  )}
                  {suggestion.event_location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{suggestion.event_location}</span>
                    </div>
                  )}
                  {suggestion.event_organizer && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate">{suggestion.event_organizer}</span>
                    </div>
                  )}
                </div>

                {/* Meeting link button */}
                {suggestion.event_meeting_link && (
                  <a 
                    href={suggestion.event_meeting_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Video className="h-4 w-4" />
                    Ouvrir le lien de la réunion
                  </a>
                )}

                {/* Attendees */}
                {attendees.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{attendees.length} participant{attendees.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attendees.slice(0, 5).map((attendee, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded-full">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {(attendee.name || attendee.email).substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[150px]">
                            {attendee.name || attendee.email}
                          </span>
                        </div>
                      ))}
                      {attendees.length > 5 && (
                        <span className="text-xs text-muted-foreground self-center">
                          +{attendees.length - 5} autres
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Thread summary */}
                {suggestion.thread_summary && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">📝 Contexte des échanges</p>
                    <p className="text-sm">{suggestion.thread_summary}</p>
                  </div>
                )}

                {/* Original description */}
                {suggestion.event_description && !suggestion.thread_summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {suggestion.event_description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-2 border-t">
                  {/* Primary action: Add to calendar */}
                  <Button
                    variant="default"
                    className="w-full"
                    disabled={isAcceptingToCalendar}
                    onClick={() => acceptToCalendar({ suggestionId: suggestion.id })}
                  >
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Ajouter à mon agenda
                  </Button>

                  {/* Secondary: Create task for establishment */}
                  <Collapsible
                    open={showTaskOptions[suggestion.id]}
                    onOpenChange={(open) => 
                      setShowTaskOptions(prev => ({ ...prev, [suggestion.id]: open }))
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <ListTodo className="h-4 w-4 mr-2" />
                        Créer une tâche pour un établissement
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-2">
                      <Select
                        value={selectedEtablissements[suggestion.id] || ''}
                        onValueChange={(value) => 
                          setSelectedEtablissements(prev => ({ ...prev, [suggestion.id]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un établissement" />
                        </SelectTrigger>
                        <SelectContent>
                          {etablissements?.map((etab) => (
                            <SelectItem key={etab.id} value={etab.id}>
                              {etab.nom} - {etab.ville}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        disabled={!selectedEtablissements[suggestion.id] || isAccepting}
                        onClick={() => {
                          if (selectedEtablissements[suggestion.id]) {
                            acceptSuggestion({
                              suggestionId: suggestion.id,
                              etablissementId: selectedEtablissements[suggestion.id]
                            });
                          }
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Créer la tâche
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Reject button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={isRejecting}
                    onClick={() => rejectSuggestion(suggestion.id)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Ignorer cette invitation
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
