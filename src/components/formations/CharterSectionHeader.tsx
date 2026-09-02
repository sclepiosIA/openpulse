import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CharterSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
  variant?: "primary" | "sub";
}

/**
 * Section header matching the OpenPulse PDF presentation charter.
 * - primary (default): Full-width orange bar, large text
 * - sub: Lighter style for sub-sections within a parent section
 */
export function CharterSectionHeader({ title, subtitle, icon: Icon, className, variant = "primary" }: CharterSectionHeaderProps) {
  return (
    <div className={cn("space-y-3 mb-8 flex flex-col items-center", className)}>
      <div
        className={cn(
          "flex items-center justify-center gap-3 px-6 py-3 rounded-lg shadow-md w-full",
          variant === "primary"
            ? "bg-marque-orange text-white"
            : "bg-marque-blue/10 text-marque-blue border border-marque-blue/20"
        )}
      >
        {Icon && <Icon className={cn("h-6 w-6 shrink-0", variant === "primary" ? "text-white/90" : "text-marque-blue")} />}
        <h2
          className={cn(
            "font-sofia font-bold uppercase tracking-wide",
            variant === "primary"
              ? "text-xl md:text-2xl lg:text-3xl"
              : "text-lg md:text-xl lg:text-2xl"
          )}
        >
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="font-titillium text-lg text-marque-blue max-w-3xl pl-1 text-center">
          {subtitle}
        </p>
      )}
    </div>
  );
}
