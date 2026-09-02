import { LayoutDashboard, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type PrevisionnelSubTabValue = 'resume' | 'jour' | 'previsionnel';

interface PrevisionnelSubTabsProps {
  value: PrevisionnelSubTabValue;
  onValueChange: (value: PrevisionnelSubTabValue) => void;
}

const TABS: { value: PrevisionnelSubTabValue; label: string; icon: typeof LayoutDashboard }[] = [
  { value: 'resume', label: 'Résumé', icon: LayoutDashboard },
  { value: 'jour', label: 'Trésorerie jour', icon: Calendar },
  { value: 'previsionnel', label: 'Trésorerie prévisionnelle', icon: TrendingUp },
];

export function PrevisionnelSubTabs({ value, onValueChange }: PrevisionnelSubTabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = value === tab.value;
        
        return (
          <button
            key={tab.value}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
