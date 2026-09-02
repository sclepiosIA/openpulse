# Workflow Automation Builder

Module d'automatisation visuelle "si X alors Y" intégré à OpenPulse (priorité 2 du roadmap CRM).

## Architecture

```
/automatisations              → liste des workflows + templates
/automatisations/:id/edit     → éditeur visuel (React Flow)
```

### Tables

- `workflows` : définition (nom, trigger_type, trigger_config, graph JSON, is_active, stats)
- `workflow_runs` : journal d'exécution (status, steps_log JSON, parent_run_id pour anti-boucle)
- `workflow_scheduled_steps` : étapes DELAY en attente
- `workflow_trigger_queue` : file d'attente alimentée par les triggers DB
- `workflow_audit_log` : audit (création, activation, suppression)

### Edge Functions

- **workflow-engine** : exécute un workflow nœud par nœud (BFS). Pas d'eval, conditions via whitelist d'opérateurs (`equals`, `contains`, `greater_than`, etc.). Interpolation `{{trigger.field}}` sécurisée.
- **workflow-dispatcher** : cron 1 min, lit `workflow_trigger_queue`, matche les workflows actifs sur `trigger_type` + filtres (keywords email, statut établissement), appelle l'engine.
- **workflow-scheduler** : cron 1 min, reprend les `workflow_scheduled_steps` arrivées à échéance.

### Triggers DB sources

Triggers PG `SECURITY DEFINER` sur :
- `etablissements` (UPDATE statut) → `etablissement.statut_changed`
- `email_threads` (INSERT) → `email.received`
- `factures` (UPDATE statut → en_retard) → `facture.overdue`
- `taches` (UPDATE statut → completed) → `task.completed`

Tous insèrent dans `workflow_trigger_queue`.

## Types de blocs

| Type | Rôle |
|------|------|
| `trigger` | Racine, 1 par workflow |
| `condition` | Évalue `field operator value`, 2 sorties (true/false) |
| `delay` | Programme une reprise à `now() + amount × unit` via `workflow_scheduled_steps` |
| `action` | Effet métier : create_task, send_email, send_notification, update_field, create_ticket, webhook, wait |

## Garde-fous

- **50 nœuds max** par workflow
- **1000 runs/jour** workspace global
- **Anti-boucle** : un run ne peut pas re-déclencher son propre workflow (vérification `parent_run_id`)
- **Audit log** automatique (création, activation, pause, suppression)
- **RLS** : seuls `admin` et `direction` accèdent aux workflows et logs
- **Erreurs sanitisées** via `_shared/error-sanitizer.ts` (pas de fuite de stack trace)

## Templates pré-configurés

Seedés en migration (is_template=true, is_active=false). Cliquer sur "Utiliser" duplique le graphe dans un nouveau workflow éditable :

1. **📨 Relance impayés J+30** — facture.overdue → email + tâche CSM
2. **🚀 Onboarding nouveau client** — etablissement.statut_changed (Production) → notif + tâche kick-off
3. **⚠️ Détection résiliation email** — email.received avec keywords → ticket urgent + alerte
4. **🔥 Suivi prospect chaud 7j** — schedule quotidien 9h → création tâche relance

## Mode Test (Dry-run)

Bouton **🧪 Tester** dans la toolbar du builder ouvre un dialog avec éditeur JSON pré-rempli (payload exemple selon `trigger_type`). Le moteur exécute la traversée complète **sans effets de bord** : aucune insertion BDD, aucun email envoyé, aucun webhook appelé, aucun appel Azure GPT-5. Chaque action retourne un objet `{ simulated: true, would_* : {...} }`. Les délais sont court-circuités. Les runs sont marqués `is_dry_run = true` (colonne dédiée + index) et exclus des stats workflow et du quota journalier.

## Visualisation d'exécution sur la canvas

Après un test (ou un run réel sélectionné), chaque nœud affiche :
- ✅ **Succès** — anneau émeraude + badge check
- 🔵 **Simulé** — anneau bleu pointillé + badge fiole (mode test)
- ❌ **Échec** — anneau rouge pulsant + badge croix → clic révèle l'erreur sanitisée
- ⏰ **Programmé** — anneau ambre (delay scheduled)
- ⚠️ **Avertissement statique** — anneau ambre + popover liste des problèmes (orphan, config incomplète…)

Les **edges empruntées** sont colorées (vert/bleu) et les autres atténuées. Les conditions affichent quel branche `vrai`/`faux` a été prise. Toutes les edges utilisent `MarkerType.ArrowClosed` pour matérialiser la direction.

Bandeau "Mode test" en haut du canvas avec compteur OK/échec et bouton **Effacer le test**. RPC `get_workflow_run_status(p_run_id)` réutilisable pour rejouer l'overlay sur n'importe quel run de l'historique.

## Validation statique en continu

`src/lib/workflow/validateGraph.ts` est exécuté à chaque mutation du graph et expose `validationIssues` via `WorkflowExecutionContext`. Détecte : multiples triggers, nœuds orphelins, configs requises manquantes (titre tâche, to/subject email, url webhook…). Affiché directement comme badge ⚠️ sur le nœud concerné.

## Frontend

- `src/pages/Automatisations.tsx` : liste + dialog création + onglet templates + bouton **Lancer maintenant** (`Zap`) par ligne pour exécution manuelle immédiate
- `src/pages/AutomatisationBuilder.tsx` : éditeur 3 colonnes (NodeLibrary | Canvas | NodeConfigPanel) wrapped dans `WorkflowExecutionProvider`. Toolbar : 🧪 Tester · ⚡ Lancer · 🕘 Historique · 💾 Enregistrer.
  - **Validation à l'enregistrement** : un seul trigger autorisé, alerte si nœuds orphelins (non reliés)
  - Bouton "Lancer maintenant" : sauvegarde + invocation `workflow-engine` avec `manual:true`
  - Sheet historique d'exécution avec realtime
- `src/components/automatisations/`
  - `WorkflowCanvas.tsx` (React Flow `@xyflow/react`)
  - `nodes/` : TriggerNode, ConditionNode (handles true/false), ActionNode, DelayNode
  - `panels/NodeLibrary.tsx`, `panels/NodeConfigPanel.tsx`
  - `WorkflowRunsList.tsx` (timeline avec realtime sur `workflow_runs`)
  - `ManualWorkflowTrigger.tsx` : dropdown réutilisable listant les workflows actifs à trigger `manual` + payload contextuel. Auto-masqué si aucun workflow disponible. **Intégré dans `QuickActionsBar`** (fiche établissement) avec `payload={{ etablissement_id, etablissement_nom }}`.
- `src/hooks/useWorkflows.ts` (utilise `useAuth()` — pas de `getUser()` per ADR), `useWorkflowRuns.ts`
- `src/types/workflow.ts`

### Hardening engine

- `webhook` action : timeout 15s via `AbortController`, status `failed` si HTTP non-2xx ou abort
- Conditions évaluées via whitelist d'opérateurs (`equals`, `not_equals`, `contains`, `greater_than`, `less_than`, `in`, `is_empty`, `is_not_empty`) — aucun `eval`
- Anti-boucle : un run ne peut pas re-déclencher son propre workflow (vérification `parent_run_id`)

## Variables d'interpolation

Disponibles dans tous les champs string des actions :

```
{{trigger.etablissement_id}}
{{trigger.statut_new}}
{{trigger.subject}}
{{trigger.sender_email}}
{{trigger.numero}}
{{workflow.nom}}
```

## Permissions

Routes `/automatisations` et `/automatisations/:id/edit` protégées par `RouteGuard allowedTeams={['direction']}`. Entrée sidebar dans la section **Direction**, icône `Workflow` (lucide).
