import React, { useState } from 'react';
import { ChevronRight, Rocket, MessageSquare, BarChart3, Calendar, FileText, Users, Sparkles, Mail, Building2, Zap, Settings, BookOpen, TrendingUp, Globe, Bell, Brain, RefreshCw, Lock, Bot, UserCircle } from 'lucide-react';
import { LaunchPreparationHeader } from './LaunchPreparationHeader';

interface LaunchOnboardingScreensProps {
  onComplete: () => void;
  onClose: () => void;
  userName?: string;
  isLegacyUser?: boolean;
}

const onboardingScreens = [
  {
    id: 'welcome',
    title: 'Welcome to',
    subtitle: 'AI that Works for Work',
    icon: Rocket,
    content: (
      <div className="space-y-6 text-center">
        {/* Logo and Title - Matching header style */}
        <div className="flex items-center justify-center space-x-3 mb-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-400 shadow-lg">
            <span className="text-3xl">🚀</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-blue-400">AI Rocket</span>
            <span className="text-white font-normal">+</span>
            <span className="text-emerald-400">Astra Intelligence</span>
          </h1>
        </div>

        {/* Tagline */}
        <div className="space-y-3">
          <h2 className="text-xl md:text-2xl font-bold text-white">
            AI that Works for Work
          </h2>
          <div className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30">
            <p className="text-lg text-white">
              <span className="font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Astra</span> is your Guide to an AI-Powered Business
            </p>
          </div>
        </div>

        <p className="text-gray-300 text-base max-w-2xl mx-auto">
          Let's take a quick tour of what you can do once you launch your AI Rocket
        </p>
      </div>
    )
  },
  {
    id: 'features-1',
    title: 'Core Features',
    subtitle: 'Everything you need to work smarter',
    icon: Brain,
    content: (
      <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-orange-500/50 transition-all">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="text-lg font-bold text-white">All Your Data Connected</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Connect Documents, Financials, and more. AI analyzes all your data for comprehensive insights.
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition-all">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Smart Visualizations</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Turn conversations into actionable insights with AI-generated charts, graphs, and visual reports.
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-blue-500/50 transition-all">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Private AI Assistant</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Have confidential conversations with AI that understands your business context and provides personalized insights.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'features-2',
    title: 'Collaboration & Security',
    subtitle: 'Work together, stay secure',
    icon: Users,
    content: (
      <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-emerald-500/50 transition-all">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Team Collaboration</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Work together with your team and AI in shared conversations. @mention team members and AI for instant insights.
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-yellow-500/50 transition-all">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Automated Reports</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Schedule automated reports delivered to your inbox. Stay informed with daily, weekly, or monthly insights.
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-cyan-500/50 transition-all">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Secure & Private</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Your data is encrypted and secure. Control who sees what with team-based permissions and private conversations.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'features-3',
    title: 'Coming Soon - Advanced AI',
    subtitle: 'Powerful capabilities on the horizon',
    icon: Bot,
    content: (
      <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-pink-500/50 transition-all relative">
          <div className="absolute top-3 right-3 px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-xs font-semibold text-blue-400">
            Coming Soon
          </div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-pink-500/10 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Agent Builder</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Design and deploy custom AI Agents to complete tasks autonomously.
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-indigo-500/50 transition-all relative">
          <div className="absolute top-3 right-3 px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-xs font-semibold text-blue-400">
            Coming Soon
          </div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <Mail className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Email Control</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Allow Astra to understand, analyze and manage your incoming and outgoing emails.
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-teal-500/50 transition-all relative">
          <div className="absolute top-3 right-3 px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-xs font-semibold text-blue-400">
            Coming Soon
          </div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-teal-500/10 rounded-lg flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="text-lg font-bold text-white">AI Job Roles</h3>
          </div>
          <p className="text-gray-300 text-sm">
            Create roles such as Business Coach, Finance Director, Marketing Manager and more.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'launch-prep',
    title: 'Ready to Launch?',
    subtitle: 'Let\'s prepare your AI Rocket for takeoff',
    icon: Sparkles,
    content: (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-2xl font-bold text-white mb-4 text-center">
            Launch Preparation System
          </h3>
          <p className="text-gray-300 text-center mb-6">
            Before you can unlock all these powerful features, we need to set up three key systems:
          </p>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Fuel - Connect Your Data</h4>
                <p className="text-gray-400 text-sm">
                  Link your Google Drive folders so Astra can access your documents and emails
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Boosters - Enable Features</h4>
                <p className="text-gray-400 text-sm">
                  Set up reports, team settings, and other features to power your workflow
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Rocket className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Guidance - Set Mission Parameters</h4>
                <p className="text-gray-400 text-sm">
                  Configure your preferences and customize how Astra works for you
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-gray-400 text-sm text-center">
          Don't worry - you can complete these at your own pace. Each step earns you Launch Points!
        </p>
      </div>
    ),
    ctaText: 'Initiate Launch Preparation',
    ctaAction: true
  }
];

export const LaunchOnboardingScreens: React.FC<LaunchOnboardingScreensProps> = ({
  onComplete,
  onClose,
  userName,
  isLegacyUser = false
}) => {
  const [currentScreen, setCurrentScreen] = useState(0);

  const handleNext = () => {
    if (currentScreen < onboardingScreens.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const screen = onboardingScreens[currentScreen];
  const ScreenIcon = screen.icon;
  const isLastScreen = currentScreen === onboardingScreens.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <LaunchPreparationHeader onClose={onClose} />

      <div className="pt-16 px-4 pb-4 h-screen overflow-y-auto flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center max-w-6xl mx-auto w-full py-8">
          {/* Page Title - Only on first screen */}
          {currentScreen === 0 && (
            <div className="text-center mb-6">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-1">
                Mission Control
              </h2>
              <p className="text-gray-400 text-base md:text-lg">
                Welcome aboard!
              </p>
            </div>
          )}

          {/* Screen Icon - Skip on welcome screen */}
          {currentScreen !== 0 && (
            <div className="mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
                <ScreenIcon className="w-10 h-10 text-white" />
              </div>
            </div>
          )}

          {/* Screen Title - Skip on welcome screen */}
          {currentScreen !== 0 && (
            <div className="text-center mb-8 max-w-3xl">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {screen.title}
              </h1>
              <p className="text-gray-400 text-base md:text-lg">
                {screen.subtitle}
              </p>
            </div>
          )}

          {/* Legacy User Message - Only on first screen */}
          {currentScreen === 0 && isLegacyUser && (
            <div className="w-full max-w-3xl mx-auto mb-6">
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2">Welcome Back!</h3>
                    <p className="text-gray-300 text-sm mb-3">
                      We've upgraded your experience with our new <span className="font-semibold text-amber-400">Launch Preparation System</span>. This is a one-time setup guide that will help you:
                    </p>
                    <ul className="space-y-1 text-gray-300 text-sm ml-4">
                      <li className="flex items-start">
                        <span className="text-amber-400 mr-2">•</span>
                        <span>Earn <span className="font-semibold text-amber-400">Launch Points</span> for actions you complete</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-400 mr-2">•</span>
                        <span>Unlock <span className="font-semibold text-amber-400">Mission Control</span> to track your progress</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-400 mr-2">•</span>
                        <span>Get credit for features you've already set up</span>
                      </li>
                    </ul>
                    <p className="text-gray-400 text-xs mt-3 italic">
                      This replaces the previous onboarding flow with a gamified experience.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Screen Content */}
          <div className="w-full mb-8">
            {screen.content}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between w-full max-w-2xl mt-8">
            {/* Progress Dots */}
            <div className="flex items-center space-x-2">
              {onboardingScreens.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentScreen(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentScreen
                      ? 'w-8 bg-gradient-to-r from-blue-500 to-purple-600'
                      : 'w-2 bg-gray-600 hover:bg-gray-500'
                  }`}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleNext}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <span>{screen.ctaText || 'Continue'}</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
