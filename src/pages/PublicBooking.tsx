import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Video,
  Phone,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from 'lucide-react';

import { toast } from 'sonner';
import { useBookingPageBySlug, useAvailableSlots, useCreateBooking } from '@/hooks/bookings/useBookings';
// PublicLayout is applied by App.tsx route, not needed here
import { BookingSidebar } from '@/components/booking/BookingSidebar';
import { BookingCalendar } from '@/components/booking/BookingCalendar';
import { TimeSlotPicker } from '@/components/booking/TimeSlotPicker';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import { getDetectedTimezone } from '@/components/booking/TimezoneSelector';
import { cn } from '@/lib/utils';
import type { BookingType, BookingFormData } from '@/types/booking';

const LOCATION_ICONS = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
};

type Step = 'type' | 'datetime' | 'details' | 'confirm' | 'success';

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<BookingType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [timezone, setTimezone] = useState(getDetectedTimezone());
  const [formData, setFormData] = useState<BookingFormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
  });

  const { data: pageData, isLoading } = useBookingPageBySlug(slug);

  // Co-host conflict checks are now handled server-side by the proxy.
  const requiredHostIds: string[] = [];

  const { data: availableSlots = [], isLoading: slotsLoading } = useAvailableSlots(
    pageData?.user_id,
    selectedType?.id,
    selectedDate,
    requiredHostIds,
    slug,
  );
  const availabilitySlots = (pageData as any)?.availability ?? [];
  const createBooking = useCreateBooking();

  // Get available days of week from availability slots
  const availableDays = useMemo<number[]>(() => {
    if (!availabilitySlots.length) return [1, 2, 3, 4, 5]; // Default Mon-Fri
    const days = new Set<number>(availabilitySlots.map((s: { day_of_week: number }) => s.day_of_week));
    return Array.from(days);
  }, [availabilitySlots]);

  const handleSelectType = (type: BookingType) => {
    setSelectedType(type);
    setStep('datetime');
  };

  const handleSelectDate = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSelectSlot = (slot: { start: string; end: string }) => {
    setSelectedSlot(slot);
  };

  const handleContinueToDetails = () => {
    if (!selectedSlot) {
      toast.error('Veuillez sélectionner un créneau horaire');
      return;
    }
    setStep('details');
  };

  const handleSubmitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error('Nom et email requis');
      return;
    }
    setStep('confirm');
  };

  const handleConfirmBooking = async () => {
    if (!selectedType || !selectedSlot || !pageData) return;

    try {
      await createBooking.mutateAsync({
        booking_type_id: selectedType.id,
        booking_page_id: pageData.id,
        host_user_id: pageData.user_id,
        guest_name: formData.name,
        guest_email: formData.email,
        guest_phone: formData.phone,
        guest_company: formData.company,
        guest_notes: formData.notes,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        timezone: timezone,
        slug,
      });

      setStep('success');
    } catch (error) {
      toast.error('Erreur lors de la réservation');
    }
  };

  const goBack = () => {
    switch (step) {
      case 'datetime':
        setStep('type');
        setSelectedType(null);
        break;
      case 'details':
        setStep('datetime');
        break;
      case 'confirm':
        setStep('details');
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-20 w-20 rounded-full mx-auto" />
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Page non trouvée</h1>
          <p className="text-muted-foreground">
            Cette page de réservation n'existe pas ou n'est plus active.
          </p>
        </div>
      </div>
    );
  }

  const host = pageData.host
    ? { id: '', nom: pageData.host.nom, prenom: pageData.host.prenom, avatar_url: pageData.host.avatar_url }
    : null;
  const bookingTypes = pageData.booking_types || [];

  // Success state - full page confirmation
  if (step === 'success' && selectedType && selectedSlot) {
    return (
      <div className="min-h-dvh flex items-center justify-center py-12 px-4">
        <BookingConfirmation
          bookingType={selectedType}
          selectedSlot={selectedSlot}
          formData={formData}
          hostName={host ? `${host.prenom} ${host.nom}` : undefined}
        />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-dvh bg-gradient-to-br from-background via-background to-muted/30">
        <div className="container max-w-6xl mx-auto py-8 px-4">
          {/* Split Screen Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
            {/* Left Sidebar - Always visible */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
                <CardContent className="p-6">
                  <BookingSidebar
                    host={host}
                    pageTitle={pageData.title}
                    pageDescription={pageData.description}
                    selectedType={selectedType}
                    selectedDate={selectedDate}
                    selectedSlot={selectedSlot}
                    formData={formData.name ? formData : undefined}
                    timezone={timezone}
                    onTimezoneChange={setTimezone}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Content Area */}
            <div>
              <Card className="shadow-lg border-0 bg-card/80 backdrop-blur min-h-[500px]">
                <CardContent className="p-6 lg:p-8">
                  {/* Step: Select Type */}
                  {step === 'type' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold">
                          Choisissez un type de rendez-vous
                        </h2>
                        <p className="text-muted-foreground mt-1">
                          Sélectionnez le type de rendez-vous qui vous convient
                        </p>
                      </div>
                      <div className="grid gap-3">
                        {bookingTypes.map((type) => {
                          const LocationIcon = LOCATION_ICONS[type.location_type] || Video;
                          return (
                            <Card 
                              key={type.id}
                              className={cn(
                                "cursor-pointer transition-all hover:border-primary hover:shadow-md",
                                "group"
                              )}
                              onClick={() => handleSelectType(type)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                  <div 
                                    className="w-1 h-full min-h-[60px] rounded-full self-stretch"
                                    style={{ backgroundColor: type.color }}
                                  />
                                  <div className="flex-1">
                                    <h3 className="font-medium group-hover:text-primary transition-colors">
                                      {type.name}
                                    </h3>
                                    {type.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {type.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-1.5">
                                        <Clock className="h-4 w-4" />
                                        {type.duration_minutes} min
                                      </span>
                                      <span className="flex items-center gap-1.5">
                                        <LocationIcon className="h-4 w-4" />
                                        {type.location_type === 'video' ? 'Visio' : 
                                         type.location_type === 'phone' ? 'Téléphone' : 'Présentiel'}
                                      </span>
                                    </div>
                                  </div>
                                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Step: Select Date & Time (Combined) */}
                  {step === 'datetime' && selectedType && (
                    <div className="space-y-6">
                      <Button variant="ghost" onClick={goBack} className="mb-2 -ml-2">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                      </Button>

                      <div>
                        <h2 className="text-xl font-semibold">
                          Sélectionnez une date et un horaire
                        </h2>
                        <p className="text-muted-foreground mt-1">
                          Choisissez le moment qui vous convient le mieux
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Calendar */}
                        <div className="flex justify-center md:justify-start">
                          <BookingCalendar
                            selected={selectedDate}
                            onSelect={handleSelectDate}
                            availableDays={availableDays}
                            maxFutureDays={selectedType.max_future_days}
                            minNoticeHours={selectedType.min_notice_hours}
                          />
                        </div>

                        {/* Time Slots */}
                        <div>
                          {selectedDate ? (
                            <TimeSlotPicker
                              slots={availableSlots}
                              selectedSlot={selectedSlot}
                              onSelectSlot={handleSelectSlot}
                              isLoading={slotsLoading}
                              date={selectedDate}
                              duration={selectedType.duration_minutes}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                              <Clock className="h-12 w-12 mb-3 opacity-30" />
                              <p>Sélectionnez une date pour voir les créneaux disponibles</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Continue Button */}
                      {selectedSlot && (
                        <div className="flex justify-end pt-4 border-t">
                          <Button onClick={handleContinueToDetails} size="lg">
                            Continuer
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step: Details Form */}
                  {step === 'details' && (
                    <div className="space-y-6 max-w-md">
                      <Button variant="ghost" onClick={goBack} className="mb-2 -ml-2">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                      </Button>

                      <div>
                        <h2 className="text-xl font-semibold">
                          Vos informations
                        </h2>
                        <p className="text-muted-foreground mt-1">
                          Renseignez vos coordonnées pour finaliser la réservation
                        </p>
                      </div>

                      <form onSubmit={handleSubmitDetails} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nom complet *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Jean Dupont"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="jean@exemple.com"
                            required
                          />
                        </div>
                        {pageData.require_phone && (
                          <div className="space-y-2">
                            <Label htmlFor="phone">Téléphone *</Label>
                            <Input
                              id="phone"
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              placeholder="+33 6 12 34 56 78"
                              required
                            />
                          </div>
                        )}
                        {pageData.require_company && (
                          <div className="space-y-2">
                            <Label htmlFor="company">Entreprise *</Label>
                            <Input
                              id="company"
                              value={formData.company}
                              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                              placeholder="Nom de votre entreprise"
                              required
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="notes">Notes (optionnel)</Label>
                          <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Y a-t-il quelque chose que vous aimeriez aborder ?"
                            rows={3}
                          />
                        </div>
                        <Button type="submit" className="w-full" size="lg">
                          Continuer
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  )}

                  {/* Step: Confirm */}
                  {step === 'confirm' && selectedType && selectedSlot && (
                    <div className="space-y-6 max-w-md">
                      <Button variant="ghost" onClick={goBack} className="mb-2 -ml-2">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                      </Button>

                      <div>
                        <h2 className="text-xl font-semibold">
                          Confirmez votre réservation
                        </h2>
                        <p className="text-muted-foreground mt-1">
                          Vérifiez les informations et confirmez votre rendez-vous
                        </p>
                      </div>

                      <Card className="bg-muted/50">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Nom</span>
                            <span className="font-medium">{formData.name}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Email</span>
                            <span className="font-medium">{formData.email}</span>
                          </div>
                          {formData.phone && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Téléphone</span>
                              <span className="font-medium">{formData.phone}</span>
                            </div>
                          )}
                          {formData.company && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Entreprise</span>
                              <span className="font-medium">{formData.company}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <p className="text-sm text-muted-foreground">
                        En confirmant, vous acceptez de recevoir des emails de confirmation et de rappel pour ce rendez-vous.
                      </p>

                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={handleConfirmBooking}
                        disabled={createBooking.isPending}
                      >
                        {createBooking.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Confirmation en cours...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Confirmer le rendez-vous
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
