import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCircle, IconCircleColor, IconCircleVariant } from "./icon-circle";

export type BigStatSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<BigStatSize, { value: string; label: string; sublabel: string }> = {
  sm: { value: 'text-2xl', label: 'text-sm', sublabel: 'text-xs' },
  md: { value: 'text-3xl sm:text-4xl', label: 'text-base', sublabel: 'text-sm' },
  lg: { value: 'text-4xl sm:text-5xl', label: 'text-lg', sublabel: 'text-base' },
  xl: { value: 'text-5xl sm:text-6xl', label: 'text-xl', sublabel: 'text-lg' }
};

const colorClasses: Record<IconCircleColor, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  muted: 'text-muted-foreground',
  white: 'text-white'
};

export interface BigStatProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number;
  label: string;
  sublabel?: string;
  icon?: LucideIcon;
  iconVariant?: IconCircleVariant;
  color?: IconCircleColor;
  size?: BigStatSize;
  centered?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const BigStat = React.forwardRef<HTMLDivElement, BigStatProps>(
  ({ 
    value,
    label,
    sublabel,
    icon,
    iconVariant = 'gradient',
    color = 'primary',
    size = 'md',
    centered = true,
    trend,
    className,
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-2",
          centered && "items-center text-center",
          "animate-fade-in",
          className
        )}
        {...props}
      >
        {icon && (
          <IconCircle 
            icon={icon} 
            variant={iconVariant} 
            color={color} 
            size={size === 'xl' ? 'xl' : size === 'lg' ? 'lg' : 'md'} 
            className="mb-2"
          />
        )}
        
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "font-bold tracking-tight",
            sizeClasses[size].value,
            colorClasses[color]
          )}>
            {value}
          </span>
          
          {trend && (
            <span className={cn(
              "text-sm font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          )}
        </div>
        
        <p className={cn(
          "text-muted-foreground font-medium",
          sizeClasses[size].label
        )}>
          {label}
        </p>
        
        {sublabel && (
          <p className={cn(
            "text-muted-foreground/70",
            sizeClasses[size].sublabel
          )}>
            {sublabel}
          </p>
        )}
      </div>
    );
  }
);

BigStat.displayName = "BigStat";

export { BigStat };
