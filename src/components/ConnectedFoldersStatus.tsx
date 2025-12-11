import React, { useState, useEffect } from 'react';
import { Folder, CheckCircle, Loader2, FolderPlus, FileText, Edit2, X, Search, FolderOpen, Info, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FolderInfo as GoogleFolderInfo, getGoogleDriveConnection, updateFolderConfiguration } from '../lib/google-drive-oauth';
import { triggerIncrementalSync } from '../lib/manual-folder-sync';

interface ConnectedFoldersStatusProps {
  onConnectMore: () => void;
  onClose: () => void;
  onViewPlaceFiles?: (folderType: 'strategy' | 'meetings' | 'financial' | 'projects') => void;
}

interface FolderInfo {
  type: 'strategy' | 'meetings' | 'financial' | 'projects';
  label: string;
  folderId: string | null;
  folderName: string | null;
  documentCount: number;
}

export const ConnectedFoldersStatus: React.FC<ConnectedFoldersStatusProps> = ({ onConnectMore, onClose, onViewPlaceFiles }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [error, setError] = useState('');
  const [changingFolder, setChangingFolder] = useState<'strategy' | 'meetings' | 'financial' | 'projects' | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [savingChange, setSavingChange] = useState(false);
  const [availableFolders, setAvailableFolders] = useState<{ id: string; name: string }[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folderSearchTerm, setFolderSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadFolderStatus();
  }, []);

  const loadFolderStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError('');

      // Get user's team_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      const teamId = userData?.team_id;
      if (!teamId) {
        setError('No team found');
        setLoading(false);
        return;
      }

      // Get drive connection info
      const { data: driveConnection, error: driveError } = await supabase
        .from('user_drive_connections')
        .select('*')
        .eq('team_id', teamId)
        .maybeSingle();

      if (driveError) throw driveError;

      // Get document counts by folder type
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('folder_type')
        .eq('team_id', teamId);

      if (docsError) throw docsError;

      // Count documents by type
      const docCounts = {
        strategy: documents?.filter(d => d.folder_type === 'strategy').length || 0,
        meetings: documents?.filter(d => d.folder_type === 'meetings').length || 0,
        financial: documents?.filter(d => d.folder_type === 'financial').length || 0,
        projects: documents?.filter(d => d.folder_type === 'projects').length || 0,
      };

      // Build folder info array
      const folderInfos: FolderInfo[] = [
        {
          type: 'strategy',
          label: 'Strategy',
          folderId: driveConnection?.strategy_folder_id || null,
          folderName: driveConnection?.strategy_folder_name || null,
          documentCount: docCounts.strategy
        },
        {
          type: 'meetings',
          label: 'Meetings',
          folderId: driveConnection?.meetings_folder_id || null,
          folderName: driveConnection?.meetings_folder_name || null,
          documentCount: docCounts.meetings
        },
        {
          type: 'financial',
          label: 'Financial',
          folderId: driveConnection?.financial_folder_id || null,
          folderName: driveConnection?.financial_folder_name || null,
          documentCount: docCounts.financial
        },
        {
          type: 'projects',
          label: 'Projects',
          folderId: driveConnection?.projects_folder_id || null,
          folderName: driveConnection?.projects_folder_name || null,
          documentCount: docCounts.projects
        }
      ];

      setFolders(folderInfos);
    } catch (err) {
      console.error('Error loading folder status:', err);
      setError('Failed to load folder information');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDocuments = async () => {
    if (!user || syncing) return;

    setSyncing(true);
    setSyncMessage(null);
    const totalInitial = folders.reduce((sum, f) => sum + f.documentCount, 0);

    try {
      const result = await triggerIncrementalSync();

      if (result.success) {
        setSyncMessage({ type: 'success', text: 'Syncing new documents...' });

        let attemptCount = 0;
        const maxAttempts = 60;

        const pollForUpdates = setInterval(async () => {
          attemptCount++;

          await loadFolderStatus();

          const { data: userData } = await supabase
            .from('users')
            .select('team_id')
            .eq('id', user.id)
            .single();

          if (userData?.team_id) {
            const { count } = await supabase
              .from('documents')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', userData.team_id);

            const currentTotal = count || 0;

            if (currentTotal > totalInitial) {
              clearInterval(pollForUpdates);
              setSyncing(false);
              setSyncMessage({ type: 'success', text: `Sync complete! ${currentTotal - totalInitial} new documents added.` });
              setTimeout(() => setSyncMessage(null), 3000);
              return;
            }
          }

          if (attemptCount >= maxAttempts) {
            clearInterval(pollForUpdates);
            setSyncing(false);
            setSyncMessage({ type: 'success', text: 'Sync complete!' });
            setTimeout(() => setSyncMessage(null), 3000);
          }
        }, 2000);
      } else {
        setSyncing(false);
        setSyncMessage({ type: 'error', text: result.message || 'Failed to start sync.' });
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncing(false);
      setSyncMessage({ type: 'error', text: 'Failed to sync. Please try again.' });
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleChangeFolder = async (folderType: 'strategy' | 'meetings' | 'financial' | 'projects') => {
    try {
      setChangingFolder(folderType);
      setLoadingFolders(true);
      setFolderSearchTerm('');
      setAvailableFolders([]);

      // Fetch folders from edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active session');
        setChangingFolder(null);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-google-drive-folders`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }

      const data = await response.json();
      setAvailableFolders(data.folders || []);
    } catch (err) {
      console.error('Error loading folders:', err);
      setError('Failed to load folders from Google Drive');
      setChangingFolder(null);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleFolderSelected = async (newFolder: GoogleFolderInfo | null) => {
    if (!changingFolder || !newFolder) {
      setChangingFolder(null);
      return;
    }

    try {
      setSavingChange(true);

      // Update the folder configuration
      const updates = {
        [`${changingFolder}_folder_id`]: newFolder.id,
        [`${changingFolder}_folder_name`]: newFolder.name
      };

      await updateFolderConfiguration(updates);

      // Reload folder status to show updated info
      await loadFolderStatus();

      // Close the change modal
      setChangingFolder(null);
    } catch (err) {
      console.error('Error updating folder:', err);
      setError('Failed to update folder');
    } finally {
      setSavingChange(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading your connected folders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const connectedFolders = folders.filter(f => f.folderId);
  const unconnectedFolders = folders.filter(f => !f.folderId);

  const totalDocuments = folders.reduce((sum, f) => sum + f.documentCount, 0);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600/20 mb-4">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Your Connected Folders</h2>
        <p className="text-gray-300">
          {connectedFolders.length} of 4 folder types connected
        </p>
      </div>

      {/* Helpful tip if folders are connected but no documents */}
      {connectedFolders.length > 0 && totalDocuments === 0 && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <p className="text-sm text-blue-300 mb-2">
            <span className="font-medium">📝 Next Step:</span> Add documents to your connected folders!
          </p>
          <p className="text-xs text-blue-200">
            Go to Google Drive and add files to your connected folders. Then return here and click "Done" to sync them.
          </p>
        </div>
      )}

      {/* Connected Folders */}
      {connectedFolders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Connected Folders</h3>
          {connectedFolders.map((folder) => (
            <div
              key={folder.type}
              className="bg-gray-800/50 border border-green-700/50 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center flex-shrink-0">
                    <Folder className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{folder.label}</p>
                    <p className="text-sm text-gray-400">📁 {folder.folderName || 'Unnamed Folder'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2 text-green-400">
                    <FileText className="w-4 h-4" />
                    <span className="font-semibold">{folder.documentCount}</span>
                  </div>
                  <p className="text-xs text-gray-400">documents</p>
                </div>
              </div>
              <div className="flex gap-2">
                {onViewPlaceFiles && (
                  <button
                    onClick={() => onViewPlaceFiles(folder.type)}
                    className="flex-1 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 text-green-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2 min-h-[44px]"
                  >
                    <Info className="w-4 h-4" />
                    <span>File Info</span>
                  </button>
                )}
                <button
                  onClick={() => handleChangeFolder(folder.type)}
                  className={`${onViewPlaceFiles ? 'flex-1' : 'w-full'} px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2 min-h-[44px]`}
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Change Folder</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unconnected Folders */}
      {unconnectedFolders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Not Yet Connected</h3>
          {unconnectedFolders.map((folder) => (
            <div
              key={folder.type}
              className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 flex items-center justify-between opacity-60"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Folder className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-gray-300 font-medium">{folder.label}</p>
                  <p className="text-sm text-gray-500">Not connected</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sync Message */}
      {syncMessage && (
        <div className={`p-3 rounded-lg ${
          syncMessage.type === 'success' ? 'bg-green-900/20 border border-green-700' : 'bg-red-900/20 border border-red-700'
        }`}>
          <p className={`text-sm text-center ${
            syncMessage.type === 'success' ? 'text-green-300' : 'text-red-300'
          }`}>
            {syncMessage.text}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col space-y-3 pt-4">
        {unconnectedFolders.length > 0 && (
          <button
            onClick={onConnectMore}
            className="w-full px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-lg font-medium transition-all flex items-center justify-center space-x-2"
          >
            <FolderPlus className="w-5 h-5" />
            <span>Connect More Folders</span>
          </button>
        )}

        {connectedFolders.length > 0 && (
          <button
            onClick={handleSyncDocuments}
            disabled={syncing}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          Done
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          <span className="font-medium">💡 Tip:</span> Add more documents to your connected folders to increase your Fuel level and unlock more features!
        </p>
      </div>

      {/* Change Folder Modal */}
      {changingFolder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold text-white">
                Change {changingFolder.charAt(0).toUpperCase() + changingFolder.slice(1)} Folder
              </h3>
              <button
                onClick={() => setChangingFolder(null)}
                disabled={savingChange}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {savingChange ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
                  <p className="text-gray-300">Updating folder...</p>
                </div>
              ) : loadingFolders ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
                  <p className="text-gray-300">Loading folders from Google Drive...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    Select a new folder from your Google Drive to replace the current {changingFolder} folder.
                  </p>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search folders..."
                      value={folderSearchTerm}
                      onChange={(e) => setFolderSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                    />
                    {folderSearchTerm && (
                      <button
                        onClick={() => setFolderSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Folder List */}
                  <div className="max-h-[400px] overflow-y-auto bg-gray-700/30 border border-gray-600 rounded-lg">
                    {availableFolders.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">
                        No folders available
                      </p>
                    ) : (
                      availableFolders
                        .filter(f => f.name.toLowerCase().includes(folderSearchTerm.toLowerCase()))
                        .map((folder) => {
                          const currentFolderData = folders.find(f => f.type === changingFolder);
                          const isCurrentlyConnected = currentFolderData?.folderId === folder.id;

                          return (
                            <button
                              key={folder.id}
                              onClick={() => handleFolderSelected({ id: folder.id, name: folder.name })}
                              disabled={isCurrentlyConnected}
                              className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-600/50 last:border-b-0 flex items-center justify-between ${
                                isCurrentlyConnected
                                  ? 'bg-green-600/20 text-green-300 cursor-not-allowed'
                                  : 'text-white hover:bg-gray-700/50'
                              }`}
                            >
                              <span className="flex items-center">
                                <FolderOpen className="w-4 h-4 inline mr-2 flex-shrink-0" />
                                <span className="truncate">{folder.name}</span>
                              </span>
                              {isCurrentlyConnected && (
                                <span className="flex items-center text-xs text-green-400 ml-2 flex-shrink-0">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Current
                                </span>
                              )}
                            </button>
                          );
                        })
                    )}
                    {availableFolders.length > 0 &&
                      availableFolders.filter(f => f.name.toLowerCase().includes(folderSearchTerm.toLowerCase())).length === 0 && (
                      <p className="text-gray-400 text-sm text-center py-8">
                        No folders match "{folderSearchTerm}"
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-gray-500">
                    Select a folder to sync your {changingFolder} documents
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
