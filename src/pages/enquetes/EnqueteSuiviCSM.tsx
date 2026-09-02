import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { EnqueteShell } from "@/components/enquetes/EnqueteShell";
import { RadioField, ScaleField, TextField } from "@/components/enquetes/fields";
import { useEnqueteContext, useSubmitEnquete } from "@/hooks/enquetes/useEnquete";
import {
  ENQUETE_LABELS, FONCTIONS, DPIS,
  CSM_CONTRIB, CSM_COMPREHENSION, CSM_REACTIVITE, CSM_UTILITE_COMITES, CSM_FREQUENCE,
} from "@/components/enquetes/constants";

export default function EnqueteSuiviCSM() {
  const { token } = useParams<{ token: string }>();
  const ctx = useEnqueteContext(token);
  const submit = useSubmitEnquete(token, 'suivi_csm');

  const [form, setForm] = useState({
    nom_prenom: '',
    fonction: '',
    fonction_autre: '',
    dpi: '',
    dpi_autre: '',
    contribution_usage: '',
    comprehension_enjeux: '',
    reactivite: '',
    utilite_comites: '',
    points_forts_axes: '',
    frequence_adaptee: '',
    note_globale: 8,
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
      ['Contribution à l\'usage', form.contribution_usage],
      ['Compréhension des enjeux', form.comprehension_enjeux],
      ['Réactivité', form.reactivite],
      ['Utilité des comités', form.utilite_comites],
      ['Fréquence adaptée', form.frequence_adaptee],
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
      title={ENQUETE_LABELS.suivi_csm.title}
      subtitle={ENQUETE_LABELS.suivi_csm.subtitle}
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
          {ctx.data?.csm && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">CSM concerné :</span> <span className="font-medium">{ctx.data.csm.nom}</span>
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
        <CardHeader><CardTitle>Évaluation du suivi CSM</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <RadioField label="Le suivi réalisé par votre CSM contribue-t-il à une meilleure utilisation de OpenPulse au sein de votre service ?" required value={form.contribution_usage} onChange={(v) => setForm({ ...form, contribution_usage: v })} options={CSM_CONTRIB} />
          <RadioField label="Votre CSM comprend-il les enjeux et les besoins de votre service ?" required value={form.comprehension_enjeux} onChange={(v) => setForm({ ...form, comprehension_enjeux: v })} options={CSM_COMPREHENSION} />
          <RadioField label="Votre CSM parvient-il à répondre à vos questions ou à obtenir les réponses dans des délais satisfaisants ?" required value={form.reactivite} onChange={(v) => setForm({ ...form, reactivite: v })} options={CSM_REACTIVITE} />
          <RadioField label="Les comités de suivi trimestriels sont-ils utiles ?" required value={form.utilite_comites} onChange={(v) => setForm({ ...form, utilite_comites: v })} options={CSM_UTILITE_COMITES} />
          <TextField label="Points forts des comités de suivi et axes d'amélioration identifiés ?" value={form.points_forts_axes} onChange={(v) => setForm({ ...form, points_forts_axes: v })} multiline />
          <RadioField label="La fréquence actuelle des comités (trimestrielle) vous semble-t-elle adaptée ?" required value={form.frequence_adaptee} onChange={(v) => setForm({ ...form, frequence_adaptee: v })} options={CSM_FREQUENCE} />
          <ScaleField label="Comment évaluez-vous la qualité du suivi CSM ?" required min={0} max={10} value={form.note_globale} onChange={(v) => setForm({ ...form, note_globale: v })} minLabel="Très insatisfaisant" maxLabel="Excellent suivi" />
          <TextField label="Quelles améliorations pourraient être apportées au suivi CSM ?" value={form.ameliorations} onChange={(v) => setForm({ ...form, ameliorations: v })} multiline />
        </CardContent>
      </Card>
    </EnqueteShell>
  );
}
