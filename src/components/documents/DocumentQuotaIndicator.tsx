import { HardDrive } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useDocumentQuota } from "@/hooks/documents/useDocumentQuota";

interface DocumentQuotaIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function DocumentQuotaIndicator({ 
  className,
  showDetails = true 
}: DocumentQuotaIndicatorProps) {
  const { data: quota, isLoading } = useDocumentQuota();

  if (isLoading || !quota) {
    return null;
  }

  const getProgressColor = () => {
    if (quota.usage_percentage >= 90) return "bg-destructive";
    if (quota.usage_percentage >= 75) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <HardDrive className="w-4 h-4" />
          <span>Stockage</span>
        </div>
        <span className="font-medium">
          {quota.formatted_used} / {quota.formatted_quota}
        </span>
      </div>
      
      <Progress 
        value={quota.usage_percentage} 
        className="h-2"
        aria-label={`Utilisation du stockage documents : ${quota.formatted_used} sur ${quota.formatted_quota}`}
      />

      {showDetails && quota.usage_percentage >= 75 && (
        <p className={cn(
          "text-xs",
          quota.usage_percentage >= 90 ? "text-destructive" : "text-yellow-600"
        )}>
          {quota.usage_percentage >= 90
            ? "Espace de stockage presque plein !"
            : "Espace de stockage limité"}
        </p>
      )}
    </div>
  );
}
