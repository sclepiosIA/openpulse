import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, Edit, RotateCcw, X, MoreHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';

import {
  useUpdateBookingStatus,
  useRescheduleBooking,
  useCancelBooking,
  useUpdateBookingGuestInfo,
} from '@/hooks/bookings/useBookings';
import type { Booking } from '@/types/booking';
import { invokeEdge } from "@/services/edgeFunctions";
import { useQuery } from '@tanstack/react-query';

interface Props {
  booking: Booking & { booking_type?: { id: string; name: string; duration_minutes: number } };
}

export function BookingActionsMenu({ booking }: Props) {
  const [openReschedule, setOpenReschedule] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const updateStatus = useUpdateBookingStatus();
  const cancelBooking = useCancelBooking();
  const rescheduleBooking = useRescheduleBooking();
  const updateGuest = useUpdateBookingGuestInfo();

  const [cancelReason, setCancelReason] = useState('');
  const [editForm, setEditForm] = useState({
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_phone: booking.guest_phone || '',
    guest_notes: booking.guest_notes || '',
  });
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(
    parseISO(booking.start_time)
  );
  const [rescheduleSlot, setRescheduleSlot] = useState<{ start: string; end: string } | null>(null);

  // Fetch slot for the host directly (authenticated path)
  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['reschedule-slots', booking.host_user_id, booking.booking_type_id, rescheduleDate?.toISOString()],
    queryFn: async () => {
      if (!rescheduleDate || !booking.booking_type_id) return [];
      // Build slots from booking_availability_slots + existing bookings, in Paris TZ
      const dateStr = format(rescheduleDate, 'yyyy-MM-dd');
      try {
        const data = await invokeEdge<any>('public-booking-proxy', {
          action: 'get_slots_authenticated',
          host_user_id: booking.host_user_id,
          booking_type_id: booking.booking_type_id,
          date: dateStr,
          exclude_booking_id: booking.id,
        });
        return ((data as any)?.slots || []) as { start: string; end: string }[];
      } catch {
        return [];
      }
    },
    enabled: openReschedule && !!rescheduleDate,
  });

  const handleConfirm = () => {
    updateStatus.mutate({ id: booking.id, status: 'confirmed' });
  };

  const handleCancel = async () => {
    await cancelBooking.mutateAsync({ id: booking.id, reason: cancelReason });
    setOpenCancel(false);
    setCancelReason('');
  };

  const handleReschedule = async () => {
    if (!rescheduleSlot) return;
    await rescheduleBooking.mutateAsync({
      id: booking.id,
      start_time: rescheduleSlot.start,
      end_time: rescheduleSlot.end,
    });
    setOpenReschedule(false);
    setRescheduleSlot(null);
  };

  const handleEdit = async () => {
    await updateGuest.mutateAsync({
      id: booking.id,
      ...editForm,
      guest_phone: editForm.guest_phone || null,
      guest_notes: editForm.guest_notes || null,
    });
    setOpenEdit(false);
  };

  const isPast = new Date(booking.start_time) < new Date();
  const isCancelled = booking.status === 'cancelled';
  const isCompleted = booking.status === 'completed';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options" className="h-8 w-8 p-0 rounded-lg">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {!isCancelled && !isCompleted && booking.status === 'pending' && (
            <DropdownMenuItem onClick={handleConfirm}>
              <Check className="mr-2 h-4 w-4 text-emerald-600" />
              Confirmer
            </DropdownMenuItem>
          )}
          {!isCancelled && !isCompleted && !isPast && (
            <DropdownMenuItem onClick={() => setOpenReschedule(true)}>
              <RotateCcw className="mr-2 h-4 w-4 text-primary" />
              Reprogrammer
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setOpenEdit(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Modifier infos
          </DropdownMenuItem>
          {!isCancelled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setOpenCancel(true)}
                className="text-destructive focus:text-destructive"
              >
                <X className="mr-2 h-4 w-4" />
                Annuler
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* RESCHEDULE DIALOG */}
      <Dialog open={openReschedule} onOpenChange={setOpenReschedule}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reprogrammer le RDV</DialogTitle>
            <DialogDescription>
              Choisissez une nouvelle date et un créneau. Un email avec une nouvelle invitation sera envoyé à {booking.guest_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div>
              <Label className="mb-2 block">Date</Label>
              <Calendar
                mode="single"
                selected={rescheduleDate}
                onSelect={(d) => {
                  setRescheduleDate(d);
                  setRescheduleSlot(null);
                }}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                locale={fr}
                className="rounded-md border"
              />
            </div>
            <div>
              <Label className="mb-2 block">Créneau ({booking.booking_type?.duration_minutes || 30} min)</Label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucun créneau disponible ce jour
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {slots.map((s) => (
                      <Button
                        key={s.start}
                        variant={rescheduleSlot?.start === s.start ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRescheduleSlot(s)}
                        className="rounded-lg"
                      >
                        {format(parseISO(s.start), 'HH:mm')}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpenReschedule(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={!rescheduleSlot || rescheduleBooking.isPending}
            >
              {rescheduleBooking.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer la nouvelle date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CANCEL DIALOG */}
      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler le RDV</DialogTitle>
            <DialogDescription>
              {booking.guest_name} recevra un email d'annulation. Vous pouvez préciser un motif (optionnel).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Motif</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: empêchement de dernière minute…"
              rows={3}
              className="mt-1"
            />
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpenCancel(false)}>
              Retour
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelBooking.isPending}
            >
              {cancelBooking.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier les informations</DialogTitle>
            <DialogDescription>
              {booking.guest_name} recevra un email pour confirmer la mise à jour.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editForm.guest_name}
                onChange={(e) => setEditForm({ ...editForm, guest_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.guest_email}
                onChange={(e) => setEditForm({ ...editForm, guest_email: e.target.value })}
              />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input
                value={editForm.guest_phone}
                onChange={(e) => setEditForm({ ...editForm, guest_phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editForm.guest_notes}
                onChange={(e) => setEditForm({ ...editForm, guest_notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpenEdit(false)}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={updateGuest.isPending}>
              {updateGuest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
