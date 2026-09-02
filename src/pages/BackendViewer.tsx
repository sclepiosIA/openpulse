import { useSearchParams, Navigate } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import { StatsIframeViewer } from "@/components/etablissement/StatsIframeViewer";
import { Server, LucideIcon, BookOpen, GitBranch, Palette, FileSignature, Lock, FolderOpen, ExternalLink, ShieldAlert, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageDataState } from "@/components/common/PageDataState";
import { usePageHeaderSlot } from "@/contexts/PageHeaderSlotContext";
import { useAppConfig } from "@/hooks/shared/useAppConfig";
import { useRolePermissions } from "@/hooks/auth/useRolePermissions";
import { fetchBackendAutologinUrl } from "@/services/admin/backendTools";
import {
  resolveInternalToolPresentation,
  type InternalToolRuntimeConfig,
  type InternalToolPresentation,
} from "@/config/internalTools";

// Outils sensibles réservés aux admins (secrets, infra, signature, stockage HDS)
const ADMIN_ONLY_TOOLS = new Set([
  'secrets', 'fichiers_hds', 'gitea', 'penpot', 'docuseal', 'azure',
  'supabase', 'vault', 'infisical'
]);

interface IframeConfig extends InternalToolRuntimeConfig {
  url: string;
  title: string;
  description: string;
  icon: LucideIcon;
  redirect?: string;
  autologin?: string;
}

interface ConfiguredTool extends InternalToolRuntimeConfig {
  url: string;
  title: string;
  description: string;
  icon?: string;
  autologin?: string | boolean;
}

// Mapping des icônes par nom (pour les entrées dynamiques depuis app_config)
const ICON_MAP: Record<string, LucideIcon> = {
  Server, BookOpen, GitBranch, Palette, FileSignature, Lock, FolderOpen
};

export default function BackendViewer() {
  const [searchParams] = useSearchParams();
  const { setHeaderContent } = usePageHeaderSlot();
  const { isAdmin, isLoading: loadingRole } = useRolePermissions();
  const rawKey = searchParams.get('backend') || searchParams.get('tool') || 'hm-prod';
  const key = rawKey.replace(/-/g, '_');
  const isRestricted = ADMIN_ONLY_TOOLS.has(key);

  // Charger les URLs uniquement depuis app_config (backend_urls + tool_urls)
  const { data: backendUrls, isLoading: loadingBackend, isError: errorBackend, refetch: refetchBackend } = useAppConfig<Record<string, ConfiguredTool>>('backend_urls');
  const { data: toolUrls, isLoading: loadingTools, isError: errorTools, refetch: refetchTools } = useAppConfig<Record<string, ConfiguredTool>>('tool_urls');

  const isLoading = loadingBackend || loadingTools || loadingRole;
  const isError = errorBackend || errorTools;

  // Construire les URLs uniquement depuis app_config — aucun fallback hardcodé
  const IFRAME_URLS = useMemo(() => {
    const merged: Record<string, IframeConfig> = {};

    const ingest = (src?: Record<string, ConfiguredTool>) => {
      if (!src) return;
      for (const [k, v] of Object.entries(src)) {
        merged[k] = {
          url: v.url,
          title: v.title,
          description: v.description,
          icon: (v.icon && ICON_MAP[v.icon]) || Server,
          externalUrl: v.externalUrl,
          launchUrl: v.launchUrl,
          embed: v.embed,
          ssoMode: v.ssoMode,
          readiness: v.readiness,
          autologin: typeof v.autologin === 'string'
            ? v.autologin
            : v.autologin === true
              ? 'hm-backend'
              : undefined,
        };
      }
    };
    ingest(backendUrls);
    ingest(toolUrls);

    return merged;
  }, [backendUrls, toolUrls]);

  const config = IFRAME_URLS[key];
  const IconComponent = config?.icon || Server;
  const internalToolPresentation: InternalToolPresentation | null =
    (key === 'gitea' || key === 'penpot') && config
      ? resolveInternalToolPresentation(key, config, {
          embedRuntimeEnabled:
            import.meta.env.VITE_INTERNAL_TOOL_EMBED_RUNTIME_ENABLED === 'true',
          parentOrigin: typeof window === 'undefined' ? '' : window.location.origin,
        })
      : null;

  const headerExternalUrl =
    internalToolPresentation?.mode === 'disabled'
      ? null
      : internalToolPresentation?.url ?? config?.url ?? null;
  const headerExternalFeatures = internalToolPresentation ? 'noopener,noreferrer' : undefined;

  // Injecter le contenu dans le header global
  useEffect(() => {
    if (!config || config.redirect || (isRestricted && !isAdmin)) {
      setHeaderContent(null);
      return;
    }
    
    setHeaderContent(
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <IconComponent className="h-5 w-5 text-primary shrink-0" />
        <h1 className="text-lg font-bold truncate">{config.title}</h1>
        <span className="text-xs text-muted-foreground hidden lg:inline">—</span>
        <p className="text-xs text-muted-foreground hidden lg:block truncate max-w-xs">{config.description}</p>
        {headerExternalUrl && (
          <div className="ml-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                headerExternalFeatures
                  ? window.open(headerExternalUrl, '_blank', headerExternalFeatures)
                  : window.open(headerExternalUrl, '_blank')
              }
            >
              <ExternalLink className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Ouvrir dans un nouvel onglet</span>
            </Button>
          </div>
        )}
      </div>
    );
    
    return () => setHeaderContent(null);
  }, [
    config,
    setHeaderContent,
    IconComponent,
    headerExternalUrl,
    headerExternalFeatures,
    isRestricted,
    isAdmin,
  ]);

  // Loader / Error state via PageDataState standard
  if (isLoading || isError) {
    return (
      <PageDataState
        isLoading={isLoading}
        isError={isError}
        onRetry={() => { refetchBackend(); refetchTools(); }}
      >
        <></>
      </PageDataState>
    );
  }

  // Restriction d'accès aux outils sensibles
  if (isRestricted && !isAdmin) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3 max-w-md">
          <ShieldAlert className="h-12 w-12 mx-auto text-destructive opacity-80" />
          <p className="text-lg font-medium">Accès restreint</p>
          <p className="text-sm">L'outil « {key} » est réservé aux administrateurs.</p>
        </div>
      </div>
    );
  }

  // Si la clé n'existe pas dans app_config
  if (!config) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <Server className="h-12 w-12 mx-auto opacity-50" />
          <p className="text-lg font-medium">Outil non configuré</p>
          <p className="text-sm max-w-md">
            La clé « {key} » n'existe pas dans la configuration. Si vous venez de l'ajouter, rafraîchissez la configuration.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => { refetchBackend(); refetchTools(); }}
          >
            Rafraîchir la configuration
          </Button>
        </div>
      </div>
    );
  }

  if (config.redirect) {
    return <Navigate to={config.redirect} replace />;
  }

  if (internalToolPresentation) {
    if (internalToolPresentation.mode === 'iframe') {
      return (
        <div className="h-full p-2">
          <StatsIframeViewer url={internalToolPresentation.url} title={config.title} />
        </div>
      );
    }

    const isExternalFallback = internalToolPresentation.mode === 'external';
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <ShieldAlert className="h-12 w-12 mx-auto text-amber-500" />
          <div>
            <p className="text-lg font-medium">
              {isExternalFallback ? 'Intégration SSO non vérifiée' : 'Outil bloqué'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isExternalFallback
                ? `${config.title} reste disponible hors de l’application tant que le contrat iframe et SSO n’est pas attesté.`
                : `${config.title} ne correspond pas à une origine interne autorisée.`}
            </p>
          </div>
          {isExternalFallback && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(internalToolPresentation.url, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ouvrir {config.title} dans le navigateur
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Mode autologin historique des backends métier uniquement.
  if (config.autologin) {
    return (
      <AutologinRedirect backendKey={rawKey} fallbackUrl={config.url} title={config.title} autologinFn={config.autologin} />
    );
  }

  return (
    <div className="h-full p-2">
      <StatsIframeViewer url={config.url} title={config.title} />
    </div>
  );
}

interface AutologinRedirectProps {
  backendKey: string;
  fallbackUrl: string;
  title: string;
  autologinFn: string;
}

function AutologinRedirect({ backendKey, fallbackUrl, title, autologinFn }: AutologinRedirectProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // Mapping clé app_config → nom edge function
  const functionName = autologinFn === 'hm-backend' ? 'hm-backend-autologin' : autologinFn;

  const run = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    setSignedUrl(null);
    try {
      const url = await fetchBackendAutologinUrl(functionName, backendKey);
      setSignedUrl(url);
      setStatus('ready');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue.';
      setErrorMsg(msg);
      setStatus('error');
    }
  }, [functionName, backendKey]);

  useEffect(() => {
    run();
  }, [run]);

  if (status === 'error') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <div>
            <p className="text-lg font-medium">Connexion à {title} impossible</p>
            <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button variant="default" size="sm" onClick={run}>Réessayer</Button>
            <Button variant="outline" size="sm" onClick={() => window.open(fallbackUrl, '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Ouvrir sans autologin
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'ready' && signedUrl) {
    return (
      <div className="h-full p-2">
        <StatsIframeViewer url={signedUrl} title={title} />
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
        <p className="text-sm">Connexion à {title}…</p>
      </div>
    </div>
  );
}
