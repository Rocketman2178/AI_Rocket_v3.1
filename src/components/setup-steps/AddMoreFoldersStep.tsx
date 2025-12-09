import React, { useState, useEffect } from 'react';
import { FolderPlus, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { getGoogleDriveConnection } from '../../lib/google-drive-oauth';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AddMoreFoldersStepProps {
  onComplete: (newFolderTypes: ('strategy' | 'meetings' | 'financial' | 'projects')[]) => void;
  onBack: () => void;
}

interface FolderSelection {
  type: 'strategy' | 'meetings' | 'financial' | 'projects';
  label: string;
  id: string | null;
  name: string | null;
  alreadyConnected: boolean;
}

export const AddMoreFoldersStep: React.FC<AddMoreFoldersStepProps> = ({ onComplete, onBack }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [folders, setFolders] = useState<FolderSelection[]>([]);
  const [pickerInited, setPickerInited] = useState(false);
  const [gsiInited, setGsiInited] = useState(false);

  useEffect(() => {
    loadCurrentFolders();
    initializeGooglePicker();
  }, []);

  const loadCurrentFolders = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const connection = await getGoogleDriveConnection();

      if (!connection) {
        setError('Not authenticated with Google Drive');
        return;
      }

      setAccessToken(connection.access_token);

      // Get current folder connections
      const folderTypes: FolderSelection[] = [
        {
          type: 'strategy',
          label: 'Strategy',
          id: connection.strategy_folder_id,
          name: connection.strategy_folder_name,
          alreadyConnected: !!connection.strategy_folder_id
        },
        {
          type: 'meetings',
          label: 'Meetings',
          id: connection.meetings_folder_id,
          name: connection.meetings_folder_name,
          alreadyConnected: !!connection.meetings_folder_id
        },
        {
          type: 'financial',
          label: 'Financial',
          id: connection.financial_folder_id,
          name: connection.financial_folder_name,
          alreadyConnected: !!connection.financial_folder_id
        },
        {
          type: 'projects',
          label: 'Projects',
          id: connection.projects_folder_id,
          name: connection.projects_folder_name,
          alreadyConnected: !!connection.projects_folder_id
        }
      ];

      setFolders(folderTypes);
    } catch (err) {
      console.error('Error loading folders:', err);
      setError('Failed to load folder information');
    } finally {
      setLoading(false);
    }
  };

  const initializeGooglePicker = () => {
    // Load Google Picker API
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('picker', () => {
        setPickerInited(true);
      });
    };
    document.body.appendChild(script);

    // Load GSI for token
    const gsiScript = document.createElement('script');
    gsiScript.src = 'https://accounts.google.com/gsi/client';
    gsiScript.onload = () => {
      setGsiInited(true);
    };
    document.body.appendChild(gsiScript);
  };

  const openFolderPicker = (folderType: FolderSelection) => {
    if (!pickerInited || !accessToken) {
      setError('Google Picker not ready. Please try again.');
      return;
    }

    const picker = new window.google.picker.PickerBuilder()
      .addView(
        new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
          .setSelectFolderEnabled(true)
      )
      .setOAuthToken(accessToken)
      .setCallback((data: any) => handlePickerCallback(data, folderType))
      .setTitle(`Select ${folderType.label} Folder`)
      .build();

    picker.setVisible(true);
  };

  const handlePickerCallback = async (data: any, folderType: FolderSelection) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const folder = data.docs[0];

      // Update the folder in state
      setFolders(prev => prev.map(f =>
        f.type === folderType.type
          ? { ...f, id: folder.id, name: folder.name, alreadyConnected: false }
          : f
      ));
    }
  };

  const handleSaveFolders = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setError('');

      // Get user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      // Get newly selected folders
      const newFolders = folders.filter(f => f.id && !f.alreadyConnected);

      if (newFolders.length === 0) {
        setError('No new folders selected');
        setSaving(false);
        return;
      }

      // Call the edge function for each new folder
      for (const folder of newFolders) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-folder-selection`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              folderIds: [folder.id],
              folderType: folder.type,
              folderName: folder.name
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to save ${folder.label} folder`);
        }
      }

      // Success - proceed to next step with the new folder types
      const newFolderTypesArray = newFolders.map(f => f.type);
      onComplete(newFolderTypesArray);
    } catch (err: any) {
      console.error('Error saving folders:', err);
      setError(err.message || 'Failed to save folders');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading your folders...</p>
        </div>
      </div>
    );
  }

  const newlySelectedFolders = folders.filter(f => f.id && !f.alreadyConnected);
  const canProceed = newlySelectedFolders.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 mb-4">
          <FolderPlus className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Connect More Folders</h2>
        <p className="text-gray-300">
          Select additional folders to add more fuel to your AI
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Folder Selection Grid */}
      <div className="space-y-3">
        {folders.map((folder) => (
          <div
            key={folder.type}
            className={`bg-gray-800/50 border rounded-lg p-4 ${
              folder.alreadyConnected
                ? 'border-green-700/50 opacity-60'
                : folder.id
                ? 'border-purple-500'
                : 'border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-lg font-semibold text-white">{folder.label}</h3>
                  {folder.alreadyConnected && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {folder.alreadyConnected
                    ? `📁 ${folder.name} (Already connected)`
                    : folder.id
                    ? `📁 ${folder.name} (Selected)`
                    : 'Not connected yet'}
                </p>
              </div>
              <button
                onClick={() => openFolderPicker(folder)}
                disabled={folder.alreadyConnected}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  folder.alreadyConnected
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {folder.id && !folder.alreadyConnected ? 'Change' : 'Select'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          <span className="font-medium">💡 Tip:</span> You can select folders for any category you haven't connected yet. More folders = more fuel!
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={onBack}
          className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSaveFolders}
          disabled={!canProceed || saving}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>Continue to Sync</span>
            </>
          )}
        </button>
      </div>

      {!canProceed && !error && (
        <p className="text-center text-sm text-gray-400">
          Select at least one new folder to continue
        </p>
      )}
    </div>
  );
};
