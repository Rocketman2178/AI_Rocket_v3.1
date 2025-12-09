import React, { useEffect, useState } from 'react';
import { Mail, Loader, CheckCircle, XCircle } from 'lucide-react';

interface GmailSyncProgressScreenProps {
  onDismiss: () => void;
  syncPromise: Promise<{
    success: boolean;
    status?: 'processing' | 'complete' | 'partial_success';
    message?: string;
    metrics?: any;
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
  }>;
}

export const GmailSyncProgressScreen: React.FC<GmailSyncProgressScreenProps> = ({
  onDismiss,
  syncPromise
}) => {
  const [status, setStatus] = useState<'syncing' | 'processing' | 'success' | 'error'>('syncing');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const procesSync = async () => {
      try {
        const syncResult = await syncPromise;

        if (syncResult.success) {
          setResult(syncResult);

          // Check if webhook indicates processing has started (async job)
          if (
            syncResult.status === 'processing' ||
            syncResult.status === 'partial_success' ||
            syncResult.message?.includes('processing')
          ) {
            setStatus('processing');
          } else {
            // Immediate completion (backwards compatibility)
            setStatus('success');
            setTimeout(() => {
              onDismiss();
            }, 3000);
          }
        } else {
          setError(syncResult.error || 'Sync failed');
          setStatus('error');
        }
      } catch (err: any) {
        console.error('[GmailSyncProgressScreen] Error:', err);
        setError(err.message || 'Failed to sync emails');
        setStatus('error');
      }
    };

    procesSync();
  }, [syncPromise, onDismiss]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-8 max-w-lg w-full">
        <div className="text-center space-y-6">
          {status === 'syncing' && (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <Loader className="w-20 h-20 text-blue-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Mail className="w-10 h-10 text-blue-400 animate-pulse" />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold text-white mb-3">
                  Syncing Your Email History
                </h2>
                <p className="text-gray-400 text-lg mb-2">
                  Astra is now reading through your emails to help answer your questions.
                </p>
                <p className="text-gray-500 text-sm">
                  This may take a few minutes depending on your email volume.
                </p>
              </div>

              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Mail className="w-4 h-4 text-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <Mail className="w-4 h-4 text-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <Mail className="w-4 h-4 text-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-xs text-gray-500">
                  Processing emails and creating searchable index...
                </p>
              </div>

              <button
                onClick={onDismiss}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Continue Using App
              </button>

              <p className="text-xs text-gray-500">
                You can close this screen and continue using the app. We'll notify you when the sync is complete.
              </p>
            </>
          )}

          {status === 'processing' && (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-pulse"></div>
                  <CheckCircle className="w-20 h-20 text-blue-500 relative" />
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold text-white mb-3">
                  Email Sync Started!
                </h2>
                <p className="text-gray-400 text-lg mb-2">
                  Your email sync is now processing in the background.
                </p>
                <div className="mt-3">
                  <p className="text-blue-400 text-sm font-medium">
                    Status: In Progress
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
                <p className="text-blue-400 text-sm font-medium">
                  What happens next:
                </p>
                <ul className="text-gray-400 text-sm space-y-1 text-left">
                  <li>• Your emails are being fetched and analyzed</li>
                  <li>• Visit Settings → Gmail Integration to see progress</li>
                  <li>• Email count will update automatically as emails are processed</li>
                  <li>• We'll notify you when sync is complete</li>
                </ul>
              </div>

              <button
                onClick={onDismiss}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all shadow-lg"
              >
                Continue Using App
              </button>

              <p className="text-xs text-gray-500">
                You'll receive a notification when your emails are ready.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                  <CheckCircle className="w-20 h-20 text-green-500 relative" />
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold text-white mb-3">
                  Email Sync Complete!
                </h2>
                <p className="text-gray-400 text-lg">
                  {result?.metrics?.emails_processed
                    ? `Successfully synced ${result.metrics.emails_processed} emails.`
                    : 'Your emails have been synced successfully.'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  You can now ask Astra about your emails!
                </p>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 text-sm">
                  Try asking: "What did John say about the Q4 budget?" or "Show me emails from last week about the project."
                </p>
              </div>

              <button
                onClick={onDismiss}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all shadow-lg"
              >
                Start Chatting with Astra
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <XCircle className="w-20 h-20 text-red-500" />
              </div>

              <div>
                <h2 className="text-3xl font-bold text-white mb-3">
                  Sync Failed
                </h2>
                <p className="text-gray-400 mb-4">{error}</p>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">
                  Unable to sync emails. Please try again or contact support if the problem persists.
                </p>
              </div>

              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>

                <button
                  onClick={onDismiss}
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
