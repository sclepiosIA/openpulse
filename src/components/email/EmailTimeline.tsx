import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEmailTimeline, TimelinePeriod, InteractionType } from "@/hooks/email/useEmailTimeline";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Calendar as CalendarIcon,
  Mail,
  Send,
  Inbox,
  Paperclip,
  Clock,
  TrendingUp,
  Filter,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { sanitizeEmailSubject } from "@/lib/emailUtils";

interface EmailTimelineProps {
  etablissementId: string;
  etablissementNom: string;
  onThreadSelect: (threadId: string) => void;
}

export function EmailTimeline({ etablissementId, etablissementNom, onThreadSelect }: EmailTimelineProps) {
  const [period, setPeriod] = useState<TimelinePeriod>('30d');
  const [interactionType, setInteractionType] = useState<InteractionType>('all');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { data, isLoading } = useEmailTimeline(etablissementId, {
    period,
    interactionType,
    customStartDate,
    customEndDate,
  });

  const periodLabels: Record<TimelinePeriod, string> = {
    '7d': '7 derniers jours',
    '30d': '30 derniers jours',
    '90d': '90 derniers jours',
    'all': 'Toute la période',
    'custom': 'Période personnalisée',
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="flex items-center justify-center">
            <Clock className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Chargement de la timeline...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Timeline des conversations
              </CardTitle>
              <CardDescription>
                Évolution chronologique des échanges avec {etablissementNom}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {data.stats.totalEvents} événements
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Period filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Période:</span>
              {(['7d', '30d', '90d', 'all'] as TimelinePeriod[]).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setPeriod(p);
                    if (p !== 'custom') {
                      setCustomStartDate(undefined);
                      setCustomEndDate(undefined);
                    }
                  }}
                >
                  {periodLabels[p]}
                </Button>
              ))}
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant={period === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setPeriod('custom');
                      setShowDatePicker(true);
                    }}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {period === 'custom' && customStartDate && customEndDate
                      ? `${format(customStartDate, 'dd/MM')} - ${format(customEndDate, 'dd/MM')}`
                      : 'Personnalisé'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Date de début</p>
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Date de fin</p>
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => setShowDatePicker(false)}
                      disabled={!customStartDate || !customEndDate}
                    >
                      Appliquer
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Interaction type filters */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Type:</span>
              <Button
                variant={interactionType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInteractionType('all')}
              >
                <Mail className="mr-2 h-4 w-4" />
                Tous
              </Button>
              <Button
                variant={interactionType === 'sent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInteractionType('sent')}
              >
                <Send className="mr-2 h-4 w-4" />
                Envoyés
              </Button>
              <Button
                variant={interactionType === 'received' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInteractionType('received')}
              >
                <Inbox className="mr-2 h-4 w-4" />
                Reçus
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Mail className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{data.stats.totalEvents}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Send className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold">{data.stats.sentCount}</p>
            <p className="text-xs text-muted-foreground">Envoyés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Inbox className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="text-2xl font-bold">{data.stats.receivedCount}</p>
            <p className="text-xs text-muted-foreground">Reçus</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-amber-600" />
            <p className="text-2xl font-bold">{data.stats.unreadCount}</p>
            <p className="text-xs text-muted-foreground">Non lus</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Paperclip className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <p className="text-2xl font-bold">{data.stats.withAttachments}</p>
            <p className="text-xs text-muted-foreground">Pièces jointes</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {data.chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Évolution des échanges</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'dd/MM')}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'dd MMMM yyyy', { locale: fr })}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="sent" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  name="Envoyés"
                />
                <Line 
                  type="monotone" 
                  dataKey="received" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Reçus"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Timeline events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chronologie détaillée</CardTitle>
        </CardHeader>
        <CardContent>
          {data.events.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucun événement pour cette période</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
              
              {/* Events */}
              <div className="space-y-4">
                {data.events.map((event, index) => (
                  <div key={event.id} className="relative pl-12">
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute left-3 top-3 w-4 h-4 rounded-full border-2 border-background",
                      event.type === 'sent' ? 'bg-blue-500' : 'bg-green-500'
                    )} />
                    
                    {/* Event card */}
                    <Card 
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => onThreadSelect(event.thread_id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {event.type === 'sent' ? (
                                <Send className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              ) : (
                                <Inbox className="h-4 w-4 text-green-600 flex-shrink-0" />
                              )}
                              <h4 className="font-semibold text-sm truncate">{sanitizeEmailSubject(event.subject)}</h4>
                              {event.unread_count > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {event.unread_count} non lu{event.unread_count > 1 ? 's' : ''}
                                </Badge>
                              )}
                              {event.has_attachments && (
                                <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <span className="truncate">{event.participant}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true, locale: fr })}</span>
                              <span>•</span>
                              <span>{event.message_count} message{event.message_count > 1 ? 's' : ''}</span>
                            </div>
                            
                            {event.ai_summary && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {sanitizeEmailSubject(event.ai_summary)}
                              </p>
                            )}
                          </div>
                          
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
