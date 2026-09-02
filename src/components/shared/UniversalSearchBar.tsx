import { useState, useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Search,
  User,
  Building,
  Mail,
  Calendar,
  MessageCircle,
  CheckSquare,
  FileText,
  Users,
  Layers,
} from "lucide-react";
import { useGlobalSearch } from "@/hooks/search/useGlobalSearch";
import { useRolePermissions } from "@/hooks/auth/useRolePermissions";
import { useNavigate } from "react-router-dom";

export function UniversalSearchBar() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const permissions = useRolePermissions();

  // Map permissions to search permissions format
  const searchPermissions = {
    canViewAllEtablissements: permissions.canViewAllEtablissements,
    canViewAllEmails: permissions.canViewAllEmails,
    canViewSharedEmails: permissions.canViewSharedEmails,
    canViewRHDocuments: permissions.canViewRHDocuments,
    canViewCalendar: permissions.canViewCalendar,
    viewScope: permissions.viewScope,
  };

  const { results, isLoading } = useGlobalSearch(search, true, searchPermissions);

  // Ouvrir avec Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const hasResults =
    results.profiles.length > 0 ||
    results.etablissements.length > 0 ||
    results.emails.length > 0 ||
    results.events.length > 0 ||
    results.pulseMessages.length > 0 ||
    results.taches.length > 0 ||
    results.contacts.length > 0 ||
    results.groupes.length > 0 ||
    results.documents.length > 0;

  const handleSelect = (href: string) => {
    setOpen(false);
    setSearch("");
    navigate(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors border rounded-md hover:bg-muted/50"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Recherche globale</span>
        <kbd className="hidden sm:inline pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Rechercher partout (établissements, emails, calendrier, Pulse...)"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {!search && (
            <CommandEmpty>Commencez à taper pour rechercher...</CommandEmpty>
          )}
          {search && !hasResults && !isLoading && (
            <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          )}
          {search && isLoading && (
            <CommandEmpty>Recherche en cours...</CommandEmpty>
          )}

          {/* Employés */}
          {results.profiles.length > 0 && (
            <CommandGroup heading="Employés">
              {results.profiles.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.href)}
                >
                  <User className="mr-2 h-4 w-4 text-blue-500" />
                  <span>{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {item.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Établissements */}
          {results.etablissements.length > 0 && (
            <CommandGroup heading="Établissements">
              {results.etablissements.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.href)}
                >
                  <Building className="mr-2 h-4 w-4 text-emerald-500" />
                  <span>{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      - {item.subtitle}
                    </span>
                  )}
                  {item.badge && (
                    <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Événements Calendrier */}
          {results.events.length > 0 && (
            <CommandGroup heading="Événements">
              {results.events.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.href)}
                >
                  <Calendar className="mr-2 h-4 w-4 text-orange-500" />
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                  {item.badge && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      📍 {item.badge}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Messages Pulse */}
          {results.pulseMessages.length > 0 && (
            <CommandGroup heading="Messages Pulse">
              {results.pulseMessages.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.href)}
                >
                  <MessageCircle className="mr-2 h-4 w-4 text-purple-500" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  </div>
                  {item.badge && (
                    <span className="ml-2 text-xs text-muted-foreground shrink-0">
                      {item.badge}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Emails */}
          {results.emails.length > 0 && (
            <CommandGroup heading="Emails">
              {results.emails.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.href)}
                >
                  <Mail className="mr-2 h-4 w-4 text-sky-500" />
                  <span className="truncate">{item.title}</span>
                  {item.badge && (
                    <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Tâches */}
          {results.taches.length > 0 && (
            <CommandGroup heading="Tâches">
              {results.taches.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.href)}
                >
                  <CheckSquare className="mr-2 h-4 w-4 text-amber-500" />
                  <span>{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {item.subtitle}
                    </span>
                  )}
                  {item.badge && (
                    <span className="ml-auto text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Contacts */}
          {results.contacts.length > 0 && (
            <CommandGroup heading="Contacts">
              {results.contacts.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.href)}
                >
                  <Users className="mr-2 h-4 w-4 text-pink-500" />
                  <span>{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {item.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Groupes */}
          {results.groupes.length > 0 && (
            <CommandGroup heading="Groupes">
              {results.groupes.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.href)}
                >
                  <Layers className="mr-2 h-4 w-4 text-indigo-500" />
                  <span>{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {item.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Documents RH */}
          {results.documents.length > 0 && (
            <CommandGroup heading="Documents RH">
              {results.documents.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.href)}
                >
                  <FileText className="mr-2 h-4 w-4 text-teal-500" />
                  <span>{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {item.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
