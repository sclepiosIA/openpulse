/**
 * Registre statique de toutes les fonctions IA du projet OpenPulse
 * 
 * Ce fichier centralise les informations de configuration de chaque edge function
 * qui utilise GPT-5.4, GPT-5.2, GPT-5 Mini, GPT-5 Vision ou Whisper.
 * Les métriques réelles viennent de ai_processing_log via useAIUsageStats.
 */

export type AIModelType = 'gpt-5.4' | 'gpt-5.2' | 'gpt-5-mini' | 'gpt-5-vision' | 'whisper-1';

export type AICategory = 
  | 'email' 
  | 'crm' 
  | 'rh' 
  | 'rd' 
  | 'jarvis' 
  | 'pulse' 
  | 'tresorerie' 
  | 'calendrier' 
  | 'support'
  | 'autre';

export interface AIFunctionConfig {
  id: string;
  label: string;
  description: string;
  category: AICategory;
  model: AIModelType;
  fallbackChain: string[];
  parameters: {
    reasoning_effort: 'low' | 'medium' | 'high' | 'none' | 'N/A';
    verbosity: 'low' | 'medium' | 'high' | 'N/A';
    max_completion_tokens: number;
    response_format?: 'json_object' | 'text';
    timeout_ms: number;
  };
  systemPromptPreview: string;
  processingType: string;
  securityFeatures: string[];
}

export const CATEGORY_CONFIG: Record<AICategory, { label: string; color: string; bgColor: string }> = {
  email: { label: 'Email', color: 'text-sky-700', bgColor: 'bg-sky-100' },
  crm: { label: 'CRM', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  rh: { label: 'RH', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  rd: { label: 'R&D', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  jarvis: { label: 'Jarvis', color: 'text-violet-700', bgColor: 'bg-violet-100' },
  pulse: { label: 'Pulse', color: 'text-rose-700', bgColor: 'bg-rose-100' },
  tresorerie: { label: 'Trésorerie', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  calendrier: { label: 'Calendrier', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  support: { label: 'Support', color: 'text-red-700', bgColor: 'bg-red-100' },
  autre: { label: 'Autre', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export const MODEL_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'gpt-5.4': { label: 'GPT-5.4', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'gpt-5.2': { label: 'GPT-5.2', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  'gpt-5-mini': { label: 'GPT-5 Mini', color: 'text-green-700', bgColor: 'bg-green-100' },
  'gpt-5-vision': { label: 'GPT-5 Vision', color: 'text-pink-700', bgColor: 'bg-pink-100' },
  'whisper-1': { label: 'Whisper', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
};

// Données du registre extraites dans aiFunctionsData.ts pour réduire la taille du fichier.
export { AI_FUNCTIONS_REGISTRY } from './aiFunctionsData';
import { AI_FUNCTIONS_REGISTRY } from './aiFunctionsData';

/**
 * Retourne la config d'une fonction IA par son ID
 */
export function getAIFunctionById(id: string): AIFunctionConfig | undefined {
  return AI_FUNCTIONS_REGISTRY.find(f => f.id === id);
}

/**
 * Retourne les fonctions IA par catégorie
 */
export function getAIFunctionsByCategory(category: AICategory): AIFunctionConfig[] {
  return AI_FUNCTIONS_REGISTRY.filter(f => f.category === category);
}

/**
 * Retourne les fonctions IA par modèle
 */
export function getAIFunctionsByModel(model: AIModelType): AIFunctionConfig[] {
  return AI_FUNCTIONS_REGISTRY.filter(f => f.model === model);
}

/**
 * Retourne la config d'une fonction IA par son processing_type
 */
export function getAIFunctionByProcessingType(processingType: string): AIFunctionConfig | undefined {
  return AI_FUNCTIONS_REGISTRY.find(f => f.processingType === processingType);
}
