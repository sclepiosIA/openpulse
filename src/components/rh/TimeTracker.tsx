import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Square, Clock, Download, User, Circle } from 'lucide-react';
import { useCurrentSession, useClockIn, useClockOut, useMyTimeEntries, useTeamTimeEntries, useElapsedTimer, formatElapsed, formatDuration, groupByDay, totalMinutes, type TimeRange, type TimeEntry } from '@/hooks/hr/useTimeTracking';
import { useRolePermissions } from '@/hooks/auth/useRolePermissions';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
const DAILY_TARGET_HOURS = 7;

// ── Personal View ──
function PersonalTimeTracker() {
  const { data: session, isLoading } = useCurrentSession();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const elapsed = useElapsedTimer(session?.clock_in ?? null);
  const isActive = !!session;

  const { data: todayEntries = [] } = useMyTimeEntries('today');
  const { data: weekEntries = [] } = useMyTimeEntries('week');
  const { data: monthEntries = [] } = useMyTimeEntries('month');

  const handleToggle = () => {
    if (isActive && session) {
      clockOut.mutate(session.id, {
        onSuccess: () => toast.success('Session terminée'),
        onError: () => toast.error('Erreur lors de la clôture'),
      });
    } else {
      clockIn.mutate(undefined, {
        onSuccess: () => toast.success('Session démarrée'),
        onError: () => toast.error('Erreur lors du démarrage'),
      });
    }
  };

  const todayTotal = totalMinutes(todayEntries, isActive ? elapsed : undefined);
  const weekTotal = totalMinutes(weekEntries, isActive ? elapsed : undefined);
  const monthTotal = totalMinutes(monthEntries, isActive ? elapsed : undefined);
  const weekByDay = groupByDay(weekEntries);

  // Days of week labels
  const weekDays = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, []);

  const weekDayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Timer Card */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-4 sm:p-8 flex flex-col items-center gap-4 sm:gap-6">
          {/* Big toggle */}
          <button
            onClick={handleToggle}
            disabled={clockIn.isPending || clockOut.isPending || isLoading}
            aria-label={isActive ? "Arrêter le pointage" : "Démarrer le pointage"}
            aria-pressed={isActive}
            title={isActive ? "Arrêter le pointage" : "Démarrer le pointage"}
            className={cn(
              "relative w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-300",
              "focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/50",
              isActive
                ? "bg-destructive/10 hover:bg-destructive/20 text-destructive"
                : "bg-primary/10 hover:bg-primary/20 text-primary"
            )}
          >
            {isActive && (
              <span className="absolute inset-0 rounded-full animate-ping bg-destructive/20" />
            )}
            {isActive ? (
              <Square className="w-10 h-10 sm:w-12 sm:h-12 relative z-10" />
            ) : (
              <Play className="w-10 h-10 sm:w-12 sm:h-12 relative z-10 ml-1" />
            )}
          </button>

          {/* Timer display */}
          <div className="text-center">
            <p className="text-3xl sm:text-5xl font-mono font-bold tracking-wider">
              {isActive ? formatElapsed(elapsed) : '00:00:00'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {isActive ? 'En cours…' : 'Cliquez pour démarrer'}
            </p>
          </div>

          {/* Today summary */}
          <div className="flex gap-6 sm:gap-10 text-center">
            <div>
              <p className="text-xl sm:text-2xl font-semibold">{formatDuration(todayTotal)}</p>
              <p className="text-xs text-muted-foreground">Aujourd'hui</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-semibold">{formatDuration(weekTotal)}</p>
              <p className="text-xs text-muted-foreground">Semaine</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-semibold">{formatDuration(monthTotal)}</p>
              <p className="text-xs text-muted-foreground">Mois</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Week progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Semaine en cours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {weekDays.map((day, i) => {
            const entries = weekByDay[day] || [];
            const mins = totalMinutes(entries, day === new Date().toISOString().slice(0, 10) && isActive ? elapsed : undefined);
            const pct = Math.min((mins / (DAILY_TARGET_HOURS * 60)) * 100, 100);
            const isToday = day === new Date().toISOString().slice(0, 10);
            return (
              <div key={day} className="flex items-center gap-3">
                <span className={cn("w-8 text-xs font-medium", isToday && "text-primary font-bold")}>
                  {weekDayLabels[i]}
                </span>
                <div className="flex-1 h-4 sm:h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      pct >= 100 ? "bg-green-500" : isToday ? "bg-primary" : "bg-primary/60"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-14 text-xs text-right text-muted-foreground">
                  {mins > 0 ? formatDuration(mins) : '—'}
                </span>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground text-right pt-1">
            Objectif : {DAILY_TARGET_HOURS}h/jour
          </p>
        </CardContent>
      </Card>

      {/* Today entries */}
      {todayEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Entrées du jour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayEntries.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 text-sm">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono">
                    {new Date(entry.clock_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono">
                    {entry.clock_out
                      ? new Date(entry.clock_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      : 'en cours'}
                  </span>
                  {entry.duration_minutes != null && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {formatDuration(Number(entry.duration_minutes))}
                    </Badge>
                  )}
                  {entry.auto_closed && (
                    <Badge variant="outline" className="text-xs text-orange-600">auto</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Team Dashboard (Direction) ──
function TeamTimeDashboard() {
  const [range, setRange] = useState<TimeRange>('week');
  const { data: entries = [] } = useTeamTimeEntries(range);

  // Fetch profiles for names
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-minimal-time'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, prenom, nom')
        .eq('actif', true);
      return data || [];
    },
  });

  // Group entries by user
  const byUser = useMemo(() => {
    const map: Record<string, TimeEntry[]> = {};
    for (const e of entries) {
      if (!map[e.user_id]) map[e.user_id] = [];
      map[e.user_id].push(e);
    }
    return map;
  }, [entries]);

  // Check who has open session
  const activeUsers = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (!e.clock_out) set.add(e.user_id);
    }
    return set;
  }, [entries]);

  const getName = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : userId.slice(0, 8);
  };

  const handleExportCSV = () => {
    const rows = [['Nom', 'Heures Total', 'Sessions', 'Statut']];
    for (const [uid, userEntries] of Object.entries(byUser)) {
      const total = totalMinutes(userEntries);
      rows.push([
        getName(uid),
        formatDuration(total),
        String(userEntries.length),
        activeUsers.has(uid) ? 'En ligne' : 'Hors ligne',
      ]);
    }
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temps-equipe-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  const sortedUsers = useMemo(() => {
    return Object.entries(byUser).sort((a, b) => {
      // Active first, then by total hours
      const aActive = activeUsers.has(a[0]) ? 1 : 0;
      const bActive = activeUsers.has(b[0]) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return totalMinutes(b[1]) - totalMinutes(a[1]);
    });
  }, [byUser, activeUsers]);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <User className="w-4 h-4" />
          Temps de travail — Équipe
        </CardTitle>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
              <TabsTrigger value="today" className="text-xs">Jour</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Semaine</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Mois</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="shrink-0">
            <Download className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée pour cette période</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Sessions</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Moy./jour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map(([uid, userEntries]) => {
                  const total = totalMinutes(userEntries);
                  const days = Object.keys(groupByDay(userEntries)).length;
                  const avg = days > 0 ? total / days : 0;
                  const active = activeUsers.has(uid);
                  return (
                    <TableRow key={uid}>
                      <TableCell className="font-medium">{getName(uid)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={active ? 'default' : 'secondary'} className={cn("text-xs", active && "bg-green-500 hover:bg-green-600")}>
                          <Circle className={cn("w-2 h-2 mr-1 fill-current", active ? "text-white" : "text-muted-foreground")} />
                          {active ? 'En ligne' : 'Hors ligne'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatDuration(total)}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{userEntries.length}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-mono">{formatDuration(avg)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ──
export function TimeTracker() {
  const { canViewAllTeamMembers, isAdmin, role } = useRolePermissions();
  const canViewTeam = canViewAllTeamMembers || isAdmin || role === 'rh';

  return (
    <div className="space-y-6">
      <PersonalTimeTracker />
      {canViewTeam && <TeamTimeDashboard />}
    </div>
  );
}
