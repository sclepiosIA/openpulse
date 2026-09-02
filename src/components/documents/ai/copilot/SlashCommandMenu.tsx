import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  getActionsForSurface,
  COPILOT_GROUP_LABEL,
  TRANSLATE_LANGUAGES,
  type CopilotAction,
  type CopilotSurface,
} from "./actions";
import { Languages } from "lucide-react";

interface SlashCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surface: CopilotSurface;
  hasSelection: boolean;
  onSelectAction: (action: CopilotAction, opts?: { language?: string }) => void;
  onFreePrompt?: (prompt: string) => void;
}

/**
 * Palette de commandes IA (Cmd/Ctrl+K).
 * - Sélectionne une action rapide ou tape une consigne libre → draft_from_prompt / continue_writing.
 */
export function SlashCommandMenu({
  open,
  onOpenChange,
  surface,
  hasSelection,
  onSelectAction,
  onFreePrompt,
}: SlashCommandMenuProps) {
  const [query, setQuery] = useState("");
  const [translateFor, setTranslateFor] = useState<CopilotAction | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTranslateFor(null);
    }
  }, [open]);

  const actions = useMemo(() => getActionsForSurface(surface), [surface]);
  const grouped = useMemo(() => {
    const map = new Map<CopilotAction["group"], CopilotAction[]>();
    for (const a of actions) {
      if (a.needsSelection && !hasSelection) continue;
      if (!map.has(a.group)) map.set(a.group, []);
      map.get(a.group)!.push(a);
    }
    return map;
  }, [actions, hasSelection]);

  const trimmedQuery = query.trim();
  const canFreePrompt =
    trimmedQuery.length > 3 && !!onFreePrompt && surface === "document";

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={
          translateFor
            ? "Choisir une langue…"
            : hasSelection
              ? "Rechercher une action ou taper une consigne…"
              : "Décrire un document à rédiger, ou choisir une action…"
        }
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {translateFor ? (
          <CommandGroup heading="Langue cible">
            {TRANSLATE_LANGUAGES.map((lang) => (
              <CommandItem
                key={lang.code}
                onSelect={() => {
                  onOpenChange(false);
                  onSelectAction(translateFor, { language: lang.code });
                }}
              >
                <Languages className="mr-2 h-4 w-4 text-muted-foreground" />
                {lang.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <>
            {canFreePrompt && (
              <>
                <CommandGroup heading="Rédiger avec IA">
                  <CommandItem
                    value={`__prompt__${trimmedQuery}`}
                    onSelect={() => {
                      onOpenChange(false);
                      onFreePrompt?.(trimmedQuery);
                    }}
                  >
                    ✨ Rédiger : « {trimmedQuery.slice(0, 60)}
                    {trimmedQuery.length > 60 ? "…" : ""} »
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandEmpty>Aucune action correspondante.</CommandEmpty>
            {[...grouped.entries()].map(([group, list]) => (
              <CommandGroup key={group} heading={COPILOT_GROUP_LABEL[group]}>
                {list.map((a) => {
                  const Icon = a.icon;
                  return (
                    <CommandItem
                      key={a.id}
                      value={`${a.label} ${a.description}`}
                      onSelect={() => {
                        if (a.id === "translate") {
                          setTranslateFor(a);
                          setQuery("");
                          return;
                        }
                        onOpenChange(false);
                        onSelectAction(a);
                      }}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{a.label}</span>
                      <span className="text-xs text-muted-foreground">{a.description}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
