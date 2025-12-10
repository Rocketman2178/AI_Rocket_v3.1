import React, { useState, useEffect } from 'react';
import { X, Fuel, CheckCircle, ArrowRight, Loader, FileText, Folder, Database, HardDrive, Rocket, Info, HelpCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { StageProgress } from '../../hooks/useLaunchPreparation';
import { useLaunchPreparation } from '../../hooks/useLaunchPreparation';
import { useDocumentCounts } from '../../hooks/useDocumentCounts';
import { FUEL_LEVELS, formatPoints } from '../../lib/launch-preparation-utils';
import { getGoogleDriveConnection } from '../../lib/google-drive-oauth';
import { useAuth } from '../../contexts/AuthContext';
import { ConnectDriveStep } from '../setup-steps/ConnectDriveStep';
import { ChooseFolderStep } from '../setup-steps/ChooseFolderStep';
import { PlaceFilesStep } from '../setup-steps/PlaceFilesStep';
import { SyncDataStep } from '../setup-steps/SyncDataStep';
import { AddMoreFoldersStep } from '../setup-steps/AddMoreFoldersStep';
import { ConnectedFoldersStatus } from '../ConnectedFoldersStatus';
import { StageProgressBar } from './StageProgressBar';
import { supabase } from '../../lib/supabase';
import { triggerIncrementalSync } from '../../lib/manual-folder-sync';

interface FuelStageProps {
  progress: StageProgress | null;
  fuelProgress: StageProgress | null;
  boostersProgress: StageProgress | null;
  guidanceProgress: StageProgress | null;
  onBack: () => void;
  onNavigateToStage?: (stage: 'fuel' | 'boosters' | 'guidance' | 'ready') => void;
  onComplete: () => void;
  onRefresh?: () => Promise<void>;
  onOpenHelpCenter?: (tab?: 'faq' | 'ask-astra') => void;
}

export const FuelStage: React.FC<FuelStageProps> = ({ progress, fuelProgress, boostersProgress, guidanceProgress, onBack, onNavigateToStage, onComplete, onRefresh, onOpenHelpCenter }) => {
  const { user } = useAuth();
  const { updateStageLevel, completeAchievement, awardPoints } = useLaunchPreparation();
  const { counts, documents, loading: countsLoading, calculateFuelLevel, meetsLevelRequirements, refresh: refreshCounts } = useDocumentCounts();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showDriveFlow, setShowDriveFlow] = useState(false);
  const [driveFlowStep, setDriveFlowStep] = useState<'status' | 'connect' | 'choose-folder' | 'add-more-folders' | 'place-files' | 'sync-data'>('status');
  const [folderData, setFolderData] = useState<any>(null);
  const [newFolderTypes, setNewFolderTypes] = useState<('strategy' | 'meetings' | 'financial' | 'projects')[]>([]);
  const [checkingLevel, setCheckingLevel] = useState(false);
  const [hasGoogleDrive, setHasGoogleDrive] = useState(false);
  const [checkingDrive, setCheckingDrive] = useState(true);
  const [userClosedModal, setUserClosedModal] = useState(false);
  const [showLevelInfoModal, setShowLevelInfoModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentLevel = progress?.level || 0;
  const targetLevel = currentLevel + 1;
  const currentLevelInfo = FUEL_LEVELS[currentLevel] || FUEL_LEVELS[0];
  const targetLevelInfo = FUEL_LEVELS[targetLevel - 1];

  // Refresh data when component mounts to ensure we have latest progress
  useEffect(() => {
    const refreshData = async () => {
      if (onRefresh) {
        await onRefresh();
      }
      await refreshCounts();
    };
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - onRefresh and refreshCounts are stable refs

  // Helper function to persist flow state to database
  const persistFlowState = async (step: typeof driveFlowStep | null, folderDataToPersist?: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('launch_preparation_progress')
        .upsert({
          user_id: user.id,
          stage: 'fuel',
          drive_flow_step: step,
          drive_flow_folder_data: folderDataToPersist || folderData
        }, {
          onConflict: 'user_id,stage'
        });

      if (error) {
        console.error('Error persisting flow state:', error);
      } else {
        console.log('✅ Persisted flow state:', step);
      }
    } catch (error) {
      console.error('Error persisting flow state:', error);
    }
  };

  // Helper function to clear flow state from database
  const clearFlowState = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('launch_preparation_progress')
        .update({
          drive_flow_step: null,
          drive_flow_folder_data: null
        })
        .eq('user_id', user.id)
        .eq('stage', 'fuel');

      if (error) {
        console.error('Error clearing flow state:', error);
      } else {
        console.log('🧹 Cleared flow state');
      }
    } catch (error) {
      console.error('Error clearing flow state:', error);
    }
  };

  // Load persisted flow state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('launch_preparation_progress')
          .select('drive_flow_step, drive_flow_folder_data')
          .eq('user_id', user.id)
          .eq('stage', 'fuel')
          .maybeSingle();

        if (error) {
          console.error('Error loading persisted state:', error);
          return;
        }

        if (data?.drive_flow_step) {
          console.log('🔄 Restoring flow state:', data.drive_flow_step);
          setDriveFlowStep(data.drive_flow_step as typeof driveFlowStep);
          if (data.drive_flow_folder_data) {
            setFolderData(data.drive_flow_folder_data);
          }
          setShowDriveFlow(true);
        }
      } catch (error) {
        console.error('Error loading persisted state:', error);
      }
    };

    loadPersistedState();
  }, [user]);

  // Check if user has Google Drive connected
  useEffect(() => {
    const checkDriveConnection = async () => {
      try {
        const connection = await getGoogleDriveConnection();
        const isConnected = !!connection && connection.is_active;
        setHasGoogleDrive(isConnected);
        setCheckingDrive(false);

        console.log('🔍 [FuelStage] Drive connection check:', {
          isConnected,
          hasStrategyFolder: connection?.strategy_folder_id,
          hasMeetingsFolder: connection?.meetings_folder_id,
          hasFinancialFolder: connection?.financial_folder_id,
          hasProjectsFolder: connection?.projects_folder_id
        });

        // Check if returning from OAuth (session storage flag)
        const shouldReopenFuel = sessionStorage.getItem('reopen_fuel_stage');
        if (shouldReopenFuel === 'true') {
          sessionStorage.removeItem('reopen_fuel_stage');
          console.log('🚀 [FuelStage] Reopening modal after OAuth return');
          // Open modal and go to folder selection step
          setDriveFlowStep('choose-folder');
          setShowDriveFlow(true);
          // Refresh counts to get latest document counts
          await refreshCounts();
          if (onRefresh) {
            await onRefresh();
          }
          return;
        }

        // Auto-open folder selection if they connected but no folders configured
        // BUT respect if user manually closed the modal
        if (connection && connection.is_active && !showDriveFlow && !userClosedModal) {
          const hasAnyFolder = connection.strategy_folder_id || connection.meetings_folder_id || connection.financial_folder_id || connection.projects_folder_id;
          if (!hasAnyFolder) {
            console.log('🔔 [FuelStage] Auto-opening folder selection - no folders configured');
            setDriveFlowStep('choose-folder');
            setShowDriveFlow(true);
          }
        }
      } catch (error) {
        console.error('Error checking drive connection:', error);
        setCheckingDrive(false);
      }
    };

    if (user) {
      checkDriveConnection();
    }
  }, [user, refreshCounts, onRefresh]);

  // Check if user meets requirements for next level
  useEffect(() => {
    const checkAndUpdateLevel = async () => {
      if (countsLoading || checkingLevel) return;

      const actualLevel = calculateFuelLevel();

      // If actual level is higher than recorded level, update it
      if (actualLevel > currentLevel) {
        setCheckingLevel(true);

        try {
          // Complete achievements for all levels up to actual level
          for (let level = currentLevel + 1; level <= actualLevel; level++) {
            const achievementKey = `fuel_level_${level}`;
            const achievementSuccess = await completeAchievement(achievementKey, 'fuel');
            if (!achievementSuccess) {
              console.error('Failed to complete achievement:', achievementKey);
            }
            const levelSuccess = await updateStageLevel('fuel', level);
            if (!levelSuccess) {
              console.error('Failed to update stage level:', level);
            }
          }

          // Refresh counts to show updated data
          await refreshCounts();
        } catch (error) {
          console.error('Error updating fuel level:', error);
        } finally {
          setCheckingLevel(false);
        }
      }
    };

    checkAndUpdateLevel();
  }, [counts, currentLevel, calculateFuelLevel, countsLoading, checkingLevel, completeAchievement, updateStageLevel, refreshCounts]);

  const levelIcons = [FileText, Folder, Database, HardDrive, Rocket];
  const LevelIcon = levelIcons[currentLevel] || FileText;

  const handleStageNavigation = (stage: 'fuel' | 'boosters' | 'guidance') => {
    if (stage === 'fuel') return; // Already here
    if (onNavigateToStage) {
      onNavigateToStage(stage);
    } else {
      onBack(); // Fallback to stage selector
    }
  };

  const handleSyncDocuments = async () => {
    if (!user || syncing) return;

    setSyncing(true);
    setSyncMessage(null);

    try {
      const result = await triggerIncrementalSync();

      if (result.success) {
        setSyncMessage({ type: 'success', text: 'Syncing new documents...' });

        setTimeout(async () => {
          await refreshCounts();
          if (onRefresh) {
            await onRefresh();
          }
          setSyncing(false);
          setSyncMessage({ type: 'success', text: 'Sync complete! Documents updated.' });
          setTimeout(() => setSyncMessage(null), 3000);
        }, 10000);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Compact Progress Bar at Top */}
      <StageProgressBar
        fuelProgress={fuelProgress}
        boostersProgress={boostersProgress}
        guidanceProgress={guidanceProgress}
        currentStage="fuel"
        onStageClick={handleStageNavigation}
      />

      <div className="p-4 max-w-5xl mx-auto">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Fuel className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Fuel Stage</h1>
              <p className="text-sm text-gray-400">Add data to power your AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenHelpCenter && (
              <button
                onClick={() => onOpenHelpCenter('faq')}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Help & FAQ"
              >
                <HelpCircle className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Back to Mission Control"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Synced Documents Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-300">Synced Documents</h2>
            {hasGoogleDrive && (
              <button
                onClick={handleSyncDocuments}
                disabled={syncing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>
          {syncMessage && (
            <p className={`text-xs mb-2 ${
              syncMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {syncMessage.text}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['strategy', 'meetings', 'financial', 'projects'] as const).map((type) => {
              const typeLabels = { strategy: 'Strategy', meetings: 'Meetings', financial: 'Financial', projects: 'Projects' };
              const count = counts[type];
              const docs = documents[type];
              const isExpanded = expandedSections[type];

              return (
                <div key={type} className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => count > 0 && setExpandedSections(prev => ({ ...prev, [type]: !prev[type] }))}
                    className={`w-full p-3 text-center ${count > 0 ? 'cursor-pointer hover:bg-gray-700/50' : 'cursor-default'} transition-colors`}
                    disabled={count === 0}
                  >
                    <p className="text-xs text-gray-400 mb-1">{typeLabels[type]}</p>
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-xl font-bold text-white">{count}</p>
                      {count > 0 && (
                        isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>
                  {isExpanded && docs.length > 0 && (
                    <div className="border-t border-gray-700 max-h-[200px] overflow-y-auto bg-gray-900/50">
                      {docs.slice(0, 10).map((doc) => (
                        <div key={doc.id} className="px-3 py-2 border-b border-gray-700/50 last:border-b-0 hover:bg-gray-800/50">
                          <p className="text-xs text-white truncate" title={doc.title}>
                            {doc.title}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                      {docs.length > 10 && (
                        <div className="px-3 py-2 text-center bg-gray-800/30">
                          <p className="text-xs text-gray-400">+{docs.length - 10} more</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>


        {/* Compact Level Progress */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center">
              <LevelIcon className="w-5 h-5 mr-2 text-orange-400" />
              {currentLevel === 0 ? 'Get Started' : `Current Stage: Level ${currentLevel}`}
            </h2>
            <button
              onClick={() => setShowLevelInfoModal(true)}
              className="text-gray-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>

          {currentLevel === 0 ? (
            <div className="mb-3">
              <p className="text-sm text-gray-300 mb-2">
                <strong>Get started by {hasGoogleDrive ? 'adding documents' : 'connecting Google Drive'}:</strong>
              </p>
              {hasGoogleDrive ? (
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 text-sm text-blue-300">
                  <p className="mb-1">Google Drive is connected!</p>
                  <p>Now add at least 1 document to any of your connected folders to reach Level 1.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Connect your Google Drive and select folders to sync your business data.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-300 mb-3">
              {currentLevelInfo.description}
            </p>
          )}

          {/* Next Level Requirements */}
          {currentLevel < 5 && targetLevelInfo && (
            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">
                  Next: Level {targetLevel} Goal
                </h3>
                <span className="text-xs text-yellow-400 font-medium">
                  +{formatPoints(targetLevelInfo.points)}
                </span>
              </div>

              <ul className="space-y-1.5">
                {targetLevelInfo.requirements.map((req, index) => {
                  let isMet = false;

                  // Check if requirement is met
                  if (req.includes('1 document')) {
                    isMet = counts.total >= 1;
                  } else if (req.toLowerCase().includes('strategy')) {
                    if (req.includes('10')) isMet = counts.strategy >= 10;
                    else if (req.includes('3')) isMet = counts.strategy >= 3;
                    else if (req.includes('1')) isMet = counts.strategy >= 1;
                  } else if (req.toLowerCase().includes('meeting')) {
                    if (req.includes('100')) isMet = counts.meetings >= 100;
                    else if (req.includes('50')) isMet = counts.meetings >= 50;
                    else if (req.includes('10')) isMet = counts.meetings >= 10;
                    else if (req.includes('1')) isMet = counts.meetings >= 1;
                  } else if (req.toLowerCase().includes('financial')) {
                    if (req.includes('10')) isMet = counts.financial >= 10;
                    else if (req.includes('3')) isMet = counts.financial >= 3;
                    else if (req.includes('1')) isMet = counts.financial >= 1;
                  } else if (req.toLowerCase().includes('project')) {
                    if (req.includes('10')) isMet = counts.projects >= 10;
                    else if (req.includes('3')) isMet = counts.projects >= 3;
                    else if (req.includes('1')) isMet = counts.projects >= 1;
                  }

                  return (
                    <li key={index} className="flex items-center space-x-2 text-sm">
                      {isMet ? (
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-600 rounded-full flex-shrink-0" />
                      )}
                      <span className={isMet ? 'text-green-400' : 'text-gray-400'}>
                        {req}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {meetsLevelRequirements(targetLevel) && !checkingLevel && (
                <div className="mt-2 text-xs text-green-400 font-medium flex items-center">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Requirements met! Updating...
                </div>
              )}
            </div>
          )}

          {currentLevel === 5 && (
            <div className="mt-3 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-lg p-3 flex items-center gap-3">
              <Rocket className="w-6 h-6 text-orange-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-white">Maximum Fuel!</p>
                <p className="text-xs text-gray-300">Ready to power up Boosters</p>
              </div>
            </div>
          )}
        </div>

        {/* Connect Google Drive - Only show if level 0 AND not connected */}
        {currentLevel === 0 && !hasGoogleDrive && (
          <button
            onClick={async () => {
              setDriveFlowStep('connect');
              setShowDriveFlow(true);
            }}
            disabled={checkingDrive}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {checkingDrive ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Folder className="w-5 h-5" />
                <span>Connect Google Drive</span>
              </>
            )}
          </button>
        )}

        {/* If Drive is connected but level 0, show folder management button */}
        {currentLevel === 0 && hasGoogleDrive && (
          <button
            onClick={() => {
              setShowDriveFlow(true);
              setDriveFlowStep('status');
            }}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Fuel className="w-5 h-5" />
            <span>Manage Connected Folders</span>
          </button>
        )}

        {currentLevel >= 1 && currentLevel < 4 && (
          <button
            onClick={() => {
              setShowDriveFlow(true);
              setDriveFlowStep('status');
            }}
            className="w-full mt-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Fuel className="w-5 h-5" />
            <span>Add More Fuel</span>
          </button>
        )}

        {/* Launch Boosters Stage - Show for level 1+ */}
        {currentLevel >= 1 && (
          <button
            onClick={onComplete}
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <span>Launch Boosters Stage</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        {currentLevel < 1 && (
          <p className="text-center text-gray-400 text-xs mt-3">
            Complete Level 1 to unlock Boosters
          </p>
        )}
      </div>

      {/* Google Drive Setup Flow Modal */}
      {showDriveFlow && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={async (e) => {
            // Allow closing by clicking backdrop
            if (e.target === e.currentTarget) {
              await clearFlowState();
              setShowDriveFlow(false);
              setUserClosedModal(true);
            }
          }}
        >
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {driveFlowStep === 'status' && 'Your Fuel Status'}
                {driveFlowStep === 'connect' && 'Connect Google Drive'}
                {driveFlowStep === 'choose-folder' && 'Choose Your Folder'}
                {driveFlowStep === 'add-more-folders' && 'Connect More Folders'}
                {driveFlowStep === 'place-files' && 'Place Your Files'}
                {driveFlowStep === 'sync-data' && 'Sync Your Data'}
              </h2>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await clearFlowState();
                  setShowDriveFlow(false);
                  setUserClosedModal(true);
                }}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>
            <div className="p-6">
              {driveFlowStep === 'status' && (
                <ConnectedFoldersStatus
                  onConnectMore={() => {
                    setDriveFlowStep('add-more-folders');
                  }}
                  onClose={async () => {
                    await clearFlowState();
                    setShowDriveFlow(false);
                    await refreshCounts();
                    if (onRefresh) {
                      await onRefresh();
                    }
                  }}
                />
              )}
              {driveFlowStep === 'connect' && (
                <ConnectDriveStep
                  onComplete={async () => {
                    setDriveFlowStep('choose-folder');
                    setHasGoogleDrive(true);
                    await persistFlowState('choose-folder');
                  }}
                  progress={null}
                  fromLaunchPrep={true}
                />
              )}
              {driveFlowStep === 'choose-folder' && (
                <ChooseFolderStep
                  onComplete={async (data) => {
                    console.log('Folder selected:', data);
                    // Store folder data for next steps
                    setFolderData(data);
                    await persistFlowState('choose-folder', data);
                    // Refresh counts in background
                    await refreshCounts();
                  }}
                  onProceed={async () => {
                    // User clicked "Next: Place Your Files" button
                    setDriveFlowStep('place-files');
                    await persistFlowState('place-files');
                  }}
                  progress={null}
                />
              )}
              {driveFlowStep === 'add-more-folders' && (
                <AddMoreFoldersStep
                  onComplete={async (newFolders) => {
                    // Store new folder types for sync step
                    setNewFolderTypes(newFolders);
                    // Move to sync step after selecting folders
                    setDriveFlowStep('sync-data');
                    await persistFlowState('sync-data');
                  }}
                  onBack={() => {
                    setDriveFlowStep('status');
                  }}
                />
              )}
              {driveFlowStep === 'place-files' && (
                <PlaceFilesStep
                  onComplete={async () => {
                    // Move to sync step
                    setDriveFlowStep('sync-data');
                    await persistFlowState('sync-data');
                  }}
                  progress={null}
                  folderData={folderData}
                />
              )}
              {driveFlowStep === 'sync-data' && (
                <SyncDataStep
                  onComplete={async () => {
                    // Sync complete - refresh all data
                    await refreshCounts();
                    if (onRefresh) {
                      await onRefresh();
                    }
                    await clearFlowState();
                    setShowDriveFlow(false);
                    // Reset new folder types
                    setNewFolderTypes([]);
                  }}
                  onGoBack={async () => {
                    setDriveFlowStep('place-files');
                    await persistFlowState('place-files');
                  }}
                  progress={null}
                  fromLaunchPrep={true}
                  newFolderTypes={newFolderTypes}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Level Info Modal */}
      {showLevelInfoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-gradient-to-r from-orange-900/30 to-blue-900/30 border-b border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center">
                    <Fuel className="w-6 h-6 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Fuel Stage Levels</h3>
                </div>
                <button
                  onClick={() => setShowLevelInfoModal(false)}
                  className="text-gray-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-300 mb-4">
                Progress through 5 Fuel Levels by adding more documents to your Google Drive folders. Each level unlocks more Launch Points and enhances Astra's capabilities.
              </p>

              {FUEL_LEVELS.map((level, index) => {
                const isCurrentLevel = currentLevel === level.level;
                const isCompleted = currentLevel > level.level;
                const LevelIcon = levelIcons[index];

                return (
                  <div
                    key={level.level}
                    className={`border rounded-lg p-4 ${
                      isCurrentLevel
                        ? 'border-orange-500 bg-orange-900/10'
                        : isCompleted
                        ? 'border-green-700 bg-green-900/10'
                        : 'border-gray-700 bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isCurrentLevel
                              ? 'bg-orange-600/20'
                              : isCompleted
                              ? 'bg-green-600/20'
                              : 'bg-gray-700/50'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle className="w-6 h-6 text-green-400" />
                          ) : (
                            <LevelIcon
                              className={`w-6 h-6 ${
                                isCurrentLevel ? 'text-orange-400' : 'text-gray-400'
                              }`}
                            />
                          )}
                        </div>
                        <div>
                          <h4
                            className={`font-semibold ${
                              isCurrentLevel
                                ? 'text-orange-400'
                                : isCompleted
                                ? 'text-green-400'
                                : 'text-white'
                            }`}
                          >
                            Level {level.level}
                          </h4>
                          <p className="text-xs text-gray-400">{level.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-sm font-medium ${
                            isCompleted ? 'text-green-400' : 'text-yellow-400'
                          }`}
                        >
                          +{formatPoints(level.points)}
                        </span>
                        {isCurrentLevel && (
                          <p className="text-xs text-orange-400 mt-1">Current</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-gray-400 font-medium mb-1">Requirements:</p>
                      {level.requirements.map((req, reqIndex) => (
                        <div key={reqIndex} className="flex items-center gap-2">
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCompleted ? 'bg-green-400' : 'bg-gray-600'
                            }`}
                          />
                          <p
                            className={`text-xs ${
                              isCompleted ? 'text-green-300' : 'text-gray-400'
                            }`}
                          >
                            {req}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-300">
                  <span className="font-medium">💡 Tip:</span> Add more documents to your Strategy, Meetings, Financial, and Projects folders to progress faster. Higher levels unlock more Launch Points and enhanced AI capabilities!
                </p>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setShowLevelInfoModal(false)}
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-blue-600 hover:from-orange-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl min-h-[44px]"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
