import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { initiateGoogleDriveOAuth } from '../lib/google-drive-oauth';

interface ExpiredTokenBannerProps {
  onDismiss: () => void;
}

export const ExpiredTokenBanner: React.FC<ExpiredTokenBannerProps> = ({ onDismiss }) => {
  const handleReauthorize = async () => {
    try {
      await initiateGoogleDriveOAuth();
    } catch (error) {
      console.error('Failed to initiate reauthorization:', error);
    }
  };

  return (
    <div className="bg-gradient-to-r from-orange-500/10 via-yellow-500/10 to-red-500/10 border border-orange-500/30 rounded-lg p-4 mb-4 mx-4 mt-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-1">
            Google Drive Authorization Expired
          </h3>
          <p className="text-sm text-gray-300 mb-3">
            Your Google Drive connection has expired and needs to be refreshed.
            Click below to re-authorize and continue syncing your documents.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReauthorize}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-lg text-sm font-medium transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Authorization
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
