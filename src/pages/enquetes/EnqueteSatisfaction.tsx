import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { EnqueteShell } from "@/components/enquetes/EnqueteShell";
import { RadioField, CheckboxArrayField, ScaleField, TextField } from "@/components/enquetes/fields";
import { useEnqueteContext, useSubmitEnquete } from "@/hooks/enquetes/useEnquete";
import {
  ENQUETE_LABELS, FONCTIONS, DPIS, MODULES, FONCTIONNALITES,
  FREQUENCE_USAGE, BEAUCOUP_PAS_DU_TOUT, GAIN_TEMPS,
} from "@/components/enquetes/constants";

export default function EnqueteSatisfaction() {
  const { token } = useParams<{ token: string }>();
  const ctx = useEnqueteContext(token);
  const submit = useSubmitEnquete(token, 'satisfaction');

  const [form, setForm] = useState({
    nom_prenom: '',
    fonction: '',
    fonction_autre: '',
    dpi: '',
    dpi_autre: '',
    modules_utilises: [] as string[],
    frequence_usage: '',
    reduction_temps_admin: '',
    aide_cotation: '',
    gain_temps_estime: '',
    fonctionnalites_principales: [] as string[],
    fonctionnalites_autre: '',
    fonctionnalites_non_utilisees: '',
    satisfaction_globale: 8,
    nps_score: 8,
    points_forts: '',
    ameliorations: '',
  });

  useEffect(() => {
    if (ctx.data?.success && ctx.data.user?.nom) {
      setForm((f) => ({ ...f, nom_prenom: f.nom_prenom || ctx.data!.user!.nom }));
    }
  }, [ctx.data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required: Array<[string, unknown]> = [
      ['Nom et prénom', form.nom_prenom.trim()],
      ['Fonction', form.fonction],
      ['DPI', form.dpi],
      ['Fréquence d\'usage', form.frequence_usage],
      ['Réduction temps admin', form.reduction_temps_admin],
      ['Aide à la cotation', form.aide_cotation],
      ['Gain de temps estimé', form.gain_temps_estime],
    ];
    for (const [label, v] of required) {
      if (!v) { toast.error(`Champ requis : ${label}`); return; }
    }
    try {
      await submit.mutateAsync(form);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const ctxErr = ctx.data && !ctx.data.success ? ctx.data.error || null : null;

  return (
    <EnqueteShell
      title={ENQUETE_LABELS.satisfaction.title}
      subtitle={ENQUETE_LABELS.satisfaction.subtitle}
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
          <RadioField label="Fonction" required value={form.fonction} onChange={(v) => setForm({ ...form, fonction: v })} options={FONCTIONS} />
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
        <CardHeader><CardTitle>Votre utilisation de OpenPulse</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <CheckboxArrayField label="Quel(s) module(s) utilisez-vous ?" values={form.modules_utilises} onChange={(v) => setForm({ ...form, modules_utilises: v })} options={MODULES} />
          <RadioField label="À quelle fréquence utilisez-vous OpenPulse ?" required value={form.frequence_usage} onChange={(v) => setForm({ ...form, frequence_usage: v })} options={FREQUENCE_USAGE} />
          <RadioField label="Dans quelle mesure OpenPulse vous permet-il de réduire le temps consacré aux tâches administratives et de saisie ?" required value={form.reduction_temps_admin} onChange={(v) => setForm({ ...form, reduction_temps_admin: v })} options={BEAUCOUP_PAS_DU_TOUT} />
          <RadioField label="Dans quelle mesure OpenPulse vous aide-t-il dans l'identification et l'optimisation des cotations ?" required value={form.aide_cotation} onChange={(v) => setForm({ ...form, aide_cotation: v })} options={BEAUCOUP_PAS_DU_TOUT} />
          <RadioField label="Quel gain de temps estimez-vous réaliser par patient ?" required value={form.gain_temps_estime} onChange={(v) => setForm({ ...form, gain_temps_estime: v })} options={GAIN_TEMPS} />
          <CheckboxArrayField
            label="Quelles fonctionnalités utilisez-vous principalement ?"
            values={form.fonctionnalites_principales}
            onChange={(v) => setForm({ ...form, fonctionnalites_principales: v })}
            options={FONCTIONNALITES}
            allowOther={{ value: form.fonctionnalites_autre, onChange: (v) => setForm({ ...form, fonctionnalites_autre: v }) }}
          />
          <TextField
            label="Y a-t-il des fonctionnalités que vous n'utilisez jamais ? Pour quelles raisons ?"
            value={form.fonctionnalites_non_utilisees}
            onChange={(v) => setForm({ ...form, fonctionnalites_non_utilisees: v })}
            multiline
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Satisfaction & recommandation</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <ScaleField label="Quel est votre niveau de satisfaction global concernant OpenPulse ?" required min={1} max={10} value={form.satisfaction_globale} onChange={(v) => setForm({ ...form, satisfaction_globale: v })} minLabel="Très insatisfait" maxLabel="Très satisfait" />
          <ScaleField label="Recommanderiez-vous OpenPulse à un collègue ?" required min={0} max={10} value={form.nps_score} onChange={(v) => setForm({ ...form, nps_score: v })} minLabel="Pas du tout probable" maxLabel="Tout à fait probable" />
          <TextField label="Selon vous, quels sont les principaux points forts de OpenPulse ?" value={form.points_forts} onChange={(v) => setForm({ ...form, points_forts: v })} multiline />
          <TextField label="Selon vous, quelles améliorations pourraient être apportées à OpenPulse ?" value={form.ameliorations} onChange={(v) => setForm({ ...form, ameliorations: v })} multiline />
        </CardContent>
      </Card>
    </EnqueteShell>
  );
}
