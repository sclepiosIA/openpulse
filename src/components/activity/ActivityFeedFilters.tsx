import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { X, Search, Users, Building2, CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ACTIVITY_TYPE_LABELS, type ActivityFeedFilters, type ActivityType } from '@/types/activity';
import { cn } from '@/lib/utils';
import { fetchActivityTeam, fetchActivityEtablissements } from '@/services/activity/activityFilters';
import { useQuery } from '@tanstack/react-query';

interface Props {
  filters: ActivityFeedFilters;
  onChange: (next: ActivityFeedFilters) => void;
  /** Masque le sélecteur "Établissements" — utile quand la timeline est déjà scopée à un établissement (Vague 3). */
  hideEtablissementFilter?: boolean;
}

const TYPES = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];

function useTeam() {
  return useQuery({
    queryKey: ['activity-filter-team'],
    staleTime: 5 * 60_000,
    queryFn: fetchActivityTeam,
  });
}

function useEtabs() {
  return useQuery({
    queryKey: ['activity-filter-etabs'],
    staleTime: 5 * 60_000,
    queryFn: fetchActivityEtablissements,
  });
}

export function ActivityFeedFilters({ filters, onChange, hideEtablissementFilter = false }: Props) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const { data: team = [] } = useTeam();
  const { data: etabs = [] } = useEtabs();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.search ?? '') !== searchInput) {
        onChange({ ...filters, search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const selectedTypes = filters.types ?? [];
  const selectedUsers = filters.user_ids ?? [];
  const selectedEtabs = filters.etablissement_ids ?? [];

  const toggleType = (t: ActivityType) => {
    const next = selectedTypes.includes(t) ? selectedTypes.filter((x) => x !== t) : [...selectedTypes, t];
    onChange({ ...filters, types: next.length ? next : undefined });
  };
  const toggleUser = (id: string) => {
    const next = selectedUsers.includes(id) ? selectedUsers.filter((x) => x !== id) : [...selectedUsers, id];
    onChange({ ...filters, user_ids: next.length ? next : undefined });
  };
  const toggleEtab = (id: string) => {
    const next = selectedEtabs.includes(id) ? selectedEtabs.filter((x) => x !== id) : [...selectedEtabs, id];
    onChange({ ...filters, etablissement_ids: next.length ? next : undefined });
  };

  const dateFrom = filters.date_from ? new Date(filters.date_from) : undefined;
  const dateTo = filters.date_to ? new Date(filters.date_to) : undefined;

  const hasFilters =
    !!filters.types?.length || !!filters.user_ids?.length || !!filters.etablissement_ids?.length ||
    !!filters.date_from || !!filters.date_to || !!filters.search;

  return (
    <div className="space-y-3">
      {/* Row 1: search + multi-selects */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher (titre, description, établissement, auteur)…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        {/* Users */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Utilisateurs {selectedUsers.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1.5">{selectedUsers.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Rechercher un utilisateur…" />
              <CommandList>
                <CommandEmpty>Aucun résultat</CommandEmpty>
                <CommandGroup>
                  {team.map((u) => (
                    <CommandItem key={u.id} onSelect={() => toggleUser(u.id)}>
                      <input type="checkbox" checked={selectedUsers.includes(u.id)} readOnly className="mr-2" />
                      {u.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Etablissements */}
        {!hideEtablissementFilter && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Établissements {selectedEtabs.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1.5">{selectedEtabs.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Rechercher un établissement…" />
              <CommandList className="max-h-72">
                <CommandEmpty>Aucun résultat</CommandEmpty>
                <CommandGroup>
                  {etabs.map((e) => (
                    <CommandItem key={e.id} onSelect={() => toggleEtab(e.id)}>
                      <input type="checkbox" checked={selectedEtabs.includes(e.id)} readOnly className="mr-2" />
                      {e.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        )}

        {/* Date range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              {dateFrom || dateTo ? (
                <>{dateFrom ? format(dateFrom, 'dd/MM/yy', { locale: fr }) : '…'} → {dateTo ? format(dateTo, 'dd/MM/yy', { locale: fr }) : '…'}</>
              ) : 'Période'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateFrom, to: dateTo }}
              onSelect={(range: any) => {
                onChange({
                  ...filters,
                  date_from: range?.from ? range.from.toISOString() : undefined,
                  date_to: range?.to ? range.to.toISOString() : undefined,
                });
              }}
              numberOfMonths={2}
              locale={fr}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearchInput(''); onChange({}); }}
            className="h-9 text-xs"
          >
            <X className="h-3 w-3 mr-1" /> Tout effacer
          </Button>
        )}
      </div>

      {/* Row 2: type chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
        {TYPES.map((t) => {
          const active = selectedTypes.includes(t);
          return (
            <Badge
              key={t}
              variant={active ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer hover:bg-primary/10 transition-colors text-[11px]',
                active && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
              onClick={() => toggleType(t)}
            >
              {ACTIVITY_TYPE_LABELS[t]}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
