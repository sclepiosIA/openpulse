import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/shared/useDebounce';
import { useAttendeeSearch, AttendeeSearchResult } from '@/hooks/search/useAttendeeSearch';
import { SelectedAttendee } from '@/types/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Users, User, Building2, FolderTree, X, Plus, Mail, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendeesSelectorProps {
  value: SelectedAttendee[];
  onChange: (attendees: SelectedAttendee[]) => void;
}

export function AttendeesSelector({ value, onChange }: AttendeesSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: searchResults = [], isLoading } = useAttendeeSearch(debouncedSearch);

  // Get selected emails for visual indicator
  const selectedEmails = useMemo(() => 
    new Set(value.map(a => a.email.toLowerCase())), 
    [value]
  );

  // Check if an email is already selected
  const isSelected = (email: string) => selectedEmails.has(email.toLowerCase());

  // Group results by type
  const profileResults = searchResults.filter(r => r.type === 'profile');
  const contactResults = searchResults.filter(r => r.type === 'contact');

  const handleSelectResult = (result: AttendeeSearchResult) => {
    // Toggle selection - if already selected, remove; otherwise add
    if (isSelected(result.email)) {
      onChange(value.filter(a => a.email.toLowerCase() !== result.email.toLowerCase()));
    } else {
      const newAttendee: SelectedAttendee = {
        email: result.email,
        displayName: result.displayName,
        userId: result.userId,
        role: 'required',
      };
      onChange([...value, newAttendee]);
    }
    // Keep popover open for multi-selection
  };

  const handleRemoveAttendee = (email: string) => {
    onChange(value.filter(a => a.email !== email));
  };

  const handleAddManualEmail = () => {
    const email = manualEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    
    // Check not already added
    if (value.some(a => a.email.toLowerCase() === email)) {
      setManualEmail('');
      return;
    }

    const newAttendee: SelectedAttendee = {
      email,
      displayName: email,
      role: 'required',
    };
    onChange([...value, newAttendee]);
    setManualEmail('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddManualEmail();
    }
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        Invités
      </Label>

      {/* Search Field */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              placeholder="Rechercher un contact ou membre..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length >= 2) setOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.length >= 2) setOpen(true);
              }}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command shouldFilter={false}>
            <CommandList>
              {isLoading && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Recherche...
                </div>
              )}
              
              {!isLoading && searchResults.length === 0 && searchQuery.length >= 2 && (
                <CommandEmpty>Aucun résultat trouvé</CommandEmpty>
              )}

              {profileResults.length > 0 && (
                <CommandGroup heading="Équipe">
                  {profileResults.map((result) => {
                    const selected = isSelected(result.email);
                    return (
                      <CommandItem
                        key={result.id}
                        value={result.email}
                        onSelect={() => handleSelectResult(result)}
                        className={cn("cursor-pointer", selected && "bg-primary/5")}
                      >
                        <div className="flex items-start gap-3 py-1 w-full">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full",
                            selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                          )}>
                            {selected ? <Check className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                            {result.fonction && (
                              <p className="text-xs text-muted-foreground">{result.fonction}</p>
                            )}
                          </div>
                          {selected && (
                            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-2" />
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {contactResults.length > 0 && (
                <CommandGroup heading="Contacts">
                  {contactResults.map((result) => {
                    const selected = isSelected(result.email);
                    return (
                      <CommandItem
                        key={result.id}
                        value={result.email}
                        onSelect={() => handleSelectResult(result)}
                        className={cn("cursor-pointer", selected && "bg-amber-500/5")}
                      >
                        <div className="flex items-start gap-3 py-1 w-full">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full",
                            selected ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-600"
                          )}>
                            {selected ? <Check className="h-4 w-4" /> : (result.groupe ? <FolderTree className="h-4 w-4" /> : <Building2 className="h-4 w-4" />)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {result.fonction && <span>{result.fonction}</span>}
                              {result.fonction && (result.etablissement || result.groupe) && <span>·</span>}
                              {result.etablissement && <span>{result.etablissement}</span>}
                              {result.groupe && <span>{result.groupe}</span>}
                            </div>
                          </div>
                          {selected && (
                            <Check className="h-4 w-4 text-amber-600 flex-shrink-0 mt-2" />
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Attendees */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((attendee) => (
            <Badge
              key={attendee.email}
              variant="secondary"
              className={cn(
                "flex items-center gap-1 pl-2 pr-1 py-1",
                attendee.userId ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-700"
              )}
            >
              {attendee.userId ? (
                <User className="h-3 w-3" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              <span className="max-w-[150px] truncate">{attendee.displayName}</span>
              <button
                type="button"
                onClick={() => handleRemoveAttendee(attendee.email)}
                className="ml-1 rounded-full p-0.5 hover:bg-black/10"
                aria-label={`Retirer ${attendee.displayName}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Manual Email Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Ajouter un email externe..."
          value={manualEmail}
          onChange={(e) => setManualEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          type="email"
        />
        <button
          type="button"
          onClick={handleAddManualEmail}
          disabled={!manualEmail.includes('@')}
          aria-label="Ajouter cet email"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md border transition-colors",
            manualEmail.includes('@')
              ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
              : "border-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
