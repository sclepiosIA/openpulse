import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Key } from "lucide-react";

interface ComptesAccesChecklistProps {
  comptes: Record<string, boolean>;
  onUpdate: (comptes: Record<string, boolean>) => void;
}

const COMPTES_CONFIG = [
  { key: 'mail', label: 'Mail professionnel' },
  { key: 'vpn', label: 'VPN' },
  { key: 'bookstack', label: 'Bookstack' },
  { key: 'passbolt', label: 'Passbolt' },
  { key: 'espocrm', label: 'EspoCRM' },
  { key: 'google_workspace', label: 'Google Workspace' },
  { key: 'penpot', label: 'Penpot' },
  { key: 'nextcloud', label: 'Nextcloud' },
  { key: 'gitea', label: 'Gitea' },
  { key: 'kimai', label: 'Kimai' },
  { key: 'calcom', label: 'Cal.com' },
  { key: 'ssh', label: 'Accès SSH' },
  { key: 'azure', label: 'Azure' },
  { key: 'ovh', label: 'OVH' },
  { key: 'openai', label: 'OpenAI' },
  { key: 'reseaux_sociaux', label: 'Réseaux sociaux' },
  { key: 'ausha', label: 'Ausha' },
  { key: 'brevo', label: 'Brevo' },
];

export function ComptesAccesChecklist({ comptes, onUpdate }: ComptesAccesChecklistProps) {
  const handleToggle = (key: string, checked: boolean) => {
    onUpdate({ ...comptes, [key]: checked });
  };

  const activeCount = Object.values(comptes).filter(Boolean).length;
  const totalCount = COMPTES_CONFIG.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Comptes et accès
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {activeCount} / {totalCount} activés
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {COMPTES_CONFIG.map((compte) => (
            <div key={compte.key} className="flex items-center gap-2">
              <Checkbox
                id={compte.key}
                checked={comptes[compte.key] || false}
                onCheckedChange={(checked) => handleToggle(compte.key, checked as boolean)}
              />
              <Label htmlFor={compte.key} className="cursor-pointer text-sm">
                {compte.label}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
