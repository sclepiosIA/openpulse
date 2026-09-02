import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Laptop, Smartphone, Plus, Trash2 } from "lucide-react";
import type { Materiel } from "@/hooks/tasks/useOnboardingOffboarding";

interface MaterielListProps {
  materiel: Materiel;
  onUpdate: (materiel: Materiel) => void;
}

export function MaterielList({ materiel, onUpdate }: MaterielListProps) {
  const [newLicence, setNewLicence] = useState({ nom: '', numero: '' });

  const handleMaterielToggle = (type: 'pc_mac' | 'laptop' | 'smartphone', checked: boolean) => {
    onUpdate({
      ...materiel,
      [type]: { ...materiel[type], assigne: checked }
    });
  };

  const handleMaterielFieldChange = (type: 'pc_mac' | 'laptop' | 'smartphone', field: string, value: string) => {
    onUpdate({
      ...materiel,
      [type]: { ...materiel[type], [field]: value }
    });
  };

  const handleAddLicence = () => {
    if (newLicence.nom && newLicence.numero) {
      onUpdate({
        ...materiel,
        licences: [...(materiel.licences || []), newLicence]
      });
      setNewLicence({ nom: '', numero: '' });
    }
  };

  const handleRemoveLicence = (index: number) => {
    onUpdate({
      ...materiel,
      licences: materiel.licences.filter((_, i) => i !== index)
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Laptop className="h-5 w-5" />
          Matériel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PC/MAC */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="pc_mac"
              checked={materiel.pc_mac.assigne}
              onCheckedChange={(checked) => handleMaterielToggle('pc_mac', checked as boolean)}
            />
            <Label htmlFor="pc_mac" className="font-medium cursor-pointer">
              PC / MAC
            </Label>
          </div>
          {materiel.pc_mac.assigne && (
            <div className="ml-6 space-y-2">
              <Input
                placeholder="Modèle"
                value={materiel.pc_mac.modele || ''}
                onChange={(e) => handleMaterielFieldChange('pc_mac', 'modele', e.target.value)}
              />
              <Input
                placeholder="Numéro de série"
                value={materiel.pc_mac.numero_serie || ''}
                onChange={(e) => handleMaterielFieldChange('pc_mac', 'numero_serie', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Laptop */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="laptop"
              checked={materiel.laptop.assigne}
              onCheckedChange={(checked) => handleMaterielToggle('laptop', checked as boolean)}
            />
            <Label htmlFor="laptop" className="font-medium cursor-pointer">
              Laptop
            </Label>
          </div>
          {materiel.laptop.assigne && (
            <div className="ml-6 space-y-2">
              <Input
                placeholder="Modèle"
                value={materiel.laptop.modele || ''}
                onChange={(e) => handleMaterielFieldChange('laptop', 'modele', e.target.value)}
              />
              <Input
                placeholder="Numéro de série"
                value={materiel.laptop.numero_serie || ''}
                onChange={(e) => handleMaterielFieldChange('laptop', 'numero_serie', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Smartphone */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="smartphone"
              checked={materiel.smartphone.assigne}
              onCheckedChange={(checked) => handleMaterielToggle('smartphone', checked as boolean)}
            />
            <Label htmlFor="smartphone" className="font-medium cursor-pointer">
              Smartphone
            </Label>
          </div>
          {materiel.smartphone.assigne && (
            <div className="ml-6 space-y-2">
              <Input
                placeholder="Modèle"
                value={materiel.smartphone.modele || ''}
                onChange={(e) => handleMaterielFieldChange('smartphone', 'modele', e.target.value)}
              />
              <Input
                placeholder="Numéro de série"
                value={materiel.smartphone.numero_serie || ''}
                onChange={(e) => handleMaterielFieldChange('smartphone', 'numero_serie', e.target.value)}
              />
              <Input
                placeholder="Numéro de téléphone"
                value={materiel.smartphone.numero || ''}
                onChange={(e) => handleMaterielFieldChange('smartphone', 'numero', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Licences */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="font-medium">Licences logicielles</Label>
          
          {materiel.licences?.length > 0 && (
            <div className="space-y-2">
              {materiel.licences.map((licence, index) => (
                <div key={`licence-${licence.nom}-${index}`} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{licence.nom}</div>
                    <div className="text-xs text-muted-foreground">{licence.numero}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLicence(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <Input
              placeholder="Nom de la licence"
              value={newLicence.nom}
              onChange={(e) => setNewLicence({ ...newLicence, nom: e.target.value })}
            />
            <Input
              placeholder="Numéro"
              value={newLicence.numero}
              onChange={(e) => setNewLicence({ ...newLicence, numero: e.target.value })}
            />
            <Button onClick={handleAddLicence} size="icon" aria-label="Ajouter">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
