import { supabase } from './supabase';

export interface SyncedDataContext {
  hasMeetings: boolean;
  hasStrategy: boolean;
  hasFinancial: boolean;
}

export interface SetupGuideProgress {
  id?: string;
  user_id: string;
  step_1_onboarding_completed: boolean;
  step_2_google_drive_connected: boolean;
  step_3_folder_selected_or_created: boolean;
  step_4_files_placed_in_folder: boolean;
  step_5_data_synced: boolean;
  step_6_team_settings_configured: boolean;
  step_7_first_prompt_sent: boolean;
  step_8_visualization_created: boolean;
  step_9_manual_report_run: boolean;
  step_10_scheduled_report_created: boolean;
  step_11_team_members_invited: boolean;
  created_folder_type?: string | null;
  created_folder_id?: string | null;
  selected_folder_path?: string | null;
  current_step: number;
  is_completed: boolean;
  is_skipped: boolean;
  started_at?: string;
  completed_at?: string | null;
  last_updated_at?: string;
}

/**
 * Get user's synced data context - which folder types have documents
 */
export const getUserDataContext = async (teamId: string): Promise<SyncedDataContext> => {
  const { data, error } = await supabase
    .from('documents')
    .select('folder_type')
    .eq('team_id', teamId)
    .not('folder_type', 'is', null);

  if (error) {
    console.error('Error fetching data context:', error);
    return { hasMeetings: false, hasStrategy: false, hasFinancial: false };
  }

  const types = new Set(data?.map(d => d.folder_type) || []);

  return {
    hasMeetings: types.has('meetings'),
    hasStrategy: types.has('strategy'),
    hasFinancial: types.has('financial')
  };
};

/**
 * Get context-aware prompts based on user's synced data
 */
export const getContextAwarePrompts = (context: SyncedDataContext): string[] => {
  const prompts: string[] = [];

  // Meetings-only prompts
  if (context.hasMeetings && !context.hasStrategy && !context.hasFinancial) {
    prompts.push(
      "Summarize our most recent meeting with key action items",
      "What topics have we discussed most frequently in recent meetings?",
      "List all pending action items from our last 3 meetings",
      "Show me attendance trends across different meeting types",
      "What decisions were made in our recent leadership meetings?"
    );
  }

  // Strategy-only prompts
  else if (context.hasStrategy && !context.hasMeetings && !context.hasFinancial) {
    prompts.push(
      "What are our top 3 strategic priorities based on our documents?",
      "Summarize our mission, vision, and core values",
      "What goals and OKRs have we defined in our strategy docs?",
      "What are the key initiatives we're focused on?",
      "Identify potential risks mentioned in our strategic planning"
    );
  }

  // Financial-only prompts
  else if (context.hasFinancial && !context.hasMeetings && !context.hasStrategy) {
    prompts.push(
      "Analyze our burn rate and cash runway",
      "Summarize our revenue and expense trends",
      "What are our biggest expense categories?",
      "Show me month-over-month financial performance",
      "What's our current financial health?"
    );
  }

  // Meetings + Strategy
  else if (context.hasMeetings && context.hasStrategy && !context.hasFinancial) {
    prompts.push(
      "How well are our recent meetings aligned with our strategic priorities?",
      "What strategic initiatives have we discussed in meetings?",
      "Which strategic goals have the most action items assigned?",
      "Are we spending meeting time on the right priorities?",
      "What strategic decisions need to be made based on recent discussions?"
    );
  }

  // Meetings + Financial
  else if (context.hasMeetings && context.hasFinancial && !context.hasStrategy) {
    prompts.push(
      "What financial topics were discussed in our recent meetings?",
      "How are our actual expenses tracking against budget discussions?",
      "What financial decisions were made in our last leadership meeting?",
      "Are meeting discussions aligned with our financial reality?",
      "What budget adjustments have been discussed recently?"
    );
  }

  // Strategy + Financial
  else if (context.hasStrategy && context.hasFinancial && !context.hasMeetings) {
    prompts.push(
      "How is our spending aligned with our strategic priorities?",
      "Are we investing appropriately in our top strategic initiatives?",
      "What's our financial capacity to pursue new strategic opportunities?",
      "Which strategic priorities are underfunded?",
      "Analyze ROI on our strategic investments"
    );
  }

  // All three data types
  else if (context.hasMeetings && context.hasStrategy && context.hasFinancial) {
    prompts.push(
      "Provide a comprehensive business overview: strategy, execution, and finances",
      "How well are we executing our strategy based on meetings and spending?",
      "What strategic adjustments should we consider based on our financial position?",
      "Generate an executive summary of our business health",
      "Where should we focus our resources for maximum strategic impact?"
    );
  }

  // Generic fallback (should rarely happen)
  else {
    prompts.push(
      "Tell me about the data you have access to",
      "Summarize the key information in my connected documents",
      "What insights can you provide from my data?",
      "Help me understand what I can ask you",
      "What kind of analysis can you perform?"
    );
  }

  return prompts.slice(0, 5); // Return max 5 prompts
};

/**
 * Sample prompts to show while data is syncing
 */
export const getSamplePrompts = (): string[] => {
  return [
    "📊 Generate a summary of our last leadership meeting with action items",
    "🎯 What are the top 3 strategic priorities from our recent strategy documents?",
    "💰 Analyze our burn rate and cash runway based on latest financials",
    "📈 Show me attendance trends across all meeting types over the last 60 days",
    "🔍 What customer pain points were discussed in our recent sales calls?",
    "📅 List all upcoming deadlines mentioned in meetings this month",
    "💡 What innovative ideas have we discussed in our strategy sessions?",
    "👥 Who are the key stakeholders mentioned most frequently in our docs?",
    "⚠️ What risks or challenges have we identified in our planning documents?",
    "📊 Create a visualization comparing Q3 vs Q4 financial performance",
    "🎯 What progress have we made on our OKRs based on meeting documents?",
    "🔄 Which action items from past meetings are still pending?",
    "💬 Summarize feedback from our latest customer meetings",
    "📈 What trends do you see in our team velocity over the past quarter?",
    "🚀 What opportunities should we prioritize based on our data?"
  ];
};

/**
 * Check if data sync has completed
 */
export const checkSyncCompletion = async (teamId: string, startTime: Date): Promise<boolean> => {
  const { data, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .gte('created_at', startTime.toISOString());

  if (error) {
    console.error('Error checking sync completion:', error);
    return false;
  }

  return (data?.length ?? 0) > 0;
};

/**
 * Trigger the data sync webhook
 */
export const triggerDataSync = async (): Promise<boolean> => {
  try {
    const response = await fetch(
      'https://healthrocket.app.n8n.cloud/webhook/21473ebb-405d-4be1-ab71-6bf2a2d4063b',
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error('Failed to trigger data sync');
    }

    const result = await response.json();
    console.log('Data sync triggered:', result);

    return true;
  } catch (error) {
    console.error('Error triggering sync:', error);
    return false;
  }
};

/**
 * Get or create setup guide progress for user
 */
export const getSetupGuideProgress = async (userId: string): Promise<SetupGuideProgress | null> => {
  const { data, error } = await supabase
    .from('setup_guide_progress')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching setup guide progress:', error);
    return null;
  }

  return data;
};

/**
 * Create initial setup guide progress
 */
export const createSetupGuideProgress = async (userId: string): Promise<SetupGuideProgress | null> => {
  const { data, error } = await supabase
    .from('setup_guide_progress')
    .insert({
      user_id: userId,
      current_step: 1,
      is_completed: false,
      is_skipped: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating setup guide progress:', error);
    return null;
  }

  return data;
};

/**
 * Update setup guide progress
 */
export const updateSetupGuideProgress = async (
  userId: string,
  updates: Partial<SetupGuideProgress>
): Promise<boolean> => {
  const { error } = await supabase
    .from('setup_guide_progress')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating setup guide progress:', error);
    return false;
  }

  return true;
};

/**
 * Mark a specific step as complete
 */
export const markStepComplete = async (
  userId: string,
  stepNumber: number,
  additionalUpdates?: Partial<SetupGuideProgress>
): Promise<boolean> => {
  const stepField = `step_${stepNumber}_${getStepName(stepNumber)}` as keyof SetupGuideProgress;

  const updates: Partial<SetupGuideProgress> = {
    [stepField]: true,
    current_step: stepNumber + 1,
    ...additionalUpdates
  };

  return updateSetupGuideProgress(userId, updates);
};

/**
 * Get step name from number
 */
const getStepName = (stepNumber: number): string => {
  const stepNames: Record<number, string> = {
    1: 'onboarding_completed',
    2: 'google_drive_connected',
    3: 'folder_selected_or_created',
    4: 'files_placed_in_folder',
    5: 'data_synced',
    6: 'team_settings_configured',
    7: 'first_prompt_sent',
    8: 'visualization_created',
    9: 'manual_report_run',
    10: 'scheduled_report_created',
    11: 'team_members_invited'
  };

  return stepNames[stepNumber] || '';
};

/**
 * Check if step is already completed (for auto-detection)
 */
export const detectStepCompletion = async (
  userId: string,
  teamId: string,
  stepNumber: number
): Promise<boolean> => {
  switch (stepNumber) {
    case 1: // Onboarding
      const { data: feedbackStatus } = await supabase
        .from('user_feedback_status')
        .select('onboarded_at')
        .eq('user_id', userId)
        .maybeSingle();
      return !!feedbackStatus?.onboarded_at;

    case 2: // Google Drive connected
      const { data: driveConnection } = await supabase
        .from('user_drive_connections')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();
      return driveConnection?.is_active === true;

    case 3: // Folder selected
      const { data: folders } = await supabase
        .from('user_drive_connections')
        .select('selected_meetings_folder_ids, selected_strategy_folder_ids, selected_financial_folder_ids')
        .eq('user_id', userId)
        .maybeSingle();
      return !!(
        (folders?.selected_meetings_folder_ids && folders.selected_meetings_folder_ids.length > 0) ||
        (folders?.selected_strategy_folder_ids && folders.selected_strategy_folder_ids.length > 0) ||
        (folders?.selected_financial_folder_ids && folders.selected_financial_folder_ids.length > 0)
      );

    case 5: // Data synced
      const { data: docs } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId);
      return (docs?.length ?? 0) > 0;

    case 6: // Team settings configured
      const { data: teamSettings } = await supabase
        .from('team_settings')
        .select('team_id')
        .eq('team_id', teamId)
        .maybeSingle();
      return !!teamSettings;

    case 7: // First prompt sent
      const { data: messages } = await supabase
        .from('astra_chats')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('message_type', 'user');
      return (messages?.length ?? 0) > 0;

    case 8: // Visualization created
      const { data: viz } = await supabase
        .from('astra_chats')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('visualization', true);
      return (viz?.length ?? 0) > 0;

    case 9: // Manual report run
      const { data: reports } = await supabase
        .from('astra_chats')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('mode', 'reports');
      return (reports?.length ?? 0) > 0;

    case 10: // Scheduled report created
      const { data: scheduledReports } = await supabase
        .from('astra_reports')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('schedule_type', 'scheduled')
        .eq('is_active', true);
      return (scheduledReports?.length ?? 0) > 0;

    case 11: // Team members invited
      const { data: invites } = await supabase
        .from('invite_codes')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', userId);
      return (invites?.length ?? 0) > 0;

    default:
      return false;
  }
};
