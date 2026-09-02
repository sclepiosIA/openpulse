import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Save, Database, Globe, Mail, FileText, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationsExternes } from "@/components/parametres/ApplicationsExternes";
import { ServeurMcp } from "@/components/parametres/ServeurMcp";
import { Link } from "react-router-dom";
import { ExternalLink, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllAppConfigs, useUpdateAppConfig, type AppConfigRow } from "@/hooks/shared/useAppConfig";
import { useAllReferenceData, useUpdateReferenceData, type ReferenceDataRow } from "@/hooks/system/useReferenceData";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { cn } from "@/lib/utils";

// ========== Company Info Editor ==========
function CompanyInfoEditor({ config, onSave }: { config: AppConfigRow; onSave: (value: Record<string, any>) => void }) {
  const [formData, setFormData] = useState(config.value as Record<string, any>);
  const fields = [
    { key: 'name', label: 'Raison sociale', placeholder: 'OpenPulse' },
    { key: 'address', label: 'Adresse', placeholder: '123 Avenue...' },
    { key: 'city', label: 'Ville / CP', placeholder: '75001 Paris' },
    { key: 'siret', label: 'SIRET', placeholder: '123 456 789 00012' },
    { key: 'tva_intracom', label: 'TVA Intracommunautaire', placeholder: 'FR12 123456789' },
    { key: 'email', label: 'Email', placeholder: 'contact@exploitant.example.org' },
    { key: 'phone', label: 'Téléphone', placeholder: '+33 1 XX XX XX XX' },
    { key: 'iban', label: 'IBAN', placeholder: 'FR76 XXXX ...' },
    { key: 'bic', label: 'BIC', placeholder: 'BNPAFRPP' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(f => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key} className="text-sm font-medium">{f.label}</Label>
            <Input
              id={f.key}
              value={formData[f.key] || ''}
              placeholder={f.placeholder}
              onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
              className={formData[f.key]?.includes('[À RENSEIGNER]') ? 'border-destructive' : ''}
            />
          </div>
        ))}
      </div>
      <Button onClick={() => onSave(formData)} className="gap-2">
        <Save className="h-4 w-4" />
        Enregistrer
      </Button>
    </div>
  );
}

// ========== Generic JSON Config Editor ==========
function JsonConfigEditor({ config, onSave }: { config: AppConfigRow; onSave: (value: Record<string, any>) => void }) {
  const [formData, setFormData] = useState(config.value as Record<string, any>);
  const keys = Object.keys(formData);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {keys.map(key => {
          const val = formData[key];
          if (typeof val === 'object' && val !== null) return null; // Skip nested objects
          return (
            <div key={key} className="space-y-1.5">
              <Label className="text-sm font-medium">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Label>
              <Input
                value={String(val || '')}
                onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                className={String(val).includes('[À RENSEIGNER]') ? 'border-destructive' : ''}
              />
            </div>
          );
        })}
      </div>
      <Button onClick={() => onSave(formData)} className="gap-2">
        <Save className="h-4 w-4" />
        Enregistrer
      </Button>
    </div>
  );
}

// ========== Reference Data Table ==========
function ReferenceDataTable({ type, items }: { type: string; items: ReferenceDataRow[] }) {
  const updateMutation = useUpdateReferenceData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const handleEdit = (item: ReferenceDataRow) => {
    setEditingId(item.id);
    setEditLabel(item.label);
  };

  const handleSave = (item: ReferenceDataRow) => {
    updateMutation.mutate({ id: item.id, label: editLabel });
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground mb-2">
        {items.length} élément{items.length > 1 ? 's' : ''}
      </div>
      <div className="grid gap-1.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
            <span className="text-xs text-muted-foreground font-mono w-8 text-right shrink-0">
              {item.ordre}
            </span>
            {item.color && (
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            )}
            {editingId === item.id ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  className="h-7 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleSave(item)}
                />
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleSave(item)}>
                  <Save className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm flex-1">{item.label}</span>
                <Badge variant="outline" className="text-xs font-mono">{item.code}</Badge>
                {item.metadata?.phase && (
                  <Badge variant="secondary" className="text-xs">{item.metadata.phase}</Badge>
                )}
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleEdit(item)}>
                  Modifier
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== Main Page ==========
export default function ParametresConfiguration() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: configs, isLoading: configLoading } = useAllAppConfigs();
  const { data: refData, isLoading: refLoading } = useAllReferenceData();
  const updateConfig = useUpdateAppConfig();

  const getConfig = (key: string) => configs?.find(c => c.key === key);

  const refTypes = refData
    ? [...new Set(refData.map(d => d.type))]
    : [];

  const refTypeLabels: Record<string, string> = {
    statut_etablissement: 'Statuts établissement',
    type_etablissement: 'Types établissement',
    dpi: 'DPI (Logiciels patients)',
    region: 'Régions',
    role: 'Rôles utilisateur',
    type_offre: 'Types d\'offre',
    pallier: 'Paliers tarifaires',
    duree_phase: 'Durées de phases',
    phase: 'Phases',
  };

  const refTypeIcons: Record<string, typeof Database> = {
    statut_etablissement: List,
    type_etablissement: Building2,
    dpi: Database,
    region: Globe,
    role: Building2,
  };

  const handleSaveConfig = (key: string, value: Record<string, any>) => {
    updateConfig.mutate({ key, value });
  };

  if (configLoading || refLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("min-h-dvh bg-gradient-page", isMobile ? "p-2" : "p-4 lg:p-6")}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/parametres')} aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className={cn("font-bold", isMobile ? "text-lg" : "text-2xl")}>Configuration générale</h1>
          <p className="text-sm text-muted-foreground">Informations société, emails, URLs et données de référence</p>
        </div>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className={cn("flex-wrap", isMobile ? "h-auto gap-1" : "")}>
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span className={isMobile ? "text-xs" : ""}>Société</span>
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <span className={isMobile ? "text-xs" : ""}>Emails</span>
          </TabsTrigger>
          <TabsTrigger value="urls" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            <span className={isMobile ? "text-xs" : ""}>URLs</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span className={isMobile ? "text-xs" : ""}>Documents</span>
          </TabsTrigger>
          <TabsTrigger value="reference" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            <span className={isMobile ? "text-xs" : ""}>Référentiel</span>
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className={isMobile ? "text-xs" : ""}>Applications</span>
          </TabsTrigger>
          <TabsTrigger value="api-mcp" className="gap-1.5">
            <Plug className="h-3.5 w-3.5" />
            <span className={isMobile ? "text-xs" : ""}>API & MCP</span>
          </TabsTrigger>
        </TabsList>

        {/* Informations société */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Informations légales
              </CardTitle>
              <CardDescription>
                Coordonnées affichées sur les factures, exports PDF et documents officiels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getConfig('company_info') ? (
                <CompanyInfoEditor
                  config={getConfig('company_info')!}
                  onSave={value => handleSaveConfig('company_info', value)}
                />
              ) : (
                <p className="text-muted-foreground text-sm">Configuration introuvable</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration emails */}
        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Adresses email expéditeur
              </CardTitle>
              <CardDescription>
                Adresses utilisées pour l'envoi d'emails par catégorie (notifications, formations, support).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getConfig('email_sender') ? (
                <JsonConfigEditor
                  config={getConfig('email_sender')!}
                  onSave={value => handleSaveConfig('email_sender', value)}
                />
              ) : (
                <p className="text-muted-foreground text-sm">Configuration introuvable</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* URLs */}
        <TabsContent value="urls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                URL de production
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getConfig('production_url') ? (
                <JsonConfigEditor
                  config={getConfig('production_url')!}
                  onSave={value => handleSaveConfig('production_url', value)}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration Qonto</CardTitle>
            </CardHeader>
            <CardContent>
              {getConfig('qonto_config') ? (
                <JsonConfigEditor
                  config={getConfig('qonto_config')!}
                  onSave={value => handleSaveConfig('qonto_config', value)}
                />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Pied de page des documents
              </CardTitle>
              <CardDescription>
                Informations affichées dans le footer des exports Gantt, rapports et documents PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getConfig('document_footer') ? (
                <JsonConfigEditor
                  config={getConfig('document_footer')!}
                  onSave={value => handleSaveConfig('document_footer', value)}
                />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Applications externes declarees par l'exploitant */}
        <TabsContent value="applications" className="space-y-4">
          <ApplicationsExternes />
        </TabsContent>

        {/* Interfaces de programmation et serveur MCP */}
        <TabsContent value="api-mcp" className="space-y-4">
          <ServeurMcp />
          <Card>
            <CardHeader>
              <CardTitle>Clés d'API</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Deux écrans créent des clés dans la même table, par deux chemins différents.
                Préférez celui de la plateforme : il crée la clé côté serveur et valide sa portée,
                alors que l'espace développeur l'engendre dans le navigateur.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/parametres/platform-api">Clés de plateforme</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/api-developer">Espace développeur</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Données de référence */}
        <TabsContent value="reference" className="space-y-4">
          {refTypes.map(type => (
            <Card key={type}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {refTypeLabels[type] || type}
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {refData?.filter(d => d.type === type).length || 0}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReferenceDataTable
                  type={type}
                  items={refData?.filter(d => d.type === type) || []}
                />
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
