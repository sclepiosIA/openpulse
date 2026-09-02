import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
}

interface CompactStatsProps {
  items: StatItem[];
  className?: string;
}

export function CompactStats({ items, className }: CompactStatsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-4 text-sm", className)}>
      {items.map((item, index) => (
        <div key={item.label || `stat-${index}`} className="flex items-center gap-2">
          {item.icon && (
            <span className={cn("flex-shrink-0", item.color)}>{item.icon}</span>
          )}
          <span className="text-muted-foreground">{item.label}:</span>
          <span className={cn("font-semibold", item.color)}>{item.value}</span>
          {index < items.length - 1 && (
            <span className="text-muted-foreground/50">|</span>
          )}
        </div>
      ))}
    </div>
  );
}
