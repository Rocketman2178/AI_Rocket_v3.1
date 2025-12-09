export interface FAQItem {
  question: string;
  answer: string;
  category: 'getting-started' | 'chat-modes' | 'visualizations' | 'team' | 'integrations' | 'reports' | 'admin' | 'launch-prep';
}

export const helpFAQ: FAQItem[] = [
  {
    category: 'getting-started',
    question: 'What is Astra Intelligence?',
    answer: 'Astra Intelligence is your AI assistant connected to all your team\'s data. Ask questions, get insights, create visualizations, and collaborate with your team - all powered by AI that understands your company\'s information.'
  },
  {
    category: 'getting-started',
    question: 'How do I ask Astra a question?',
    answer: 'Simply type your question in the chat input at the bottom of the screen and press Enter or click Send. Astra will analyze your data and provide insights based on your question.'
  },
  {
    category: 'getting-started',
    question: 'What kind of questions can I ask?',
    answer: 'You can ask about your company data, search through documents, analyze trends, or get summaries. Try questions like "What are our top priorities?" or "Show me email trends from last month". You can also create visualizations using the "Create Visualizations" button.'
  },
  {
    category: 'chat-modes',
    question: 'What\'s the difference between Private and Team chat?',
    answer: 'Private mode is just for you - your questions and Astra\'s responses are only visible to you. Team mode is collaborative - everyone on your team can see the conversation and contribute.'
  },
  {
    category: 'chat-modes',
    question: 'When should I use Team mode?',
    answer: 'Use Team mode when you want to collaborate with your team on insights, share discoveries, or have group discussions with AI assistance. It\'s great for team meetings, brainstorming, or sharing important findings.'
  },
  {
    category: 'chat-modes',
    question: 'Can I switch between Private and Team mode?',
    answer: 'Yes! Click the "Private" or "Team" button at the top of the chat to switch modes. Each mode has its own conversation history that stays separate.'
  },
  {
    category: 'visualizations',
    question: 'How do I create a visualization?',
    answer: 'After asking Astra a question, click the "Create Visualizations" button that appears in the conversation. Astra will generate interactive charts and visualizations based on your data. If you want a different version, simply click "Retry".'
  },
  {
    category: 'visualizations',
    question: 'Who can see my visualizations?',
    answer: 'Only you can see visualizations you create. Even in Team mode, visualizations are private to the person who requested them. You can export them as PDFs to share with others.'
  },
  {
    category: 'visualizations',
    question: 'Can I save visualizations?',
    answer: 'Yes! When viewing a visualization, click the bookmark icon to save it. Your saved visualizations appear in your sidebar for easy access later.'
  },
  {
    category: 'visualizations',
    question: 'How do I export a visualization?',
    answer: 'Open any visualization and click the "Export as PDF" button. This creates a downloadable PDF that you can share or keep for your records.'
  },
  {
    category: 'team',
    question: 'How do I mention someone in Team chat?',
    answer: 'Type @ followed by their name in Team mode. You\'ll see a list of team members to choose from. Mentioned users will receive a notification.'
  },
  {
    category: 'team',
    question: 'How do notifications work?',
    answer: 'You\'ll receive notifications when someone mentions you in Team chat or when there\'s important team activity. Click the bell icon in the header to view your notifications.'
  },
  {
    category: 'team',
    question: 'Can I see who\'s on my team?',
    answer: 'Yes! Click your profile picture or the team icon in the header to see all team members. You can view their roles and contact information there.'
  },
  {
    category: 'reports',
    question: 'What are Reports?',
    answer: 'Reports are a dedicated space where you can create, view, and manage your own custom reports, as well as view scheduled reports. They provide summaries and analyses of your team\'s data.'
  },
  {
    category: 'reports',
    question: 'How do I access Reports?',
    answer: 'Click the "Reports" button in the left sidebar to view all available reports. You can filter by date and view detailed insights for each report.'
  },
  {
    category: 'reports',
    question: 'Can I create my own reports?',
    answer: 'Yes! All team members can create, manage, edit, and delete their own reports from the Reports page. You can create custom reports that run manually or on a schedule (daily, weekly, or monthly).'
  },
  {
    category: 'reports',
    question: 'What are Team Reports?',
    answer: 'Team Reports are reports created by admins that are automatically delivered to all team members. When you receive a Team Report, you\'ll see it with an orange "Team Report" badge showing who created it. Each team member gets their own copy in their Reports view.'
  },
  {
    category: 'integrations',
    question: 'What is Google Drive integration?',
    answer: 'Google Drive integration allows Astra to access and analyze your team\'s Google Drive documents. Once connected, you can ask questions about your docs, sheets, and slides.'
  },
  {
    category: 'integrations',
    question: 'Is my Google Drive data secure?',
    answer: 'Yes! We only access files you grant permission to, and all data is encrypted. Your documents are processed securely and stored safely in your team\'s private database.'
  },
  {
    category: 'integrations',
    question: 'Can I disconnect Google Drive?',
    answer: 'Yes, admins can disconnect Google Drive at any time from Team Settings. This will stop syncing new documents, but previously synced data will remain available to your team.'
  },
  {
    category: 'admin',
    question: 'How do I invite team members?',
    answer: 'As an admin, click on the Team Members section and then click "Invite Member". Enter their email address and they\'ll receive an invitation to join your team.'
  },
  {
    category: 'admin',
    question: 'What\'s the difference between Admin and Member roles?',
    answer: 'Admins can invite team members, manage team settings, connect integrations, delete documents, and create Team Reports that are delivered to all members. Members can chat with Astra, create visualizations, create and manage their own personal reports, and view team data.'
  },
  {
    category: 'admin',
    question: 'How do I create Team Reports?',
    answer: 'As an admin, go to the Reports page and click "New Report". Configure your report (manual or scheduled), then check the "Team Report" checkbox before saving. Team Reports will be delivered to all team members, and each member will see it marked with a "Team Report" badge in their Reports view.'
  },
  {
    category: 'admin',
    question: 'What\'s the difference between personal and Team Reports?',
    answer: 'Personal reports are only visible to the person who creates them. Team Reports, created by admins, are automatically delivered to every team member - each person gets their own copy with a special "Team Report" badge showing which admin created it.'
  },
  {
    category: 'admin',
    question: 'How do I connect Google Drive?',
    answer: 'Go to Team Settings, find the Google Drive section, and click "Connect Google Drive". You\'ll be taken to Google to authorize access, then you can select which folders to sync.'
  },
  {
    category: 'admin',
    question: 'Can I remove team members?',
    answer: 'Yes, admins can remove team members from the Team Members panel. Click the menu next to a member\'s name and select "Remove from Team". Their access will be revoked immediately.'
  },
  {
    category: 'launch-prep',
    question: 'What is the Launch Preparation Guide?',
    answer: 'The Launch Preparation Guide helps you get your team fully set up with Astra through three stages: Fuel (add your data), Boosters (use AI features), and Guidance (configure your team). Complete tasks to earn Launch Points and unlock the full potential of Astra Intelligence.'
  },
  {
    category: 'launch-prep',
    question: 'What are Launch Points?',
    answer: 'Launch Points are earned by completing tasks in the Launch Preparation Guide. Each achievement awards points - from 10 points for basic tasks to 50+ points for advanced features. You earn points for adding documents, creating visualizations, setting up reports, and configuring your team.'
  },
  {
    category: 'launch-prep',
    question: 'How do I earn Launch Points?',
    answer: 'Earn points by progressing through the three stages: Fuel Stage (add documents to your Google Drive folders), Boosters Stage (use Guided Chat, create visualizations, generate reports), and Guidance Stage (configure team settings, enable news preferences, invite team members).'
  },
  {
    category: 'launch-prep',
    question: 'What is the Fuel Stage?',
    answer: 'The Fuel Stage is about adding data to power your AI. Connect your Google Drive and add documents to your Strategy, Meetings, Financial, and Projects folders. Progress through 5 levels by adding more documents - Level 1 needs just 1 document, while Level 5 requires a comprehensive data collection.'
  },
  {
    category: 'launch-prep',
    question: 'What is the Boosters Stage?',
    answer: 'The Boosters Stage helps you learn Astra\'s AI features. Progress through 5 levels: use Guided Chat or send prompts (Level 1), create visualizations (Level 2), generate manual reports (Level 3), schedule recurring reports (Level 4), and build AI agents (Level 5 - coming soon).'
  },
  {
    category: 'launch-prep',
    question: 'What is the Guidance Stage?',
    answer: 'The Guidance Stage is about team configuration and growth. Complete 5 levels: configure team settings (Level 1), enable news preferences (Level 2), invite team members (Level 3), create AI jobs (Level 4 - coming soon), and document processes (Level 5 - coming soon).'
  },
  {
    category: 'launch-prep',
    question: 'What is Guided Chat?',
    answer: 'Guided Chat is a feature in the Boosters Stage that analyzes your available data and suggests 3 personalized prompts. It helps you get started with Astra by showing you what kinds of questions work best with your specific data. Click any suggestion to send it to Astra and see instant results.'
  },
  {
    category: 'launch-prep',
    question: 'When can I launch?',
    answer: 'You can launch when you reach minimum requirements: Fuel Stage Level 1 (at least 1 document), Boosters Stage Level 4 (scheduled reports set up), and Guidance Stage Level 2 (news preferences enabled). This ensures you have data, know how to use key features, and have your team configured.'
  },
  {
    category: 'launch-prep',
    question: 'What happens when I launch?',
    answer: 'Launching marks your team as fully prepared to use Astra Intelligence. You\'ll keep all your Launch Points, maintain access to all features, and can continue earning points through daily activity. The Launch Prep Guide remains accessible for reference and adding team members.'
  },
  {
    category: 'launch-prep',
    question: 'Can I go back to previous stages?',
    answer: 'Yes! You can navigate between Fuel, Boosters, and Guidance stages at any time by clicking on them in Mission Control. Your progress is saved, and you can complete tasks in any order that works best for your team.'
  },
  {
    category: 'launch-prep',
    question: 'Do Launch Points expire?',
    answer: 'No, Launch Points never expire. Once earned, they stay on your account permanently. You can continue earning additional points through daily activity and team achievements even after launching.'
  },
  {
    category: 'launch-prep',
    question: 'How do I access the Launch Preparation Guide?',
    answer: 'Click on "Mission Control" in the left sidebar to open the Launch Preparation Guide. From there, you can see your total Launch Points, current progress in each stage, and tap any stage to enter and complete tasks.'
  }
];

export const faqCategories = {
  'getting-started': {
    title: '🚀 Getting Started',
    description: 'Learn the basics of using Astra'
  },
  'launch-prep': {
    title: '🎯 Launch Preparation',
    description: 'Mission Control and Launch Points guide'
  },
  'chat-modes': {
    title: '💬 Chat Modes',
    description: 'Understanding Private and Team chat'
  },
  'visualizations': {
    title: '📊 Visualizations',
    description: 'Creating and managing data visualizations'
  },
  'team': {
    title: '👥 Team Collaboration',
    description: 'Working with your team in Astra'
  },
  'reports': {
    title: '📈 Reports',
    description: 'Viewing and understanding reports'
  },
  'integrations': {
    title: '🔗 Integrations',
    description: 'Connecting Google Drive and other services'
  },
  'admin': {
    title: '⚙️ Admin Features',
    description: 'Managing your team and settings'
  }
} as const;
