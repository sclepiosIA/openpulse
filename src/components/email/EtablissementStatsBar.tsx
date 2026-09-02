import { Card, CardContent } from "@/components/ui/card";
import { Building2, MessageSquare, Mail, MailOpen } from "lucide-react";

interface EtablissementStatsBarProps {
  totalEtablissements: number;
  totalConversations: number;
  totalMessages: number;
  totalUnread: number;
  avgEngagement: number;
}

export function EtablissementStatsBar({
  totalEtablissements,
  totalConversations,
  totalMessages,
  totalUnread,
  avgEngagement,
}: EtablissementStatsBarProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Engagement global */}
          <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center p-4 border rounded-lg bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="relative w-20 h-20 mb-2">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-muted/20"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={`${(avgEngagement / 100) * 226} 226`}
                  className={avgEngagement > 70 ? "text-green-500" : avgEngagement > 40 ? "text-amber-500" : "text-red-500"}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{avgEngagement}%</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground text-center">Engagement moyen</span>
          </div>

          {/* Stats KPIs */}
          <div className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalEtablissements}</div>
              <div className="text-xs text-muted-foreground">Établissements</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <MessageSquare className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalConversations}</div>
              <div className="text-xs text-muted-foreground">Conversations</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Mail className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalMessages}</div>
              <div className="text-xs text-muted-foreground">Messages</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
            <div className="p-2 rounded-lg bg-red-500/10">
              <MailOpen className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalUnread}</div>
              <div className="text-xs text-muted-foreground">Non lus</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
