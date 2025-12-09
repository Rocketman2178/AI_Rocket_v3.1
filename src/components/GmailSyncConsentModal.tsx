import React from 'react';
import { Mail, Lock, RefreshCw, Clock } from 'lucide-react';

interface GmailSyncConsentModalProps {
  email: string;
  onProceed: () => void;
  onSkip: () => void;
}

export const GmailSyncConsentModal: React.FC<GmailSyncConsentModalProps> = ({
  email,
  onProceed,
  onSkip
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700 shadow-2xl p-8 max-w-lg w-full">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <div className="relative bg-gradient-to-br from-green-500 to-green-600 rounded-full p-4">
                <Mail className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              Gmail Connected Successfully!
            </h2>
            <p className="text-gray-400">
              Connected to <span className="text-white font-medium">{email}</span>
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-left space-y-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              Astra can now access your email account to help you find information faster.
            </p>

            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <RefreshCw className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">One-Time Initial Sync</p>
                  <p className="text-gray-400 text-xs">
                    We'll sync your full email history. This typically takes a few minutes.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">Automatic Updates</p>
                  <p className="text-gray-400 text-xs">
                    After the initial sync, we'll automatically check for new emails every 15 minutes.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Lock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">Private & Secure</p>
                  <p className="text-gray-400 text-xs">
                    Your emails are private and secured with encryption. Only you can access your email data.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            <button
              onClick={onProceed}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl"
            >
              Proceed with Sync
            </button>

            <button
              onClick={onSkip}
              className="w-full px-6 py-3 bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white font-medium rounded-lg transition-colors border border-gray-700"
            >
              Skip for Now
            </button>
          </div>

          <p className="text-xs text-gray-500">
            You can trigger the sync anytime from your Settings.
          </p>
        </div>
      </div>
    </div>
  );
};
