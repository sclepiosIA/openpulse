import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import {
  CheckCircle2,
  Calendar,
  Clock,
  Mail,
  CalendarPlus,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BookingType, BookingFormData } from '@/types/booking';

interface BookingConfirmationProps {
  bookingType: BookingType;
  selectedSlot: { start: string; end: string };
  formData: BookingFormData;
  hostName?: string;
  className?: string;
}

export function BookingConfirmation({
  bookingType,
  selectedSlot,
  formData,
  hostName,
  className,
}: BookingConfirmationProps) {

  const startDate = parseISO(selectedSlot.start);
  const endDate = parseISO(selectedSlot.end);

  // Generate Google Calendar URL
  const generateGoogleCalendarUrl = () => {
    const title = encodeURIComponent(`${bookingType.name}${hostName ? ` avec ${hostName}` : ''}`);
    const dates = `${format(startDate, "yyyyMMdd'T'HHmmss")}/${format(endDate, "yyyyMMdd'T'HHmmss")}`;
    const details = encodeURIComponent(`Rendez-vous ${bookingType.name}\n\nParticipant: ${formData.name}\nEmail: ${formData.email}${formData.notes ? `\n\nNotes: ${formData.notes}` : ''}`);
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
  };

  // Generate Outlook URL
  const generateOutlookUrl = () => {
    const title = encodeURIComponent(`${bookingType.name}${hostName ? ` avec ${hostName}` : ''}`);
    const startDateStr = format(startDate, "yyyy-MM-dd'T'HH:mm:ss");
    const endDateStr = format(endDate, "yyyy-MM-dd'T'HH:mm:ss");
    const body = encodeURIComponent(`Rendez-vous ${bookingType.name}\n\nParticipant: ${formData.name}`);
    
    return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDateStr}&enddt=${endDateStr}&body=${body}`;
  };

  // Generate ICS file
  const downloadICS = () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Marque IA//Booking//FR
BEGIN:VEVENT
UID:${Date.now()}@exploitant.example.org
DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}
DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss")}
DTEND:${format(endDate, "yyyyMMdd'T'HHmmss")}
SUMMARY:${bookingType.name}${hostName ? ` avec ${hostName}` : ''}
DESCRIPTION:Participant: ${formData.name}\\nEmail: ${formData.email}${formData.notes ? `\\n\\nNotes: ${formData.notes}` : ''}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rendez-vous-${format(startDate, 'yyyy-MM-dd')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("max-w-lg mx-auto space-y-6", className)}>
      {/* Success Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative bg-green-100 dark:bg-green-900/30 rounded-full p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold">Réservation confirmée !</h1>
          <p className="text-muted-foreground mt-2">
            Un email de confirmation a été envoyé à <span className="font-medium">{formData.email}</span>
          </p>
        </div>
      </div>

      {/* Booking Details Card */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: bookingType.color }}
            />
            <CardTitle className="text-lg">{bookingType.name}</CardTitle>
          </div>
          {hostName && (
            <CardDescription>avec {hostName}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium capitalize">
                  {format(startDate, 'EEE d MMM', { locale: fr })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Heure</p>
                <p className="font-medium">
                  {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">Participant</p>
              <p className="font-medium truncate">{formData.name}</p>
              <p className="text-sm text-muted-foreground truncate">{formData.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add to Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarPlus className="h-4 w-4" />
            Ajouter à votre calendrier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.open(generateGoogleCalendarUrl(), '_blank')}
            >
              Google
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.open(generateOutlookUrl(), '_blank')}
            >
              Outlook
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1"
              onClick={downloadICS}
            >
              <Download className="h-3 w-3" />
              .ics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Notice */}
      <p className="text-center text-sm text-muted-foreground">
        Vous pouvez fermer cette page. 
        Un rappel vous sera envoyé 24h et 1h avant le rendez-vous.
      </p>
    </div>
  );
}
