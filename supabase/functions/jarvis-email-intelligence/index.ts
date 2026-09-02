 /**
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
  * JARVIS V12.0 - Email Intelligence Engine
  * 
  * Analyse avancée des emails : scoring de priorité, détection de sentiment,
  * suggestions de réponse contextuelles.
  */
 
 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;
 
 interface EmailAnalysis {
   threadId: string;
   priorityScore: number;
   sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
   suggestedResponseTone: string;
   keyTopics: string[];
   actionRequired: boolean;
   estimatedResponseTime: number;
 }
 
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 🔒 Validate JWT — reject anon/unauthenticated callers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub || claimsData.claims.role !== 'authenticated') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authenticatedUserId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, threadId } = await req.json();
    // 🔒 Force userId to authenticated subject — ignore any client-supplied value
    const userId = authenticatedUserId;

    // 🔒 Verify thread ownership before processing thread-scoped actions
    const verifyThreadOwnership = async (tid: string): Promise<boolean> => {
      const { data } = await supabase
        .from('email_threads')
        .select('id, user_email_accounts!inner(user_id)')
        .eq('id', tid)
        .eq('user_email_accounts.user_id', userId)
        .maybeSingle();
      return !!data;
    };

    switch (action) {
      case 'analyze_thread': {
        if (!threadId || !(await verifyThreadOwnership(threadId))) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const analysis = await analyzeEmailThread(supabase, threadId);
        return new Response(JSON.stringify({ success: true, analysis }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_priority_inbox': {
        const emails = await getPriorityInbox(supabase, userId);
        return new Response(JSON.stringify({ success: true, emails }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'suggest_response': {
        if (!threadId || !(await verifyThreadOwnership(threadId))) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const suggestion = await suggestResponse(supabase, threadId);
        return new Response(JSON.stringify({ success: true, suggestion }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'detect_sentiment_alerts': {
        const alerts = await detectSentimentAlerts(supabase, userId);
        return new Response(JSON.stringify({ success: true, alerts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Email intelligence error:', error);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
 
 async function analyzeEmailThread(supabase: any, threadId: string): Promise<EmailAnalysis> {
   // Get thread with messages
   const { data: thread, error } = await supabase
     .from('email_threads')
     .select(`
       *,
       email_messages (
         id,
         from_email,
         subject,
         body_text,
         sent_at,
         direction
       )
     `)
     .eq('id', threadId)
     .single();
 
   if (error || !thread) {
     throw new Error('Thread not found');
   }
 
   const messages = thread.email_messages || [];
   const lastMessage = messages[messages.length - 1];
   const bodyText = lastMessage?.body_text || '';
 
   // Analyze sentiment based on keywords
   const sentiment = analyzeSentiment(bodyText);
   
   // Calculate priority score
   const priorityScore = calculatePriorityScore(thread, messages, sentiment);
   
   // Detect key topics
   const keyTopics = extractKeyTopics(bodyText);
   
   // Determine if action is required
   const actionRequired = detectActionRequired(bodyText);
   
   // Estimate response time based on complexity
   const estimatedResponseTime = estimateResponseTime(bodyText, sentiment);
 
   return {
     threadId,
     priorityScore,
     sentiment,
     suggestedResponseTone: getSuggestedTone(sentiment),
     keyTopics,
     actionRequired,
     estimatedResponseTime
   };
 }
 
 function analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' | 'urgent' {
   const lowerText = text.toLowerCase();
   
   // Urgent indicators
   const urgentWords = ['urgent', 'asap', 'immédiat', 'critique', 'deadline', 'aujourd\'hui'];
   if (urgentWords.some(w => lowerText.includes(w))) {
     return 'urgent';
   }
   
   // Negative indicators
   const negativeWords = ['problème', 'erreur', 'bug', 'mécontent', 'déçu', 'plainte', 'résiliation', 'annuler'];
   const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
   
   // Positive indicators
   const positiveWords = ['merci', 'excellent', 'parfait', 'satisfait', 'bravo', 'super', 'génial'];
   const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
   
   if (negativeCount > positiveCount && negativeCount >= 2) return 'negative';
   if (positiveCount > negativeCount && positiveCount >= 2) return 'positive';
   return 'neutral';
 }
 
 function calculatePriorityScore(thread: any, messages: any[], sentiment: string): number {
   let score = 50; // Base score
   
   // Sentiment impact
   if (sentiment === 'urgent') score += 40;
   else if (sentiment === 'negative') score += 25;
   else if (sentiment === 'positive') score -= 10;
   
   // Unread count impact
   if (thread.unread_count > 0) score += 15;
   if (thread.unread_count > 3) score += 10;
   
   // Message count (long threads might need attention)
   if (messages.length > 5) score += 10;
   
   // Time since last message
   const lastMessageDate = new Date(thread.last_message_date);
   const hoursSinceLastMessage = (Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60);
   if (hoursSinceLastMessage < 4) score += 15;
   else if (hoursSinceLastMessage > 48) score -= 10;
   
   // Clamp to 0-100
   return Math.max(0, Math.min(100, score));
 }
 
 function extractKeyTopics(text: string): string[] {
   const topics: string[] = [];
   const lowerText = text.toLowerCase();
   
   const topicPatterns: Record<string, string[]> = {
     'facturation': ['facture', 'paiement', 'devis', 'tarif', 'prix'],
     'technique': ['bug', 'erreur', 'problème technique', 'fonctionnalité'],
     'commercial': ['offre', 'proposition', 'contrat', 'partenariat'],
     'support': ['aide', 'assistance', 'question', 'comment'],
     'formation': ['formation', 'tutoriel', 'apprendre', 'session'],
     'rdv': ['réunion', 'rendez-vous', 'appel', 'visio', 'call']
   };
   
   for (const [topic, keywords] of Object.entries(topicPatterns)) {
     if (keywords.some(k => lowerText.includes(k))) {
       topics.push(topic);
     }
   }
   
   return topics.slice(0, 3);
 }
 
 function detectActionRequired(text: string): boolean {
   const actionIndicators = [
     'pouvez-vous', 'pourriez-vous', 'merci de', 'prière de',
     'j\'attends', 'attendons', 'besoin de', 'nécessaire',
     '?', 'quand', 'comment', 'où'
   ];
   
   const lowerText = text.toLowerCase();
   return actionIndicators.some(i => lowerText.includes(i));
 }
 
 function estimateResponseTime(text: string, sentiment: string): number {
   // Base time in minutes
   let time = 5;
   
   // Complexity based on length
   const wordCount = text.split(/\s+/).length;
   if (wordCount > 200) time += 10;
   else if (wordCount > 100) time += 5;
   
   // Sentiment adjustment
   if (sentiment === 'negative' || sentiment === 'urgent') time += 10;
   
   return time;
 }
 
 function getSuggestedTone(sentiment: string): string {
   switch (sentiment) {
     case 'urgent': return 'professionnel et réactif';
     case 'negative': return 'empathique et solution-oriented';
     case 'positive': return 'chaleureux et reconnaissant';
     default: return 'professionnel et courtois';
   }
 }
 
 async function getPriorityInbox(supabase: any, userId: string): Promise<any[]> {
   // Get user's email accounts
   const { data: accounts } = await supabase
     .from('user_email_accounts')
     .select('id')
     .eq('user_id', userId);
 
   if (!accounts || accounts.length === 0) return [];
 
   const accountIds = accounts.map((a: any) => a.id);
 
   // Get recent unread threads
   const { data: threads } = await supabase
     .from('email_threads')
     .select('*')
     .in('email_account_id', accountIds)
     .gt('unread_count', 0)
     .order('last_message_date', { ascending: false })
     .limit(20);
 
   if (!threads) return [];
 
   // Analyze and sort by priority
   const analyzedThreads = await Promise.all(
     threads.map(async (thread: any) => {
       try {
         const analysis = await analyzeEmailThread(supabase, thread.id);
         return { ...thread, analysis };
       } catch {
         return { ...thread, analysis: { priorityScore: 50 } };
       }
     })
   );
 
   return analyzedThreads.sort((a, b) => b.analysis.priorityScore - a.analysis.priorityScore);
 }
 
 async function suggestResponse(supabase: any, threadId: string): Promise<any> {
   const analysis = await analyzeEmailThread(supabase, threadId);
   
   const templates: Record<string, string> = {
     'urgent': "Je prends en charge votre demande immédiatement et reviens vers vous dans l'heure.",
     'negative': "Je comprends votre frustration et je m'engage à résoudre ce problème rapidement.",
     'positive': "Merci pour votre retour positif ! C'est un plaisir de collaborer avec vous.",
     'neutral': "Merci pour votre message. Je vous réponds dans les meilleurs délais."
   };
   
   return {
     suggestedOpening: templates[analysis.sentiment],
     tone: analysis.suggestedResponseTone,
     estimatedTime: analysis.estimatedResponseTime,
     keyPoints: analysis.keyTopics
   };
 }
 
 async function detectSentimentAlerts(supabase: any, userId: string): Promise<any[]> {
   const priorityInbox = await getPriorityInbox(supabase, userId);
   
   return priorityInbox
     .filter(t => t.analysis?.sentiment === 'negative' || t.analysis?.sentiment === 'urgent')
     .map(t => ({
       threadId: t.id,
       subject: t.subject,
       sentiment: t.analysis.sentiment,
       priorityScore: t.analysis.priorityScore,
       actionRequired: t.analysis.actionRequired,
       alert: t.analysis.sentiment === 'negative' 
         ? '⚠️ Client potentiellement mécontent' 
         : '🔥 Demande urgente'
     }));
 }