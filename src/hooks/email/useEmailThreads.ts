/**
 * @fileoverview Hook pour la gestion des fils de discussion email.
 * 
 * Ce module fournit un hook React Query pour récupérer les threads email
 * avec pagination, filtrage et support du prefetch.
 * 
 * @module hooks/useEmailThreads
 * @see {@link docs/EMAIL_ARCHITECTURE.md} pour l'architecture complète
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmailFilters } from "./useEmailFilters";
import { queryPresets } from "@/lib/queryPresets";
import { useUserEmailAccountIds } from "../shared/useUserEmailAccountIds";
import { sanitizePostgrestValue } from '@/lib/sanitize';

/**
 * Options pour la récupération des threads email.
 */
interface FetchThreadsOptions {
  /** Numéro de page (1-indexed) */
  page: number;
  /** Nombre d'éléments par page */
  itemsPerPage: number;
  /** Filtres à appliquer */
  filters: EmailFilters;
  /** IDs des comptes email de l'utilisateur (pour filtrage) */
  accountIds?: string[];
}

/** Structure d'un message email pour le filtrage des domaines exclus */
interface EmailMessageForFilter {
  from_address: string | null;
}

/** Cache global pour les domaines exclus (durée: 30 minutes) */
let excludedDomainsCache: { data: Set<string>; timestamp: number } | null = null;
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Récupère les domaines exclus avec cache mémoire
 */
async function getExcludedDomains(): Promise<Set<string>> {
  const now = Date.now();
  
  if (excludedDomainsCache && (now - excludedDomainsCache.timestamp) < CACHE_DURATION_MS) {
    return excludedDomainsCache.data;
  }
  
  const { data } = await supabase
    .from('email_domain_mappings')
    .select('domain')
    .eq('is_excluded', true);
  
  const domainSet = new Set(data?.map(d => d.domain) || []);
  excludedDomainsCache = { data: domainSet, timestamp: now };
  
  return domainSet;
}

/**
 * Construit et exécute la requête de threads avec filtres
 */
async function fetchThreadsWithFilters(
  page: number,
  itemsPerPage: number,
  filters: EmailFilters,
  excludedDomainsSet: Set<string>,
  accountIds?: string[]
) {
  const from = (page - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;

  let query = supabase
    .from("email_threads")
    .select(`
      id, thread_id, user_email_account_id, subject, participants,
      last_message_date, message_count, unread_count,
      last_message_from_email, last_message_from_name, last_message_is_sent,
      last_inbound_from_email, last_inbound_from_name, last_inbound_date,
      is_archived, is_spam, is_deleted, is_hors_etablissement, is_processed,
      has_sent_messages, category, priority, tags,
      etablissement_id, groupe_id, partenaire_id,
      ai_summary, ai_generated_title, ai_confidence_score, needs_manual_review,
      created_at, updated_at,
      account:user_email_accounts(email_address),
      etablissement:etablissements(id, nom, ville),
      groupe:groupes_etablissements(id, nom, type),
      partenaire:partenaires(id, nom, ville, type_partenaire)
    `)
    .eq('is_archived', false)
    .eq('is_spam', false)
    .eq('is_deleted', false);

  // Filter by user's accounts
  if (accountIds && accountIds.length > 0) {
    query = query.in('user_email_account_id', accountIds);
  }

  // Apply filters
  if (filters.search) {
    query = query.or(`subject.ilike.%${sanitizePostgrestValue(filters.search)}%,ai_summary.ilike.%${sanitizePostgrestValue(filters.search)}%`);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority as 'high' | 'medium' | 'low');
  }
  if (filters.unreadOnly) {
    query = query.gt('unread_count', 0);
  }
  
  // Mailbox filter (inbox/sent)
  // Inbox shows all threads EXCEPT pure outbound (is_outbound=true)
  // Sent shows all threads that have sent messages
  // A conversation thread appears in BOTH views (standard Gmail/Outlook behavior)
  if (filters.mailbox === 'sent') {
    query = query.eq('has_sent_messages', true);
  } else if (filters.mailbox === 'inbox') {
    query = query.or('is_outbound.eq.false,is_outbound.is.null');
  }

  const { data, error } = await query
    .order("last_message_date", { ascending: false })
    .range(from, to);

  if (error) throw error;

  // Filtrer les threads dont les participants proviennent de domaines exclus
  const filteredThreads = (data || []).filter(thread => {
    const participants = thread.participants;
    if (!participants || typeof participants !== 'object') return true;
    
    const emails: string[] = [];
    if (Array.isArray(participants)) {
      (participants as Array<string | { email?: string } | null>).forEach((p) => {
        const email = typeof p === 'string' ? p : p?.email;
        if (email) emails.push(email.toLowerCase());
      });
    }
    
    return !emails.some(email => {
      const domain = email.split('@')[1];
      return domain && excludedDomainsSet.has(domain);
    });
  });

  return {
    threads: filteredThreads,
    serverTotal: filteredThreads.length,
    filteredCount: filteredThreads.length,
    hasMore: (data || []).length === itemsPerPage, // If we got a full page, there's likely more
  };
}

/**
 * Hook pour récupérer les fils de discussion email avec pagination et filtrage.
 * 
 * Récupère les threads email non archivés, non spam, non supprimés avec leurs
 * relations (compte, établissement, groupe, partenaire, messages).
 * Exclut automatiquement les domaines marqués comme exclus.
 * 
 * @param {FetchThreadsOptions} options - Options de récupération
 * @param {number} options.page - Numéro de page (1-indexed)
 * @param {number} options.itemsPerPage - Nombre d'items par page
 * @param {EmailFilters} options.filters - Filtres actifs
 * 
 * @returns {Object} Résultat avec threads et métadonnées
 * @property {EmailThread[]} threads - Liste des threads
 * @property {number} total - Nombre total de threads (serveur)
 * @property {boolean} hasMore - Indique s'il y a plus de pages
 * @property {boolean} isLoading - État de chargement
 * @property {Error | null} error - Erreur éventuelle
 * @property {function} prefetchNextPage - Précharge la page suivante
 * @property {function} invalidateThreads - Invalide le cache des threads
 * 
 * @example
 * ```tsx
 * function EmailInbox() {
 *   const [page, setPage] = useState(1);
 *   const [filters, setFilters] = useState<EmailFilters>({});
 * 
 *   const { 
 *     threads, 
 *     hasMore, 
 *     isLoading,
 *     prefetchNextPage 
 *   } = useEmailThreads({ 
 *     page, 
 *     itemsPerPage: 25, 
 *     filters 
 *   });
 * 
 *   // Prefetch la page suivante au survol du bouton "suivant"
 *   const handleNextHover = () => {
 *     if (hasMore) prefetchNextPage();
 *   };
 * 
 *   return (
 *     <EmailList 
 *       threads={threads} 
 *       onLoadMore={() => setPage(p => p + 1)}
 *       onNextHover={handleNextHover}
 *     />
 *   );
 * }
 * ```
 * 
 * @see {@link useEmailFilters} pour la gestion des filtres
 * @see {@link useEmailSync} pour la synchronisation IMAP
 */
export function useEmailThreads({ page, itemsPerPage, filters, accountIds: externalAccountIds }: FetchThreadsOptions) {
  const queryClient = useQueryClient();
  const { accountIds: userAccountIds } = useUserEmailAccountIds();
  const effectiveAccountIds = externalAccountIds ?? userAccountIds;

  const queryKey = ['email-threads', page, filters, effectiveAccountIds];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const excludedDomainsSet = await getExcludedDomains();
      return fetchThreadsWithFilters(page, itemsPerPage, filters, excludedDomainsSet, effectiveAccountIds);
    },
    ...queryPresets.standard,
    refetchOnWindowFocus: false,
    enabled: effectiveAccountIds.length > 0,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
  });

  const prefetchNextPage = () => {
    queryClient.prefetchQuery({
      queryKey: ['email-threads', page + 1, filters, effectiveAccountIds],
      queryFn: async () => {
        const excludedDomainsSet = await getExcludedDomains();
        return fetchThreadsWithFilters(page + 1, itemsPerPage, filters, excludedDomainsSet, effectiveAccountIds);
      },
    });
  };

  const invalidateThreads = () => {
    queryClient.invalidateQueries({ queryKey: ['email-threads'] });
  };

  return {
    threads: data?.threads || [],
    total: data?.serverTotal || 0, // FIX: Utiliser le total serveur, pas le count filtré
    hasMore: data?.hasMore || false,
    isLoading,
    error,
    prefetchNextPage,
    invalidateThreads,
  };
}
