import React, { useState, useEffect } from 'react';
import { FolderPlus, CheckCircle, Folder, Loader2, FolderOpen, Plus, Search } from 'lucide-react';
import { SetupGuideProgress } from '../../lib/setup-guide-utils';
import { getGoogleDriveConnection } from '../../lib/google-drive-oauth';
import { supabase } from '../../lib/supabase';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { GoogleDriveFolderPicker } from '../GoogleDriveFolderPicker';

interface ChooseFolderStepProps {
  onComplete: (folderData: any) => void;
  progress: SetupGuideProgress | null;
  onProceed?: () => void; // Optional callback when user clicks "Next" from success screen
}

interface GoogleDriveFolder {
  id: string;
  name: string;
  createdTime?: string;
}

type ViewMode = 'initial' | 'select-existing' | 'creating-new';

export const ChooseFolderStep: React.FC<ChooseFolderStepProps> = ({ onComplete, onProceed }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('initial');
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<GoogleDriveFolder | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [error, setError] = useState('');
  const [hasExistingFolders, setHasExistingFolders] = useState(false);
  const [isNewlyCreated, setIsNewlyCreated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accessToken, setAccessToken] = useState<string>('');
  // Use custom UI with list and search (we have full drive scope)
  const useGooglePicker = false;

  useEffect(() => {
    checkExistingSetup();
  }, []);

  const checkExistingSetup = async () => {
    setLoading(true);
    try {
      const connection = await getGoogleDriveConnection();

      if (!connection) {
        setLoading(false);
        return;
      }

      // Check if strategy folders are already configured (use original columns)
      if (connection.strategy_folder_id) {
        setHasExistingFolders(true);
      }
    } catch (error) {
      console.error('Error checking existing setup:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    setLoading(true);
    setError('');
    try {
      const connection = await getGoogleDriveConnection();
      if (!connection) {
        setError('Not authenticated with Google Drive');
        return;
      }

      setAccessToken(connection.access_token);

      // If using Google Picker, skip loading folder list
      if (useGooglePicker) {
        setViewMode('select-existing');
        setLoading(false);
        return;
      }

      // Legacy: Load folder list via API
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-google-drive-folders`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load folders');
      }

      const { folders: driveFolders } = await response.json();
      setFolders(driveFolders || []);
      setViewMode('select-existing');
    } catch (err: any) {
      console.error('Error loading folders:', err);
      setError(err.message || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewFolder = async () => {
    // Prevent double-clicks
    if (creatingFolder) return;

    setCreatingFolder(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        setCreatingFolder(false);
        return;
      }

      console.log('🚀 Creating Astra Strategy folder...');

      // Create the "Astra Strategy" folder
      const createResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-google-drive-folder`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ folderName: 'Astra Strategy' }),
        }
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create folder');
      }

      const { folder } = await createResponse.json();
      console.log('✅ Folder created:', folder);

      // Save folder selection
      const saveResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-folder-selection`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            folderIds: [folder.id],
            folderType: 'strategy',
            folderName: folder.name,
          }),
        }
      );

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save folder selection');
      }

      console.log('✅ Folder selection saved');

      // Reset loading state and show success screen
      setCreatingFolder(false);
      setSelectedFolder(folder);
      setHasExistingFolders(true);
      setIsNewlyCreated(true); // Mark as newly created

      // Call onComplete to notify parent (parent should NOT close modal yet)
      onComplete({
        selectedFolder: folder,
        folderType: 'strategy',
        isNewFolder: true,
      });
    } catch (err: any) {
      console.error('❌ Error creating folder:', err);
      setError(err.message || 'Failed to create folder');
      setCreatingFolder(false);
    }
  };

  const handleSelectFolder = async (folder: GoogleDriveFolder) => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      // Save folder selection
      const saveResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-folder-selection`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            folderIds: [folder.id],
            folderType: 'strategy',
            folderName: folder.name,
          }),
        }
      );

      if (!saveResponse.ok) {
        throw new Error('Failed to save folder selection');
      }

      // Mark as having existing folders and show success screen
      setSelectedFolder(folder);
      setHasExistingFolders(true);

      // Call onComplete but let the component show success screen first
      onComplete({
        selectedFolder: folder,
        folderType: 'strategy',
        isNewFolder: false,
      });
    } catch (err: any) {
      console.error('Error selecting folder:', err);
      setError(err.message || 'Failed to select folder');
    } finally {
      setLoading(false);
    }
  };

  if (loading && viewMode === 'initial') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 mb-4">
            <FolderPlus className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Choose Your Folder</h2>
          <p className="text-gray-300">Checking your connected folders...</p>
        </div>
      </div>
    );
  }

  // If already has folders configured
  if (hasExistingFolders) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600/20 mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            {isNewlyCreated ? 'Folder Created Successfully!' : 'Strategy Folder Connected!'}
          </h2>
          <p className="text-gray-300">
            {isNewlyCreated
              ? `Your "Astra Strategy" folder has been created in Google Drive.`
              : "You've already set up a strategy folder. Let's continue with the setup."}
          </p>
          {selectedFolder && (
            <p className="text-sm text-gray-400 mt-2">
              📁 {selectedFolder.name}
            </p>
          )}
        </div>

        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <p className="text-sm text-green-300">
            <span className="font-medium">✅ All set!</span> {isNewlyCreated ? 'Now add your strategy documents to this folder.' : 'Your strategy folder is connected and ready to use.'}
          </p>
        </div>

        <div className="flex justify-center pt-4">
          <button
            onClick={() => {
              if (onProceed) {
                onProceed();
              } else {
                onComplete({ existingFolder: true });
              }
            }}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all min-h-[44px]"
          >
            Next: Place Your Files →
          </button>
        </div>
      </div>
    );
  }

  // Initial view - choose between existing or create new
  if (viewMode === 'initial') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 mb-4">
            <FolderPlus className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Choose Your Strategy Folder</h2>
          <p className="text-gray-300">
            Select an existing folder or let Astra create one for you
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Select Existing Folder Option */}
          <button
            onClick={loadFolders}
            className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-purple-500 rounded-lg p-6 transition-all text-left group min-h-[200px] flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-purple-600/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FolderOpen className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 text-center">
              Select Existing Folder
            </h3>
            <p className="text-sm text-gray-400 text-center">
              Browse and choose a folder from your Google Drive
            </p>
          </button>

          {/* Create New Folder Option */}
          <button
            onClick={handleCreateNewFolder}
            disabled={creatingFolder}
            className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-blue-500 rounded-lg p-6 transition-all text-left group min-h-[200px] flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {creatingFolder ? (
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              ) : (
                <Plus className="w-8 h-8 text-blue-400" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 text-center">
              {creatingFolder ? 'Creating Folder...' : 'Create "Astra Strategy" Folder'}
            </h3>
            <p className="text-sm text-gray-400 text-center">
              {creatingFolder ? 'Please wait...' : 'Let Astra create a new folder for your strategy documents'}
            </p>
          </button>
        </div>

        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            <span className="font-medium">💡 About Strategy Folders:</span> This folder will contain documents about your team's mission, goals, strategic plans, and objectives. Astra will read these to better understand your team's direction.
          </p>
        </div>
      </div>
    );
  }

  // Folder selection view
  if (viewMode === 'select-existing') {
    // Use Google Picker for beta users
    if (useGooglePicker) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 mb-4">
              <Folder className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Choose Your Strategy Folder</h2>
            <p className="text-gray-300 mb-2">
              Select a folder from your Google Drive containing strategy documents
            </p>
            <p className="text-sm text-gray-400">
              This includes mission statements, goals, strategic plans, and business objectives
            </p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <GoogleDriveFolderPicker
            accessToken={accessToken}
            folderType="strategy"
            onFolderSelected={(folder) => {
              handleSelectFolder({ id: folder.id, name: folder.name });
            }}
          />

          <div className="flex justify-center space-x-3">
            <button
              onClick={() => {
                setViewMode('initial');
              }}
              disabled={loading}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 min-h-[44px]"
            >
              Back
            </button>
          </div>
        </div>
      );
    }

    // Legacy folder list view
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 mb-4">
            <Folder className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Select a Folder</h2>
          <p className="text-gray-300">
            Choose a folder from your Google Drive for strategy documents
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">
                  {searchQuery ? `No folders found matching "${searchQuery}"` : 'No folders found in your Google Drive'}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setViewMode('initial');
                  }}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors min-h-[44px]"
                >
                  Go Back
                </button>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 max-h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder)}
                    disabled={loading}
                    className="w-full flex items-center space-x-3 p-4 bg-gray-900/50 hover:bg-gray-700 border border-gray-700 hover:border-purple-500 rounded-lg transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Folder className="w-6 h-6 text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{folder.name}</p>
                      {folder.createdTime && (
                        <p className="text-xs text-gray-400">
                          Created {new Date(folder.createdTime).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {loading && selectedFolder?.id === folder.id && (
                      <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />
                    )}
                  </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center space-x-3">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setViewMode('initial');
                }}
                disabled={loading}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 min-h-[44px]"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
};
