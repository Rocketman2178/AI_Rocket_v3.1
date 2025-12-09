import React from 'react';
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { initiateGoogleDriveOAuth } from '../lib/google-drive-oauth';

interface OAuthReconnectModalProps {
  onClose: () => void;
  onReconnect: () => void;
}

export const OAuthReconnectModal: React.FC<OAuthReconnectModalProps> = ({ onClose, onReconnect }) => {
  const handleReconnect = () => {
    console.log('🔄 User clicked reconnect from modal');
    onReconnect();
    initiateGoogleDriveOAuth();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-lg w-full border border-yellow-500/30 animate-in fade-in duration-300">
        {/* Header with gradient accent */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-yellow-500/30 p-6 rounded-t-2xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              Action Required: Reconnect Google Account
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-gray-200 leading-relaxed">
              We've added powerful new features that require additional permissions from your Google account.
              Your document sync will not work until you reconnect.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-white font-semibold flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>What's New</span>
            </h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start space-x-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong className="text-white">Google Sheets Integration:</strong> Access and analyze spreadsheet data directly in Astra</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong className="text-white">Enhanced Financial Insights:</strong> Richer data analysis from your financial spreadsheets</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong className="text-white">Automated Data Sync:</strong> Seamless synchronization with your team's data sources</span>
              </li>
            </ul>
          </div>

          <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Your Data is Safe</span>
            </h3>
            <p className="text-gray-300 text-sm">
              All your existing folder configurations and synced documents will be preserved.
              This is a one-time permission update that takes less than 30 seconds.
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-300 text-sm font-medium">
              ⚠️ Document sync is currently paused until you reconnect
            </p>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="bg-gray-800/50 border-t border-gray-700 p-6 rounded-b-2xl flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            Remind Me Later
          </button>
          <button
            onClick={handleReconnect}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-gray-900 font-bold rounded-lg transition-all transform hover:scale-105 flex items-center space-x-2 shadow-lg"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Reconnect Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
