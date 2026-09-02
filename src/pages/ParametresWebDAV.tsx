import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, HardDrive, Monitor, Apple, Terminal, Copy, CheckCircle, Info, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/shared/use-toast";
import { useAuth } from "@/components/AuthProvider";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { cn } from "@/lib/utils";

// Fallback Azure pour les builds locaux qui n'injectent pas VITE_SUPABASE_URL.
const SUPABASE_URL_FALLBACK = 'https://supabase.openpulse.example.org';
const WEBDAV_URL = `${import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK}/functions/v1/webdav-server`;

export default function ParametresWebDAV() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Parse sécurisé de WEBDAV_URL — évite tout crash si l'URL est mal formée
  const webdavParts = useMemo(() => {
    try {
      const u = new URL(WEBDAV_URL);
      return { ok: true as const, host: u.host, pathname: u.pathname, full: WEBDAV_URL };
    } catch {
      return { ok: false as const, host: '', pathname: '', full: WEBDAV_URL };
    }
  }, []);

  const userEmail = user?.email || "votre-email@example.com";

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "Copié !", description: "L'adresse a été copiée dans le presse-papiers." });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 shrink-0"
      onClick={() => copyToClipboard(text, field)}
    >
      {copiedField === field ? (
        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  );

  const detectedOS = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "windows";
    if (ua.includes("mac")) return "macos";
    return "linux";
  }, []);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-background via-background to-muted/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/parametres')} aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <HardDrive className="h-6 w-6 text-primary" />
              </div>
              Lecteur réseau WebDAV
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Accédez à vos documents directement depuis l'explorateur de fichiers de votre ordinateur
            </p>
          </div>
        </div>

        {/* Connection Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Informations de connexion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Adresse du serveur WebDAV</label>
              <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2">
                <code className="text-sm flex-1 overflow-x-auto whitespace-nowrap">{WEBDAV_URL}</code>
                <CopyButton text={WEBDAV_URL} field="url" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Identifiant</label>
                <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2 mt-1">
                  <code className="text-sm flex-1 truncate">{userEmail}</code>
                  <CopyButton text={userEmail} field="email" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mot de passe</label>
                <div className="flex items-center gap-2 bg-background rounded-lg border px-3 py-2 mt-1">
                  <code className="text-sm text-muted-foreground">Votre mot de passe OpenPulse</code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security note */}
        <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            La connexion est sécurisée par HTTPS. Vos identifiants sont vos identifiants OpenPulse habituels. 
            Ne partagez jamais vos informations de connexion.
          </AlertDescription>
        </Alert>

        {/* OS Instructions */}
        <Tabs defaultValue={detectedOS} className="space-y-4">
          <TabsList className={cn("grid w-full", isMobile ? "grid-cols-3" : "grid-cols-3")}>
            <TabsTrigger value="windows" className="gap-1.5">
              <Monitor className="h-4 w-4" />
              <span className={cn(isMobile && "text-xs")}>Windows</span>
            </TabsTrigger>
            <TabsTrigger value="macos" className="gap-1.5">
              <Apple className="h-4 w-4" />
              <span className={cn(isMobile && "text-xs")}>macOS</span>
            </TabsTrigger>
            <TabsTrigger value="linux" className="gap-1.5">
              <Terminal className="h-4 w-4" />
              <span className={cn(isMobile && "text-xs")}>Linux</span>
            </TabsTrigger>
          </TabsList>

          {/* Windows */}
          <TabsContent value="windows" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monter comme lecteur réseau sur Windows</CardTitle>
                <CardDescription>Via l'Explorateur de fichiers Windows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <Step number={1} title="Ouvrir l'Explorateur de fichiers">
                    <p className="text-sm text-muted-foreground">
                      Appuyez sur <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Win + E</kbd> pour ouvrir l'Explorateur.
                    </p>
                  </Step>
                  
                  <Step number={2} title="Connecter un lecteur réseau">
                    <p className="text-sm text-muted-foreground">
                      Cliquez sur <strong>« … »</strong> (trois points) dans la barre d'outils, puis sur <strong>« Connecter un lecteur réseau »</strong>.
                    </p>
                  </Step>
                  
                  <Step number={3} title="Configurer la connexion">
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0 mt-0.5">Lecteur</Badge>
                        <span>Choisissez une lettre (ex: <strong>Z:</strong>)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0 mt-0.5">Dossier</Badge>
                        <div className="flex-1">
                          <code className="text-xs break-all">{WEBDAV_URL}</code>
                          <CopyButton text={WEBDAV_URL} field="win-url" />
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0 mt-0.5">Option</Badge>
                        <span>Cochez <strong>« Se connecter avec d'autres informations d'identification »</strong></span>
                      </div>
                    </div>
                  </Step>
                  
                  <Step number={4} title="Entrer vos identifiants">
                    <p className="text-sm text-muted-foreground">
                      Identifiant : <strong>{userEmail}</strong><br />
                      Mot de passe : votre mot de passe OpenPulse
                    </p>
                  </Step>

                  <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Si Windows refuse la connexion :</strong> Ouvrez le Registre (<code className="text-xs">regedit</code>), allez dans 
                      <code className="text-xs mx-1">HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\WebClient\Parameters</code> 
                      et changez <code className="text-xs">BasicAuthLevel</code> à <strong>2</strong>. Redémarrez le service WebClient.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* macOS */}
          <TabsContent value="macos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monter comme lecteur réseau sur macOS</CardTitle>
                <CardDescription>Via le Finder</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <Step number={1} title="Ouvrir le Finder">
                    <p className="text-sm text-muted-foreground">
                      Ouvrez le Finder puis allez dans le menu <strong>Aller → Se connecter au serveur</strong> 
                      (ou <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⌘ + K</kbd>).
                    </p>
                  </Step>
                  
                  <Step number={2} title="Entrer l'adresse du serveur">
                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 break-all">{WEBDAV_URL}</code>
                        <CopyButton text={WEBDAV_URL} field="mac-url" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Cliquez sur <strong>« Se connecter »</strong>.
                    </p>
                  </Step>
                  
                  <Step number={3} title="S'authentifier">
                    <p className="text-sm text-muted-foreground">
                      Sélectionnez <strong>« Utilisateur enregistré »</strong>, puis entrez :<br />
                      Nom : <strong>{userEmail}</strong><br />
                      Mot de passe : votre mot de passe OpenPulse
                    </p>
                  </Step>
                  
                  <Step number={4} title="Accéder aux fichiers">
                    <p className="text-sm text-muted-foreground">
                      Le lecteur apparaît dans la barre latérale du Finder sous <strong>« Emplacements »</strong>. 
                      Vous pouvez glisser-déposer, ouvrir et modifier vos fichiers directement.
                    </p>
                  </Step>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Linux */}
          <TabsContent value="linux" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monter comme lecteur réseau sur Linux</CardTitle>
                <CardDescription>Via Nautilus (GNOME) ou en ligne de commande</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Badge>Option A</Badge> Nautilus / Fichiers GNOME
                  </h4>
                  
                  <Step number={1} title="Ouvrir Fichiers">
                    <p className="text-sm text-muted-foreground">
                      Ouvrez l'application <strong>Fichiers</strong> puis cliquez sur <strong>« Autres emplacements »</strong> en bas de la barre latérale.
                    </p>
                  </Step>
                  
                  <Step number={2} title="Connexion au serveur">
                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <p className="text-muted-foreground mb-1">Dans « Se connecter au serveur », entrez :</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 break-all">davs://{webdavParts.host}{webdavParts.pathname}</code>
                        <CopyButton
                          text={`davs://${webdavParts.host}${webdavParts.pathname}`}
                          field="linux-url"
                        />
                      </div>
                    </div>
                  </Step>
                  
                  <Step number={3} title="S'authentifier">
                    <p className="text-sm text-muted-foreground">
                      Entrez vos identifiants OpenPulse lorsque demandé.
                    </p>
                  </Step>

                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
                      <Badge>Option B</Badge> Ligne de commande (davfs2)
                    </h4>
                    <div className="bg-muted/80 rounded-lg p-3 font-mono text-xs space-y-1 overflow-x-auto">
                      <p className="text-muted-foreground"># Installer davfs2</p>
                      <p>sudo apt install davfs2</p>
                      <p className="text-muted-foreground mt-2"># Créer le point de montage</p>
                      <p>sudo mkdir -p /mnt/marque</p>
                      <p className="text-muted-foreground mt-2"># Monter</p>
                      <p className="break-all">sudo mount -t davfs {WEBDAV_URL} /mnt/marque</p>
                      <p className="text-muted-foreground mt-2"># Pour un montage automatique, ajoutez dans /etc/fstab :</p>
                      <p className="break-all">{WEBDAV_URL} /mnt/marque davfs user,noauto 0 0</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Supported operations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opérations supportées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("grid gap-2", isMobile ? "grid-cols-1" : "grid-cols-2")}>
              {[
                "📂 Naviguer dans les dossiers",
                "📄 Ouvrir et lire des fichiers",
                "⬆️ Copier des fichiers vers le serveur",
                "✏️ Modifier et enregistrer directement",
                "🗑️ Supprimer des fichiers et dossiers",
                "📁 Créer de nouveaux dossiers",
                "🔄 Déplacer et renommer des éléments",
                "📋 Copier entre dossiers",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/40">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm mb-1">{title}</h4>
        {children}
      </div>
    </div>
  );
}
