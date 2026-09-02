import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react";
import {
  Sparkles,
  ChevronDown,
  Loader2,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COPILOT_ACTIONS,
  COPILOT_GROUP_LABEL,
  TRANSLATE_LANGUAGES,
  type CopilotAction,
} from "./actions";

interface FloatingSelectionBarProps {
  editor: Editor | null;
  isRunning: boolean;
  onRunAction: (action: CopilotAction, opts?: { language?: string }) => void;
}

/**
 * Barre flottante IA au-dessus d'une sélection de texte.
 * Regroupe les actions par catégorie et propose un sous-menu pour la traduction.
 */
export function FloatingSelectionBar({ editor, isRunning, onRunAction }: FloatingSelectionBarProps) {
  const [open, setOpen] = useState(false);
  if (!editor) return null;

  const selectionActions = COPILOT_ACTIONS.filter(
    (a) => a.needsSelection && a.surfaces.includes("document") && a.id !== "translate",
  );
  const grouped = new Map<CopilotAction["group"], CopilotAction[]>();
  for (const a of selectionActions) {
    if (!grouped.has(a.group)) grouped.set(a.group, []);
    grouped.get(a.group)!.push(a);
  }

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: "top" }}
      shouldShow={({ editor: e, from, to }) => {
        if (isRunning) return false;
        if (from === to) return false;
        if (!e.isEditable) return false;
        // évite l'affichage sur sélection dans un lien
        return true;
      }}
    >
      <div className="flex items-center gap-1 rounded-md border bg-background px-1 py-1 shadow-md">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs font-medium"
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              )}
              IA Copilot
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-h-[70vh] overflow-y-auto">
            {[...grouped.entries()].map(([group, actions], idx) => (
              <DropdownMenuGroup key={group}>
                {idx > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {COPILOT_GROUP_LABEL[group]}
                </DropdownMenuLabel>
                {actions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <DropdownMenuItem
                      key={a.id}
                      onSelect={() => {
                        setOpen(false);
                        onRunAction(a);
                      }}
                      className="gap-2 text-sm"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{a.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{a.description}</div>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 text-sm">
                <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                Traduire vers…
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-[60vh] overflow-y-auto">
                {TRANSLATE_LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onSelect={() => {
                      setOpen(false);
                      const translateAction = COPILOT_ACTIONS.find((a) => a.id === "translate");
                      if (translateAction) onRunAction(translateAction, { language: lang.code });
                    }}
                  >
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </BubbleMenu>
  );
}
