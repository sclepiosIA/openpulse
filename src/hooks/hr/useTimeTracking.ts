import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { useState, useEffect } from 'react';

export interface TimeEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  note: string | null;
  auto_closed: boolean;
  created_at: string;
}

// Current open session
export function useCurrentSession() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['time-entry-current', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TimeEntry | null;
    },
    enabled: !!user,
    refetchInterval: 30000, // refresh every 30s for real-time feel
  });
}

export function useClockIn() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note?: string) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('time_entries')
        .insert({ user_id: user.id, note: note || null })
        .select()
        .single(); // safe: guaranteed-row
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entry-current'] });
      qc.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });
}

export function useClockOut() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('time_entries')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .select()
        .single(); // safe: guaranteed-row
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entry-current'] });
      qc.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });
}

export type TimeRange = 'today' | 'week' | 'month';

function getDateRange(range: TimeRange) {
  const now = new Date();
  const start = new Date(now);
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday as start
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

export function useMyTimeEntries(range: TimeRange) {
  const { user } = useAuth();
  const { start, end } = getDateRange(range);
  return useQuery({
    queryKey: ['time-entries', 'my', range, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('clock_in', start)
        .lte('clock_in', end)
        .order('clock_in', { ascending: false });
      if (error) throw error;
      return (data || []) as TimeEntry[];
    },
    enabled: !!user,
  });
}

export function useTeamTimeEntries(range: TimeRange) {
  const { start, end } = getDateRange(range);
  return useQuery({
    queryKey: ['time-entries', 'team', range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .gte('clock_in', start)
        .lte('clock_in', end)
        .order('clock_in', { ascending: false });
      if (error) throw error;
      return (data || []) as TimeEntry[];
    },
  });
}

// Real-time elapsed timer
export function useElapsedTimer(clockIn: string | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!clockIn) { setElapsed(0); return; }
    const start = new Date(clockIn).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockIn]);

  return elapsed;
}

export function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

// Aggregate helpers
export function groupByDay(entries: TimeEntry[]) {
  const groups: Record<string, TimeEntry[]> = {};
  for (const e of entries) {
    const day = e.clock_in.slice(0, 10);
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }
  return groups;
}

export function totalMinutes(entries: TimeEntry[], currentSessionElapsed?: number) {
  let total = 0;
  for (const e of entries) {
    if (e.duration_minutes != null) {
      total += Number(e.duration_minutes);
    } else if (e.clock_out === null && currentSessionElapsed != null) {
      total += currentSessionElapsed / 60;
    }
  }
  return total;
}
