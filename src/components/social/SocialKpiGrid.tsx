import { Heart, MessageSquare, Eye, Users, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SocialKpis } from '@/hooks/social/useSocialKpis';

interface Props {
  kpis: SocialKpis;
}

function formatN(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function SocialKpiGrid({ kpis }: Props) {
  const items = [
    { label: 'Posts (90j)', value: formatN(kpis.postsCount), icon: BarChart3, color: 'text-indigo-600' },
    { label: 'Engagement total', value: formatN(kpis.totalEngagement), icon: Heart, color: 'text-rose-600' },
    { label: 'Vues / portée', value: formatN(kpis.totalReach), icon: Eye, color: 'text-sky-600' },
    { label: 'Followers cumulés', value: formatN(kpis.totalFollowers), icon: Users, color: 'text-emerald-600' },
    { label: 'Engagement / post', value: formatN(kpis.avgEngagementPerPost), icon: MessageSquare, color: 'text-amber-600' },
  ];
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <it.icon className={`h-4 w-4 ${it.color}`} />
              <span className="truncate">{it.label}</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
