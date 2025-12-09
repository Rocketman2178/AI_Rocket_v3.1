import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ReportsProvider } from './contexts/ReportsContext';
import { AuthScreen } from './components/AuthScreen';
import { MainContainer } from './components/MainContainer';
import { GmailCallback } from './components/GmailCallback';
import { GoogleDriveCallback } from './components/GoogleDriveCallback';
import { OnboardingScreen } from './components/OnboardingScreen';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { FeedbackModal } from './components/FeedbackModal';
import { VersionChecker } from './components/VersionChecker';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import AdminDashboardPage from './components/AdminDashboardPage';
import { AdminDashboard } from './components/AdminDashboard';
import { BuildAgentsPage } from './components/BuildAgentsPage';
import { MarketingPage } from './components/MarketingPage';
import { MarketingLogo } from './components/MarketingLogo';
import { UserMetricsDashboard } from './components/UserMetricsDashboard';
import { ProtectedMetricsRoute } from './components/ProtectedMetricsRoute';
import { PricingStrategyPage } from './components/PricingStrategyPage';
import { MCPStrategyPage } from './components/MCPStrategyPage';
import { PasswordResetPage } from './components/PasswordResetPage';
import { LaunchPreparationFlow } from './components/LaunchPreparationFlow';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { TermsOfServicePage } from './components/TermsOfServicePage';
import { MoonshotChallengePage } from './components/MoonshotChallengePage';
import { useGmailTokenRefresh } from './hooks/useGmailTokenRefresh';
import { useFeedbackPrompt } from './hooks/useFeedbackPrompt';
import { useActivityTracking } from './hooks/useActivityTracking';
import { useLaunchPreparation } from './hooks/useLaunchPreparation';
import { supabase } from './lib/supabase';
import { FEATURES } from './config/features';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [needsLaunchPreparation, setNeedsLaunchPreparation] = useState(false);
  const [isEligibleForLaunchPrep, setIsEligibleForLaunchPrep] = useState(false);
  const [checkingLaunchStatus, setCheckingLaunchStatus] = useState(true);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const { shouldShowFeedback, questions, submitFeedback, skipFeedback } = useFeedbackPrompt();
  const { checkEligibility, launchStatus } = useLaunchPreparation();

  // Automatically refresh Gmail tokens in the background (only if Gmail is enabled)
  useGmailTokenRefresh(FEATURES.GMAIL_ENABLED);

  // Track user activity for accurate "Last Active" metrics
  useActivityTracking();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setCheckingOnboarding(false);
        return;
      }

      // Check both metadata and database for team assignment
      const metadataTeamId = user.user_metadata?.team_id;

      // If metadata has team_id, user is onboarded
      if (metadataTeamId) {
        setNeedsOnboarding(false);
        setCheckingOnboarding(false);
        return;
      }

      // Metadata doesn't have team_id, check the database
      // (handles case where trigger assigned team but metadata not yet updated)
      const { data: userData } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', user.id)
        .maybeSingle();

      if (userData?.team_id) {
        console.log('User has team in database, updating metadata');
        // User has team in database but not in metadata - update metadata
        await supabase.auth.updateUser({
          data: {
            team_id: userData.team_id,
            pending_team_setup: false
          }
        });
        setNeedsOnboarding(false);
      } else {
        // User truly needs onboarding
        setNeedsOnboarding(true);
      }

      setCheckingOnboarding(false);
    };

    checkOnboardingStatus();
  }, [user]);

  // Check launch preparation eligibility and status (after onboarding)
  useEffect(() => {
    const checkLaunchPreparation = async () => {
      if (!user || needsOnboarding) {
        setCheckingLaunchStatus(false);
        return;
      }

      try {
        // Check if returning from OAuth callback - force show Launch Prep
        const shouldReturnToLaunchPrep = sessionStorage.getItem('return_to_launch_prep');
        if (shouldReturnToLaunchPrep === 'true') {
          sessionStorage.removeItem('return_to_launch_prep');
          console.log('🚀 [App] Returning to Launch Prep after OAuth');
          setNeedsLaunchPreparation(true);
          setCheckingLaunchStatus(false);
          return;
        }

        // Check if user is eligible for launch preparation
        const eligible = await checkEligibility(user.email || '');
        setIsEligibleForLaunchPrep(eligible);

        if (!eligible) {
          // User not eligible, skip launch preparation
          setNeedsLaunchPreparation(false);
          setCheckingLaunchStatus(false);
          return;
        }

        // User is eligible, check if they've launched
        if (launchStatus?.is_launched) {
          // User already launched, go to main app
          setNeedsLaunchPreparation(false);
        } else {
          // User needs to go through launch preparation
          setNeedsLaunchPreparation(true);
        }
      } catch (err) {
        console.error('Error checking launch preparation status:', err);
        // On error, default to not needing launch prep (fail open)
        setNeedsLaunchPreparation(false);
      } finally {
        setCheckingLaunchStatus(false);
      }
    };

    checkLaunchPreparation();
  }, [user, needsOnboarding, checkEligibility, launchStatus]);

  const handleOnboardingComplete = async () => {
    const { data: { user: refreshedUser } } = await supabase.auth.getUser();
    if (refreshedUser) {
      // Check if user created a team or joined an existing team
      // New users who create teams have role 'admin', invited members have role 'member'
      const { data: userData } = await supabase
        .from('users')
        .select('role, team_id')
        .eq('id', refreshedUser.id)
        .maybeSingle();

      const isTeamCreator = userData?.role === 'admin';

      console.log('🎯 [Onboarding Complete] User role:', userData?.role, 'Is team creator:', isTeamCreator);

      // Check if user is eligible for Launch Preparation
      const eligible = await checkEligibility(refreshedUser.email || '');
      console.log('🚀 [Onboarding Complete] Launch Preparation eligible:', eligible);

      if (eligible) {
        // User is eligible for Launch Preparation
        // Don't redirect, just update state to trigger re-render
        console.log('✅ [Onboarding Complete] User eligible for Launch Prep');
        setNeedsOnboarding(false);
        setIsEligibleForLaunchPrep(true);
        setNeedsLaunchPreparation(true);
        setCheckingLaunchStatus(false);
      } else if (isTeamCreator) {
        // Not eligible for Launch Prep, use old guided setup flow
        console.log('✅ [Onboarding Complete] Redirecting team creator to Guided Setup');
        setNeedsOnboarding(false);
        window.location.href = '/?openGuidedSetup=true';
      } else {
        console.log('✅ [Onboarding Complete] Invited member - skipping Guided Setup');
        setNeedsOnboarding(false);
        // Invited members skip guided setup and just reload the app
        // They will see the Interactive Tour on first login
        window.location.href = '/';
      }
    }
  };

  const handleLaunchComplete = () => {
    // User has launched - trigger Welcome Screen + Tour
    // Store flag so main app knows to show welcome/tour
    sessionStorage.setItem('show_welcome_after_launch', 'true');
    setNeedsLaunchPreparation(false);
    window.location.href = '/';
  };

  if (loading || checkingOnboarding || checkingLaunchStatus) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚀</div>
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading Astra Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* OAuth Callbacks */}
      {FEATURES.GMAIL_ENABLED && (
        <Route path="/auth/gmail/callback" element={<GmailCallback />} />
      )}
      {FEATURES.GOOGLE_DRIVE_SYNC_ENABLED && (
        <Route path="/auth/google-drive/callback" element={<GoogleDriveCallback />} />
      )}

      {/* Admin Dashboard - Protected Route */}
      <Route
        path="/admin"
        element={
          <ProtectedAdminRoute>
            <AdminDashboardPage />
          </ProtectedAdminRoute>
        }
      />

      {/* User Metrics Dashboard - Super Admin Only */}
      <Route
        path="/user-metrics"
        element={
          <ProtectedMetricsRoute>
            <UserMetricsDashboard />
          </ProtectedMetricsRoute>
        }
      />

      {/* Pricing Strategy - Super Admin Only */}
      <Route
        path="/pricing-strategy"
        element={
          <ProtectedMetricsRoute>
            <PricingStrategyPage />
          </ProtectedMetricsRoute>
        }
      />

      {/* MCP Strategy - Super Admin Only */}
      <Route
        path="/mcp-strategy"
        element={
          <ProtectedMetricsRoute>
            <MCPStrategyPage />
          </ProtectedMetricsRoute>
        }
      />

      {/* Build Agents - Protected Route */}
      <Route
        path="/build-agents"
        element={
          user ? (
            <BuildAgentsPage />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Marketing Page - Public Route */}
      <Route path="/marketing" element={<MarketingPage />} />

      {/* Marketing Logo Page - Public Route */}
      <Route path="/marketing-logo" element={<MarketingLogo />} />

      {/* Password Reset Page - Public Route */}
      <Route path="/reset-password" element={<PasswordResetPage />} />

      {/* Legal Pages - Public Routes */}
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />

      {/* Moonshot Challenge - Public Route */}
      <Route path="/moonshot" element={<MoonshotChallengePage />} />

      {/* Main App Routes */}
      <Route
        path="/"
        element={
          !user ? (
            <AuthScreen />
          ) : needsOnboarding ? (
            <OnboardingScreen onComplete={handleOnboardingComplete} />
          ) : needsLaunchPreparation ? (
            <LaunchPreparationFlow onLaunch={handleLaunchComplete} />
          ) : (
            <>
              <VersionChecker />
              <MainContainer onOpenAdminDashboard={() => setShowAdminDashboard(true)} />
              <PWAInstallPrompt />
              {shouldShowFeedback && questions.length > 0 && (
                <FeedbackModal questions={questions} onSubmit={submitFeedback} onSkip={skipFeedback} />
              )}
              {showAdminDashboard && (
                <AdminDashboard isOpen={true} onClose={() => setShowAdminDashboard(false)} />
              )}
            </>
          )
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ReportsProvider>
          <AppContent />
        </ReportsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;