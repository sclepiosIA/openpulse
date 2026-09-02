import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';

export interface PulsePollOption {
  id: string;
  poll_id: string;
  text: string;
  position: number | null;
  created_at: string | null;
  vote_count?: number;
}

export interface PulsePollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string | null;
}

export interface PulsePoll {
  id: string;
  conversation_id: string;
  message_id: string | null;
  created_by: string;
  question: string;
  is_multiple_choice: boolean | null;
  is_anonymous: boolean | null;
  ends_at: string | null;
  created_at: string | null;
  options?: PulsePollOption[];
  votes?: PulsePollVote[];
  my_votes?: string[]; // option_ids I voted for
  total_votes?: number;
}

// Query keys
export const pulsePollKeys = {
  all: ['pulse-polls'] as const,
  byId: (pollId: string) => [...pulsePollKeys.all, 'detail', pollId] as const,
  byConversation: (conversationId: string) => [...pulsePollKeys.all, 'conversation', conversationId] as const,
};

// Fetch a single poll with options and votes
async function fetchPoll(pollId: string, currentProfileId?: string): Promise<PulsePoll | null> {
  const { data: poll, error: pollError } = await supabase
    .from('pulse_polls')
    .select('id, conversation_id, message_id, created_by, question, is_multiple_choice, is_anonymous, ends_at, created_at')
    .eq('id', pollId)
    .maybeSingle();

  if (pollError) throw pollError;
  if (!poll) return null;

  // Fetch options
  const { data: options, error: optionsError } = await supabase
    .from('pulse_poll_options')
    .select('id, poll_id, text, position, created_at')
    .eq('poll_id', pollId)
    .order('position', { ascending: true });

  if (optionsError) throw optionsError;

  // Fetch votes
  const { data: votes, error: votesError } = await supabase
    .from('pulse_poll_votes')
    .select('id, poll_id, option_id, user_id, created_at')
    .eq('poll_id', pollId);

  if (votesError) throw votesError;

  // Calculate vote counts per option
  const voteCounts: Record<string, number> = {};
  (votes || []).forEach(v => {
    voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
  });

  const optionsWithCounts = (options || []).map(opt => ({
    ...opt,
    vote_count: voteCounts[opt.id] || 0,
  }));

  // Get my votes
  const myVotes = currentProfileId
    ? (votes || []).filter(v => v.user_id === currentProfileId).map(v => v.option_id)
    : [];

  return {
    ...poll,
    options: optionsWithCounts,
    votes: votes || [],
    my_votes: myVotes,
    total_votes: (votes || []).length,
  };
}

// Hook: Get a poll by ID
export function usePulsePoll(pollId: string | undefined) {
  const { data: currentProfile } = useCurrentProfile();

  return useQuery({
    queryKey: pulsePollKeys.byId(pollId || ''),
    queryFn: () => fetchPoll(pollId!, currentProfile?.id),
    enabled: !!pollId,
    staleTime: 10 * 1000,
  });
}

// Hook: Create a poll
export function useCreatePulsePoll() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCurrentProfile();

  return useMutation({
    mutationFn: async ({
      conversationId,
      question,
      options,
      isMultipleChoice = false,
      isAnonymous = false,
      endsAt,
    }: {
      conversationId: string;
      question: string;
      options: string[];
      isMultipleChoice?: boolean;
      isAnonymous?: boolean;
      endsAt?: string | null;
    }) => {
      if (!currentProfile?.id) throw new Error('Non authentifié');
      if (options.length < 2) throw new Error('Au moins 2 options requises');

      // Create poll
      const { data: poll, error: pollError } = await supabase
        .from('pulse_polls')
        .insert({
          conversation_id: conversationId,
          created_by: currentProfile.id,
          question,
          is_multiple_choice: isMultipleChoice,
          is_anonymous: isAnonymous,
          ends_at: endsAt || null,
        })
        .select()
        // safe: guaranteed-row
        .single();

      if (pollError) throw pollError;

      // Create options
      const optionInserts = options.map((text, index) => ({
        poll_id: poll.id,
        text,
        position: index,
      }));

      const { error: optionsError } = await supabase
        .from('pulse_poll_options')
        .insert(optionInserts);

      if (optionsError) throw optionsError;

      return poll;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pulsePollKeys.byConversation(data.conversation_id) });
      toast.success('Sondage créé');
    },
    onError: (error: Error) => {
      debug.error('Error creating poll:', error);
      toast.error('Erreur lors de la création du sondage');
    },
  });
}

// Hook: Vote on a poll
export function useVotePoll() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCurrentProfile();

  return useMutation({
    mutationFn: async ({
      pollId,
      optionId,
    }: {
      pollId: string;
      optionId: string;
    }) => {
      if (!currentProfile?.id) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('pulse_poll_votes')
        .insert({
          poll_id: pollId,
          option_id: optionId,
          user_id: currentProfile.id,
        })
        .select()
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pulsePollKeys.byId(data.poll_id) });
    },
    onError: (error: Error) => {
      debug.error('Error voting:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Vous avez déjà voté pour cette option');
      } else {
        toast.error('Erreur lors du vote');
      }
    },
  });
}

// Hook: Remove vote
export function useUnvotePoll() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCurrentProfile();

  return useMutation({
    mutationFn: async ({
      pollId,
      optionId,
    }: {
      pollId: string;
      optionId: string;
    }) => {
      if (!currentProfile?.id) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('pulse_poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('option_id', optionId)
        .eq('user_id', currentProfile.id);

      if (error) throw error;
      return { pollId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pulsePollKeys.byId(data.pollId) });
    },
    onError: (error: Error) => {
      debug.error('Error removing vote:', error);
      toast.error('Erreur lors du retrait du vote');
    },
  });
}

// Hook: Update poll message_id (link to message after sending)
export function useUpdatePollMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pollId, messageId }: { pollId: string; messageId: string }) => {
      const { data, error } = await supabase
        .from('pulse_polls')
        .update({ message_id: messageId })
        .eq('id', pollId)
        .select()
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pulsePollKeys.byId(data.id) });
    },
  });
}
