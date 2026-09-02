import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useFindAvailableSlots } from '@/hooks/bookings/useFindAvailableSlots';
import { useProfiles } from '@/hooks/profile/useProfiles';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, Clock, CalendarPlus, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FindAvailableSlotProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectSlot?: (start: Date, end: Date) => void;
  onSlotSelected?: (slot: { start: Date; end: Date }) => void;
}

const DURATION_OPTIONS = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 heure' },
  { value: '90', label: '1h30' },
  { value: '120', label: '2 heures' },
  { value: '180', label: '3 heures' },
];

const RANGE_OPTIONS = [
  { value: '7', label: 'Cette semaine' },
  { value: '14', label: '2 semaines' },
  { value: '30', label: '1 mois' },
];

export function FindAvailableSlot({ 
  open: controlledOpen, 
  onOpenChange, 
  onSelectSlot,
  onSlotSelected 
}: FindAvailableSlotProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [duration, setDuration] = useState('60');
  const [searchRange, setSearchRange] = useState('14');
  const [includeWeekends, setIncludeWeekends] = useState(false);

  const { data: profiles } = useProfiles();

  const searchStartDate = useMemo(() => new Date(), []);
  const searchEndDate = useMemo(() => 
    addDays(new Date(), parseInt(searchRange)), 
    [searchRange]
  );

  const { slots, isLoading } = useFindAvailableSlots({
    participantUserIds: selectedParticipants,
    durationMinutes: parseInt(duration),
    searchStartDate,
    searchEndDate,
    includeWeekends,
    maxResults: 10,
  });

  const toggleParticipant = (id: string) => {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSelectSlot = (slot: { start: Date; end: Date }) => {
    onSelectSlot?.(slot.start, slot.end);
    onSlotSelected?.(slot);
    setOpen(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 100) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-amber-600 bg-amber-100';
    return 'text-muted-foreground bg-muted';
  };

  // Don't render trigger when open is controlled externally
  const isControlled = controlledOpen !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Trouver un créneau</span>
            <span className="sm:hidden">Créneau</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Trouver un créneau disponible
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Participants */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants
            </Label>
            <ScrollArea className="h-32 border rounded-md p-2">
              <div className="space-y-1">
                {profiles?.map(profile => (
                  <div
                    key={profile.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleParticipant(profile.user_id!)}
                  >
                    <Checkbox
                      checked={selectedParticipants.includes(profile.user_id!)}
                      onCheckedChange={() => toggleParticipant(profile.user_id!)}
                    />
                    <span className="text-sm">
                      {profile.prenom} {profile.nom}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedParticipants.map(id => {
                  const profile = profiles?.find(p => p.user_id === id);
                  return profile ? (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {profile.prenom}
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Durée
              </Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Période de recherche</Label>
              <Select value={searchRange} onValueChange={setSearchRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Include weekends */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="weekends"
              checked={includeWeekends}
              onCheckedChange={(checked) => setIncludeWeekends(!!checked)}
            />
            <Label htmlFor="weekends" className="text-sm cursor-pointer">
              Inclure les week-ends
            </Label>
          </div>

          {/* Results */}
          <div className="space-y-2">
            <Label>Créneaux disponibles</Label>
            
            {selectedParticipants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Sélectionnez des participants pour rechercher</p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-2 animate-pulse" />
                <p>Recherche en cours...</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Aucun créneau trouvé</p>
                <p className="text-xs mt-1">Essayez une période plus longue</p>
              </div>
            ) : (
              <ScrollArea className="h-48 border rounded-md">
                <div className="space-y-1 p-2">
                  {slots.map((slot) => (
                    <button
                      key={`slot-${slot.start.getTime()}-${slot.end.getTime()}`}
                      onClick={() => handleSelectSlot(slot)}
                      className="w-full flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <CalendarPlus className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium text-sm">
                            {format(slot.start, 'EEEE d MMMM', { locale: fr })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(slot.start, 'HH:mm')} - {format(slot.end, 'HH:mm')}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={cn('text-xs', getScoreColor(slot.score))}
                      >
                        {slot.score >= 100 ? 'Idéal' : slot.score >= 80 ? 'Bon' : 'OK'}
                      </Badge>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
