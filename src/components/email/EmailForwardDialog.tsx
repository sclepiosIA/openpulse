import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, User, Building2, Clock, Loader2 } from "lucide-react";
import { useEmailAutocomplete, EmailSuggestion } from "@/hooks/email/useEmailAutocomplete";
import { useDebounce } from "@/hooks/shared/useDebounce";
import { cn } from "@/lib/utils";

interface EmailForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onForward: (toAddresses: string[], additionalContent?: string) => void;
  isForwarding?: boolean;
}

export function EmailForwardDialog({ 
  open, 
  onOpenChange, 
  onForward, 
  isForwarding 
}: EmailForwardDialogProps) {
  const [toAddresses, setToAddresses] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [additionalContent, setAdditionalContent] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounce query for autocomplete
  const debouncedQuery = useDebounce(currentEmail, 300);
  const { data: suggestions, isLoading } = useEmailAutocomplete(debouncedQuery);

  // Filter out already added addresses
  const filteredSuggestions = suggestions?.filter(
    s => !toAddresses.includes(s.email)
  ) || [];

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredSuggestions.length]);

  // Show suggestions when we have results
  useEffect(() => {
    setShowSuggestions(filteredSuggestions.length > 0 && currentEmail.length >= 2);
  }, [filteredSuggestions.length, currentEmail]);

  const handleAddEmail = (email?: string) => {
    const emailToAdd = email || currentEmail.trim();
    if (emailToAdd && !toAddresses.includes(emailToAdd)) {
      setToAddresses([...toAddresses, emailToAdd]);
      setCurrentEmail("");
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: EmailSuggestion) => {
    handleAddEmail(suggestion.email);
    inputRef.current?.focus();
  };

  const handleRemoveEmail = (email: string) => {
    setToAddresses(toAddresses.filter(e => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSuggestions[selectedIndex]) {
          handleSelectSuggestion(filteredSuggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleForward = () => {
    if (toAddresses.length > 0) {
      onForward(toAddresses, additionalContent || undefined);
      setToAddresses([]);
      setCurrentEmail("");
      setAdditionalContent("");
      onOpenChange(false);
    }
  };

  const getSourceIcon = (source: EmailSuggestion['source']) => {
    switch (source) {
      case 'profile':
        return <User className="h-3.5 w-3.5 text-primary" />;
      case 'contact':
        return <Building2 className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />;
      case 'history':
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getSourceLabel = (source: EmailSuggestion['source']) => {
    switch (source) {
      case 'profile':
        return 'Équipe';
      case 'contact':
        return 'Contact';
      case 'history':
        return 'Historique';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transférer l'email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Destinataires</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  type="email"
                  placeholder="Rechercher un contact ou saisir un email..."
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (filteredSuggestions.length > 0 && currentEmail.length >= 2) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  className="pr-8"
                />
                {isLoading && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* Suggestions dropdown */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto"
                  >
                    {filteredSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.email}
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className={cn(
                          "w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-accent transition-colors",
                          index === selectedIndex && "bg-accent"
                        )}
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          {getSourceIcon(suggestion.source)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {suggestion.name || suggestion.email}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {getSourceLabel(suggestion.source)}
                            </span>
                          </div>
                          {suggestion.name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {suggestion.email}
                              {suggestion.etablissement && (
                                <span className="ml-1">• {suggestion.etablissement}</span>
                              )}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button 
                type="button" 
                size="sm" 
                onClick={() => handleAddEmail()}
                disabled={!currentEmail.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {toAddresses.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {toAddresses.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm"
                  >
                    {email}
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional-content">Message additionnel (optionnel)</Label>
            <Textarea
              id="additional-content"
              placeholder="Ajoutez un message qui sera ajouté avant l'email transféré..."
              value={additionalContent}
              onChange={(e) => setAdditionalContent(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isForwarding}>
            Annuler
          </Button>
          <Button 
            onClick={handleForward} 
            disabled={toAddresses.length === 0 || isForwarding}
          >
            {isForwarding ? "Transfert en cours..." : "Transférer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
