/**
 * Client typé pour l'edge function `document-ai-assist`.
 *
 * Actions IA du panneau documents : résumé, reformulation, classification
 * DPO/RSSI, extraction d'actions. Aucun secret côté frontend — l'appel passe
 * par Supabase Edge Functions (JWT utilisateur), Azure OpenAI est configuré
 * exclusivement côté serveur.
 *
 * Mode dégradé : si la fonction est absente (404 / non déployée) ou si le
 * serveur répond `configured: false`, l'appelant reçoit un statut
 * `unconfigured` au lieu d'une erreur brute, pour permettre à l'UI d'afficher
 * un état « non configuré » plutôt qu'un échec.
 */
import { supabase } from '@/integrations/supabase/client';

export type DocumentAiAction = 'summarize' | 'rewrite' | 'classify' | 'extract_actions';

export type DocumentAiTone = 'formal' | 'concise' | 'simplified';

export interface DocumentAiRequest {
  action: DocumentAiAction;
  /** Contenu HTML ou texte du document (tronqué côté serveur). */
  content: string;
  /** Nom du document, utile pour contextualiser le prompt. */
  documentName?: string;
  /** Ton souhaité pour la reformulation. */
  tone?: DocumentAiTone;
}

export interface DocumentAiClassification {
  /** Niveau de sensibilité DPO (RGPD). */
  dpo_level: 'public' | 'interne' | 'confidentiel' | 'donnees_sante';
  /** Niveau de criticité RSSI (sécurité SI). */
  rssi_level: 'faible' | 'modere' | 'eleve' | 'critique';
  /** Justification courte en français. */
  rationale: string;
  /** Recommandations de manipulation du document. */
  recommendations: string[];
}

export interface DocumentAiActionItem {
  /** Description de l'action à réaliser. */
  action: string;
  /** Responsable identifié dans le texte, si présent. */
  owner?: string;
  /** Échéance identifiée dans le texte, si présente. */
  due_date?: string;
}

export interface DocumentAiSuccess {
  status: 'ok';
  action: DocumentAiAction;
  /** Texte produit (résumé ou reformulation). */
  result?: string;
  /** Présent uniquement pour `classify`. */
  classification?: DocumentAiClassification;
  /** Présent uniquement pour `extract_actions`. */
  actions?: DocumentAiActionItem[];
  model?: string;
}

export interface DocumentAiUnconfigured {
  status: 'unconfigured';
  /** Message explicatif à afficher (mode dégradé). */
  message: string;
}

export interface DocumentAiFailure {
  status: 'error';
  message: string;
}

export type DocumentAiResponse = DocumentAiSuccess | DocumentAiUnconfigured | DocumentAiFailure;

interface RawEdgePayload {
  status?: string;
  configured?: boolean;
  action?: string;
  result?: string;
  classification?: DocumentAiClassification;
  actions?: DocumentAiActionItem[];
  model?: string;
  error?: string;
  message?: string;
}

const EDGE_FUNCTION_NAME = 'document-ai-assist';

const UNCONFIGURED_MESSAGE =
  "L'assistant IA documents n'est pas configuré sur ce déploiement. " +
  'Les fonctionnalités de résumé, reformulation, classification et extraction ' +
  "d'actions seront disponibles une fois le backend IA activé.";

function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as { status?: number; context?: { status?: number } };
  return e.status ?? e.context?.status;
}

/** Détecte un backend absent : fonction non déployée ou introuvable. */
export function isBackendMissingError(error: unknown): boolean {
  const status = extractStatus(error);
  if (status === 404) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /not\s*found|does not exist|Failed to send a request/i.test(message);
}

/**
 * Appelle l'edge function `document-ai-assist` et normalise la réponse.
 * Ne lève jamais pour un backend absent/non configuré : retourne
 * `{ status: 'unconfigured' }` à la place (mode dégradé).
 */
export async function callDocumentAiAssist(
  request: DocumentAiRequest,
): Promise<DocumentAiResponse> {
  let data: RawEdgePayload | null = null;
  let error: unknown = null;

  try {
    const response = await supabase.functions.invoke<RawEdgePayload>(EDGE_FUNCTION_NAME, {
      body: request,
    });
    data = response.data ?? null;
    error = response.error ?? null;
  } catch (err) {
    error = err;
  }

  if (error) {
    if (isBackendMissingError(error)) {
      return { status: 'unconfigured', message: UNCONFIGURED_MESSAGE };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', message: message || 'Erreur inconnue' };
  }

  if (!data) {
    return { status: 'error', message: 'Réponse vide du serveur IA' };
  }

  // Le serveur signale explicitement qu'Azure OpenAI n'est pas configuré.
  if (data.status === 'unconfigured' || data.configured === false) {
    return { status: 'unconfigured', message: data.message || UNCONFIGURED_MESSAGE };
  }

  if (data.error) {
    return { status: 'error', message: data.error };
  }

  return {
    status: 'ok',
    action: (data.action as DocumentAiAction) ?? request.action,
    result: data.result,
    classification: data.classification,
    actions: data.actions,
    model: data.model,
  };
}
