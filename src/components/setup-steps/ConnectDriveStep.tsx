import React, { useState, useEffect } from 'react';
import { HardDrive, CheckCircle, AlertCircle } from 'lucide-react';
import { SetupGuideProgress } from '../../lib/setup-guide-utils';
import { initiateGoogleDriveOAuth, getGoogleDriveConnection } from '../../lib/google-drive-oauth';

interface ConnectDriveStepProps {
  onComplete: () => void;
  progress: SetupGuideProgress | null;
  fromLaunchPrep?: boolean;
}

export const ConnectDriveStep: React.FC<ConnectDriveStepProps> = ({ onComplete, fromLaunchPrep = false }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const connection = await getGoogleDriveConnection();
      if (connection?.is_active) {
        setIsConnected(true);
      }
    } catch (err) {
      console.error('Error checking connection:', err);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError('');

    try {
      initiateGoogleDriveOAuth(!fromLaunchPrep, fromLaunchPrep);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Google Drive');
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/20 mb-3">
          <HardDrive className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Connect Your Google Drive
        </h2>
        <p className="text-sm text-gray-400">
          Access your documents for AI-powered insights
        </p>
      </div>

      {!isConnected && (
        <>
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">🔓</span>
              Astra Can Access:
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-950/50 rounded-lg p-3 text-center">
                <div className="text-2xl mb-1">📄</div>
                <div className="text-xs text-blue-200">Read Docs</div>
              </div>
              <div className="bg-purple-950/50 rounded-lg p-3 text-center">
                <div className="text-2xl mb-1">📁</div>
                <div className="text-xs text-purple-200">Create Folders</div>
              </div>
              <div className="bg-green-950/50 rounded-lg p-3 text-center">
                <div className="text-2xl mb-1">📋</div>
                <div className="text-xs text-green-200">File Info</div>
              </div>
            </div>
          </div>

          <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 flex items-center gap-2">
            <span className="text-xl">🔒</span>
            <p className="text-xs text-green-300 flex-1">
              <span className="font-medium">Secure:</span> Only access folders you select. Never shared.
            </p>
          </div>
        </>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {isConnected ? (
        <>
          <div className="bg-green-900/20 border-2 border-green-600 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-green-300 font-semibold">Drive Connected!</p>
                <p className="text-xs text-green-400 mt-1">
                  Ready to select folders and sync data
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-center pt-2">
            <button
              onClick={onComplete}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all min-h-[44px]"
            >
              Next: Choose Folder →
            </button>
          </div>
        </>
      ) : (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all min-h-[44px] flex items-center gap-2"
          >
            <HardDrive className="w-5 h-5" />
            <span>{isConnecting ? 'Connecting...' : 'Connect Google Drive'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
