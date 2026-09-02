import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { EnqueteShell } from "@/components/enquetes/EnqueteShell";
import { RadioField, CheckboxArrayField, ScaleField, TextField } from "@/components/enquetes/fields";
import { useEnqueteContext, useSubmitEnquete } from "@/hooks/enquetes/useEnquete";
import { ENQUETE_LABELS, FONCTIONS, DPIS, MODULES, FORMATION_RECUE } from "@/components/enquetes/constants";

export default function EnqueteCES() {
  const { token } = useParams<{ token: string }>();
  const ctx = useEnqueteContext(token);
  const submit = useSubmitEnquete(token, 'ces');

  const [form, setForm] = useState({
    nom_prenom: '',
    fonction: '',
    fonction_autre: '',
    dpi: '',
    dpi_autre: '',
    formation_recue: '',
    modules_formes: [] as string[],
    effort_score: 3,
    facteurs_freins: '',
  });

  useEffect(() => {
    if (ctx.data?.success && ctx.data.user?.nom) {
      setForm((f) => ({ ...f, nom_prenom: f.nom_prenom || ctx.data!.user!.nom }));
    }
  }, [ctx.data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom_prenom.trim()) { toast.error('Nom et prénom requis'); return; }
    if (!form.fonction) { toast.error('Fonction requise'); return; }
    if (!form.dpi) { toast.error('DPI requis'); return; }
    if (!form.formation_recue) { toast.error('Formation reçue requise'); return; }
    try {
      await submit.mutateAsync(form);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const ctxErr = ctx.data && !ctx.data.success ? ctx.data.error || null : null;

  return (
    <EnqueteShell
      title={ENQUETE_LABELS.ces.title}
      subtitle={ENQUETE_LABELS.ces.subtitle}
      onSubmit={handleSubmit}
      isLoading={ctx.isLoading}
      isError={ctxErr}
      isSubmitting={submit.isPending}
      isSuccess={submit.isSuccess}
    >
      <Card>
        <CardHeader><CardTitle>Vos informations</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {ctx.data?.etablissement && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Établissement :</span> <span className="font-medium">{ctx.data.etablissement.nom}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>Nom et prénom <span className="text-destructive">*</span></Label>
            <Input value={form.nom_prenom} onChange={(e) => setForm({ ...form, nom_prenom: e.target.value })} maxLength={150} />
          </div>
          <RadioField label="Fonction au sein du service" required value={form.fonction} onChange={(v) => setForm({ ...form, fonction: v })} options={FONCTIONS} />
          {form.fonction === 'autre' && (
            <Input value={form.fonction_autre} onChange={(e) => setForm({ ...form, fonction_autre: e.target.value })} placeholder="Précisez la fonction" maxLength={150} />
          )}
          <RadioField label="Sélectionnez votre DPI" required value={form.dpi} onChange={(v) => setForm({ ...form, dpi: v })} options={DPIS} />
          {form.dpi === 'autre' && (
            <Input value={form.dpi_autre} onChange={(e) => setForm({ ...form, dpi_autre: e.target.value })} placeholder="Précisez le DPI" maxLength={150} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Votre prise en main</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <RadioField label="Avez-vous bénéficié d'une formation à l'utilisation de OpenPulse ?" required value={form.formation_recue} onChange={(v) => setForm({ ...form, formation_recue: v })} options={FORMATION_RECUE} />
          <CheckboxArrayField label="Sur quel(s) module(s) avez-vous été formé ?" values={form.modules_formes} onChange={(v) => setForm({ ...form, modules_formes: v })} options={MODULES} />
          <ScaleField
            label="À combien évaluez-vous l'effort que vous avez dû fournir pour prendre en main et utiliser les fonctionnalités de OpenPulse ?"
            required
            min={0} max={10}
            value={form.effort_score}
            onChange={(v) => setForm({ ...form, effort_score: v })}
            minLabel="Aucun effort"
            maxLabel="Effort très important"
          />
          <TextField
            label="Quels éléments ont facilité ou freiné votre prise en main des fonctionnalités de OpenPulse ?"
            value={form.facteurs_freins}
            onChange={(v) => setForm({ ...form, facteurs_freins: v })}
            multiline
            placeholder="Votre commentaire (facultatif)…"
          />
        </CardContent>
      </Card>
    </EnqueteShell>
  );
}
