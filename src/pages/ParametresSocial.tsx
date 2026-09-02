import { useState } from 'react';
import { Link2, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageDataState } from '@/components/shared/PageDataState';
import { usePageTitle } from '@/hooks/shared/usePageTitle';
import { useRolePermissions } from '@/hooks/auth/useRolePermissions';
import { useSocialBrands } from '@/hooks/social/useSocialBrands';
import { useSocialConnections } from '@/hooks/social/useSocialConnections';
import { startSocialOAuth } from '@/services/social/socialEdge';
import { PLATFORM_LABELS, BRAND_DEFAULT_PLATFORMS, type SocialPlatform, type SocialConnection } from '@/types/social';
import { PlatformBadge } from '@/components/social/PlatformBadge';
import { toast } from 'sonner';

export default function ParametresSocial() {
  usePageTitle('Connexions sociales');
  const perms = useRolePermissions();
  const allowed = ['admin', 'direction'].includes(perms.role ?? '');

  const brandsQ = useSocialBrands();
  const connsQ = useSocialConnections();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const isLoading = perms.isLoading || brandsQ.isLoading || connsQ.isLoading;

  const handleConnect = async (brandId: string, platform: SocialPlatform) => {
    const key = `${brandId}:${platform}`;
    setLoadingKey(key);
    try {
      const url = await startSocialOAuth(brandId, platform, '/parametres/social');
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message || 'Connexion impossible');
      setLoadingKey(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Connexions sociales</h1>
          <p className="text-sm text-muted-foreground">
            Connectez chaque marque à ses plateformes (Facebook, Instagram, LinkedIn, TikTok).
          </p>
        </div>
      </header>

      <PageDataState
        isLoading={isLoading}
        isError={!allowed || brandsQ.isError || connsQ.isError}
        error={!allowed ? new Error('Réservé à l\'administration / direction.') : brandsQ.error || connsQ.error}
        loadingLabel="Chargement des connexions…"
        onRetry={() => {
          brandsQ.refetch();
          connsQ.refetch();
        }}
      >
        <div className="grid gap-4">
          {(brandsQ.data ?? []).map((brand) => {
            const platforms = BRAND_DEFAULT_PLATFORMS[brand.slug] || [];
            const brandConns = (connsQ.data ?? []).filter((c) => c.brand_id === brand.id);
            return (
              <Card key={brand.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-base">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: brand.color_hex || '#6366f1' }}
                    />
                    {brand.name}
                    {brand.is_anonymous && (
                      <Badge variant="outline" className="text-xs">Masqué</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {platforms.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucune plateforme cible définie.</p>
                  )}
                  {platforms.map((p) => {
                    const conn: SocialConnection | undefined = brandConns.find((c) => c.platform === p);
                    const key = `${brand.id}:${p}`;
                    const busy = loadingKey === key;
                    return (
                      <div
                        key={p}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card/50 p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <PlatformBadge platform={p} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{PLATFORM_LABELS[p]}</div>
                            {conn?.external_user_name ? (
                              <div className="text-xs text-muted-foreground truncate">
                                {conn.external_user_name}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">Non connecté</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {conn?.status === 'active' && (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Active
                            </Badge>
                          )}
                          {conn && conn.status !== 'active' && (
                            <Badge variant="outline" className="gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-600" /> {conn.status}
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant={conn?.status === 'active' ? 'outline' : 'default'}
                            onClick={() => handleConnect(brand.id, p)}
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : conn?.status === 'active' ? (
                              <><RefreshCw className="h-4 w-4 mr-1.5" />Reconnecter</>
                            ) : (
                              <><Link2 className="h-4 w-4 mr-1.5" />Connecter</>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageDataState>
    </div>
  );
}
