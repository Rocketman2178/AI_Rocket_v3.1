import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GmailAuthData } from '../lib/gmail-oauth';

const SYNC_WEBHOOK_URL = import.meta.env.VITE_N8N_GMAIL_SYNC_WEBHOOK;

interface SyncResult {
  success: boolean;
  status?: 'processing' | 'complete' | 'partial_success';
  message?: string;
  metrics?: {
    emails_processed?: number;
    emails_stored?: number;
    sync_duration_ms?: number;
  };
  sync_details?: {
    user_id: string;
    sync_type: string;
    total_batches: number;
    batches_triggered: number;
    batches_failed: number;
    estimated_completion_minutes: number;
  };
  next_steps?: {
    info: string;
    estimated_completion: string;
  };
  error?: string;
}

export interface GmailSyncState {
  isConnected: boolean;
  gmailAuth: GmailAuthData | null;
  emailCount: number;
  lastSyncDate: Date | null;
  loading: boolean;
  syncing: boolean;
  error: string | null;
}

export const useGmailSync = () => {
  const [state, setState] = useState<GmailSyncState>({
    isConnected: false,
    gmailAuth: null,
    emailCount: 0,
    lastSyncDate: null,
    loading: true,
    syncing: false,
    error: null
  });
  const [previousEmailCount, setPreviousEmailCount] = useState<number>(0);

  const createSyncCompletionNotification = async (userId: string, emailCount: number) => {
    try {
      const { error } = await supabase
        .from('astra_notifications')
        .insert({
          user_id: userId,
          type: 'system',
          title: 'Gmail Sync Complete',
          message: `Successfully synced ${emailCount} emails. You can now ask Astra about your emails!`,
          action_url: 'settings',
          is_read: false
        });

      if (error) {
        console.error('[useGmailSync] Failed to create notification:', error);
      } else {
        console.log('[useGmailSync] ✅ Created sync completion notification');
      }
    } catch (err) {
      console.error('[useGmailSync] Error creating notification:', err);
    }
  };

  const loadSyncState = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      const { data: gmailAuth } = await supabase
        .from('gmail_auth')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();

      // Try to use RPC function first, fallback to client-side counting if not available
      let count = 0;

      const { data: countData, error: countError } = await supabase
        .rpc('count_distinct_email_threads', { p_user_id: session.user.id });

      if (countError) {
        console.log('[useGmailSync] RPC function not available, using fallback count method');

        // Fallback: fetch with a high limit to get all records
        const { data: threads, error: threadsError } = await supabase
          .from('document_chunks_emails')
          .select('thread_id')
          .eq('user_id', session.user.id)
          .limit(10000); // Set a high limit to get more records

        if (threadsError) {
          console.error('[useGmailSync] Error fetching threads:', threadsError);
        } else {
          // Count unique thread_ids
          const uniqueThreads = new Set(threads?.map(t => t.thread_id).filter(Boolean) || []);
          count = uniqueThreads.size;
        }
      } else {
        count = countData || 0;
      }

      const { data: lastEmail } = await supabase
        .from('document_chunks_emails')
        .select('created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentCount = count;

      // Detect sync completion: significant increase in email count (>= 10 emails)
      if (currentCount >= 10 && previousEmailCount < 10 && currentCount > previousEmailCount) {
        // Check if we've already notified about initial sync
        const notifiedKey = `gmail_sync_notified_${session.user.id}`;
        const hasNotified = localStorage.getItem(notifiedKey);

        if (!hasNotified) {
          console.log('[useGmailSync] Initial sync detected! Creating notification...');
          await createSyncCompletionNotification(session.user.id, currentCount);
          localStorage.setItem(notifiedKey, 'true');
        }
      }

      setPreviousEmailCount(currentCount);

      setState({
        isConnected: !!gmailAuth,
        gmailAuth: gmailAuth || null,
        emailCount: currentCount,
        lastSyncDate: lastEmail ? new Date(lastEmail.created_at) : null,
        loading: false,
        syncing: false,
        error: null
      });
    } catch (err: any) {
      console.error('[useGmailSync] Error loading state:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load Gmail sync state'
      }));
    }
  };

  const triggerSync = async (): Promise<SyncResult> => {
    if (!SYNC_WEBHOOK_URL) {
      const error = 'Gmail sync webhook URL is not configured';
      setState(prev => ({ ...prev, error }));
      return { success: false, error };
    }

    try {
      setState(prev => ({ ...prev, syncing: true, error: null }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('[useGmailSync] Triggering sync for user:', session.user.id);

      // Create AbortController with 5 minute timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      try {
        const response = await fetch(SYNC_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: session.user.id,
            timestamp: new Date().toISOString()
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Sync failed: ${errorText}`);
        }

        let result = await response.json();
        console.log('[useGmailSync] Sync result:', result);

        // Handle array response (n8n webhook may return array)
        if (Array.isArray(result) && result.length > 0) {
          result = result[0];
        }

        await loadSyncState();

        setState(prev => ({ ...prev, syncing: false }));

        // Check if result has success property, if not assume success from result object structure
        const isSuccess = result.success !== false;

        return {
          success: isSuccess,
          status: result.status || 'complete',
          message: result.message,
          metrics: result.metrics,
          sync_details: result.sync_details,
          next_steps: result.next_steps
        };
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    } catch (err: any) {
      console.error('[useGmailSync] Sync error:', err);
      const errorMessage = err.message || 'Failed to sync emails';

      setState(prev => ({
        ...prev,
        syncing: false,
        error: errorMessage
      }));

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  useEffect(() => {
    loadSyncState();

    // Set up real-time subscription to document_chunks_emails table
    // This will update the email count as emails are synced
    let channel: any;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;

      channel = supabase
        .channel('document-chunks-emails-sync')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'document_chunks_emails',
            filter: `user_id=eq.${session.user.id}`
          },
          () => {
            console.log('[useGmailSync] New email detected, refreshing state...');
            loadSyncState();
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return {
    ...state,
    triggerSync,
    refreshState: loadSyncState,
    clearError
  };
};
