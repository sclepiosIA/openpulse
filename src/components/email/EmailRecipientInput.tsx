import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Plus, Users, UserCheck, Mail } from "lucide-react";
import { useEmailAutocomplete } from "@/hooks/email/useEmailAutocomplete";
import { cn } from "@/lib/utils";

interface EmailRecipientInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}

export function EmailRecipientInput({
  value,
  onChange,
  placeholder = "Ajouter un destinataire...",
  disabled = false,
  label,
}: EmailRecipientInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce : attendre 300ms après la dernière frappe
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: suggestions = [] } = useEmailAutocomplete(debouncedValue);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const addEmail = (email: string, name?: string) => {
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) return;
    
    if (!validateEmail(trimmedEmail)) {
      return;
    }
    
    if (value.includes(trimmedEmail)) {
      return;
    }
    
    onChange([...value, trimmedEmail]);
    setInputValue("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeEmail = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        addEmail(suggestions[0].email, suggestions[0].name);
      } else if (inputValue) {
        addEmail(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeEmail(value[value.length - 1]);
    }
  };

  const handleBlur = () => {
    // Auto-ajouter l'email valide quand l'utilisateur quitte le champ
    if (inputValue.trim() && validateEmail(inputValue.trim())) {
      addEmail(inputValue);
    }
  };

  useEffect(() => {
    if (debouncedValue.length >= 2 && suggestions.length > 0) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [debouncedValue, suggestions.length]);

  const getSourceIcon = (source: "contact" | "profile" | "history") => {
    switch (source) {
      case "profile":
        return <UserCheck className="h-3.5 w-3.5 text-primary" />;
      case "contact":
        return <Users className="h-3.5 w-3.5 text-success" />;
      case "history":
        return <Mail className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      
      {/* Recipient Badges */}
      {value.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {value.map((email) => (
            <Badge key={email} variant="secondary" className="gap-1">
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="hover:bg-accent rounded-full p-0.5"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input with autocomplete */}
      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              type="email"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1"
            />
            {inputValue && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addEmail(inputValue)}
                disabled={!validateEmail(inputValue) || disabled}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-2" align="start">
          <div className="text-xs text-muted-foreground mb-2 px-2">Suggestions</div>
          <ul className="max-h-[300px] overflow-y-auto">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.email}
                onClick={() => addEmail(suggestion.email, suggestion.name)}
                className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded cursor-pointer"
              >
                {getSourceIcon(suggestion.source)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {suggestion.name && (
                      <span className="font-medium text-sm">{suggestion.name}</span>
                    )}
                    <span className={cn(
                      "text-sm truncate",
                      suggestion.name ? "text-muted-foreground" : ""
                    )}>
                      {suggestion.email}
                    </span>
                  </div>
                  {suggestion.etablissement && (
                    <span className="text-xs text-muted-foreground">
                      {suggestion.etablissement}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
