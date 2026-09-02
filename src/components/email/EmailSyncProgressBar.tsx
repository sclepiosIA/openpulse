import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { debug } from "@/lib/debug";
import { useVisibilityAwareInterval } from "@/hooks/ui/useVisibilityAwareInterval";
import { fetchRecentEmailSyncLog } from "@/services/email/emailSyncStatus";

interface SyncProgress {
  isRunning: boolean;
  progress: number; // 0-100
  emailsFetched: number;
  totalEstimated: number;
  currentAccount: string;
}

interface EmailSyncProgressBarProps {
  onSyncComplete?: () => void;
}

const LAST_SYNC_KEY = 'email_last_sync_id';

export function EmailSyncProgressBar({ onSyncComplete }: EmailSyncProgressBarProps) {
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncId, setLastSyncId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LAST_SYNC_KEY);
    }
    return null;
  });

  const checkSyncStatus = useCallback(async () => {
    try {
      const recentSync = await fetchRecentEmailSyncLog();
      if (!recentSync) {
        setSyncProgress(null);
        return;
      }

      const now = new Date();

      // Detect running based on status field (more reliable)
      if (recentSync.status === 'running') {
        // Guard: if running for more than 15 minutes, treat as stale/failed
        const startedAt = recentSync.execution_start ? new Date(recentSync.execution_start) : null;
        const runningSeconds = startedAt ? (now.getTime() - startedAt.getTime()) / 1000 : 0;
        if (runningSeconds > 900) {
          // Stale sync — ignore it
          setSyncProgress(null);
        } else {
          const emailsFetched = recentSync.emails_fetched || 0;
          setSyncProgress({
            isRunning: true,
            progress: Math.min(95, (emailsFetched / Math.max(emailsFetched + 50, 100)) * 100),
            emailsFetched: emailsFetched,
            totalEstimated: Math.max(emailsFetched + 50, 100),
            currentAccount: 'Synchronisation en cours...'
          });
        }
      } else if (recentSync.status === 'completed' && recentSync.execution_end) {
        const completedAt = new Date(recentSync.execution_end);
        const completedElapsed = (now.getTime() - completedAt.getTime()) / 1000;
        
        // Trigger refresh when sync completes (only once per sync, persist across remounts)
        if (lastSyncId !== recentSync.id && onSyncComplete) {
          debug.log('🔄 Sync completed, triggering auto-refresh');
          onSyncComplete();
          setLastSyncId(recentSync.id);
          if (typeof window !== 'undefined') {
            localStorage.setItem(LAST_SYNC_KEY, recentSync.id);
          }
        }
        
        // Show completion for 5 seconds
        if (completedElapsed < 5) {
          setSyncProgress({
            isRunning: false,
            progress: 100,
            emailsFetched: recentSync.emails_fetched || 0,
            totalEstimated: recentSync.emails_fetched || 0,
            currentAccount: ''
          });
        } else {
          setSyncProgress(null);
        }
      } else {
        setSyncProgress(null);
      }
    } catch (e) {
      // Unexpected error - silently ignore
      setSyncProgress(null);
    }
  }, [lastSyncId, onSyncComplete]);

  // Use visibility-aware interval - pauses when tab is hidden
  // Poll every 30s, disable entirely when no sync is detected (syncProgress === null)
  const [pollingActive, setPollingActive] = useState(true);
  
  // Track polling state: start with a single check, then only keep polling if sync is running
  const checkAndManagePolling = useCallback(async () => {
    await checkSyncStatus();
  }, [checkSyncStatus]);

  // Disable polling when syncProgress is null (no active sync) after initial check
  useEffect(() => {
    if (syncProgress === null) {
      // After initial check returned null, slow down to 60s background check
      setPollingActive(false);
    } else if (syncProgress?.isRunning) {
      // Active sync detected, enable fast polling
      setPollingActive(true);
    }
  }, [syncProgress]);

  useVisibilityAwareInterval(checkAndManagePolling, pollingActive ? 15000 : 60000, {
    runImmediately: true,
    enabled: true,
  });

  if (!syncProgress) return null;

  return (
    <Card className="p-4 mb-4 bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-top-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {syncProgress.isRunning ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            <div>
              <p className="font-medium text-sm">
                {syncProgress.isRunning ? "Synchronisation en cours..." : "Synchronisation terminée"}
              </p>
              <p className="text-xs text-muted-foreground">
                {syncProgress.currentAccount}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-primary">
              {Math.round(syncProgress.progress)}%
            </p>
            <p className="text-xs text-muted-foreground">
              <Mail className="h-3 w-3 inline mr-1" />
              {syncProgress.emailsFetched} / {syncProgress.totalEstimated}
            </p>
          </div>
        </div>
        <Progress value={syncProgress.progress} className="h-2" />
      </div>
    </Card>
  );
}
