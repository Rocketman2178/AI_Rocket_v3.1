import React, { useEffect, useState } from 'react';
import { Mail, CheckCircle, XCircle, Loader } from 'lucide-react';
import { handleGmailCallback } from '../lib/gmail-oauth';
import { GmailSyncConsentModal } from './GmailSyncConsentModal';
import { GmailSyncProgressScreen } from './GmailSyncProgressScreen';
import { useGmailSync } from '../hooks/useGmailSync';

export const GmailCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'consent' | 'syncing' | 'error'>('processing');
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [syncPromise, setSyncPromise] = useState<Promise<any> | null>(null);
  const { triggerSync } = useGmailSync();

  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log('📧 [GmailCallback] Processing OAuth callback...');
        console.log('📧 [GmailCallback] Current URL:', window.location.href);

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const errorParam = params.get('error');

        console.log('📧 [GmailCallback] URL params:', {
          hasCode: !!code,
          hasState: !!state,
          error: errorParam
        });

        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        if (!code || !state) {
          throw new Error('Missing required OAuth parameters');
        }

        console.log('📧 [GmailCallback] Calling handleGmailCallback...');
        const result = await handleGmailCallback(code, state);
        console.log('📧 [GmailCallback] Success! Email:', result.email);

        setEmail(result.email);
        setStatus('consent');
      } catch (err: any) {
        console.error('📧 [GmailCallback] Error:', err);
        let errorMessage = err.message || 'Failed to connect Gmail account';

        if (errorMessage.includes('Missing Google OAuth configuration')) {
          errorMessage = 'Gmail integration is not fully configured on the server. Please ensure GOOGLE_CLIENT_SECRET and GMAIL_REDIRECT_URI are set in Supabase Edge Functions. See GMAIL_SETUP.md for details.';
        } else if (errorMessage.includes('Failed to exchange code')) {
          errorMessage = 'Failed to complete OAuth flow. Please check that your Google OAuth credentials are configured correctly.';
        }

        setError(errorMessage);
        setStatus('error');
      }
    };

    processCallback();
  }, []);

  const handleProceedWithSync = () => {
    const promise = triggerSync();
    setSyncPromise(promise);
    setStatus('syncing');
  };

  const handleSkipSync = () => {
    console.log('📧 [GmailCallback] User skipped initial sync');
    window.location.href = '/';
  };

  const handleDismissSyncScreen = () => {
    console.log('📧 [GmailCallback] Dismissing sync screen');
    window.location.href = '/';
  };

  if (status === 'consent') {
    return (
      <GmailSyncConsentModal
        email={email}
        onProceed={handleProceedWithSync}
        onSkip={handleSkipSync}
      />
    );
  }

  if (status === 'syncing' && syncPromise) {
    return (
      <GmailSyncProgressScreen
        syncPromise={syncPromise}
        onDismiss={handleDismissSyncScreen}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-8 max-w-md w-full">
        <div className="text-center space-y-6">
          {status === 'processing' && (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <Loader className="w-16 h-16 text-blue-500 animate-spin" />
                  <Mail className="w-8 h-8 text-blue-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Connecting Gmail
                </h2>
                <p className="text-gray-400">
                  Processing your authorization...
                </p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <XCircle className="w-16 h-16 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Connection Failed
                </h2>
                <p className="text-gray-400 mb-4">{error}</p>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Return to Astra
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
