import * as React from "react";
import { cn } from "@/lib/utils";

export type AccentColor = 'blue' | 'orange' | 'cyan' | 'green' | 'purple' | 'red';
export type AccentPosition = 'left' | 'top' | 'none';

const accentColorClasses: Record<AccentColor, string> = {
  blue: 'border-l-primary',
  orange: 'border-l-accent',
  cyan: 'border-l-success',
  green: 'border-l-emerald-500',
  purple: 'border-l-violet-500',
  red: 'border-l-destructive'
};

const accentTopColorClasses: Record<AccentColor, string> = {
  blue: 'border-t-primary',
  orange: 'border-t-accent',
  cyan: 'border-t-success',
  green: 'border-t-emerald-500',
  purple: 'border-t-violet-500',
  red: 'border-t-destructive'
};

const glowColorClasses: Record<AccentColor, string> = {
  blue: 'hover:shadow-[0_8px_30px_-6px_hsl(var(--primary)/0.25)]',
  orange: 'hover:shadow-[0_8px_30px_-6px_hsl(var(--accent)/0.25)]',
  cyan: 'hover:shadow-[0_8px_30px_-6px_hsl(var(--success)/0.25)]',
  green: 'hover:shadow-[0_8px_30px_-6px_hsl(142_76%_36%/0.25)]',
  purple: 'hover:shadow-[0_8px_30px_-6px_hsl(263_70%_50%/0.25)]',
  red: 'hover:shadow-[0_8px_30px_-6px_hsl(var(--destructive)/0.25)]'
};

export interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  accentColor?: AccentColor;
  accentPosition?: AccentPosition;
  hoverable?: boolean;
  glowOnHover?: boolean;
  children: React.ReactNode;
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ 
    className, 
    accentColor = 'blue', 
    accentPosition = 'left',
    hoverable = false,
    glowOnHover = false,
    children,
    ...props 
  }, ref) => {
    const accentClass = accentPosition === 'left' 
      ? accentColorClasses[accentColor]
      : accentPosition === 'top'
        ? accentTopColorClasses[accentColor]
        : '';

    const borderWidth = accentPosition === 'left' 
      ? 'border-l-4'
      : accentPosition === 'top'
        ? 'border-t-4'
        : '';

    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          "rounded-xl bg-card text-card-foreground",
          "shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.08)]",
          "border border-border/50",
          // Accent border
          borderWidth,
          accentClass,
          // Hover effects
          hoverable && [
            "transition-all duration-300 ease-out",
            "hover:-translate-y-1",
            "hover:shadow-[0_8px_30px_-6px_hsl(var(--primary)/0.15)]",
            "cursor-pointer"
          ],
          // Glow effect on hover
          glowOnHover && glowColorClasses[accentColor],
          // Animation
          "animate-fade-in",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

EnhancedCard.displayName = "EnhancedCard";

const EnhancedCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5 pb-0", className)}
    {...props}
  />
));
EnhancedCardHeader.displayName = "EnhancedCardHeader";

const EnhancedCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-sm font-medium text-muted-foreground uppercase tracking-wide",
      className
    )}
    {...props}
  />
));
EnhancedCardTitle.displayName = "EnhancedCardTitle";

const EnhancedCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5", className)} {...props} />
));
EnhancedCardContent.displayName = "EnhancedCardContent";

const EnhancedCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 pt-0", className)}
    {...props}
  />
));
EnhancedCardFooter.displayName = "EnhancedCardFooter";

export {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardTitle,
  EnhancedCardContent,
  EnhancedCardFooter
};
