import type { Node } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { ACTION_LABELS, TRIGGER_LABELS, type WorkflowActionType, type WorkflowTriggerType } from '@/types/workflow';
import { ConditionGroupEditor } from './ConditionGroupEditor';
import { VariablesHelper } from './VariablesHelper';
import { NodeInlineTest } from './NodeInlineTest';
import { useParams } from 'react-router-dom';

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  triggerType?: WorkflowTriggerType;
}

export function NodeConfigPanel({ node, onUpdate, onDelete, onClose, triggerType }: NodeConfigPanelProps) {
  const { id: workflowId } = useParams<{ id: string }>();

  if (!node) {
    return (
      <div className="w-80 border-l bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground text-center mt-8">
          Sélectionnez un bloc pour le configurer.
        </p>
      </div>
    );
  }

  const data: any = node.data || {};
  const config: any = data.config || {};

  const updateData = (patch: Record<string, unknown>) => onUpdate(node.id, { ...data, ...patch });
  const updateConfig = (patch: Record<string, unknown>) =>
    onUpdate(node.id, { ...data, config: { ...config, ...patch } });

  return (
    <div className="w-80 border-l bg-muted/30 p-4 overflow-y-auto space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize">{node.type}</h3>
        {node.type !== 'trigger' && (
          <Button size="icon" variant="ghost" onClick={() => onDelete(node.id)} aria-label="Supprimer">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <div>
        <Label className="text-xs">Libellé</Label>
        <Input
          value={data.label || ''}
          onChange={(e) => updateData({ label: e.target.value })}
          className="mt-1"
        />
      </div>

      {node.type === 'trigger' && (
        <>
          <div>
            <Label className="text-xs">Type de déclencheur</Label>
            <Select
              value={data.trigger_type || ''}
              onValueChange={(v) => updateData({ trigger_type: v as WorkflowTriggerType })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trigger-specific config */}
          {data.trigger_type === 'prospect.score_above' && (
            <>
              <div><Label className="text-xs">Seuil de score (0-100)</Label>
                <Input type="number" min={0} max={100} value={config.threshold ?? 70} onChange={(e) => updateConfig({ threshold: Number(e.target.value) })} className="mt-1" /></div>
              <div><Label className="text-xs">Opérateur</Label>
                <Select value={config.operator || 'gte'} onValueChange={(v) => updateConfig({ operator: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gte">≥ supérieur ou égal</SelectItem>
                    <SelectItem value="gt">&gt; strictement supérieur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {data.trigger_type === 'email.no_reply_after_days' && (
            <>
              <div><Label className="text-xs">Nombre de jours sans réponse</Label>
                <Input type="number" min={1} max={90} value={config.days ?? 3} onChange={(e) => updateConfig({ days: Number(e.target.value) })} className="mt-1" /></div>
              <div><Label className="text-xs">Filtre destinataire (optionnel)</Label>
                <Input value={config.recipient_filter || ''} onChange={(e) => updateConfig({ recipient_filter: e.target.value })} placeholder="ex: @mondomaine.fr" className="mt-1" /></div>
            </>
          )}

          {data.trigger_type === 'calendar.event_starts_in' && (
            <div><Label className="text-xs">Minutes avant l'événement</Label>
              <Input type="number" min={5} max={1440} value={config.minutes_before ?? 15} onChange={(e) => updateConfig({ minutes_before: Number(e.target.value) })} className="mt-1" /></div>
          )}

          {data.trigger_type === 'churn.risk_detected' && (
            <div><Label className="text-xs">Seuil de risque (0-100)</Label>
              <Input type="number" min={0} max={100} value={config.risk_threshold ?? 60} onChange={(e) => updateConfig({ risk_threshold: Number(e.target.value) })} className="mt-1" /></div>
          )}

          {(data.trigger_type === 'schedule_cron' || data.trigger_type === 'schedule') && (
            <>
              <div><Label className="text-xs">Expression cron</Label>
                <Input value={config.cron_expression || ''} onChange={(e) => updateConfig({ cron_expression: e.target.value })} placeholder="0 9 * * 1-5" className="mt-1 font-mono text-xs" /></div>
              <p className="text-[10px] text-muted-foreground">Format : minute heure jour mois jour_semaine. Ex: <code>0 9 * * 1-5</code> = lun-ven à 9h.</p>
            </>
          )}

          {data.trigger_type === 'webhook' && (
            <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
              🔌 Les tokens webhook se gèrent depuis <strong>Automatisations → Webhooks</strong>. Le moteur recevra le payload HTTP complet dans <code>{'{{trigger.*}}'}</code>.
            </div>
          )}
        </>
      )}

      {node.type === 'condition' && (
        <>
          <VariablesHelper triggerType={triggerType} />
          <div>
            <Label className="text-xs mb-1 block">Règles (ET / OU imbriqués)</Label>
            <ConditionGroupEditor
              value={config as any}
              onChange={(v) => onUpdate(node.id, { ...data, config: v })}
            />
          </div>
        </>
      )}

      {node.type === 'delay' && (
        <>
          <div>
            <Label className="text-xs">Quantité</Label>
            <Input
              type="number"
              min={1}
              value={config.amount || 1}
              onChange={(e) => updateConfig({ amount: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Unité</Label>
            <Select value={config.unit || 'minutes'} onValueChange={(v) => updateConfig({ unit: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Heures</SelectItem>
                <SelectItem value="days">Jours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {node.type === 'action' && (
        <>
          <div>
            <Label className="text-xs">Type d'action</Label>
            <Select
              value={data.action_type || ''}
              onValueChange={(v) => updateData({ action_type: v as WorkflowActionType })}
            >
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data.action_type === 'create_task' && (
            <>
              <div>
                <Label className="text-xs">Titre tâche</Label>
                <Input value={config.titre || ''} onChange={(e) => updateConfig({ titre: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={config.description || ''} onChange={(e) => updateConfig({ description: e.target.value })} className="mt-1" rows={3} />
              </div>
              <div>
                <Label className="text-xs">Priorité</Label>
                <Select value={config.priorite || 'medium'} onValueChange={(v) => updateConfig({ priorite: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Échéance (jours)</Label>
                <Input
                  type="number"
                  value={config.echeance_offset_days || ''}
                  onChange={(e) => updateConfig({ echeance_offset_days: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </>
          )}

          {data.action_type === 'send_email' && (
            <>
              <div><Label className="text-xs">Destinataire</Label>
                <Input value={config.to || ''} onChange={(e) => updateConfig({ to: e.target.value })} placeholder="{{trigger.email}}" className="mt-1" /></div>
              <div><Label className="text-xs">Sujet</Label>
                <Input value={config.subject || ''} onChange={(e) => updateConfig({ subject: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Corps</Label>
                <Textarea value={config.body || ''} onChange={(e) => updateConfig({ body: e.target.value })} className="mt-1" rows={4} /></div>
            </>
          )}

          {data.action_type === 'send_notification' && (
            <>
              <div><Label className="text-xs">User ID (vide = créateur)</Label>
                <Input value={config.user_id || ''} onChange={(e) => updateConfig({ user_id: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Message</Label>
                <Textarea value={config.message || ''} onChange={(e) => updateConfig({ message: e.target.value })} className="mt-1" rows={2} /></div>
            </>
          )}

          {data.action_type === 'create_ticket' && (
            <>
              <div><Label className="text-xs">Sujet</Label>
                <Input value={config.sujet || ''} onChange={(e) => updateConfig({ sujet: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Priorité</Label>
                <Select value={config.priorite || 'medium'} onValueChange={(v) => updateConfig({ priorite: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {data.action_type === 'update_field' && (
            <>
              <div><Label className="text-xs">Table</Label>
                <Input value={config.table || ''} onChange={(e) => updateConfig({ table: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Record ID</Label>
                <Input value={config.record_id || ''} onChange={(e) => updateConfig({ record_id: e.target.value })} placeholder="{{trigger.etablissement_id}}" className="mt-1" /></div>
              <div><Label className="text-xs">Champ</Label>
                <Input value={config.field || ''} onChange={(e) => updateConfig({ field: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Valeur</Label>
                <Input value={config.value || ''} onChange={(e) => updateConfig({ value: e.target.value })} className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'webhook' && (
            <>
              <div><Label className="text-xs">URL</Label>
                <Input value={config.url || ''} onChange={(e) => updateConfig({ url: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Méthode</Label>
                <Select value={config.method || 'POST'} onValueChange={(v) => updateConfig({ method: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {data.action_type === 'ai_write_email' && (
            <>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                ✨ L'IA rédigera un email contextuel via GPT-5. Variables : <code>{'{{trigger.x}}'}</code>.
              </div>
              <div><Label className="text-xs">Objectif de l'email</Label>
                <Textarea value={config.ai_objective || ''} onChange={(e) => updateConfig({ ai_objective: e.target.value })} placeholder="ex: relancer un prospect après 7j sans réponse" className="mt-1" rows={2} /></div>
              <div><Label className="text-xs">Contexte du destinataire</Label>
                <Textarea value={config.ai_recipient_context || ''} onChange={(e) => updateConfig({ ai_recipient_context: e.target.value })} placeholder="ex: directeur EHPAD secteur Martinique, intéressé par la solution" className="mt-1" rows={2} /></div>
              <div><Label className="text-xs">Ton</Label>
                <Select value={config.ai_tone || 'formel'} onValueChange={(v) => updateConfig({ ai_tone: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formel">Formel</SelectItem>
                    <SelectItem value="amical">Amical</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="empathique">Empathique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Sujet suggéré (l'IA l'affinera)</Label>
                <Input value={config.ai_subject_hint || ''} onChange={(e) => updateConfig({ ai_subject_hint: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Longueur max (mots)</Label>
                <Input type="number" min={50} max={600} value={config.ai_max_words || 200} onChange={(e) => updateConfig({ ai_max_words: Number(e.target.value) })} className="mt-1" /></div>
              <div><Label className="text-xs">Envoyer à (laisser vide pour ne pas envoyer)</Label>
                <Input value={config.ai_send_to || ''} onChange={(e) => updateConfig({ ai_send_to: e.target.value })} placeholder="{{trigger.sender_email}}" className="mt-1" /></div>
              <div><Label className="text-xs">Clé de sortie (réutilisable via {`{{ai.xxx}}`})</Label>
                <Input value={config.ai_output_key || ''} onChange={(e) => updateConfig({ ai_output_key: e.target.value })} placeholder="email_genere" className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'ai_summarize' && (
            <>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                ✨ Résume un contenu via GPT-5. Sortie disponible via <code>{'{{ai.<clé>.summary}}'}</code>.
              </div>
              <div><Label className="text-xs">Contenu à résumer</Label>
                <Textarea value={config.ai_input || ''} onChange={(e) => updateConfig({ ai_input: e.target.value })} placeholder="{{trigger.body}}" className="mt-1" rows={4} /></div>
              <div><Label className="text-xs">Longueur</Label>
                <Select value={config.ai_summary_length || 'moyen'} onValueChange={(v) => updateConfig({ ai_summary_length: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="court">Court (2-3 phrases)</SelectItem>
                    <SelectItem value="moyen">Moyen (4-6 phrases)</SelectItem>
                    <SelectItem value="long">Long (8-12 phrases)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Clé de sortie</Label>
                <Input value={config.ai_output_key || ''} onChange={(e) => updateConfig({ ai_output_key: e.target.value })} placeholder="resume" className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'set_variables' && (
            <>
              <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                Définit des variables réutilisables via <code>{'{{vars.nom}}'}</code>. Format JSON : <code>{'{"cle":"valeur"}'}</code>
              </div>
              <div><Label className="text-xs">Variables (JSON)</Label>
                <Textarea
                  value={typeof config.variables === 'string' ? config.variables : JSON.stringify(config.variables || {}, null, 2)}
                  onChange={(e) => {
                    try { updateConfig({ variables: JSON.parse(e.target.value) }); }
                    catch { updateConfig({ variables: e.target.value }); }
                  }}
                  rows={4}
                  className="mt-1 font-mono text-xs"
                  placeholder='{"score":"{{trigger.score}}","priorite":"haute"}'
                />
              </div>
            </>
          )}

          {data.action_type === 'update_etablissement_statut' && (
            <>
              <div><Label className="text-xs">Établissement (laisser vide = trigger)</Label>
                <Input value={config.etablissement_id || ''} onChange={(e) => updateConfig({ etablissement_id: e.target.value })} placeholder="{{trigger.etablissement_id}}" className="mt-1" /></div>
              <div><Label className="text-xs">Nouveau statut</Label>
                <Input value={config.statut || ''} onChange={(e) => updateConfig({ statut: e.target.value })} placeholder="ex: contractuel" className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'assign_user' && (
            <>
              <div><Label className="text-xs">Table</Label>
                <Input value={config.table || 'taches'} onChange={(e) => updateConfig({ table: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Record ID</Label>
                <Input value={config.record_id || ''} onChange={(e) => updateConfig({ record_id: e.target.value })} placeholder="{{trigger.task_id}}" className="mt-1" /></div>
              <div><Label className="text-xs">Champ assignation</Label>
                <Input value={config.field || 'responsable_id'} onChange={(e) => updateConfig({ field: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">User ID</Label>
                <Input value={config.user_id || ''} onChange={(e) => updateConfig({ user_id: e.target.value })} className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'for_each' && (
            <>
              <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                🔁 Itère sur un tableau. Chaque élément est disponible via <code>{'{{item.*}}'}</code>. Max 100 itérations.
              </div>
              <div><Label className="text-xs">Source (chemin dans le contexte)</Label>
                <Input value={config.items_path || ''} onChange={(e) => updateConfig({ items_path: e.target.value })} placeholder="trigger.items" className="mt-1" /></div>
              <div><Label className="text-xs">Limite max d'itérations</Label>
                <Input type="number" min={1} max={100} value={config.max_iterations ?? 100} onChange={(e) => updateConfig({ max_iterations: Number(e.target.value) })} className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'wait_until' && (
            <>
              <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                ⏳ Attend jusqu'à une date/heure précise (max 30 jours). Le workflow reprendra automatiquement.
              </div>
              <div><Label className="text-xs">Date cible (expression ou ISO)</Label>
                <Input value={config.until || ''} onChange={(e) => updateConfig({ until: e.target.value })} placeholder="{{trigger.deadline}} ou 2026-05-01T09:00:00" className="mt-1" /></div>
              <div><Label className="text-xs">Max jours d'attente</Label>
                <Input type="number" min={1} max={30} value={config.max_days ?? 30} onChange={(e) => updateConfig({ max_days: Number(e.target.value) })} className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'create_event' && (
            <>
              <div><Label className="text-xs">Titre de l'événement</Label>
                <Input value={config.title || ''} onChange={(e) => updateConfig({ title: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Date/heure de début (ISO)</Label>
                <Input value={config.start_time || ''} onChange={(e) => updateConfig({ start_time: e.target.value })} placeholder="{{trigger.date}}" className="mt-1" /></div>
              <div><Label className="text-xs">Date/heure de fin (ISO)</Label>
                <Input value={config.end_time || ''} onChange={(e) => updateConfig({ end_time: e.target.value })} placeholder="2026-05-01T10:00:00" className="mt-1" /></div>
              <div><Label className="text-xs">Calendar ID (vide = défaut)</Label>
                <Input value={config.calendar_id || ''} onChange={(e) => updateConfig({ calendar_id: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Description</Label>
                <Textarea value={config.description || ''} onChange={(e) => updateConfig({ description: e.target.value })} className="mt-1" rows={2} /></div>
            </>
          )}

          {data.action_type === 'create_devis' && (
            <>
              <div><Label className="text-xs">Établissement ID</Label>
                <Input value={config.etablissement_id || ''} onChange={(e) => updateConfig({ etablissement_id: e.target.value })} placeholder="{{trigger.etablissement_id}}" className="mt-1" /></div>
              <div><Label className="text-xs">Montant HT</Label>
                <Input type="number" min={0} step={0.01} value={config.montant_ht ?? ''} onChange={(e) => updateConfig({ montant_ht: Number(e.target.value) })} className="mt-1" /></div>
              <div><Label className="text-xs">Description / Objet</Label>
                <Textarea value={config.objet || ''} onChange={(e) => updateConfig({ objet: e.target.value })} className="mt-1" rows={2} /></div>
              <div><Label className="text-xs">Validité (jours)</Label>
                <Input type="number" min={1} value={config.validite_jours ?? 30} onChange={(e) => updateConfig({ validite_jours: Number(e.target.value) })} className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'start_email_sequence' && (
            <>
              <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                ✉️ Démarre une séquence d'emails automatisée pour le destinataire.
              </div>
              <div><Label className="text-xs">Sequence ID</Label>
                <Input value={config.sequence_id || ''} onChange={(e) => updateConfig({ sequence_id: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Email du destinataire</Label>
                <Input value={config.contact_email || ''} onChange={(e) => updateConfig({ contact_email: e.target.value })} placeholder="{{trigger.email}}" className="mt-1" /></div>
              <div><Label className="text-xs">Variables personnalisées (JSON)</Label>
                <Textarea
                  value={typeof config.custom_vars === 'string' ? config.custom_vars : JSON.stringify(config.custom_vars || {}, null, 2)}
                  onChange={(e) => { try { updateConfig({ custom_vars: JSON.parse(e.target.value) }); } catch { updateConfig({ custom_vars: e.target.value }); } }}
                  rows={3} className="mt-1 font-mono text-xs"
                /></div>
            </>
          )}

          {data.action_type === 'pulse_notify' && (
            <>
              <div><Label className="text-xs">Conversation ID (vide = nouveau)</Label>
                <Input value={config.conversation_id || ''} onChange={(e) => updateConfig({ conversation_id: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Message</Label>
                <Textarea value={config.content || ''} onChange={(e) => updateConfig({ content: e.target.value })} className="mt-1" rows={3} /></div>
              <div><Label className="text-xs">Destinataire User ID</Label>
                <Input value={config.recipient_user_id || ''} onChange={(e) => updateConfig({ recipient_user_id: e.target.value })} placeholder="{{trigger.assigned_to}}" className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'update_csm_playbook' && (
            <>
              <div><Label className="text-xs">Établissement ID</Label>
                <Input value={config.etablissement_id || ''} onChange={(e) => updateConfig({ etablissement_id: e.target.value })} placeholder="{{trigger.etablissement_id}}" className="mt-1" /></div>
              <div><Label className="text-xs">Playbook ID</Label>
                <Input value={config.playbook_id || ''} onChange={(e) => updateConfig({ playbook_id: e.target.value })} className="mt-1" /></div>
              <div><Label className="text-xs">Action</Label>
                <Select value={config.playbook_action || 'advance'} onValueChange={(v) => updateConfig({ playbook_action: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Avancer à l'étape suivante</SelectItem>
                    <SelectItem value="complete">Marquer comme terminé</SelectItem>
                    <SelectItem value="restart">Redémarrer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {data.action_type === 'add_to_segment' && (
            <>
              <div><Label className="text-xs">Segment (nom ou ID)</Label>
                <Input value={config.segment || ''} onChange={(e) => updateConfig({ segment: e.target.value })} placeholder="ex: hot-leads" className="mt-1" /></div>
              <div><Label className="text-xs">Établissement ID</Label>
                <Input value={config.etablissement_id || ''} onChange={(e) => updateConfig({ etablissement_id: e.target.value })} placeholder="{{trigger.etablissement_id}}" className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'ai_classify' && (
            <>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                🤖 Classifie un contenu parmi les catégories définies. Résultat dans <code>{'{{ai.<clé>.category}}'}</code>.
              </div>
              <div><Label className="text-xs">Contenu à classifier</Label>
                <Textarea value={config.ai_input || ''} onChange={(e) => updateConfig({ ai_input: e.target.value })} placeholder="{{trigger.body}}" className="mt-1" rows={3} /></div>
              <div><Label className="text-xs">Catégories (séparées par virgule)</Label>
                <Input value={config.ai_categories || ''} onChange={(e) => updateConfig({ ai_categories: e.target.value })} placeholder="urgent, normal, info, spam" className="mt-1" /></div>
              <div><Label className="text-xs">Clé de sortie</Label>
                <Input value={config.ai_output_key || ''} onChange={(e) => updateConfig({ ai_output_key: e.target.value })} placeholder="classification" className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'ai_route' && (
            <>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                🧭 L'IA choisit la branche à suivre. Sortie dans <code>{'{{ai.<clé>.branch}}'}</code>.
              </div>
              <div><Label className="text-xs">Contenu à analyser</Label>
                <Textarea value={config.ai_input || ''} onChange={(e) => updateConfig({ ai_input: e.target.value })} placeholder="{{trigger.body}}" className="mt-1" rows={3} /></div>
              <div><Label className="text-xs">Branches possibles (séparées par virgule)</Label>
                <Input value={config.ai_branches || ''} onChange={(e) => updateConfig({ ai_branches: e.target.value })} placeholder="support, commercial, technique, autre" className="mt-1" /></div>
              <div><Label className="text-xs">Instructions contextuelles</Label>
                <Textarea value={config.ai_instructions || ''} onChange={(e) => updateConfig({ ai_instructions: e.target.value })} placeholder="ex: router vers 'support' si le message mentionne un bug" className="mt-1" rows={2} /></div>
              <div><Label className="text-xs">Clé de sortie</Label>
                <Input value={config.ai_output_key || ''} onChange={(e) => updateConfig({ ai_output_key: e.target.value })} placeholder="routage" className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'ai_extract' && (
            <>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                🧠 Extrait des données structurées du contenu. Sortie JSON dans <code>{'{{ai.<clé>}}'}</code>.
              </div>
              <div><Label className="text-xs">Contenu source</Label>
                <Textarea value={config.ai_input || ''} onChange={(e) => updateConfig({ ai_input: e.target.value })} placeholder="{{trigger.body}}" className="mt-1" rows={3} /></div>
              <div><Label className="text-xs">Champs à extraire (JSON schema)</Label>
                <Textarea
                  value={typeof config.ai_schema === 'string' ? config.ai_schema : JSON.stringify(config.ai_schema || { nom: 'string', email: 'string', montant: 'number' }, null, 2)}
                  onChange={(e) => { try { updateConfig({ ai_schema: JSON.parse(e.target.value) }); } catch { updateConfig({ ai_schema: e.target.value }); } }}
                  rows={4} className="mt-1 font-mono text-xs"
                /></div>
              <div><Label className="text-xs">Clé de sortie</Label>
                <Input value={config.ai_output_key || ''} onChange={(e) => updateConfig({ ai_output_key: e.target.value })} placeholder="extraction" className="mt-1" /></div>
            </>
          )}

          {data.action_type === 'http_request' && (
            <>
              <div><Label className="text-xs">URL</Label>
                <Input value={config.url || ''} onChange={(e) => updateConfig({ url: e.target.value })} placeholder="https://api.example.com/endpoint" className="mt-1" /></div>
              <div><Label className="text-xs">Méthode</Label>
                <Select value={config.method || 'POST'} onValueChange={(v) => updateConfig({ method: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Headers (JSON)</Label>
                <Textarea
                  value={typeof config.headers === 'string' ? config.headers : JSON.stringify(config.headers || { 'Content-Type': 'application/json' }, null, 2)}
                  onChange={(e) => { try { updateConfig({ headers: JSON.parse(e.target.value) }); } catch { updateConfig({ headers: e.target.value }); } }}
                  rows={3} className="mt-1 font-mono text-xs"
                /></div>
              <div><Label className="text-xs">Body (JSON, variables supportées)</Label>
                <Textarea
                  value={typeof config.payload === 'string' ? config.payload : JSON.stringify(config.payload || {}, null, 2)}
                  onChange={(e) => { try { updateConfig({ payload: JSON.parse(e.target.value) }); } catch { updateConfig({ payload: e.target.value }); } }}
                  rows={4} className="mt-1 font-mono text-xs"
                  placeholder='{"id":"{{trigger.id}}"}'
                /></div>
              <div><Label className="text-xs">Timeout (ms)</Label>
                <Input type="number" min={1000} max={30000} step={1000} value={config.timeout_ms ?? 10000} onChange={(e) => updateConfig({ timeout_ms: Number(e.target.value) })} className="mt-1" /></div>
              <div><Label className="text-xs">Clé de sortie (réponse)</Label>
                <Input value={config.output_key || ''} onChange={(e) => updateConfig({ output_key: e.target.value })} placeholder="api_response" className="mt-1" /></div>
            </>
          )}

          {/* Retry config — disponible pour toute action */}
          {data.action_type && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 space-y-2">
              <Label className="text-xs font-semibold">🔁 Retry automatique</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Tentatives (1-5)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={data.retry?.max ?? 1}
                    onChange={(e) => updateData({ retry: { ...(data.retry || {}), max: Math.max(1, Math.min(5, Number(e.target.value))) } })}
                    className="mt-1 h-8"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Délai ms (0-30000)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={30000}
                    step={500}
                    value={data.retry?.backoff_ms ?? 1000}
                    onChange={(e) => updateData({ retry: { ...(data.retry || {}), backoff_ms: Math.max(0, Math.min(30000, Number(e.target.value))) } })}
                    className="mt-1 h-8"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Si l'action échoue malgré les tentatives, la branche d'erreur (handle rouge) est suivie si présente.
              </p>
            </div>
          )}

          {/* Helper variables pour les actions */}
          {data.action_type && <VariablesHelper triggerType={triggerType} />}

          {/* Test rapide pour les nœuds action */}
          {data.action_type && workflowId && (
            <NodeInlineTest
              workflowId={workflowId}
              nodeId={node.id}
              nodeType={data.action_type}
            />
          )}
        </>
      )}

      <div className="pt-4 border-t">
        <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}
