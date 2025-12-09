import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, XCircle, Trash2, Clock, Download } from 'lucide-react';
import {
  initiateGmailOAuth,
  disconnectGmail as disconnectGmailAuth,
  GmailAuthData
} from '../lib/gmail-oauth';
import { GmailConfigCheck } from './GmailConfigCheck';
import { GmailSyncConsentModal } from './GmailSyncConsentModal';
import { GmailSyncProgressScreen } from './GmailSyncProgressScreen';
import { useGmailSync } from '../hooks/useGmailSync';
import { supabase } from '../lib/supabase';

export const GmailSettings: React.FC = () => {
  const [gmailAuth, setGmailAuth] = useState<GmailAuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncPromise, setSyncPromise] = useState<Promise<any> | null>(null);
  const { emailCount, lastSyncDate, refreshState, triggerSync } = useGmailSync();

  const loadGmailAuth = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: auth } = await supabase
        .from('gmail_auth')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      setGmailAuth(auth);
      setError('');
    } catch (err: any) {
      console.error('Failed to load Gmail auth:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGmailAuth();

    // Set up real-time subscription to gmail_auth table
    // This will update the UI when tokens are refreshed by the global service
    const channel = supabase
      .channel('gmail-auth-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gmail_auth'
        },
        (payload) => {
          console.log('[GmailSettings] Gmail auth changed, reloading...');
          loadGmailAuth();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleConnect = () => {
    try {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        setError('Gmail integration is not configured. Please check GMAIL_SETUP.md for setup instructions.');
        return;
      }
      initiateGmailOAuth();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail? Astra will no longer have access to your emails.')) {
      return;
    }

    try {
      setLoading(true);
      await disconnectGmailAuth();
      setGmailAuth(null);
      await refreshState();
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !gmailAuth) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <Mail className="w-6 h-6 text-blue-500" />
        <h3 className="text-lg font-semibold text-white">Gmail Email Vectorization</h3>
      </div>

      <GmailConfigCheck />

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!gmailAuth ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="space-y-4">
            <p className="text-gray-300">
              Connect Gmail to let Astra search and understand your email history.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Benefits:</p>
              <ul className="text-sm text-gray-400 space-y-1 ml-4">
                <li>• Ask Astra questions about your emails</li>
                <li>• Search emails using natural language</li>
                <li>• Get AI-powered insights from your inbox</li>
                <li>• Private and secure - only you can access your data</li>
              </ul>
            </div>
            <button
              onClick={handleConnect}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Mail className="w-5 h-5" />
              <span>Connect Gmail</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${gmailAuth.is_active ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                  {gmailAuth.is_active ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{gmailAuth.email}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {gmailAuth.is_active ? 'Connected and active' : 'Connection inactive'}
                  </p>
                  {emailCount > 0 && (
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Mail className="w-3 h-3" />
                        <span>{emailCount.toLocaleString()} emails synced</span>
                      </div>
                      {lastSyncDate && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>Last sync: {lastSyncDate.toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {emailCount === 0 ? (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300 mb-3">
                  Your Gmail is connected but no emails have been synced yet. Start the initial sync to enable Astra to search your emails.
                </p>
                <button
                  onClick={() => setShowSyncModal(true)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Start Initial Sync</span>
                </button>
              </div>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-sm text-blue-300 flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>New emails sync automatically every 5 minutes</span>
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          <strong>Privacy Note:</strong> Your Gmail credentials are stored securely and are only used to perform actions you explicitly request through Astra.
        </p>
      </div>

      {showSyncModal && gmailAuth && (
        <GmailSyncConsentModal
          email={gmailAuth.email}
          onProceed={async () => {
            setShowSyncModal(false);
            const promise = triggerSync();
            setSyncPromise(promise);
          }}
          onSkip={() => {
            setShowSyncModal(false);
          }}
        />
      )}

      {syncPromise && (
        <GmailSyncProgressScreen
          syncPromise={syncPromise}
          onDismiss={() => {
            setSyncPromise(null);
            refreshState();
          }}
        />
      )}
    </div>
  );
};
