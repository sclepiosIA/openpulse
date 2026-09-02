import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCost, formatTokens } from "@/hooks/ai/useAIUsageStats";

export function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-md p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-mono font-medium">{value}</p>
    </div>
  );
}

export function KpiCard({ title, value, sub, icon: Icon, color, bgColor, className }: {
  title: string; value: string; sub: string;
  icon: React.ElementType; color: string; bgColor: string; className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{title}</p>
            <p className={cn("text-lg sm:text-2xl font-bold mt-0.5", color)}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
          <div className={cn("p-2 rounded-lg", bgColor)}>
            <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PeriodCard({ title, calls, tokens, cost }: {
  title: string; calls?: number; tokens?: number; cost?: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xl font-bold">{calls || 0}</div>
            <p className="text-xs text-muted-foreground">appels</p>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{formatTokens(tokens || 0)}</div>
            <p className="text-xs text-muted-foreground">tokens</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-emerald-700">{formatCost(cost || 0)}</div>
            <p className="text-xs text-muted-foreground">coût</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
