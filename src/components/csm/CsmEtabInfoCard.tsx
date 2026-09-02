import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditableCell } from '@/components/csm/EditableCell';
import { EditableDateCell } from '@/components/csm/EditableDateCell';
import { EditableListCell } from '@/components/csm/EditableListCell';
import { ClipboardList, Building2, Target, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabaseBrowser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

interface CsmEtabInfoCardProps {
  etablissementId: string;
}

export function CsmEtabInfoCard({ etablissementId }: CsmEtabInfoCardProps) {
  const queryClient = useQueryClient();

  const { data: etab } = useQuery({
    queryKey: ['csm-etab-info', etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('id, nom, contexte_csm, besoins_du_compte, prochaine_action_orga, date_action_orga, prochaine_action_csm, date_action_csm, point_hebdo, derniere_venue_site, modules_actifs')
        .eq('id', etablissementId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Établissement introuvable');
      return data as any;
    },
    staleTime: 5 * 60 * 1000
  });

  const handleUpdate = async (field: string, value: any) => {
    try {
      const { data, error } = await supabase
        .from('etablissements')
        .update({ [field]: value } as never)
        .eq('id', etablissementId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Modification non autorisée ou établissement introuvable.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['csm-etab-info', etablissementId] });
      queryClient.invalidateQueries({ queryKey: ['production'] });
    } catch (error) {
      toast.error(sanitizeSupabaseError(error as Error));
    }
  };

  if (!etab) return null;

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          Informations CSM
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        {/* Contexte & Besoins - compact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <div>
            <p className="text-[13px] font-medium text-primary/80 mb-0.5 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              Contexte du compte
            </p>
            <EditableCell
              value={etab.contexte_csm}
              placeholder="Contexte du compte..."
              multiline
              onSave={(v) => handleUpdate('contexte_csm', v || null)}
            />
          </div>
          <div>
            <p className="text-[13px] font-medium text-primary/80 mb-0.5 flex items-center gap-1">
              <Target className="h-3.5 w-3.5 text-primary" />
              Besoins du compte
            </p>
            <EditableCell
              value={etab.besoins_du_compte}
              placeholder="Besoins du compte..."
              multiline
              onSave={(v) => handleUpdate('besoins_du_compte', v || null)}
            />
          </div>
        </div>

        {/* Actions sections side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Actions Orga */}
          <div className="rounded-md border-l-[3px] border-l-[hsl(var(--success))] border border-[hsl(var(--success)/0.2)] p-2.5 bg-[hsl(var(--marque-pastel-cyan)/0.3)]">
            <p className="text-[13px] font-semibold text-foreground mb-1.5">
              Actions organisationnelles
            </p>
            <EditableListCell
              items={etab.prochaine_action_orga}
              placeholder="Ajouter une action orga..."
              onSave={(v) => handleUpdate('prochaine_action_orga', v)}
            />
          </div>

          {/* Actions CSM */}
          <div className="rounded-md border-l-[3px] border-l-[hsl(var(--marque-pastel-blue))] border border-[hsl(var(--marque-pastel-violet)/0.4)] p-2.5 bg-[hsl(var(--marque-pastel-violet)/0.15)]">
            <p className="text-[13px] font-semibold text-foreground mb-1.5">
              Actions CSM
            </p>
            <EditableListCell
              items={etab.prochaine_action_csm}
              placeholder="Ajouter une action CSM..."
              onSave={(v) => handleUpdate('prochaine_action_csm', v)}
            />
          </div>
        </div>

        {/* Dernière venue sur site - inline */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[13px] font-medium text-muted-foreground shrink-0">Dernière venue sur site</span>
          <EditableDateCell
            value={etab.derniere_venue_site}
            placeholder="—"
            onSave={(v) => handleUpdate('derniere_venue_site', v || null)}
            className="text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
