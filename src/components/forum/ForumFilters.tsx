import { Badge } from "@/components/ui/badge";
import { FileBarChart, Heart, AlertCircle, FileCheck, Mic, Lightbulb, Bug, HelpCircle, MoreHorizontal, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ForumFiltersProps {
  selectedTheme: string | null;
  onThemeSelect: (theme: string | null) => void;
  themeCounts: Record<string, number>;
}

// Type strict pour les icônes de thème
const themeIcons: Record<string, LucideIcon> = {
  "pmsi": FileBarChart,
  "smr": Heart,
  "urgences": AlertCircle,
  "completion_dossier": FileCheck,
  "dictee_vocale": Mic,
  "astuces": Lightbulb,
  "bugs": Bug,
  "support": HelpCircle,
  "autre": MoreHorizontal
};

const themeLabels: Record<string, string> = {
  pmsi: "PMSI",
  smr: "SMR",
  urgences: "Urgences",
  completion_dossier: "Complétion dossier",
  dictee_vocale: "Dictée vocale",
  astuces: "Astuces",
  bugs: "Bugs",
  support: "Support",
  autre: "Autre"
};

const themes = [
  "pmsi",
  "smr",
  "urgences",
  "completion_dossier",
  "dictee_vocale",
  "astuces",
  "bugs",
  "support",
  "autre"
];

export function ForumFilters({ selectedTheme, onThemeSelect, themeCounts }: ForumFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant={selectedTheme === null ? "default" : "outline"}
        className={cn(
          "cursor-pointer transition-all hover:scale-105",
          selectedTheme === null && "shadow-sm"
        )}
        onClick={() => onThemeSelect(null)}
      >
        Tous
        <span className="ml-1.5 text-xs opacity-70">
          ({Object.values(themeCounts).reduce((sum, count) => sum + count, 0)})
        </span>
      </Badge>
      
      {themes.map((theme) => {
        const Icon = themeIcons[theme];
        const count = themeCounts[theme] || 0;
        const isSelected = selectedTheme === theme;
        
        return (
          <Badge
            key={theme}
            variant={isSelected ? "default" : "outline"}
            className={cn(
              "cursor-pointer transition-all hover:scale-105 flex items-center gap-1.5",
              isSelected && "shadow-sm"
            )}
            onClick={() => onThemeSelect(theme)}
          >
            <Icon className="h-3 w-3" />
            {themeLabels[theme]}
            <span className="ml-1 text-xs opacity-70">({count})</span>
          </Badge>
        );
      })}
    </div>
  );
}
