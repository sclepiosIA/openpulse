import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, CheckCircle } from "lucide-react";

interface EmailClassificationChartProps {
  autoMatchedCount: number;
  manuallyClassifiedCount: number;
  unclassifiedCount: number;
  totalThreadsCount: number;
  autoMatchRate: number;
  totalClassificationRate: number;
  totalClassifiedCount: number;
  horsEtablissementCount?: number;
  etablissementCount?: number;
  partenaireCount?: number;
  groupeCount?: number;
  interneCount?: number;
}

export function EmailClassificationChart({
  totalClassificationRate,
  totalClassifiedCount,
  horsEtablissementCount = 0,
  etablissementCount = 0,
  partenaireCount = 0,
  groupeCount = 0,
  interneCount = 0,
  unclassifiedCount,
  totalThreadsCount,
}: EmailClassificationChartProps) {
  const etablissementPercentage = totalThreadsCount > 0 ? Math.round((etablissementCount / totalThreadsCount) * 100) : 0;
  const partenairePercentage = totalThreadsCount > 0 ? Math.round((partenaireCount / totalThreadsCount) * 100) : 0;
  const groupePercentage = totalThreadsCount > 0 ? Math.round((groupeCount / totalThreadsCount) * 100) : 0;
  const horsPercentage = totalThreadsCount > 0 ? Math.round((horsEtablissementCount / totalThreadsCount) * 100) : 0;
  const internePercentage = totalThreadsCount > 0 ? Math.round((interneCount / totalThreadsCount) * 100) : 0;
  const unclassifiedPercentage = totalThreadsCount > 0 ? Math.round((unclassifiedCount / totalThreadsCount) * 100) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Taux de classification total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="12" className="text-muted/20" />
                <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray={`${(totalClassificationRate / 100) * 440} 440`} className={totalClassificationRate > 70 ? "text-green-500" : "text-amber-500"} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{totalClassificationRate}%</span>
                <span className="text-xs text-muted-foreground">Classés</span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center space-y-1">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{totalClassifiedCount}</span> classés sur{" "}
              <span className="font-semibold text-foreground">{totalThreadsCount}</span> total
            </div>
            <div className="text-xs text-muted-foreground">{unclassifiedCount} emails restent à classifier</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Répartition
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span>Établissements</span>
              </div>
              <span className="font-medium">{etablissementPercentage}%</span>
            </div>
            <Progress value={etablissementPercentage} className="h-2" />
            <div className="text-xs text-muted-foreground pl-5">{etablissementCount} emails</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-500" />
                <span>Partenaires</span>
              </div>
              <span className="font-medium">{partenairePercentage}%</span>
            </div>
            <Progress value={partenairePercentage} className="h-2 [&>div]:bg-purple-500" />
            <div className="text-xs text-muted-foreground pl-5">{partenaireCount} emails</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span>Groupes</span>
              </div>
              <span className="font-medium">{groupePercentage}%</span>
            </div>
            <Progress value={groupePercentage} className="h-2 [&>div]:bg-blue-500" />
            <div className="text-xs text-muted-foreground pl-5">{groupeCount} emails</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-500" />
                <span>Interne OpenPulse</span>
              </div>
              <span className="font-medium">{internePercentage}%</span>
            </div>
            <Progress value={internePercentage} className="h-2 [&>div]:bg-slate-500" />
            <div className="text-xs text-muted-foreground pl-5">{interneCount} emails</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span>Hors établissement</span>
              </div>
              <span className="font-medium">{horsPercentage}%</span>
            </div>
            <Progress value={horsPercentage} className="h-2 [&>div]:bg-amber-500" />
            <div className="text-xs text-muted-foreground pl-5">{horsEtablissementCount} emails</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>Non classés</span>
              </div>
              <span className="font-medium">{unclassifiedPercentage}%</span>
            </div>
            <Progress value={unclassifiedPercentage} className="h-2 [&>div]:bg-red-500" />
            <div className="text-xs text-muted-foreground pl-5">{unclassifiedCount} emails</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
