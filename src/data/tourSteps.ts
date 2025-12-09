import { TourStep } from '../components/InteractiveTour';
import { ChatMode } from '../types';

export interface TourNavigation {
  mode?: ChatMode;
  openUserSettings?: boolean;
  closeUserSettings?: boolean;
}

export const memberTourSteps: TourStep[] = [
  {
    id: 'chat-with-astra',
    title: 'Chat with Astra',
    description: 'Ask Astra questions about your data using the message box. Save your favorite prompts so you can quickly use them again.',
    targetSelector: '[data-tour="chat-input"]',
    position: 'top',
    navigation: { mode: 'private' }
  },
  {
    id: 'suggested-prompts',
    title: 'AI Suggested Prompts',
    description: 'Click the sparkle icon to see powerful suggested prompts that help you get the most out of Astra. These prompts are designed to analyze your mission, meetings, financials, and team alignment.',
    targetSelector: '[data-tour="suggested-prompts"]',
    position: 'right',
    navigation: { mode: 'private' }
  },
  {
    id: 'chat-modes',
    title: 'Private or Team Chat',
    description: 'Use Private mode for personal questions that only you can see. Switch to Team mode when you want everyone to collaborate on insights together.',
    targetSelector: '[data-tour="mode-toggle"]',
    position: 'bottom',
    navigation: { mode: 'team' }
  },
  {
    id: 'reports-view',
    title: 'Manage & View Reports',
    description: 'Access the Reports page to view, create, and manage reports. You can set up automated scheduled reports that run daily, weekly, or monthly.',
    targetSelector: '[data-tour="reports-button"]',
    position: 'right',
    navigation: { mode: 'reports' }
  },
  {
    id: 'mission-control',
    title: 'Mission Control - Launch Points',
    description: 'Track your Launch Points and team progress in Mission Control. View your achievements across Fuel (data), Boosters (AI features), and Guidance (team setup) stages. Launch Points never expire and reward you for mastering Astra!',
    targetSelector: '[data-tour="mission-control"]',
    position: 'bottom',
    navigation: { mode: 'private' }
  },
  {
    id: 'sync-your-data',
    title: 'Sync Your Data',
    description: 'Connect your team documents in User Settings to sync Strategy, Meetings or Financial data. This is KEY to Astra delivering ROI.',
    targetSelector: '[data-tour="google-drive-sync"]',
    position: 'top',
    navigation: { mode: 'private', openUserSettings: true }
  },
  {
    id: 'user-settings',
    title: 'Your Profile & Settings',
    description: 'Click here to manage your profile, adjust notification preferences, and access team settings. You can also restart this tour anytime from here!',
    targetSelector: '[data-tour="user-menu"]',
    position: 'bottom',
    navigation: { mode: 'private', openUserSettings: true }
  },
  {
    id: 'start-chatting',
    title: 'Start Chatting with Astra',
    description: 'This is Astra\'s welcome message! Start asking questions about your business, strategy, meetings, or financials. Astra learns from your connected data to provide personalized insights.',
    targetSelector: '[data-tour="astra-welcome-message"]',
    position: 'bottom',
    navigation: { mode: 'private', closeUserSettings: true }
  }
];

export const adminTourSteps: TourStep[] = [
  {
    id: 'chat-with-astra',
    title: 'Chat with Astra',
    description: 'Ask Astra questions about your data using the message box. Save your favorite prompts so you can quickly use them again.',
    targetSelector: '[data-tour="chat-input"]',
    position: 'top',
    navigation: { mode: 'private' }
  },
  {
    id: 'suggested-prompts',
    title: 'AI Suggested Prompts',
    description: 'Click the sparkle icon to see powerful suggested prompts that help you get the most out of Astra. These prompts are designed to analyze your mission, meetings, financials, and team alignment.',
    targetSelector: '[data-tour="suggested-prompts"]',
    position: 'right',
    navigation: { mode: 'private' }
  },
  {
    id: 'chat-modes',
    title: 'Private or Team Chat',
    description: 'Use Private mode for personal questions that only you can see. Switch to Team mode when you want everyone to collaborate on insights together.',
    targetSelector: '[data-tour="mode-toggle"]',
    position: 'bottom',
    navigation: { mode: 'team' }
  },
  {
    id: 'reports-view',
    title: 'Manage & View Reports',
    description: 'Access the Reports page to view, create, and manage reports. You can set up automated scheduled reports that run daily, weekly, or monthly.',
    targetSelector: '[data-tour="reports-button"]',
    position: 'right',
    navigation: { mode: 'reports' }
  },
  {
    id: 'mission-control',
    title: 'Mission Control - Launch Points',
    description: 'Track your Launch Points and team progress in Mission Control. View your achievements across Fuel (data), Boosters (AI features), and Guidance (team setup) stages. Launch Points never expire and reward you for mastering Astra!',
    targetSelector: '[data-tour="mission-control"]',
    position: 'bottom',
    navigation: { mode: 'private' }
  },
  {
    id: 'sync-your-data',
    title: 'Sync Your Data',
    description: 'Connect your team documents in User Settings to sync Strategy, Meetings or Financial data. This is KEY to Astra delivering ROI.',
    targetSelector: '[data-tour="google-drive-sync"]',
    position: 'top',
    navigation: { mode: 'private', openUserSettings: true }
  },
  {
    id: 'team-members',
    title: 'Manage Your Team',
    description: 'View all team members here. As an admin, you can invite new members, manage roles, and remove users from your team.',
    targetSelector: '[data-tour="team-panel"]',
    position: 'left',
    navigation: { mode: 'private', openUserSettings: true }
  },
  {
    id: 'user-settings',
    title: 'Team Settings & Profile',
    description: 'Access team settings to connect Google Drive and manage team-wide preferences. You can also update your personal profile here.',
    targetSelector: '[data-tour="user-menu"]',
    position: 'bottom',
    navigation: { mode: 'private', openUserSettings: true }
  },
  {
    id: 'start-chatting',
    title: 'Start Chatting with Astra',
    description: 'This is Astra\'s welcome message! Start asking questions about your business, strategy, meetings, or financials. Astra learns from your connected data to provide personalized insights.',
    targetSelector: '[data-tour="astra-welcome-message"]',
    position: 'bottom',
    navigation: { mode: 'private', closeUserSettings: true }
  }
];

export function getTourStepsForRole(isAdmin: boolean): TourStep[] {
  return isAdmin ? adminTourSteps : memberTourSteps;
}
