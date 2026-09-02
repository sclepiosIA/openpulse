import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { sanitizeEmailSubject } from "@/lib/emailUtils";

export type TimelinePeriod = '7d' | '30d' | '90d' | 'all' | 'custom';
export type InteractionType = 'all' | 'sent' | 'received';

interface TimelineFilters {
  period: TimelinePeriod;
  interactionType: InteractionType;
  customStartDate?: Date;
  customEndDate?: Date;
}

interface TimelineEvent {
  id: string;
  thread_id: string;
  subject: string;
  timestamp: string;
  type: 'sent' | 'received';
  participant: string;
  message_count: number;
  unread_count: number;
  ai_summary: string | null;
  has_attachments: boolean;
}

export function useEmailTimeline(etablissementId: string, filters: TimelineFilters) {
  return useQuery({
    queryKey: ['email-timeline', etablissementId, filters],
    queryFn: async () => {
      let startDate: Date | undefined;
      let endDate: Date = new Date();

      // Calculate date range based on period
      switch (filters.period) {
        case '7d':
          startDate = subDays(endDate, 7);
          break;
        case '30d':
          startDate = subDays(endDate, 30);
          break;
        case '90d':
          startDate = subDays(endDate, 90);
          break;
        case 'custom':
          startDate = filters.customStartDate;
          endDate = filters.customEndDate || endDate;
          break;
        case 'all':
        default:
          startDate = undefined;
          break;
      }

      // Build query
      let query = supabase
        .from('email_threads')
        .select(`
          id,
          subject,
          last_message_date,
          message_count,
          unread_count,
          ai_summary,
          participants,
          user_email_accounts!inner(email_address)
        `)
        .eq('etablissement_id', etablissementId)
        .order('last_message_date', { ascending: false });

      // Apply date filters
      if (startDate) {
        query = query.gte('last_message_date', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('last_message_date', endOfDay(endDate).toISOString());
      }

      const { data: threads, error } = await query;

      if (error) throw error;

      // Fetch all latest messages in one query using a window function approach
      const threadIds = (threads || []).map(t => t.id);
      
      if (threadIds.length === 0) {
        return {
          events: [],
          stats: {
            totalEvents: 0,
            sentCount: 0,
            receivedCount: 0,
            unreadCount: 0,
            withAttachments: 0,
          },
          chartData: [],
        };
      }

      const { data: allMessages } = await supabase
        .from('email_messages')
        .select('thread_id, from_address, to_addresses, has_attachments, created_at')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false });

      // Group messages by thread and get the latest one for each
      interface MessageData {
        thread_id: string;
        from_address: string | null;
        to_addresses: unknown; // JSON type from Supabase
        has_attachments: boolean | null;
        created_at: string;
      }
      const latestMessageByThread = new Map<string, MessageData>();
      allMessages?.forEach(msg => {
        if (!latestMessageByThread.has(msg.thread_id)) {
          latestMessageByThread.set(msg.thread_id, msg as MessageData);
        }
      });

      // Process threads with their latest messages
      const timelineEvents: (TimelineEvent | null)[] = (threads || []).map(thread => {
        const lastMessage = latestMessageByThread.get(thread.id);
        const userEmail = (thread.user_email_accounts as { email_address?: string } | null)?.email_address;
        
        if (!lastMessage) return null;

        // Determine if sent or received based on from_address
        const isSent = lastMessage.from_address === userEmail;
        const type: 'sent' | 'received' = isSent ? 'sent' : 'received';

        // Apply interaction type filter
        if (filters.interactionType !== 'all' && filters.interactionType !== type) {
          return null;
        }

        // Extract participant safely
        let participant = 'Unknown';
        if (isSent && lastMessage.to_addresses) {
          const toAddresses = Array.isArray(lastMessage.to_addresses) 
            ? lastMessage.to_addresses 
            : [];
          const first = toAddresses[0];
          if (first && typeof first === 'object' && first !== null) {
            const f = first as { name?: string; email?: string };
            participant = f.name || f.email || 'Unknown';
          } else if (typeof first === 'string') {
            participant = first;
          }
        } else if (lastMessage.from_address) {
          const fromAddr = lastMessage.from_address;
          if (typeof fromAddr === 'object' && fromAddr !== null) {
            const f = fromAddr as { name?: string; email?: string };
            participant = f.name || f.email || 'Unknown';
          } else {
            participant = fromAddr as string;
          }
        }

        return {
          id: thread.id,
          thread_id: thread.id,
          subject: sanitizeEmailSubject(thread.subject),
          timestamp: thread.last_message_date,
          type,
          participant,
          message_count: thread.message_count,
          unread_count: thread.unread_count,
          ai_summary: thread.ai_summary ? sanitizeEmailSubject(thread.ai_summary) : null,
          has_attachments: lastMessage.has_attachments ? true : false,
        };
      });

      // Filter out null values and sort by timestamp
      const filteredEvents = timelineEvents
        .filter((event): event is TimelineEvent => event !== null)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Calculate statistics
      const stats = {
        totalEvents: filteredEvents.length,
        sentCount: filteredEvents.filter(e => e.type === 'sent').length,
        receivedCount: filteredEvents.filter(e => e.type === 'received').length,
        unreadCount: filteredEvents.reduce((sum, e) => sum + e.unread_count, 0),
        withAttachments: filteredEvents.filter(e => e.has_attachments).length,
      };

      // Group by date for chart
      const eventsByDate = filteredEvents.reduce((acc, event) => {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, sent: 0, received: 0 };
        }
        if (event.type === 'sent') {
          acc[date].sent++;
        } else {
          acc[date].received++;
        }
        return acc;
      }, {} as Record<string, { date: string; sent: number; received: number }>);

      const chartData = Object.values(eventsByDate).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return {
        events: filteredEvents,
        stats,
        chartData,
      };
    },
    staleTime: 30000,
  });
}
