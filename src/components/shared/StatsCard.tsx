import { LucideIcon, Lock, TrendingUp, TrendingDown } from "lucide-react";
import { useRolePermissions, RolePermissions } from "@/hooks/auth/useRolePermissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EnhancedCard, EnhancedCardContent, AccentColor } from "@/components/ui/enhanced-card";
import { IconCircle, IconCircleVariant, IconCircleColor } from "@/components/ui/icon-circle";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  accentColor?: AccentColor;
  iconVariant?: IconCircleVariant;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
  permission?: keyof RolePermissions;
  className?: string;
}

// Map legacy color props to new IconCircleColor
function mapColorToIconColor(color?: string): IconCircleColor {
  if (!color) return 'primary';
  if (color.includes('green') || color.includes('emerald') || color.includes('success')) return 'success';
  if (color.includes('orange') || color.includes('amber') || color.includes('warning') || color.includes('accent')) return 'accent';
  if (color.includes('red') || color.includes('destructive')) return 'destructive';
  if (color.includes('purple') || color.includes('violet')) return 'primary';
  if (color.includes('cyan') || color.includes('teal')) return 'success';
  if (color.includes('muted') || color.includes('gray')) return 'muted';
  return 'primary';
}

function mapColorToAccent(color?: string): AccentColor {
  if (!color) return 'blue';
  if (color.includes('green') || color.includes('emerald')) return 'green';
  if (color.includes('orange') || color.includes('amber') || color.includes('warning')) return 'orange';
  if (color.includes('red') || color.includes('destructive')) return 'red';
  if (color.includes('purple') || color.includes('violet')) return 'purple';
  if (color.includes('cyan') || color.includes('teal') || color.includes('success')) return 'cyan';
  return 'blue';
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "text-primary",
  accentColor,
  iconVariant = "gradient",
  trend,
  onClick,
  permission,
  className
}: StatsCardProps) {
  const permissions = useRolePermissions();

  // Vérifier la permission si spécifiée
  const hasPermission = !permission || (permissions[permission] as boolean);

  // Determine accent color from legacy color prop or explicit accentColor
  const finalAccentColor = accentColor || mapColorToAccent(color);
  const iconColor = mapColorToIconColor(color);

  // Si pas de permission, afficher une carte verrouillée
  if (!hasPermission) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <EnhancedCard 
              accentColor="blue" 
              accentPosition="left"
              className={cn("opacity-60 cursor-not-allowed", className)}
            >
              <EnhancedCardContent className="p-4">
                <div className="flex items-center gap-3">
                  <IconCircle icon={Lock} variant="soft" color="muted" size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                      {title}
                    </p>
                    <div className="text-xl sm:text-2xl font-bold text-muted-foreground mt-1">
                      •••
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Accès restreint</p>
                  </div>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>
          </TooltipTrigger>
          <TooltipContent>
            <p>Vous n'avez pas les permissions pour voir ces données</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <EnhancedCard 
      accentColor={finalAccentColor}
      accentPosition="left"
      hoverable={!!onClick}
      glowOnHover={!!onClick}
      className={cn(className)}
      onClick={onClick}
    >
      <EnhancedCardContent className="p-4">
        <div className="flex items-center gap-3">
          <IconCircle 
            icon={Icon} 
            variant={iconVariant} 
            color={iconColor} 
            size="lg"
            animate={!!onClick}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {title}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-bold text-foreground">
                {value}
              </span>
              {trend && (
                <span className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}>
                  {trend.isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}
