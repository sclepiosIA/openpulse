import { useState } from 'react';
import { debug } from '@/lib/debug';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAvailabilities, CreateAvailabilityInput } from '@/hooks/bookings/useAvailabilities';
import { format, setHours, setMinutes, addHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Clock, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvailabilityQuickAddProps {
  defaultDate?: Date;
  onSuccess?: () => void;
}

const AVAILABILITY_TYPES = [
  { value: 'unavailable', label: 'Indisponible', color: 'bg-red-500' },
  { value: 'busy', label: 'Occupé', color: 'bg-amber-500' },
  { value: 'tentative', label: 'Tentative', color: 'bg-blue-500' },
];

const QUICK_DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h', minutes: 240 },
  { label: 'Journée', minutes: 480 },
];

export function AvailabilityQuickAdd({ defaultDate, onSuccess }: AvailabilityQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(defaultDate || new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [type, setType] = useState<'unavailable' | 'busy' | 'tentative'>('unavailable');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  
  const { createAvailability, isCreating } = useAvailabilities();

  const handleQuickDuration = (minutes: number) => {
    const [hours, mins] = startTime.split(':').map(Number);
    const startDate = setMinutes(setHours(new Date(), hours), mins);
    const endDate = addHours(startDate, minutes / 60);
    setEndTime(format(endDate, 'HH:mm'));
  };

  const handleSubmit = async () => {
    const [startHours, startMins] = startTime.split(':').map(Number);
    const [endHours, endMins] = endTime.split(':').map(Number);
    
    const start = setMinutes(setHours(selectedDate, startHours), startMins);
    const end = setMinutes(setHours(selectedDate, endHours), endMins);

    const input: CreateAvailabilityInput = {
      title: title || 'Indisponible',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      type,
      notes: notes || undefined,
    };

    try {
      await createAvailability(input);
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      debug.error('Error creating availability:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setStartTime('09:00');
    setEndTime('10:00');
    setType('unavailable');
    setSelectedDate(new Date());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Ban className="h-4 w-4" />
          <span className="hidden sm:inline">Marquer indisponible</span>
          <span className="sm:hidden">Indispo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une indisponibilité</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITY_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', t.color)} />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Titre (optionnel)</Label>
            <Input
              placeholder="Ex: Rendez-vous médical"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Début</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fin</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Quick duration buttons */}
          <div className="flex flex-wrap gap-2">
            {QUICK_DURATIONS.map(d => (
              <Button
                key={d.label}
                variant="outline"
                size="sm"
                onClick={() => handleQuickDuration(d.minutes)}
              >
                {d.label}
              </Button>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optionnel)</Label>
            <Textarea
              placeholder="Détails supplémentaires..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button 
            onClick={handleSubmit} 
            className="w-full" 
            disabled={isCreating}
          >
            {isCreating ? 'Création...' : 'Ajouter'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
