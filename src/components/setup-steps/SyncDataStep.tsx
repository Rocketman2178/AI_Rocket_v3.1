import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Sparkles, X, ArrowLeft } from 'lucide-react';
import { SetupGuideProgress } from '../../lib/setup-guide-utils';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingCarousel } from './LoadingCarousel';
import { FUEL_LEVELS } from '../../lib/launch-preparation-utils';
import { syncAllFolders } from '../../lib/manual-folder-sync';
import { OAuthReconnectModal } from '../OAuthReconnectModal';

interface SyncDataStepProps {
  onComplete: () => void;
  onGoBack?: () => void;
  progress: SetupGuideProgress | null;
  fromLaunchPrep?: boolean; // Flag to customize messaging for Launch Prep flow
  newFolderTypes?: ('strategy' | 'meetings' | 'financial' | 'projects')[]; // New folders to check for
}


export const SyncDataStep: React.FC<SyncDataStepProps> = ({ onComplete, onGoBack, fromLaunchPrep = false, newFolderTypes = [] }) => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(true);
  const [syncComplete, setSyncComplete] = useState(false);
  const [documentCounts, setDocumentCounts] = useState<{ meetings: number; strategy: number; financial: number; projects: number }>({ meetings: 0, strategy: 0, financial: 0, projects: 0 });
  const [checkAttempts, setCheckAttempts] = useState(0);
  const [showNoDocumentModal, setShowNoDocumentModal] = useState(false);
  const [showTokenExpiredModal, setShowTokenExpiredModal] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [newLevel, setNewLevel] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const maxCheckAttempts = 90; // Check for up to 3 minutes (90 * 2s intervals)
  const isAddingNewFolders = newFolderTypes.length > 0;

  useEffect(() => {
    // Start syncing process
    triggerSync();
  }, []);


  useEffect(() => {
    // Poll for synced data every 2 seconds
    if (syncing && !syncComplete) {
      const interval = setInterval(() => {
        checkSyncedData();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [syncing, syncComplete]);

  const triggerSync = async () => {
    console.log('========================================');
    console.log('[SyncDataStep] TRIGGERING SYNC');
    console.log('========================================');
    setSyncing(true);

    try {
      // Get user's team info
      const teamId = user?.user_metadata?.team_id;
      const userId = user?.id;

      console.log('[SyncDataStep] User info:', { teamId, userId, email: user?.email });

      if (!teamId || !userId) {
        console.error('[SyncDataStep] No team ID or user ID found');
        return;
      }

      // Determine which folder types to sync
      let foldersToSync: ('strategy' | 'meetings' | 'financial')[] = ['strategy', 'meetings', 'financial'];

      // If adding new folders, only sync those specific types
      if (isAddingNewFolders && newFolderTypes.length > 0) {
        foldersToSync = newFolderTypes.filter(type =>
          type === 'strategy' || type === 'meetings' || type === 'financial'
        ) as ('strategy' | 'meetings' | 'financial')[];
      }

      console.log('Calling manual folder sync for team:', teamId, 'folders:', foldersToSync);

      // Call the new manual folder sync for each configured folder
      const result = await syncAllFolders({
        teamId,
        userId,
        folderTypes: foldersToSync,
      });

      console.log('Manual folder sync completed:', result);

      if (result.success) {
        console.log(`Successfully synced ${result.totalFilesSent} files`);
      } else {
        console.warn('Some folders failed to sync:', result.results.filter(r => !r.success));
      }
    } catch (error) {
      console.error('Error triggering manual sync:', error);

      // Check if the error is due to expired Google token
      if (error instanceof Error && error.message === 'GOOGLE_TOKEN_EXPIRED') {
        console.log('Token expired - showing reconnect modal');
        setSyncing(false);
        setShowTokenExpiredModal(true);
        return;
      }
    }

    // Start checking for data immediately
    checkSyncedData();
  };

  const calculateFuelLevel = (counts: { meetings: number; strategy: number; financial: number; projects: number }) => {
    // Level 5: 10 strategy, 100 meetings, 10 financial, projects folder
    if (counts.strategy >= 10 && counts.meetings >= 100 && counts.financial >= 10 && counts.projects > 0) {
      return 5;
    }
    // Level 4: 10 strategy, 50 meetings, 10 financial
    if (counts.strategy >= 10 && counts.meetings >= 50 && counts.financial >= 10) {
      return 4;
    }
    // Level 3: 3 strategy, 10 meetings, 3 financial
    if (counts.strategy >= 3 && counts.meetings >= 10 && counts.financial >= 3) {
      return 3;
    }
    // Level 2: 1 strategy, 1 meeting, 1 financial
    if (counts.strategy >= 1 && counts.meetings >= 1 && counts.financial >= 1) {
      return 2;
    }
    // Level 1: Any 1 document
    if (counts.strategy > 0 || counts.meetings > 0 || counts.financial > 0 || counts.projects > 0) {
      return 1;
    }
    return 0;
  };

  const checkAndUpdateLevel = async (counts: { meetings: number; strategy: number; financial: number; projects: number }) => {
    if (!user || !fromLaunchPrep) return;

    try {
      const userId = user.id;
      if (!userId) return;

      // Get current fuel stage progress (using user_id, not team_id)
      const { data: fuelProgress, error: progressError } = await supabase
        .from('launch_preparation_progress')
        .select('level, points_earned')
        .eq('user_id', userId)
        .eq('stage', 'fuel')
        .maybeSingle();

      if (progressError) {
        console.error('Error fetching fuel progress:', progressError);
        return;
      }

      const oldLevel = fuelProgress?.level || 0;
      const calculatedLevel = calculateFuelLevel(counts);

      setCurrentLevel(oldLevel);
      setNewLevel(calculatedLevel);

      // If level increased, update database and award points
      if (calculatedLevel > oldLevel) {
        setLeveledUp(true);

        // Calculate points to award (sum of all levels achieved)
        let pointsToAward = 0;
        for (let i = oldLevel + 1; i <= calculatedLevel; i++) {
          pointsToAward += FUEL_LEVELS[i - 1]?.points || 0;
        }

        const currentPoints = fuelProgress?.points_earned || 0;

        // Update fuel stage level and points in launch_preparation_progress
        const { error: updateError } = await supabase
          .from('launch_preparation_progress')
          .update({
            level: calculatedLevel,
            points_earned: currentPoints + pointsToAward
          })
          .eq('user_id', userId)
          .eq('stage', 'fuel');

        if (updateError) {
          console.error('Error updating fuel progress:', updateError);
        } else {
          console.log(`Level up! ${oldLevel} → ${calculatedLevel}, awarded ${pointsToAward} points (${currentPoints} → ${currentPoints + pointsToAward})`);
        }
      }
    } catch (error) {
      console.error('Error checking/updating level:', error);
    }
  };

  const checkSyncedData = async () => {
    if (!user || syncComplete) return;

    try {
      const teamId = user.user_metadata?.team_id;
      if (!teamId) return;

      const [meetingsData, strategyData, financialData, projectsData] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('folder_type', 'meetings'),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('folder_type', 'strategy'),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('folder_type', 'financial'),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('folder_type', 'projects')
      ]);

      const counts = {
        meetings: meetingsData.count || 0,
        strategy: strategyData.count || 0,
        financial: financialData.count || 0,
        projects: projectsData.count || 0
      };

      setDocumentCounts(counts);

      // If adding new folders, check specifically for documents in those new folder types
      if (isAddingNewFolders) {
        const hasNewFolderDocs = newFolderTypes.some(folderType => counts[folderType] > 0);

        if (hasNewFolderDocs) {
          setSyncing(false);
          setSyncComplete(true);
          // Check for level progression
          await checkAndUpdateLevel(counts);
        } else {
          // Increment check attempts
          setCheckAttempts(prev => {
            const newCount = prev + 1;

            // If we've exceeded max attempts (3 minutes), show error modal
            if (newCount >= maxCheckAttempts) {
              setSyncing(false);
              setShowNoDocumentModal(true);
            }

            return newCount;
          });
        }
      } else {
        // Original behavior - check if we have any synced data
        if (counts.meetings > 0 || counts.strategy > 0 || counts.financial > 0 || counts.projects > 0) {
          setSyncing(false);
          setSyncComplete(true);
          // Check for level progression
          await checkAndUpdateLevel(counts);
        } else {
          // Increment check attempts
          setCheckAttempts(prev => {
            const newCount = prev + 1;

            // If we've exceeded max attempts (3 minutes), show error modal
            if (newCount >= maxCheckAttempts) {
              setSyncing(false);
              setShowNoDocumentModal(true);
            }

            return newCount;
          });
        }
      }
    } catch (error) {
      console.error('Error checking synced data:', error);
    }
  };

  // Syncing in progress view
  if (syncing && !syncComplete) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 mb-4 animate-pulse">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Syncing Your Documents...</h2>
          <p className="text-sm text-gray-300 mb-1">
            Astra is processing your strategy documents and will be ready shortly
          </p>
          <p className="text-xs text-gray-400">
            This may take a minute or two depending on the number of documents
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-progress-indeterminate" />
          </div>
        </div>

        {/* Graphic Loading Carousel */}
        <LoadingCarousel type="sync" />
      </div>
    );
  }

  // Sync complete view
  if (syncComplete) {
    const totalDocs = documentCounts.meetings + documentCounts.strategy + documentCounts.financial + documentCounts.projects;
    const newFolderNames = newFolderTypes.map(type =>
      type.charAt(0).toUpperCase() + type.slice(1)
    ).join(', ');

    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600/20 mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isAddingNewFolders ? 'New Folders Syncing!' : 'Sync Complete!'}
          </h2>
          <p className="text-sm text-gray-300">
            {isAddingNewFolders
              ? `At least one document from your new ${newFolderNames} folder(s) has been detected`
              : 'Your documents have been successfully processed and Astra is ready to help'
            }
          </p>
        </div>

        {isAddingNewFolders && (
          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
            <p className="text-sm text-blue-300 text-center">
              <span className="font-medium">⏳ Note:</span> Full document sync may take 5+ minutes depending on the number of documents. Your new data will continue syncing in the background.
            </p>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Sync Summary
          </h3>
          <div className="space-y-2">
            {documentCounts.strategy > 0 && (
              <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <p className="text-white text-sm font-medium">Strategy Documents</p>
                    <p className="text-xs text-gray-400">{documentCounts.strategy.toLocaleString()} documents processed</p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}
            {documentCounts.meetings > 0 && (
              <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📊</span>
                  <div>
                    <p className="text-white text-sm font-medium">Meeting Notes</p>
                    <p className="text-xs text-gray-400">{documentCounts.meetings.toLocaleString()} documents processed</p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}
            {documentCounts.financial > 0 && (
              <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">💰</span>
                  <div>
                    <p className="text-white text-sm font-medium">Financial Documents</p>
                    <p className="text-xs text-gray-400">{documentCounts.financial.toLocaleString()} documents processed</p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}
            {documentCounts.projects > 0 && (
              <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📁</span>
                  <div>
                    <p className="text-white text-sm font-medium">Project Documents</p>
                    <p className="text-xs text-gray-400">{documentCounts.projects.toLocaleString()} documents processed</p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-400">
              Total: <span className="text-white font-medium">{totalDocs.toLocaleString()} documents</span> ready for AI-powered insights
            </p>
          </div>
        </div>

        {fromLaunchPrep && totalDocs > 0 ? (
          // Launch Prep: Celebrate Fuel Level 1 Achievement
          <>
            <div className="bg-gradient-to-br from-orange-900/20 to-blue-900/20 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-orange-400" />
                <h4 className="text-white text-lg font-bold">
                  {leveledUp && newLevel > currentLevel
                    ? `Fuel Level ${newLevel} Achieved!`
                    : `Fuel Level ${newLevel || 1} Achieved!`
                  }
                </h4>
                <Sparkles className="w-5 h-5 text-orange-400" />
              </div>
              {leveledUp && newLevel > currentLevel && (
                <div className="text-center mb-3">
                  <p className="text-sm text-green-300 font-medium">
                    🎉 Level Up! {currentLevel} → {newLevel}
                  </p>
                  <p className="text-xs text-orange-300">
                    +{FUEL_LEVELS[newLevel - 1]?.points || 0} Launch Points
                  </p>
                </div>
              )}
              <p className="text-center text-gray-300 text-sm mb-3">
                {isAddingNewFolders
                  ? `You've added new data sources! Astra can now provide insights from ${newFolderNames} documents`
                  : "You've unlocked AI-powered insights and the next stage: Boosters"
                }
              </p>
              <div className="grid grid-cols-2 gap-2">
                {documentCounts.strategy > 0 && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-green-300">
                      <span className="text-green-400">✓</span>
                      <span>Analyze strategy</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-300">
                      <span className="text-green-400">✓</span>
                      <span>Track goals</span>
                    </div>
                  </>
                )}
                {documentCounts.meetings > 0 && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-green-300">
                      <span className="text-green-400">✓</span>
                      <span>Review meetings</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-300">
                      <span className="text-green-400">✓</span>
                      <span>Track decisions</span>
                    </div>
                  </>
                )}
                {documentCounts.financial > 0 && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-green-300">
                      <span className="text-green-400">✓</span>
                      <span>Analyze finances</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-300">
                      <span className="text-green-400">✓</span>
                      <span>Budget insights</span>
                    </div>
                  </>
                )}
                {documentCounts.projects > 0 && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-green-300">
                      <span className="text-green-400">✓</span>
                      <span>Track projects</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-300">
                      <span className="text-green-400">✓</span>
                      <span>Project status</span>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-1 text-xs text-green-300">
                  <span className="text-green-400">✓</span>
                  <span>Create visuals</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-green-300">
                  <span className="text-green-400">✓</span>
                  <span>Answer questions</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
              <p className="text-sm text-blue-300 text-center">
                <span className="font-medium">Next Steps:</span> Add more documents to reach higher Fuel Levels (2-5) or explore the Boosters stage
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={onComplete}
                className="px-8 py-3 bg-gradient-to-r from-orange-600 to-blue-600 hover:from-orange-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl min-h-[44px]"
              >
                Return to Fuel Stage →
              </button>
            </div>
          </>
        ) : (
          // Regular Guided Setup: Continue to Team Settings
          <>
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-green-400" />
                <h4 className="text-white text-sm font-medium">Astra Can Now:</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1 text-xs text-green-300">
                  <span className="text-green-400">✓</span>
                  <span>Answer questions</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-green-300">
                  <span className="text-green-400">✓</span>
                  <span>Track progress</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-green-300">
                  <span className="text-green-400">✓</span>
                  <span>Analyze alignment</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-green-300">
                  <span className="text-green-400">✓</span>
                  <span>Create visuals</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={onComplete}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl min-h-[44px]"
              >
                Next: Configure Team Settings →
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // No data found after waiting - This shouldn't be reached now since we show the modal
  return (
    <>
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-600/20 mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Sync Not Complete Yet</h2>
          <p className="text-gray-300">
            Documents are still being processed. This can take a few minutes.
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
          <p className="text-sm text-yellow-300">
            <span className="font-medium">⏳ Please wait:</span> The document sync is handled by our n8n workflow and may take 2-5 minutes depending on the number and size of documents. You can continue with the setup and check back later.
          </p>
        </div>

        <div className="flex justify-center gap-3 pt-4">
          <button
            onClick={() => {
              setCheckAttempts(0);
              setSyncing(true);
              checkSyncedData();
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 min-h-[44px]"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Check Again</span>
          </button>
          <button
            onClick={onComplete}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all min-h-[44px]"
          >
            Continue Anyway →
          </button>
        </div>
      </div>

      {/* No Document Found Modal */}
      {showNoDocumentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-red-700 max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border-b border-red-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">No Documents Found</h3>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  After 3 minutes of checking, we couldn't find any synced documents in your folder.
                </p>
                <p className="text-sm text-gray-300">
                  This usually happens when:
                </p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <p className="text-xs text-gray-300">
                    <span className="font-medium text-white">Unsupported file type:</span> File format is not yet supported
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <p className="text-xs text-gray-300">
                    <span className="font-medium text-white">Empty folder:</span> No files were added to the folder
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <p className="text-xs text-gray-300">
                    <span className="font-medium text-white">Wrong folder:</span> Files were added to a different folder
                  </p>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                <p className="text-xs text-blue-200">
                  <span className="font-medium">✨ Supported formats:</span> Google Docs, Google Sheets, PDF, Word (DOC/DOCX), Excel (XLS/XLSX), CSV, TXT/Markdown, and PowerPoint (PPT/PPTX).
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowNoDocumentModal(false);
                    if (onGoBack) {
                      onGoBack();
                    }
                  }}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Go Back and Check My Files</span>
                </button>
                <button
                  onClick={() => {
                    setShowNoDocumentModal(false);
                    setCheckAttempts(0);
                    setSyncing(true);
                    triggerSync();
                  }}
                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Syncing Again</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Token Expired Modal */}
      {showTokenExpiredModal && (
        <OAuthReconnectModal
          onClose={() => {
            setShowTokenExpiredModal(false);
            if (onGoBack) {
              onGoBack();
            }
          }}
          onReconnect={() => {
            setShowTokenExpiredModal(false);
            // The initiateGoogleDriveOAuth in the modal will redirect them
          }}
        />
      )}
    </>
  );
};
