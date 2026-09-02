import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Loader2, Sparkles } from "lucide-react";
import { useCreateDemandeFormation } from "@/hooks/hr/useRHMutations";

const TYPE_FORMATION_OPTIONS = [
  { value: "formation_externe", label: "Formation externe" },
  { value: "conference", label: "Conférence / Séminaire" },
  { value: "certification", label: "Certification" },
  { value: "credit_formation", label: "Crédit formation (CPF)" },
  { value: "mooc", label: "MOOC / E-learning" },
];

export function RHDemandeFormation() {
  const createMutation = useCreateDemandeFormation();
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    type: "",
    organisme: "",
    cout_estime: "",
    lien_formation: "",
    date_souhaitee: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    createMutation.mutate(formData, {
      onSuccess: () => {
        setFormData({
          titre: "",
          description: "",
          type: "",
          organisme: "",
          cout_estime: "",
          lien_formation: "",
          date_souhaitee: "",
        });
      },
    });
  };

  const isSubmitting = createMutation.isPending;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Demande de formation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre de la formation *</Label>
            <Input
              id="titre"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Ex: Certification AWS Solutions Architect"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type de formation *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FORMATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organisme">Organisme de formation</Label>
            <Input
              id="organisme"
              value={formData.organisme}
              onChange={(e) => setFormData({ ...formData, organisme: e.target.value })}
              placeholder="Ex: AWS Training"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cout_estime">Coût estimé (€)</Label>
              <Input
                id="cout_estime"
                type="number"
                value={formData.cout_estime}
                onChange={(e) => setFormData({ ...formData, cout_estime: e.target.value })}
                placeholder="1500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_souhaitee">Date souhaitée</Label>
              <Input
                id="date_souhaitee"
                type="date"
                value={formData.date_souhaitee}
                onChange={(e) => setFormData({ ...formData, date_souhaitee: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lien_formation">Lien vers la formation</Label>
            <Input
              id="lien_formation"
              type="url"
              value={formData.lien_formation}
              onChange={(e) => setFormData({ ...formData, lien_formation: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description / Justification</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Expliquez pourquoi cette formation est pertinente pour votre poste..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || !formData.titre || !formData.type}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Soumettre la demande
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
