/**
 * JARVIS 12.0 - Advanced Intent Classifier
 * 
 * Détecte et décompose les intentions multiples dans une requête utilisateur.
 * V12.0: Résolution de coréférences, détection émotionnelle avancée, 
 *        clarification proactive, support multi-tours.
 */

export interface ExtractedEntity {
  type: 'person' | 'etablissement' | 'date' | 'amount' | 'email' | 'phone' | 'duration';
  value: string;
  normalized?: string; // Valeur normalisée (ex: date ISO)
  confidence: number;
}

export interface EmotionalContext {
  tone: 'neutral' | 'urgent' | 'frustrated' | 'positive' | 'formal' | 'casual';
  urgencyLevel: number; // 0-10
  sentimentScore: number; // -1 to 1
  keywords: string[];
}

export interface DetectedIntent {
  type: string;
  description: string;
  confidence: number;
  suggestedTool?: string;
  extractedParams?: Record<string, unknown>;
  dependsOn?: string[];
  isImplicit?: boolean; // Intent détecté implicitement
}

export interface IntentClassificationResult {
  intents: DetectedIntent[];
  entities: ExtractedEntity[];
  emotionalContext: EmotionalContext;
  isMultiIntent: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
  suggestedParallelExecution: boolean;
}

// Patterns pour détecter les intentions
const INTENT_PATTERNS: Array<{
  pattern: RegExp;
  type: string;
  tool: string;
  paramExtractor?: (match: RegExpMatchArray, fullText: string) => Record<string, unknown>;
}> = [
  // Email intentions
  {
    pattern: /(?:envoie|envoi|email|mail|écris|rédige|contacte).*?(?:à|a)\s+([^\s,]+(?:@[^\s,]+)?)/i,
    type: 'send_email',
    tool: 'send_email',
    paramExtractor: (match, text) => ({
      to_hint: match[1],
      subject_hint: extractSubject(text),
      body_hint: extractBody(text),
    }),
  },
  {
    pattern: /(?:traduis|traduire|translation|translate)/i,
    type: 'translate',
    tool: 'translate_email',
  },
  {
    pattern: /(?:corrige|correction|orthographe|fautes)/i,
    type: 'correct',
    tool: 'correct_email',
  },
  {
    pattern: /(?:reformule|reformuler|réécrire|améliore)/i,
    type: 'reformulate',
    tool: 'reformulate_email',
  },
  
  // Task intentions
  {
    pattern: /(?:crée?|ajoute|nouvelle?)\s+(?:une?\s+)?(?:tâche|task|todo)/i,
    type: 'create_task',
    tool: 'create_task',
    paramExtractor: (_, text) => ({
      title_hint: extractTaskTitle(text),
      priority_hint: extractPriority(text),
    }),
  },
  {
    pattern: /(?:liste|affiche|montre|voir)\s+(?:mes?\s+)?(?:tâches|tasks|todos)/i,
    type: 'list_tasks',
    tool: 'query_database',
    paramExtractor: () => ({ table: 'taches' }),
  },
  {
    pattern: /(?:termine|complète|finis|valide|clos)\s+(?:la\s+)?(?:tâche|task)/i,
    type: 'complete_task',
    tool: 'update_entity_status',
  },
  
  // Meeting/Calendar intentions
  {
    pattern: /(?:planifie|planifier|programme|calendrier|réunion|meeting|rdv|rendez-vous)/i,
    type: 'schedule_meeting',
    tool: 'schedule_meeting',
    paramExtractor: (_, text) => ({
      title_hint: extractMeetingTitle(text),
      date_hint: extractDate(text),
    }),
  },
  
  // Query/Search intentions
  {
    pattern: /(?:cherche|recherche|trouve|trouver|montre|affiche|liste|résume?)\s+(?:les?\s+)?(?:établissement|client|contact|facture|email|ticket)/i,
    type: 'query',
    tool: 'query_database',
    paramExtractor: (_, text) => ({
      table: extractTableName(text),
    }),
  },
  {
    pattern: /(?:combien|quel|quelle|quels|quelles|nombre|stats?|statistiques?|kpi|metrics?)/i,
    type: 'analytics',
    tool: 'calculate_kpi',
  },
  
  // Report/Summary intentions
  {
    pattern: /(?:résumé?|summary|bilan|rapport|briefing|récap)/i,
    type: 'summary',
    tool: 'generate_report',
  },
  
  // Pipeline intentions
  {
    pattern: /(?:pipeline|commercial|ventes?|sales|prospects?|opportunités?)/i,
    type: 'pipeline',
    tool: 'query_database',
    paramExtractor: () => ({ table: 'etablissements', context: 'pipeline' }),
  },
  
  // Treasury intentions
  {
    pattern: /(?:facture|invoice|paiement|trésorerie|treasury|qonto|banque|solde)/i,
    type: 'treasury',
    tool: 'sync_qonto_transactions',
  },
  
  // Support intentions
  {
    pattern: /(?:ticket|support|incident|problème|bug)/i,
    type: 'support',
    tool: 'create_support_ticket',
  },
  
  // Objectives intentions (V11.0)
  {
    pattern: /(?:objectif|goal|cible|target)/i,
    type: 'objectives',
    tool: 'list_objectives',
  },
  {
    pattern: /(?:créer?|définir?|nouveau)\s+(?:un\s+)?objectif/i,
    type: 'create_objective',
    tool: 'create_objective',
  },
  
  // Document search (V11.0)
  {
    pattern: /(?:cherche|trouve|recherche)\s+(?:dans\s+)?(?:les?\s+)?(?:documents?|fichiers?|pièces?\s+jointes?|pdf)/i,
    type: 'search_documents',
    tool: 'search_documents',
  },
  {
    pattern: /(?:dans\s+la\s+)?(?:base\s+de\s+)?(?:connaissances?|kb|documentation)/i,
    type: 'search_kb',
    tool: 'search_knowledge_base',
  },
];

// Conjonctions qui indiquent des intentions multiples
const MULTI_INTENT_CONNECTORS = /\s+(?:et|puis|ensuite|également|aussi|après|avant|en plus)\s+/i;

// Patterns émotionnels
const EMOTIONAL_PATTERNS = {
  urgent: /(?:urgent|asap|vite|rapidement|immédiatement|critique|prioritaire|deadline|bloqu)/i,
  frustrated: /(?:encore|toujours|impossible|marche pas|fonctionne pas|problème|bug|erreur|jamais)/i,
  positive: /(?:merci|super|génial|parfait|excellent|bravo|bien joué|formidable)/i,
  formal: /(?:pourriez-vous|serait-il possible|veuillez|merci de|je vous prie)/i,
  casual: /(?:salut|hey|coucou|svp|plz|thx|asap|ok\s|cool)/i,
};

// Patterns d'entités
const ENTITY_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(?:(?:\+33|0)\s?[1-9])(?:[\s.-]?\d{2}){4}/g,
  amount: /(\d+(?:[.,]\d{2})?)\s*(?:€|euros?|EUR)/gi,
  date_fr: /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/g,
  duration: /(\d+)\s*(?:jours?|semaines?|mois|heures?|h|j)/gi,
  person_name: /(?:M\.|Mme|Dr|Mr)?\s*([A-Z][a-zéèêëàâäùûüôöîï]+(?:\s+[A-Z][a-zéèêëàâäùûüôöîï]+)+)/g,
};

/**
 * Classifie les intentions dans un message utilisateur (V11.0 - Enhanced)
 */
export function classifyIntents(message: string): IntentClassificationResult {
  const intents: DetectedIntent[] = [];
  const normalizedMessage = message.toLowerCase().trim();
  
  // 1. Extraire les entités
  const entities = extractEntities(message);
  
  // 2. Analyser le contexte émotionnel
  const emotionalContext = analyzeEmotionalContext(message);
  
  // 3. Détecter si c'est une requête multi-intentions
  const hasConnectors = MULTI_INTENT_CONNECTORS.test(message);
  const segments = hasConnectors 
    ? message.split(MULTI_INTENT_CONNECTORS)
    : [message];
  
  // 4. Analyser chaque segment
  for (const segment of segments) {
    const segmentIntents = detectIntentsInSegment(segment, normalizedMessage, entities);
    intents.push(...segmentIntents);
  }
  
  // 5. Détecter les intentions implicites
  const implicitIntents = detectImplicitIntents(message, entities, emotionalContext);
  intents.push(...implicitIntents);
  
  // 6. Dédupliquer les intentions similaires
  const uniqueIntents = deduplicateIntents(intents);
  
  // 7. Enrichir les intentions avec les entités extraites
  const enrichedIntents = enrichIntentsWithEntities(uniqueIntents, entities);
  
  // 8. Ajuster la confiance selon le contexte émotionnel
  const adjustedIntents = adjustConfidenceByContext(enrichedIntents, emotionalContext);
  
  // Calculer la complexité
  const complexity = calculateComplexity(adjustedIntents);
  
  // Déterminer si la parallélisation est suggérée
  const suggestedParallelExecution = adjustedIntents.length > 1 && 
    !hasSequentialDependencies(adjustedIntents);
  
  return {
    intents: adjustedIntents,
    entities,
    emotionalContext,
    isMultiIntent: adjustedIntents.length > 1,
    complexity,
    suggestedParallelExecution,
  };
}

/**
 * Extrait les entités nommées du message
 */
function extractEntities(message: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  
  // Emails
  const emailMatches = message.match(ENTITY_PATTERNS.email);
  if (emailMatches) {
    emailMatches.forEach(email => {
      entities.push({
        type: 'email',
        value: email,
        confidence: 0.95,
      });
    });
  }
  
  // Téléphones
  const phoneMatches = message.match(ENTITY_PATTERNS.phone);
  if (phoneMatches) {
    phoneMatches.forEach(phone => {
      entities.push({
        type: 'phone',
        value: phone,
        normalized: phone.replace(/[\s.-]/g, ''),
        confidence: 0.9,
      });
    });
  }
  
  // Montants
  let amountMatch;
  while ((amountMatch = ENTITY_PATTERNS.amount.exec(message)) !== null) {
    entities.push({
      type: 'amount',
      value: amountMatch[0],
      normalized: amountMatch[1].replace(',', '.'),
      confidence: 0.9,
    });
  }
  ENTITY_PATTERNS.amount.lastIndex = 0;
  
  // Dates relatives
  const relativeDates = extractRelativeDates(message);
  entities.push(...relativeDates);
  
  // Dates explicites
  let dateMatch;
  while ((dateMatch = ENTITY_PATTERNS.date_fr.exec(message)) !== null) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3] || new Date().getFullYear().toString();
    entities.push({
      type: 'date',
      value: dateMatch[0],
      normalized: `${year.length === 2 ? '20' + year : year}-${month}-${day}`,
      confidence: 0.85,
    });
  }
  ENTITY_PATTERNS.date_fr.lastIndex = 0;
  
  // Durées
  let durationMatch;
  while ((durationMatch = ENTITY_PATTERNS.duration.exec(message)) !== null) {
    entities.push({
      type: 'duration',
      value: durationMatch[0],
      normalized: durationMatch[1],
      confidence: 0.85,
    });
  }
  ENTITY_PATTERNS.duration.lastIndex = 0;
  
  // Noms de personnes (heuristique)
  let personMatch;
  while ((personMatch = ENTITY_PATTERNS.person_name.exec(message)) !== null) {
    // Filtrer les faux positifs courants
    const name = personMatch[1];
    if (!isCommonWord(name)) {
      entities.push({
        type: 'person',
        value: name,
        confidence: 0.7,
      });
    }
  }
  ENTITY_PATTERNS.person_name.lastIndex = 0;
  
  return entities;
}

function extractRelativeDates(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const today = new Date();
  
  if (/\baujourd'hui\b/i.test(text)) {
    entities.push({
      type: 'date',
      value: "aujourd'hui",
      normalized: today.toISOString().split('T')[0],
      confidence: 0.95,
    });
  }
  
  if (/\bdemain\b/i.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    entities.push({
      type: 'date',
      value: 'demain',
      normalized: tomorrow.toISOString().split('T')[0],
      confidence: 0.95,
    });
  }
  
  if (/\baprès-demain\b/i.test(text)) {
    const afterTomorrow = new Date(today);
    afterTomorrow.setDate(afterTomorrow.getDate() + 2);
    entities.push({
      type: 'date',
      value: 'après-demain',
      normalized: afterTomorrow.toISOString().split('T')[0],
      confidence: 0.95,
    });
  }
  
  // Jours de la semaine
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  dayNames.forEach((dayName, dayIndex) => {
    const regex = new RegExp(`\\b${dayName}\\b`, 'i');
    if (regex.test(text)) {
      entities.push({
        type: 'date',
        value: dayName,
        normalized: getNextDayOfWeek(dayIndex),
        confidence: 0.9,
      });
    }
  });
  
  // Cette semaine / semaine prochaine
  if (/\bcette\s+semaine\b/i.test(text)) {
    entities.push({
      type: 'date',
      value: 'cette semaine',
      normalized: `week:${getWeekNumber(today)}`,
      confidence: 0.85,
    });
  }
  
  if (/\bsemaine\s+prochaine\b/i.test(text)) {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    entities.push({
      type: 'date',
      value: 'semaine prochaine',
      normalized: `week:${getWeekNumber(nextWeek)}`,
      confidence: 0.85,
    });
  }
  
  return entities;
}

/**
 * Analyse le contexte émotionnel du message
 */
function analyzeEmotionalContext(message: string): EmotionalContext {
  let tone: EmotionalContext['tone'] = 'neutral';
  let urgencyLevel = 0;
  let sentimentScore = 0;
  const keywords: string[] = [];
  
  // Détecter le ton
  if (EMOTIONAL_PATTERNS.urgent.test(message)) {
    tone = 'urgent';
    urgencyLevel = 8;
    sentimentScore = -0.2;
    keywords.push(...(message.match(EMOTIONAL_PATTERNS.urgent) || []));
  }
  
  if (EMOTIONAL_PATTERNS.frustrated.test(message)) {
    tone = 'frustrated';
    urgencyLevel = Math.max(urgencyLevel, 6);
    sentimentScore = -0.5;
    keywords.push(...(message.match(EMOTIONAL_PATTERNS.frustrated) || []));
  }
  
  if (EMOTIONAL_PATTERNS.positive.test(message)) {
    tone = 'positive';
    sentimentScore = 0.7;
    keywords.push(...(message.match(EMOTIONAL_PATTERNS.positive) || []));
  }
  
  if (EMOTIONAL_PATTERNS.formal.test(message)) {
    tone = 'formal';
    keywords.push(...(message.match(EMOTIONAL_PATTERNS.formal) || []));
  }
  
  if (EMOTIONAL_PATTERNS.casual.test(message)) {
    tone = 'casual';
    keywords.push(...(message.match(EMOTIONAL_PATTERNS.casual) || []));
  }
  
  // Détecter l'urgence par ponctuation
  const exclamationCount = (message.match(/!/g) || []).length;
  const questionCount = (message.match(/\?/g) || []).length;
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
  
  if (exclamationCount > 2) urgencyLevel = Math.min(10, urgencyLevel + 2);
  if (capsRatio > 0.5) urgencyLevel = Math.min(10, urgencyLevel + 1);
  
  return {
    tone,
    urgencyLevel,
    sentimentScore,
    keywords: [...new Set(keywords)],
  };
}

/**
 * Détecte les intentions implicites basées sur le contexte
 */
function detectImplicitIntents(
  message: string, 
  entities: ExtractedEntity[],
  emotionalContext: EmotionalContext
): DetectedIntent[] {
  const implicitIntents: DetectedIntent[] = [];
  
  // Si urgence élevée + tâche, suggérer de prioriser
  if (emotionalContext.urgencyLevel > 7) {
    implicitIntents.push({
      type: 'prioritize',
      description: 'Urgence détectée - priorisation suggérée',
      confidence: 0.6,
      isImplicit: true,
    });
  }
  
  // Si mention d'email sans destinataire explicite, suggérer de vérifier les contacts
  const hasEmailMention = /\b(?:email|mail|envoie|contacte)\b/i.test(message);
  const hasEmailEntity = entities.some(e => e.type === 'email');
  if (hasEmailMention && !hasEmailEntity) {
    implicitIntents.push({
      type: 'lookup_contact',
      description: 'Recherche de contact suggérée pour email',
      confidence: 0.5,
      suggestedTool: 'query_database',
      extractedParams: { table: 'contacts' },
      isImplicit: true,
    });
  }
  
  // Si mention de montant + date, suggérer de créer une facture ou rappel
  const hasAmount = entities.some(e => e.type === 'amount');
  const hasDate = entities.some(e => e.type === 'date');
  if (hasAmount && hasDate && /(?:payer|facture|règlement|échéance)/i.test(message)) {
    implicitIntents.push({
      type: 'create_reminder',
      description: 'Rappel de paiement suggéré',
      confidence: 0.5,
      suggestedTool: 'create_task',
      isImplicit: true,
    });
  }
  
  return implicitIntents;
}

function detectIntentsInSegment(
  segment: string, 
  fullMessage: string,
  entities: ExtractedEntity[]
): DetectedIntent[] {
  const detected: DetectedIntent[] = [];
  
  for (const pattern of INTENT_PATTERNS) {
    const match = segment.match(pattern.pattern);
    if (match) {
      const intent: DetectedIntent = {
        type: pattern.type,
        description: `${pattern.type} détecté: "${segment.substring(0, 50)}..."`,
        confidence: 0.7,
        suggestedTool: pattern.tool,
        extractedParams: pattern.paramExtractor 
          ? pattern.paramExtractor(match, fullMessage)
          : undefined,
      };
      detected.push(intent);
    }
  }
  
  // Si aucune intention détectée, c'est probablement une question générale
  if (detected.length === 0) {
    detected.push({
      type: 'general_query',
      description: 'Question générale ou conversation',
      confidence: 0.5,
    });
  }
  
  return detected;
}

function enrichIntentsWithEntities(
  intents: DetectedIntent[], 
  entities: ExtractedEntity[]
): DetectedIntent[] {
  return intents.map(intent => {
    const params = intent.extractedParams || {};
    
    // Enrichir avec les entités pertinentes
    const emailEntity = entities.find(e => e.type === 'email');
    const dateEntity = entities.find(e => e.type === 'date');
    const amountEntity = entities.find(e => e.type === 'amount');
    const personEntity = entities.find(e => e.type === 'person');
    
    if (intent.type === 'send_email' && emailEntity) {
      params.to = emailEntity.value;
    }
    
    if (intent.type === 'schedule_meeting' && dateEntity) {
      params.date = dateEntity.normalized;
    }
    
    if (intent.type.includes('task') && dateEntity) {
      params.due_date = dateEntity.normalized;
    }
    
    if (intent.type === 'treasury' && amountEntity) {
      params.amount = parseFloat(amountEntity.normalized || '0');
    }
    
    if (personEntity) {
      params.person_name = personEntity.value;
    }
    
    return {
      ...intent,
      extractedParams: Object.keys(params).length > 0 ? params : undefined,
    };
  });
}

function adjustConfidenceByContext(
  intents: DetectedIntent[],
  emotionalContext: EmotionalContext
): DetectedIntent[] {
  return intents.map(intent => {
    let adjustedConfidence = intent.confidence;
    
    // Boost confidence for urgent requests
    if (emotionalContext.urgencyLevel > 6 && intent.type !== 'general_query') {
      adjustedConfidence = Math.min(0.95, adjustedConfidence + 0.1);
    }
    
    // Reduce confidence for implicit intents when sentiment is frustrated
    if (intent.isImplicit && emotionalContext.tone === 'frustrated') {
      adjustedConfidence = Math.max(0.3, adjustedConfidence - 0.15);
    }
    
    return {
      ...intent,
      confidence: adjustedConfidence,
    };
  });
}

function deduplicateIntents(intents: DetectedIntent[]): DetectedIntent[] {
  const seen = new Map<string, DetectedIntent>();
  
  for (const intent of intents) {
    const existing = seen.get(intent.type);
    if (!existing || intent.confidence > existing.confidence) {
      seen.set(intent.type, intent);
    }
  }
  
  return Array.from(seen.values());
}

function calculateComplexity(intents: DetectedIntent[]): 'simple' | 'moderate' | 'complex' {
  const explicitIntents = intents.filter(i => !i.isImplicit);
  if (explicitIntents.length === 1 && explicitIntents[0].type === 'general_query') return 'simple';
  if (explicitIntents.length <= 2) return 'moderate';
  return 'complex';
}

function hasSequentialDependencies(intents: DetectedIntent[]): boolean {
  const types = new Set(intents.map(i => i.type));
  
  // Ex: query puis send_email basé sur le résultat
  if (types.has('query') && types.has('send_email')) {
    const emailIntent = intents.find(i => i.type === 'send_email');
    if (emailIntent?.extractedParams?.to === undefined) {
      return true;
    }
  }
  
  // lookup_contact doit précéder send_email
  if (types.has('lookup_contact') && types.has('send_email')) {
    return true;
  }
  
  return false;
}

// Utility functions
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'Bonjour', 'Merci', 'Cordialement', 'Salut', 'Bonne', 'Journée',
    'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche',
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet',
    'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ]);
  return commonWords.has(word);
}

function getNextDayOfWeek(dayOfWeek: number): string {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntil = (dayOfWeek - currentDay + 7) % 7 || 7;
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate.toISOString().split('T')[0];
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helpers pour extraire des paramètres
function extractSubject(text: string): string | undefined {
  const match = text.match(/(?:sujet|objet|titre)\s*[:=]?\s*["']?([^"'\n]+)/i);
  return match?.[1]?.trim();
}

function extractBody(text: string): string | undefined {
  const match = text.match(/(?:contenu|message|texte|body)\s*[:=]?\s*["']?([^"']+)/i);
  return match?.[1]?.trim();
}

function extractTaskTitle(text: string): string | undefined {
  const match = text.match(/(?:tâche|task)\s+(?:pour\s+)?["']?([^"'\n,]+)/i);
  return match?.[1]?.trim();
}

function extractPriority(text: string): string | undefined {
  if (/urgent|critique|important/i.test(text)) return 'Haute';
  if (/normal|standard/i.test(text)) return 'Normale';
  if (/bas|basse|faible/i.test(text)) return 'Basse';
  return undefined;
}

function extractMeetingTitle(text: string): string | undefined {
  const match = text.match(/(?:réunion|meeting|rdv)\s+(?:avec\s+)?["']?([^"'\n,]+)/i);
  return match?.[1]?.trim();
}

function extractDate(text: string): string | undefined {
  if (/demain/i.test(text)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  if (/après-demain/i.test(text)) {
    const afterTomorrow = new Date();
    afterTomorrow.setDate(afterTomorrow.getDate() + 2);
    return afterTomorrow.toISOString().split('T')[0];
  }
  
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3] || new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }
  
  return undefined;
}

function extractTableName(text: string): string {
  if (/établissement|client/i.test(text)) return 'etablissements';
  if (/contact/i.test(text)) return 'contacts';
  if (/facture|invoice/i.test(text)) return 'factures';
  if (/email|mail/i.test(text)) return 'email_threads';
  if (/ticket|support/i.test(text)) return 'support_tickets';
  if (/tâche|task/i.test(text)) return 'taches';
  if (/objectif/i.test(text)) return 'jarvis_objectives';
  return 'etablissements';
}
