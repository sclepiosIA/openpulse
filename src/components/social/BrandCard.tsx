import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EyeOff } from 'lucide-react';
import { PlatformBadge } from './PlatformBadge';
import { BRAND_DEFAULT_PLATFORMS, type SocialBrand, type SocialConnection } from '@/types/social';

interface Props {
  brand: SocialBrand;
  connections: SocialConnection[];
}

export function BrandCard({ brand, connections }: Props) {
  const expectedPlatforms = BRAND_DEFAULT_PLATFORMS[brand.slug] ?? [];
  const connectedPlatforms = new Set(connections.filter((c) => c.status === 'active').map((c) => c.platform));

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1.5" style={{ backgroundColor: brand.color_hex || 'hsl(var(--primary))' }} />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="truncate">{brand.name}</span>
              {brand.is_anonymous && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <EyeOff className="h-3 w-3" /> Anonyme
                </Badge>
              )}
            </CardTitle>
            {brand.tagline && <p className="text-xs text-muted-foreground mt-0.5 truncate">{brand.tagline}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {expectedPlatforms.map((p) => (
            <PlatformBadge
              key={p}
              platform={p}
              variant={connectedPlatforms.has(p) ? 'default' : 'outline'}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {connectedPlatforms.size}/{expectedPlatforms.length} compte{expectedPlatforms.length > 1 ? 's' : ''} connecté{connectedPlatforms.size > 1 ? 's' : ''}
        </p>
      </CardContent>
    </Card>
  );
}
