// ============================================================================
// Contexte de connaissance IA
// ----------------------------------------------------------------------------
// Permet aux assistants texte d'interroger Jarvis avec l'autorisation de
// l'utilisateur avant de rédiger. Jarvis applique les mêmes règles RLS.
// ============================================================================

const DATA_KEYWORDS = [
  'établissement',
  'etablissement',
  'hôpital',
  'hopital',
  'ght',
  'groupe',
  'prospect',
  'client',
  'deal',
  'contrat',
  'devis',
  'facture',
  'facturation',
  'avoir',
  'partenaire',
  'contact',
  'apporteur',
  'tâche',
  'tache',
  'ticket',
  'support',
  'email',
  'mail',
  'agenda',
  'réunion',
  'reunion',
  'rendez-vous',
  'formation',
  'session',
  'émargement',
  'emargement',
  'rh',
  'salarié',
  'salarie',
  'collaborateur',
  'équipe',
  'equipe',
  'absence',
  'salaire',
  'masse salariale',
  'trésorerie',
  'tresorerie',
  'dépense',
  'depense',
  'revenu',
  'budget',
  'mrr',
  'arr',
  'ca ',
  "chiffre d'affaires",
  'churn',
  'kpi',
  'statistique',
  'chiffres',
  'combien',
  'liste des',
  'état des',
  'pipeline',
  'prévision',
  'prevision',
  'forecast',
  'top ',
  'classement',
  'notre',
  'nos ',
  'chez nous',
]

export function needsKnowledge(prompt: string): boolean {
  const lower = (prompt || '').toLowerCase()
  return DATA_KEYWORDS.some((keyword) => lower.includes(keyword))
}

export interface KnowledgeResult {
  context: string
  used: boolean
  error?: string
}

export async function fetchKnowledgeContext(
  authHeader: string | null,
  question: string,
  options: { maxChars?: number; timeoutMs?: number } = {}
): Promise<KnowledgeResult> {
  const maxChars = options.maxChars ?? 4000
  const timeoutMs = options.timeoutMs ?? 70000

  if (!authHeader) return { context: '', used: false, error: 'no-auth' }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) return { context: '', used: false, error: 'no-url' }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/jarvis-brain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      },
      body: JSON.stringify({
        message:
          'Recherche documentaire interne. Utilise les outils nécessaires pour récupérer ' +
          'les données réelles répondant à la demande ci-dessous. ' +
          'Réponds UNIQUEMENT par une synthèse factuelle et chiffrée (puces courtes), ' +
          'sans introduction, sans conseil, sans mise en forme markdown complexe. ' +
          "Si aucune donnée pertinente n'existe, réponds exactement : AUCUNE_DONNEE.\n\n" +
          `Demande : ${question}`,
        reasoning_hint: 'minimal',
        model_hint: 'gpt-5.6-terra',
        max_iterations_hint: 4,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error('[ai-knowledge] jarvis-brain error', response.status, body.slice(0, 500))
      return { context: '', used: false, error: `brain-${response.status}` }
    }

    const data = await response.json()
    const raw: string = (data?.content || data?.response || data?.message || '').toString().trim()
    if (!raw) return { context: '', used: false, error: 'empty' }
    if (raw.includes('AUCUNE_DONNEE')) {
      return { context: '', used: false, error: 'no-data' }
    }

    return { context: raw.slice(0, maxChars), used: true }
  } catch (error) {
    return {
      context: '',
      used: false,
      error: (error as Error)?.name === 'AbortError' ? 'timeout' : 'exception',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export function buildKnowledgeBlock(context: string): string {
  if (!context) return ''
  return (
    '\n\n--- DONNÉES INTERNES (source de vérité, à utiliser en priorité) ---\n' +
    context +
    '\n--- FIN DES DONNÉES INTERNES ---\n' +
    "Utilise ces données réelles pour rédiger. N'invente aucun chiffre absent de ce bloc."
  )
}
