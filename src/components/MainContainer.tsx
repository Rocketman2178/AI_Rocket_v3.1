import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { ChatSidebar } from './ChatSidebar';
import { ChatContainer } from './ChatContainer';
import { GroupChat } from './GroupChat';
import { ReportsView } from './ReportsView';
import { ChatModeToggle } from './ChatModeToggle';
import { SavedVisualizationsList } from './SavedVisualizationsList';
import { UserSettingsModal } from './UserSettingsModal';
import { WelcomeModal } from './WelcomeModal';
import { InteractiveTour } from './InteractiveTour';
import { HelpCenter, HelpCenterTab } from './HelpCenter';
import { AstraGuidedSetup } from './AstraGuidedSetup';
import { ExpiredTokenBanner } from './ExpiredTokenBanner';
import { OAuthReconnectModal } from './OAuthReconnectModal';
import { ChooseFolderStep } from './setup-steps/ChooseFolderStep';
import { FuelStage } from './launch-stages/FuelStage';
import { BoostersStage } from './launch-stages/BoostersStage';
import { GuidanceStage } from './launch-stages/GuidanceStage';
import { ChatMode } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSavedVisualizations } from '../hooks/useSavedVisualizations';
import { useOAuthReconnectPrompt } from '../hooks/useOAuthReconnectPrompt';
import { useLaunchPreparation } from '../hooks/useLaunchPreparation';
import { getTourStepsForRole } from '../data/tourSteps';
import { supabase } from '../lib/supabase';

interface MainContainerProps {
  onOpenAdminDashboard?: () => void;
}

export const MainContainer: React.FC<MainContainerProps> = ({ onOpenAdminDashboard }) => {
  const { user } = useAuth();
  const { checkEligibility, launchStatus, stageProgress, refresh } = useLaunchPreparation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('reports');
  const [conversationToLoad, setConversationToLoad] = useState<string | null>(null);
  const [shouldStartNewChat, setShouldStartNewChat] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showSavedVisualizations, setShowSavedVisualizations] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);

  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [helpCenterTab, setHelpCenterTab] = useState<HelpCenterTab>('quick-start');
  const [teamName, setTeamName] = useState<string>('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [hasExpiredToken, setHasExpiredToken] = useState(false);
  const [tokenBannerDismissed, setTokenBannerDismissed] = useState(false);
  const [showDriveFolderSelection, setShowDriveFolderSelection] = useState(false);
  const [guidedPromptToSubmit, setGuidedPromptToSubmit] = useState<string | null>(null);
  const [showLaunchPrepStage, setShowLaunchPrepStage] = useState<'fuel' | 'boosters' | 'guidance' | null>(null);

  // OAuth Reconnect Prompt Hook
  const {
    showModal: showOAuthReconnectModal,
    needsReconnect,
    dismissModal: dismissOAuthReconnectModal,
    handleReconnect: handleOAuthReconnect
  } = useOAuthReconnectPrompt();

  const isAdmin = user?.user_metadata?.role === 'admin';
  const tourSteps = getTourStepsForRole(isAdmin);

  const {
    savedVisualizations,
    loading: savedVisualizationsLoading,
    deleteVisualization
  } = useSavedVisualizations(user?.id);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) return;

      console.log('🔍 [MainContainer] Starting onboarding check for user:', user.id);

      // FIRST: Check if user just completed Launch Preparation - always show Welcome + Tour
      // This must be checked BEFORE any other logic to avoid race conditions
      const showWelcomeAfterLaunch = sessionStorage.getItem('show_welcome_after_launch');
      if (showWelcomeAfterLaunch === 'true') {
        console.log('🚀 [MainContainer] User completed Launch Prep - showing Welcome + Tour');
        sessionStorage.removeItem('show_welcome_after_launch');
        setShowWelcomeModal(true);
        return; // Exit early - show welcome regardless of other settings
      }

      // CRITICAL FIX: Get team_id from database, not metadata (metadata may not be fresh)
      const { data: userData } = await supabase
        .from('users')
        .select('team_id, role')
        .eq('id', user.id)
        .maybeSingle();

      const teamId = userData?.team_id;
      let isTeamCreator = false;

      console.log('📊 [MainContainer] User data from DB:', { teamId, role: userData?.role });

      if (teamId) {
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('name, created_by')
          .eq('id', teamId)
          .maybeSingle();

        console.log('🔍 [MainContainer] Team query result:', { teamData, teamError, teamId });

        if (teamData) {
          setTeamName(teamData.name);
          isTeamCreator = teamData.created_by === user.id;
          console.log('👥 [MainContainer] Team data:', {
            teamName: teamData.name,
            created_by: teamData.created_by,
            user_id: user.id,
            isTeamCreator
          });
        } else {
          console.error('❌ [MainContainer] No team data found for teamId:', teamId, 'Error:', teamError);
        }
      } else {
        console.error('❌ [MainContainer] No teamId found in user data');
      }

      // CRITICAL: Check Launch Preparation eligibility BEFORE checking guided setup
      const isEligibleForLaunchPrep = await checkEligibility(user.email || '');
      console.log('🚀 [MainContainer] Launch Preparation check:', {
        isEligible: isEligibleForLaunchPrep,
        hasLaunched: launchStatus?.is_launched
      });

      // If user is eligible for Launch Preparation and hasn't launched yet,
      // they should NOT see the old Guided Setup - they'll see Launch Prep from App.tsx
      if (isEligibleForLaunchPrep && !launchStatus?.is_launched) {
        console.log('🚀 [MainContainer] User eligible for Launch Prep - skipping old Guided Setup');
        // Clear any openGuidedSetup param
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('openGuidedSetup') === 'true') {
          window.history.replaceState({}, '', '/');
        }
        // Don't show any setup modals - Launch Prep handles this
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const hasGuidedSetupParam = urlParams.get('openGuidedSetup') === 'true';

      console.log('🔗 [MainContainer] URL check:', { hasGuidedSetupParam, isTeamCreator });

      if (hasGuidedSetupParam && isTeamCreator && !isEligibleForLaunchPrep) {
        console.log('✅ [MainContainer] Opening Guided Setup for team creator');
        setShowSetupGuide(true);
        setShowWelcomeModal(false); // CRITICAL: Prevent Welcome Modal from showing
        // Clean up the URL parameter
        window.history.replaceState({}, '', '/');
        return; // Exit early - we're showing the guide
      }

      if (hasGuidedSetupParam && !isTeamCreator) {
        console.log('⚠️ [MainContainer] URL has openGuidedSetup but user is NOT team creator - ignoring');
      }

      // Check if user has incomplete guided setup progress
      // ONLY for team creators who are NOT in Launch Preparation
      if (isTeamCreator && !isEligibleForLaunchPrep) {
        const { data: setupProgress } = await supabase
          .from('setup_guide_progress')
          .select('is_completed, current_step')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('📋 [MainContainer] Setup progress:', setupProgress);

        // If user has setup progress but hasn't completed it, show the guide
        if (setupProgress && !setupProgress.is_completed) {
          console.log('✅ [MainContainer] Resuming incomplete Guided Setup');
          setShowSetupGuide(true);
          setShowWelcomeModal(false); // CRITICAL: Prevent Welcome Modal from showing
          return; // Exit early - we're showing the guide
        }
      }

      // Only show welcome modal if no guided setup is needed
      const onboardingCompleted = user.user_metadata?.onboarding_completed;
      const onboardingDismissed = user.user_metadata?.onboarding_dismissed;

      console.log('👋 [MainContainer] Welcome modal check:', { onboardingCompleted, onboardingDismissed, willShow: !onboardingCompleted && !onboardingDismissed });

      if (!onboardingCompleted && !onboardingDismissed) {
        console.log('✅ [MainContainer] Showing Welcome Modal');
        setShowWelcomeModal(true);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  useEffect(() => {
    const checkGoogleDriveConnection = async () => {
      if (!user) return;

      try {
        const { data: connection } = await supabase
          .from('user_drive_connections')
          .select('is_active, connection_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (connection && (!connection.is_active || connection.connection_status === 'token_expired')) {
          setHasExpiredToken(true);
        } else {
          setHasExpiredToken(false);
        }
      } catch (error) {
        console.error('Error checking Google Drive connection:', error);
      }
    };

    checkGoogleDriveConnection();
  }, [user]);

  // Close sidebar when switching away from private chat mode
  React.useEffect(() => {
    if (chatMode === 'private') {
      setSidebarOpen(false);
    }
  }, [chatMode]);

  // Check if returning from Google Drive OAuth (for users not in Launch Prep)
  React.useEffect(() => {
    const shouldReopenFuel = sessionStorage.getItem('reopen_fuel_stage');
    if (shouldReopenFuel === 'true') {
      sessionStorage.removeItem('reopen_fuel_stage');
      console.log('🚀 [MainContainer] Reopening Drive folder selection after OAuth return');
      setShowDriveFolderSelection(true);
    }
  }, []);

  // Check if coming from Astra Guided Chat in Launch Prep
  React.useEffect(() => {
    const guidedPrompt = sessionStorage.getItem('astra_guided_prompt');
    if (guidedPrompt) {
      sessionStorage.removeItem('astra_guided_prompt');
      console.log('🚀 [MainContainer] Submitting guided prompt from Launch Prep');
      // Switch to private chat mode
      setChatMode('private');
      // Start a new chat with the prompt
      setShouldStartNewChat(true);
      setGuidedPromptToSubmit(guidedPrompt);
    }
  }, []);

  const handleLoadConversation = (conversationId: string) => {
    console.log('MainContainer: handleLoadConversation called with:', conversationId);

    // Check if this is a summary request (special conversation ID format)
    if (conversationId.startsWith('summary-')) {
      // Start a new conversation and set a flag to send the summary prompt
      setShouldStartNewChat(true);
      // Store the summary type for the private chat to pick up
      const summaryType = conversationId.split('-')[1];
      localStorage.setItem('pendingSummaryRequest', summaryType);
    } else {
      setConversationToLoad(conversationId);
    }
    setSidebarOpen(false);
  };

  const handleStartNewConversation = () => {
    setShouldStartNewChat(true);
    setSidebarOpen(false);
  };

  const handleSwitchToPrivateChat = (conversationId: string) => {
    setChatMode('private');
    
    // Check if this is a summary request (special conversation ID format)
    if (conversationId.startsWith('summary-')) {
      // Start a new conversation and set a flag to send the summary prompt
      setShouldStartNewChat(true);
      // Store the summary type for the private chat to pick up
      const summaryType = conversationId.split('-')[1];
      localStorage.setItem('pendingSummaryRequest', summaryType);
    } else {
      setConversationToLoad(conversationId);
    }
  };

  const handleToggleTeamMenu = () => {
    setShowTeamMenu(!showTeamMenu);
  };

  const handleOpenSavedVisualizations = () => {
    setShowSavedVisualizations(true);
  };

  const handleOpenUserSettings = () => {
    setShowUserSettings(true);
  };

  const handleDeleteVisualization = async (id: string) => {
    const result = await deleteVisualization(id);
    if (!result.success) {
      console.error('Failed to delete visualization:', result.error);
    }
  };

  const handleStartTour = async () => {
    setShowWelcomeModal(false);

    // Set welcome_completed_at timestamp for 24-hour feedback delay
    if (user) {
      const teamId = user.user_metadata?.team_id;
      if (teamId) {
        await supabase
          .from('team_settings')
          .upsert({
            team_id: teamId,
            welcome_completed_at: new Date().toISOString()
          }, {
            onConflict: 'team_id'
          });
      }
    }

    // Small delay to ensure modal closes before tour starts
    setTimeout(() => {
      setTourStep(0);
      setShowTour(true);
    }, 100);
  };

  const handleDismissWelcome = async () => {
    setShowWelcomeModal(false);
    if (user) {
      // Set welcome_completed_at timestamp for 24-hour feedback delay
      const teamId = user.user_metadata?.team_id;
      if (teamId) {
        await supabase
          .from('team_settings')
          .upsert({
            team_id: teamId,
            welcome_completed_at: new Date().toISOString()
          }, {
            onConflict: 'team_id'
          });
      }

      await supabase.auth.updateUser({
        data: { onboarding_dismissed: true }
      });
    }
  };

  const handleTourComplete = async () => {
    setShowTour(false);
    if (user) {
      // Set welcome_completed_at timestamp for 24-hour feedback delay (if not already set)
      const teamId = user.user_metadata?.team_id;
      if (teamId) {
        const { data: existingSettings } = await supabase
          .from('team_settings')
          .select('welcome_completed_at')
          .eq('team_id', teamId)
          .maybeSingle();

        if (!existingSettings?.welcome_completed_at) {
          await supabase
            .from('team_settings')
            .upsert({
              team_id: teamId,
              welcome_completed_at: new Date().toISOString()
            }, {
              onConflict: 'team_id'
            });
        }
      }

      await supabase.auth.updateUser({
        data: { onboarding_completed: true }
      });
    }
  };

  const handleTourSkip = async () => {
    setShowTour(false);
    if (user) {
      await supabase.auth.updateUser({
        data: { onboarding_dismissed: true }
      });
    }
  };

  const handleRestartTour = () => {
    setTourStep(0);
    setShowTour(true);
  };

  const handleTourNavigate = (navigation: { mode?: ChatMode; openUserSettings?: boolean; closeUserSettings?: boolean }) => {
    if (navigation.mode) {
      setChatMode(navigation.mode);
    }
    if (navigation.openUserSettings) {
      setShowUserSettings(true);
    }
    if (navigation.closeUserSettings) {
      setShowUserSettings(false);
    }
  };

  // Get progress for stages (needed if showing launch prep stage)
  const fuelProgress = launchStatus ? stageProgress.find(p => p.stage === 'fuel') || null : null;
  const boostersProgress = launchStatus ? stageProgress.find(p => p.stage === 'boosters') || null : null;
  const guidanceProgress = launchStatus ? stageProgress.find(p => p.stage === 'guidance') || null : null;

  if (showSavedVisualizations) {
    return (
      <SavedVisualizationsList
        savedVisualizations={savedVisualizations}
        onBack={() => setShowSavedVisualizations(false)}
        onDelete={handleDeleteVisualization}
        loading={savedVisualizationsLoading}
      />
    );
  }

  // Show Launch Prep Stage if user clicked on one from Mission Control
  if (showLaunchPrepStage) {
    const handleBack = () => {
      setShowLaunchPrepStage(null);
      refresh();
    };

    const handleNavigateToStage = (stage: 'fuel' | 'boosters' | 'guidance' | 'ready') => {
      if (stage === 'ready') return; // Don't handle ready state here
      setShowLaunchPrepStage(stage);
    };

    if (showLaunchPrepStage === 'fuel') {
      return (
        <FuelStage
          progress={fuelProgress}
          fuelProgress={fuelProgress}
          boostersProgress={boostersProgress}
          guidanceProgress={guidanceProgress}
          onBack={handleBack}
          onNavigateToStage={handleNavigateToStage}
          onRefresh={refresh}
          onComplete={handleBack}
        />
      );
    }

    if (showLaunchPrepStage === 'boosters') {
      return (
        <BoostersStage
          progress={boostersProgress}
          fuelProgress={fuelProgress}
          boostersProgress={boostersProgress}
          guidanceProgress={guidanceProgress}
          onBack={handleBack}
          onNavigateToStage={handleNavigateToStage}
          onComplete={handleBack}
          showLevelUp={() => {}}
          onExitToChat={(prompt: string) => {
            setChatMode('private');
            setShouldStartNewChat(true);
            setGuidedPromptToSubmit(prompt);
            setShowLaunchPrepStage(null);
          }}
        />
      );
    }

    if (showLaunchPrepStage === 'guidance') {
      return (
        <GuidanceStage
          progress={guidanceProgress}
          fuelProgress={fuelProgress}
          boostersProgress={boostersProgress}
          guidanceProgress={guidanceProgress}
          onBack={handleBack}
          onNavigateToStage={handleNavigateToStage}
          onComplete={handleBack}
        />
      );
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Sidebar - only show for private chat mode */}
      {chatMode === 'private' && (
        <ChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLoadConversation={handleLoadConversation}
          onStartNewConversation={handleStartNewConversation}
          activeConversationId={activeConversationId}
          onOpenSavedVisualizations={handleOpenSavedVisualizations}
          onOpenUserSettings={handleOpenUserSettings}
        />
      )}

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={showUserSettings}
        onClose={() => setShowUserSettings(false)}
        onStartTour={handleRestartTour}
        onOpenHelpCenter={(tab) => {
          setShowUserSettings(false);
          setHelpCenterTab(tab || 'quick-start');
          setShowHelpCenter(true);
        }}
      />
      
      <div className="flex flex-col h-screen overflow-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showSidebarToggle={chatMode === 'private'}
          chatMode={chatMode}
          onToggleTeamMenu={handleToggleTeamMenu}
          onOpenHelpCenter={(tab) => {
            setHelpCenterTab(tab || 'quick-start');
            setShowHelpCenter(true);
          }}
          onStartTour={handleRestartTour}
          onOpenSetupGuide={() => setShowSetupGuide(true)}
          onNavigateToLaunchStage={(stage) => setShowLaunchPrepStage(stage)}
          onOpenAdminDashboard={onOpenAdminDashboard}
        />

        {/* Chat Mode Toggle - Fixed below header */}
        <div className="pt-16 flex-shrink-0" data-tour="mode-toggle">
          <ChatModeToggle mode={chatMode} onModeChange={setChatMode} />
        </div>

        {/* Expired Token Banner */}
        {hasExpiredToken && !tokenBannerDismissed && (
          <ExpiredTokenBanner onDismiss={() => setTokenBannerDismissed(true)} />
        )}

        {/* Chat Content - Scrollable area */}
        <div className="flex-1 overflow-y-auto">
          {chatMode === 'reports' ? (
            <ReportsView />
          ) : chatMode === 'private' ? (
            <ChatContainer
              sidebarOpen={sidebarOpen}
              onCloseSidebar={() => setSidebarOpen(false)}
              conversationToLoad={conversationToLoad}
              shouldStartNewChat={shouldStartNewChat}
              onConversationLoaded={() => setConversationToLoad(null)}
              onNewChatStarted={() => setShouldStartNewChat(false)}
              onConversationChange={setActiveConversationId}
              guidedPromptToSubmit={guidedPromptToSubmit}
              onGuidedPromptSubmitted={() => setGuidedPromptToSubmit(null)}
            />
          ) : (
            <GroupChat
              showTeamMenu={showTeamMenu}
              onCloseTeamMenu={() => setShowTeamMenu(false)}
              onSwitchToPrivateChat={handleSwitchToPrivateChat}
            />
          )}
        </div>
      </div>

      {/* Onboarding Modals - CRITICAL: Guided Setup takes precedence over Welcome Modal */}
      {showWelcomeModal && !showSetupGuide && (
        <WelcomeModal
          userName={user?.user_metadata?.full_name || 'there'}
          teamName={teamName}
          onStartTour={handleStartTour}
          onDismiss={handleDismissWelcome}
        />
      )}

      {showTour && !showSetupGuide && (
        <InteractiveTour
          steps={tourSteps}
          currentStep={tourStep}
          onNext={() => setTourStep(prev => prev + 1)}
          onPrevious={() => setTourStep(prev => prev - 1)}
          onSkip={handleTourSkip}
          onComplete={handleTourComplete}
          onNavigate={handleTourNavigate}
        />
      )}

      {/* Help Center */}
      <HelpCenter
        isOpen={showHelpCenter}
        onClose={() => setShowHelpCenter(false)}
        onStartTour={handleRestartTour}
        isAdmin={isAdmin}
        initialTab={helpCenterTab}
      />

      {/* Astra Guided Setup - Always takes precedence over other onboarding flows */}
      <AstraGuidedSetup
        isOpen={showSetupGuide}
        onClose={() => setShowSetupGuide(false)}
      />

      {/* OAuth Reconnect Modal - Prompts users to update OAuth scopes */}
      {showOAuthReconnectModal && (
        <OAuthReconnectModal
          onClose={dismissOAuthReconnectModal}
          onReconnect={handleOAuthReconnect}
        />
      )}

      {/* Google Drive Folder Selection - After OAuth return */}
      {showDriveFolderSelection && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Allow closing by clicking backdrop
            if (e.target === e.currentTarget) {
              setShowDriveFolderSelection(false);
            }
          }}
        >
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Choose Your Folder</h2>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDriveFolderSelection(false);
                }}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>
            <div className="p-6">
              <ChooseFolderStep
                onComplete={(folderData) => {
                  console.log('Folder selected:', folderData);
                  setShowDriveFolderSelection(false);
                  // Refresh the page to update data counts
                  window.location.reload();
                }}
                progress={null}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};