/**
 * useJarvisOfflineQueue - Offline message queue with IndexedDB persistence
 * 
 * Provides:
 * - Offline message queuing
 * - Automatic sync when online
 * - Request deduplication
 * - Priority-based ordering
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOfflineStatus } from '@/hooks/shared/useOfflineStatus';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';

export interface QueuedMessage {
  id: string;
  message: string;
  userId: string;
  conversationId?: string;
  priority: 'critical' | 'normal' | 'background';
  createdAt: number;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed';
}

interface UseJarvisOfflineQueueOptions {
  maxRetries?: number;
  autoSync?: boolean;
  dedupeTimeMs?: number;
}

const DB_NAME = 'jarvis-offline-db';
const STORE_NAME = 'message-queue';
const DB_VERSION = 1;

/**
 * Open or create IndexedDB database
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('priority', 'priority', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Generate unique ID for messages
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useJarvisOfflineQueue(options: UseJarvisOfflineQueueOptions = {}) {
  const { maxRetries = 3, autoSync = true, dedupeTimeMs = 5000 } = options;
  
  const { isOnline, isOffline } = useOfflineStatus();
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const dbRef = useRef<IDBDatabase | null>(null);
  const syncingRef = useRef(false);
  const recentMessagesRef = useRef<Map<string, number>>(new Map());

  /**
   * Initialize database
   */
  const initDb = useCallback(async () => {
    try {
      dbRef.current = await openDatabase();
      await loadQueue();
    } catch (error) {
      debug.error('[OfflineQueue] Failed to initialize IndexedDB:', error);
    }
  }, []);

  /**
   * Load queue from IndexedDB
   */
  const loadQueue = useCallback(async () => {
    if (!dbRef.current) return;

    return new Promise<void>((resolve, reject) => {
      const transaction = dbRef.current!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const messages = request.result as QueuedMessage[];
        // Sort by priority and creation time
        messages.sort((a, b) => {
          const priorityOrder = { critical: 0, normal: 1, background: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return a.createdAt - b.createdAt;
        });
        setQueue(messages);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }, []);

  /**
   * Save message to IndexedDB
   */
  const saveToDb = useCallback(async (message: QueuedMessage) => {
    if (!dbRef.current) return;

    return new Promise<void>((resolve, reject) => {
      const transaction = dbRef.current!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(message);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, []);

  /**
   * Remove message from IndexedDB
   */
  const removeFromDb = useCallback(async (id: string) => {
    if (!dbRef.current) return;

    return new Promise<void>((resolve, reject) => {
      const transaction = dbRef.current!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, []);

  /**
   * Check for duplicate messages (debounce)
   */
  const isDuplicate = useCallback((message: string): boolean => {
    const now = Date.now();
    const lastSent = recentMessagesRef.current.get(message);
    
    if (lastSent && (now - lastSent) < dedupeTimeMs) {
      return true;
    }

    // Clean old entries
    recentMessagesRef.current.forEach((time, key) => {
      if (now - time > dedupeTimeMs) {
        recentMessagesRef.current.delete(key);
      }
    });

    recentMessagesRef.current.set(message, now);
    return false;
  }, [dedupeTimeMs]);

  /**
   * Add message to queue
   */
  const enqueue = useCallback(async (
    message: string,
    userId: string,
    conversationId?: string,
    priority: QueuedMessage['priority'] = 'normal'
  ): Promise<string | null> => {
    // Check for duplicates
    if (isDuplicate(message)) {
      debug.log('[OfflineQueue] Duplicate message ignored');
      return null;
    }

    const queuedMessage: QueuedMessage = {
      id: generateId(),
      message,
      userId,
      conversationId,
      priority,
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    await saveToDb(queuedMessage);
    setQueue(prev => [...prev, queuedMessage]);
    
    debug.log(`[OfflineQueue] Message queued: ${queuedMessage.id}`);
    return queuedMessage.id;
  }, [isDuplicate, saveToDb]);

  /**
   * Process a single queued message
   */
  const processMessage = useCallback(async (msg: QueuedMessage): Promise<boolean> => {
    try {
      // Update status to processing
      const updatedMsg = { ...msg, status: 'processing' as const };
      await saveToDb(updatedMsg);

      // Send to Jarvis
      const { error } = await supabase.functions.invoke('jarvis-brain', {
        body: {
          user_id: msg.userId,
          message: msg.message,
          conversation_id: msg.conversationId,
        },
      });

      if (error) {
        throw error;
      }

      // Success - remove from queue
      await removeFromDb(msg.id);
      setQueue(prev => prev.filter(m => m.id !== msg.id));
      debug.log(`[OfflineQueue] Message processed: ${msg.id}`);
      return true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      debug.error(`[OfflineQueue] Failed to process ${msg.id}:`, errorMsg);

      // Update retry count
      const failedMsg: QueuedMessage = {
        ...msg,
        status: 'failed',
        retryCount: msg.retryCount + 1,
        lastError: errorMsg,
      };

      if (failedMsg.retryCount >= maxRetries) {
        // Max retries reached - keep in failed state
        await saveToDb(failedMsg);
        setQueue(prev => prev.map(m => m.id === msg.id ? failedMsg : m));
      } else {
        // Reset to pending for retry
        const pendingMsg = { ...failedMsg, status: 'pending' as const };
        await saveToDb(pendingMsg);
        setQueue(prev => prev.map(m => m.id === msg.id ? pendingMsg : m));
      }

      return false;
    }
  }, [maxRetries, saveToDb, removeFromDb]);

  /**
   * Sync all pending messages
   */
  const sync = useCallback(async (): Promise<{ processed: number; failed: number }> => {
    if (syncingRef.current || isOffline) {
      return { processed: 0, failed: 0 };
    }

    syncingRef.current = true;
    setIsSyncing(true);

    let processed = 0;
    let failed = 0;

    try {
      // Get pending messages sorted by priority
      const pendingMessages = queue.filter(m => m.status === 'pending');

      for (const msg of pendingMessages) {
        const success = await processMessage(msg);
        if (success) {
          processed++;
        } else {
          failed++;
        }

        // Small delay between messages
        await new Promise(r => setTimeout(r, 500));
      }

      setLastSync(new Date());
      debug.log(`[OfflineQueue] Sync complete: ${processed} processed, ${failed} failed`);

    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }

    return { processed, failed };
  }, [queue, isOffline, processMessage]);

  /**
   * Clear all messages (including failed)
   */
  const clearQueue = useCallback(async () => {
    if (!dbRef.current) return;

    return new Promise<void>((resolve, reject) => {
      const transaction = dbRef.current!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        setQueue([]);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }, []);

  /**
   * Retry failed messages
   */
  const retryFailed = useCallback(async () => {
    const failedMessages = queue.filter(m => m.status === 'failed');
    
    for (const msg of failedMessages) {
      const resetMsg = { ...msg, status: 'pending' as const, retryCount: 0 };
      await saveToDb(resetMsg);
    }

    setQueue(prev => prev.map(m => 
      m.status === 'failed' ? { ...m, status: 'pending', retryCount: 0 } : m
    ));

    // Trigger sync
    if (isOnline) {
      await sync();
    }
  }, [queue, isOnline, saveToDb, sync]);

  // Initialize DB on mount
  useEffect(() => {
    initDb();
  }, [initDb]);

  // Auto-sync when coming online
  useEffect(() => {
    if (autoSync && isOnline && queue.some(m => m.status === 'pending')) {
      sync();
    }
  }, [autoSync, isOnline, queue, sync]);

  const pendingCount = queue.filter(m => m.status === 'pending').length;
  const failedCount = queue.filter(m => m.status === 'failed').length;

  return {
    queue,
    pendingCount,
    failedCount,
    isSyncing,
    isOffline,
    lastSync,
    enqueue,
    sync,
    clearQueue,
    retryFailed,
  };
}

export default useJarvisOfflineQueue;
