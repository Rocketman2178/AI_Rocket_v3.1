import React, { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

export const GmailConfigCheck: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);

  const checks = [
    {
      name: 'Frontend Client ID',
      configured: !!import.meta.env.VITE_GOOGLE_CLIENT_ID,
      value: import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
      required: true
    }
  ];

  const allConfigured = checks.every(check => check.configured);

  if (allConfigured) {
    return null;
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-4">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-yellow-400 font-medium">Configuration Required</h4>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
          <p className="text-sm text-yellow-300 mb-2">
            Gmail integration requires additional configuration to work properly.
          </p>

          {showDetails && (
            <div className="mt-3 space-y-3">
              <div className="bg-gray-900/50 rounded p-3 space-y-2">
                <p className="text-xs text-gray-300 font-medium">Configuration Status:</p>
                {checks.map((check, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{check.name}:</span>
                    <div className="flex items-center space-x-2">
                      <span className={check.configured ? 'text-green-400' : 'text-red-400'}>
                        {check.value}
                      </span>
                      {check.configured ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-900/50 rounded p-3">
                <p className="text-xs text-gray-300 font-medium mb-2">Required Edge Function Secrets:</p>
                <ul className="text-xs text-gray-400 space-y-1 ml-4">
                  <li>• GOOGLE_CLIENT_SECRET</li>
                  <li>• GMAIL_REDIRECT_URI</li>
                </ul>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                <p className="text-xs text-blue-300 mb-2">
                  <strong>Setup Instructions:</strong>
                </p>
                <ol className="text-xs text-blue-300 space-y-1 ml-4">
                  <li>1. Set up Google OAuth credentials in Google Cloud Console</li>
                  <li>2. Configure environment variables (see GMAIL_SETUP.md)</li>
                  <li>3. Set Edge Function secrets in Supabase</li>
                  <li>4. Apply database migrations</li>
                </ol>
                <a
                  href="https://github.com/yourusername/yourrepo/blob/main/GMAIL_SETUP.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
                >
                  <span>View Full Setup Guide</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
