/**
 * JARVIS 11.0 - Multi-Intent Planner
 * 
 * Intègre le classifier d'intentions dans le flux principal.
 * Décompose les requêtes complexes en plans d'exécution séquentiels/parallèles.
 * V11.0: Support des entités extraites et contexte émotionnel.
 */

import { 
  classifyIntents, 
  type DetectedIntent, 
  type IntentClassificationResult,
  type ExtractedEntity,
  type EmotionalContext 
} from "./intent-classifier.ts";

export interface ExecutionStep {
  id: string;
  intent: DetectedIntent;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
  dependsOn: string[];
  canRunParallel: boolean;
}

export interface ExecutionPlan {
  id: string;
  originalQuery: string;
  classification: IntentClassificationResult;
  steps: ExecutionStep[];
  strategy: 'sequential' | 'parallel' | 'mixed';
  estimatedSteps: number;
  entities: ExtractedEntity[];
  emotionalContext: EmotionalContext;
  createdAt: number;
}

let planCounter = 0;

/**
 * Crée un plan d'exécution à partir d'une requête utilisateur
 */
export function createExecutionPlan(query: string): ExecutionPlan {
  const classification = classifyIntents(query);
  const planId = `plan_${Date.now()}_${++planCounter}`;
  
  // Créer les étapes d'exécution
  const steps: ExecutionStep[] = classification.intents.map((intent, index) => ({
    id: `step_${index}_${intent.type}`,
    intent,
    status: 'pending',
    dependsOn: intent.dependsOn || [],
    canRunParallel: classification.suggestedParallelExecution && !intent.dependsOn?.length,
  }));
  
  // Déterminer la stratégie d'exécution
  let strategy: ExecutionPlan['strategy'] = 'sequential';
  if (classification.suggestedParallelExecution && steps.length > 1) {
    const parallelSteps = steps.filter(s => s.canRunParallel).length;
    if (parallelSteps === steps.length) {
      strategy = 'parallel';
    } else if (parallelSteps > 0) {
      strategy = 'mixed';
    }
  }
  
  return {
    id: planId,
    originalQuery: query,
    classification,
    steps,
    strategy,
    estimatedSteps: steps.length,
    entities: classification.entities || [],
    emotionalContext: classification.emotionalContext || { tone: 'neutral', urgencyLevel: 0, sentimentScore: 0, keywords: [] },
    createdAt: Date.now(),
  };
}

/**
 * Génère un prompt enrichi pour GPT avec le contexte du plan
 */
export function enrichPromptWithPlan(
  originalPrompt: string,
  plan: ExecutionPlan
): string {
  if (!plan.classification.isMultiIntent) {
    return originalPrompt; // Pas besoin d'enrichissement pour requête simple
  }
  
  const intentsSummary = plan.steps.map((step, i) => 
    `${i + 1}. ${step.intent.type}${step.intent.suggestedTool ? ` (outil: ${step.intent.suggestedTool})` : ''}`
  ).join('\n');
  
  const planContext = `
[DÉTECTION MULTI-INTENTIONS]
J'ai détecté ${plan.steps.length} intentions dans cette requête:
${intentsSummary}

Stratégie d'exécution: ${plan.strategy}
${plan.strategy === 'sequential' ? 'Je vais exécuter ces actions une par une.' : ''}
${plan.strategy === 'parallel' ? 'Ces actions peuvent être exécutées en parallèle.' : ''}
${plan.strategy === 'mixed' ? 'Certaines actions seront parallèles, d\'autres séquentielles.' : ''}

Requête originale: "${plan.originalQuery}"
`;

  return planContext + '\n' + originalPrompt;
}

/**
 * Vérifie si une requête est multi-intentions
 */
export function isMultiIntentQuery(query: string): boolean {
  const classification = classifyIntents(query);
  return classification.isMultiIntent;
}

/**
 * Extrait les outils suggérés pour une requête
 */
export function getSuggestedTools(query: string): string[] {
  const classification = classifyIntents(query);
  return classification.intents
    .map(i => i.suggestedTool)
    .filter((t): t is string => !!t);
}

/**
 * Génère un résumé du plan pour l'affichage utilisateur
 */
export function getPlanSummary(plan: ExecutionPlan): string {
  if (!plan.classification.isMultiIntent) {
    return '';
  }
  
  const steps = plan.steps.map((step, i) => {
    const icon = step.status === 'completed' ? '✅' :
                 step.status === 'failed' ? '❌' :
                 step.status === 'running' ? '⏳' :
                 step.status === 'skipped' ? '⏭️' : '⏸️';
    return `${icon} ${i + 1}. ${step.intent.description}`;
  }).join('\n');
  
  return `**Plan d'exécution (${plan.steps.length} étapes):**\n${steps}`;
}

/**
 * Met à jour le statut d'une étape dans le plan
 */
export function updateStepStatus(
  plan: ExecutionPlan,
  stepId: string,
  status: ExecutionStep['status'],
  result?: unknown,
  error?: string
): ExecutionPlan {
  const updatedSteps = plan.steps.map(step => {
    if (step.id === stepId) {
      return { ...step, status, result, error };
    }
    return step;
  });
  
  return { ...plan, steps: updatedSteps };
}

/**
 * Obtient les prochaines étapes à exécuter
 */
export function getNextExecutableSteps(plan: ExecutionPlan): ExecutionStep[] {
  // Trouver les étapes pending dont les dépendances sont satisfaites
  return plan.steps.filter(step => {
    if (step.status !== 'pending') return false;
    
    // Vérifier que toutes les dépendances sont complétées
    const dependenciesMet = step.dependsOn.every(depId => {
      const depStep = plan.steps.find(s => s.id === depId);
      return depStep?.status === 'completed';
    });
    
    return dependenciesMet;
  });
}

/**
 * Vérifie si le plan est terminé
 */
export function isPlanComplete(plan: ExecutionPlan): boolean {
  return plan.steps.every(step => 
    step.status === 'completed' || 
    step.status === 'failed' || 
    step.status === 'skipped'
  );
}

/**
 * Génère des hints de paramètres pour GPT basés sur le plan
 */
export function getParameterHints(plan: ExecutionPlan): Record<string, unknown> {
  const hints: Record<string, unknown> = {};
  
  for (const step of plan.steps) {
    if (step.intent.extractedParams) {
      Object.assign(hints, step.intent.extractedParams);
    }
  }
  
  return hints;
}
