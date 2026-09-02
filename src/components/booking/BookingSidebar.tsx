import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TimezoneSelector } from './TimezoneSelector';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  User,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BookingType, BookingFormData } from '@/types/booking';

const LOCATION_ICONS = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
};

const LOCATION_LABELS = {
  video: 'Visioconférence',
  phone: 'Appel téléphonique',
  in_person: 'En personne',
};

interface BookingSidebarProps {
  host?: {
    id: string;
    nom: string;
    prenom: string;
    avatar_url: string | null;
  } | null;
  pageTitle: string;
  pageDescription?: string | null;
  selectedType?: BookingType | null;
  selectedDate?: Date;
  selectedSlot?: { start: string; end: string } | null;
  formData?: BookingFormData;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  className?: string;
}

export function BookingSidebar({
  host,
  pageTitle,
  pageDescription,
  selectedType,
  selectedDate,
  selectedSlot,
  formData,
  timezone,
  onTimezoneChange,
  className,
}: BookingSidebarProps) {
  const LocationIcon = selectedType ? LOCATION_ICONS[selectedType.location_type] : Video;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Host Info */}
      <div className="text-center lg:text-left">
        {host && (
          <div className="flex flex-col lg:flex-row items-center gap-4 mb-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={host.avatar_url || undefined} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {host.prenom?.[0]}{host.nom?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">
                {host.prenom} {host.nom}
              </p>
              <p className="text-sm text-muted-foreground">Organisateur</p>
            </div>
          </div>
        )}
        <h1 className="text-xl font-bold">{pageTitle}</h1>
        {pageDescription && (
          <p className="text-sm text-muted-foreground mt-2">{pageDescription}</p>
        )}
      </div>

      <Separator />

      {/* Selected Type */}
      {selectedType && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div
                className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: selectedType.color }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{selectedType.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {selectedType.duration_minutes} min
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <LocationIcon className="h-3 w-3" />
                    {LOCATION_LABELS[selectedType.location_type]}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Date & Time */}
      {(selectedDate || selectedSlot) && (
        <div className="space-y-3">
          {selectedDate && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium capitalize">
                  {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
                </p>
                <p className="text-muted-foreground">
                  {format(selectedDate, 'yyyy')}
                </p>
              </div>
            </div>
          )}
          {selectedSlot && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {format(parseISO(selectedSlot.start), 'HH:mm')} - {format(parseISO(selectedSlot.end), 'HH:mm')}
                </p>
                <p className="text-muted-foreground">
                  {selectedType?.duration_minutes} minutes
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guest Info Preview */}
      {formData?.name && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Vos informations</p>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{formData.name}</span>
            </div>
            {formData.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="ml-6">{formData.email}</span>
              </div>
            )}
            {formData.company && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{formData.company}</span>
              </div>
            )}
          </div>
        </>
      )}

      <Separator />

      {/* Timezone Selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Fuseau horaire</p>
        <TimezoneSelector
          value={timezone}
          onChange={onTimezoneChange}
          className="w-full"
        />
      </div>
    </div>
  );
}
