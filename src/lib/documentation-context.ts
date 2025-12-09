// This file contains documentation context for the Help Assistant
// It combines information from various .md files in the project

export const DOCUMENTATION_CONTEXT = `
# Astra Intelligence Documentation

## Google Drive Integration Setup

### Overview
Astra can connect to your team's Google Drive to analyze documents and provide AI insights. Admins can configure which folders to sync for Strategy, Meetings, and Financial documents.

### Astra Guided Setup
When setting up Google Drive integration, admins can choose between:
- **Astra Guided Setup** (Recommended): Step-by-step walkthrough with examples and best practices
- **Manual Setup**: Direct folder selection for advanced users

### Guided Setup Features
- Educational content explaining the value of each data type
- Document examples for Strategy, Meetings, and Financial folders
- Sample prompts showing what you can ask after syncing
- Best practices for folder organization
- Save & Continue Later - resume setup anytime
- Progress tracking throughout the process

### Strategy Documents
Examples: Mission statements, quarterly OKRs, strategic plans, company values, annual planning materials, product strategy
Sample Prompt: "Analyze alignment between our mission and recent team meetings"

### Meeting Notes
Examples: Team meetings, 1-on-1s, sprint retrospectives, executive reviews, planning sessions
Sample Prompt: "Summarize key decisions from this week's meetings"

### Financial Documents
Examples: P&Ls, balance sheets, budget forecasts, expense reports, financial dashboards
Sample Prompt: "Summarize our financials and the alignment to our core values and mission"

## Scheduled Reports

### Overview
Admins can create automated reports that run on a schedule (daily, weekly, or monthly). These reports execute automatically and deliver insights to the team without manual effort.

### Creating Scheduled Reports
1. Navigate to the Reports page
2. Click "Create New Report"
3. Select "Scheduled" as the report type
4. Choose frequency: Daily, Weekly, or Monthly
5. Set the time of day for report generation
6. Enter your report prompt (what you want Astra to analyze)
7. Save the report

### Report Features
- Automatic execution based on schedule
- Results appear in the Reports view
- Team-wide visibility
- Edit or delete reports anytime
- Manual run option for immediate results

## Data Visualizations

### Creating Visualizations
1. During any conversation with Astra, click the "Create Visualizations" button
2. Astra analyzes the conversation and generates relevant charts
3. Click "Retry" to generate different visualization styles
4. Visualizations are private to you, even in Team mode

### Saving Visualizations
- Click "Save" on any visualization to add it to your library
- Access saved visualizations from the sidebar dropdown
- Export as PDF for presentations and sharing
- Organize your favorite insights for quick reference

## Team Collaboration

### Private vs Team Mode
- **Private Mode**: Personal conversations only you can see
- **Team Mode**: Collaborative discussions visible to all team members
- Switch modes using the toggle below the header

### @Mentions
- In Team mode, type @ to mention team members
- Mentioned users receive notifications
- Use @mentions to direct questions or comments to specific people

### Real-Time Sync
- All messages sync in real-time across devices
- See team activity as it happens
- Conversation history preserved for reference

## Admin Features

### Team Management
- Invite new members via email
- Assign admin or member roles
- View team activity and metrics
- Remove team members when needed
- Configure team-wide settings

### Google Drive Management
- Only admins can connect/disconnect Google Drive
- Configure folder selections for the team
- View and manage synced documents
- Delete documents from Astra's index

### Scheduled Reports Management
- Create automated reports for the team
- Set report schedules and frequencies
- Edit or delete scheduled reports
- View all team reports

## User Settings

### Profile Management
- Update your name and profile information
- Manage notification preferences
- Access team settings (admins only)
- Restart the interactive tour

### Notification Preferences
- Control @mention notifications
- Manage system notifications
- Customize your alert settings

## Help & Support

### Getting Help
- **Quick Start Guide**: Overview of key features
- **What's New**: Latest features and improvements
- **FAQ**: Common questions and answers
- **Ask Astra**: AI-powered help assistant

### Interactive Tour
- Comprehensive walkthrough of the platform
- Different tours for admins and members
- Restart anytime from User Settings or Help Center
- Step-by-step feature explanations

## Key Concepts

### Reports
Reports are saved analyses that can be run manually or on a schedule. They help track KPIs, generate summaries, and monitor trends over time.

### Visualizations
AI-generated charts and graphs that make data easier to understand. Created from conversations and can be saved for future reference.

### Document Sync
The process of connecting Google Drive folders so Astra can analyze your team's documents and provide contextual insights.

### Team Collaboration
Working together in Team mode with @mentions, real-time sync, and shared conversations to leverage collective knowledge.
`;
