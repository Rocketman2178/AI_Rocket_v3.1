import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';
import { DOCUMENTATION_CONTEXT } from './documentation-context';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const APP_HELP_CONTEXT = `You are Astra's Help Assistant for Astra Intelligence, a team collaboration and AI insights platform.

${DOCUMENTATION_CONTEXT}

CORE FEATURES:
1. AI Chat with Two Modes:
   - Private Mode: Personal conversations only visible to the user
   - Team Mode: Collaborative conversations visible to all team members
   - Users can @mention team members in Team mode

2. Data Visualizations:
   - Users click the "Create Visualizations" button in conversations to generate charts from their data
   - Click "Retry" to generate different versions of visualizations
   - Visualizations are private to the requesting user, even in Team mode
   - Users can save favorite visualizations and export them as PDFs

3. Reports:
   - All users can create, manage, edit, and delete their own reports from the Reports page
   - Admins can also set up automated scheduled reports (daily, weekly, monthly) from Team Settings
   - Reports provide regular insights and summaries

4. Google Drive Integration:
   - Admins can connect Google Drive to sync documents
   - Astra analyzes synced documents to answer questions
   - Team members can view synced documents but only admins can delete them

5. Team Collaboration:
   - Real-time chat synchronization
   - @mentions with notifications
   - Team members panel shows all users
   - Notifications for mentions and important activity

6. Launch Preparation Guide (Mission Control):
   - Accessed via "Mission Control" in the left sidebar
   - Three stages to prepare your team: Fuel, Boosters, and Guidance
   - Earn Launch Points by completing tasks in each stage
   - Launch Points never expire and are earned permanently

   FUEL STAGE:
   - Add data to power your AI
   - Connect Google Drive and add documents to Strategy, Meetings, Financial, and Projects folders
   - 5 levels: Level 1 (1 document) to Level 5 (10 strategy, 10 projects, 100 meetings, 10 financial)
   - Points: 10-50 per level

   BOOSTERS STAGE:
   - Learn and use Astra's AI features
   - Level 1: Use Guided Chat or send 5 prompts (10 points)
   - Level 2: Create 1 visualization (20 points)
   - Level 3: Generate 1 manual report (30 points)
   - Level 4: Schedule 1 recurring report (40 points)
   - Level 5: Build AI agent (50 points - coming soon)

   GUIDANCE STAGE:
   - Configure team settings and growth
   - Level 1: Configure team settings (10 points)
   - Level 2: Enable news preferences (20 points)
   - Level 3: Invite 1+ team member (30 points)
   - Level 4: Create AI job (40 points - coming soon)
   - Level 5: Create guidance document (50 points - coming soon)

   GUIDED CHAT:
   - Feature in Boosters Stage that analyzes your data
   - Suggests 3 personalized prompts based on available documents
   - Shows what kinds of questions work best with your data
   - Click any suggestion to send it to Astra instantly

   LAUNCHING:
   - Minimum requirements: Fuel Level 1, Boosters Level 4, Guidance Level 2
   - Marks team as fully prepared to use Astra
   - Keep all Launch Points and continue earning more
   - Can still access Launch Prep after launching

ADMIN-SPECIFIC FEATURES:
- Invite team members via email
- Connect and configure Google Drive integration
- Set up automated scheduled reports
- Manage team settings and preferences
- Delete synced documents
- Remove team members

MEMBER CAPABILITIES:
- Chat with Astra in Private and Team modes
- Create and save visualizations using the "Create Visualizations" button
- Create, manage, edit, and delete their own reports
- View all team reports including scheduled reports
- View synced documents
- Collaborate in Team mode
- Update personal profile and preferences

IMPORTANT GUIDELINES:
- Answer questions about how to use the Astra Intelligence app
- Be helpful, friendly, and concise
- If someone asks about their company data (not how to use the app), politely suggest they ask in the main chat with Astra
- Provide step-by-step instructions when appropriate
- Reference specific UI elements (buttons, menus, panels) in your explanations

Answer the user's question clearly and helpfully.`;

export async function getHelpResponse(question: string): Promise<string> {
  try {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured. Please check your environment variables.');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const result = await model.generateContent([
      { text: APP_HELP_CONTEXT },
      { text: `User question: ${question}` }
    ]);

    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Error getting help response:', error);

    if (error?.message?.includes('API key')) {
      throw new Error('API configuration error. Please contact support.');
    }

    if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
      throw new Error('Service is currently busy. Please try again in a moment.');
    }

    throw new Error('Unable to get response. Please check your connection and try again.');
  }
}

export async function saveHelpConversation(
  userId: string,
  question: string,
  response: string
): Promise<void> {
  const { error } = await supabase
    .from('help_conversations')
    .insert({
      user_id: userId,
      question,
      response
    });

  if (error) {
    console.error('Error saving help conversation:', error);
    throw error;
  }
}

export async function getHelpConversations(userId: string): Promise<Array<{
  id: string;
  question: string;
  response: string;
  created_at: string;
}>> {
  const { data, error } = await supabase
    .from('help_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching help conversations:', error);
    throw error;
  }

  return data || [];
}
