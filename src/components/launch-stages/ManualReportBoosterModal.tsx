import React, { useState, useEffect } from 'react';
import { X, FileBarChart, Loader, Check, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LoadingCarousel } from '../setup-steps/LoadingCarousel';
import { VisualizationView } from '../VisualizationView';
import { useVisualization } from '../../hooks/useVisualization';

interface ManualReportBoosterModalProps {
  onClose: () => void;
  onComplete: () => void;
}

interface ReportSuggestion {
  title: string;
  prompt: string;
  description: string;
}

type ModalState = 'analyzing' | 'suggestions' | 'generating' | 'viewing' | 'complete';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const ManualReportBoosterModal: React.FC<ManualReportBoosterModalProps> = ({ onClose, onComplete }) => {
  const { user } = useAuth();
  const { generateVisualization } = useVisualization();

  const [state, setState] = useState<ModalState>('analyzing');
  const [suggestions, setSuggestions] = useState<ReportSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ReportSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<{ messageId: string; content: string; visualizationHtml: string } | null>(null);

  // Analyze user data and generate suggestions on mount
  useEffect(() => {
    generateSuggestions();
  }, []);

  const generateSuggestions = async () => {
    try {
      setState('analyzing');
      setError(null);

      // Get team ID from user metadata
      const teamId = user?.user_metadata?.team_id;
      if (!teamId) {
        throw new Error('Team not found');
      }

      // Analyze user's available data
      const [strategyDocs, meetings, financials, projects] = await Promise.all([
        supabase
          .from('documents')
          .select('title, modified_time')
          .eq('team_id', teamId)
          .eq('folder_type', 'strategy')
          .order('modified_time', { ascending: false })
          .limit(10),

        supabase
          .from('documents')
          .select('title, modified_time')
          .eq('team_id', teamId)
          .eq('folder_type', 'meetings')
          .order('modified_time', { ascending: false })
          .limit(10),

        supabase
          .from('documents')
          .select('title, modified_time')
          .eq('team_id', teamId)
          .eq('folder_type', 'financial')
          .order('modified_time', { ascending: false })
          .limit(10),

        supabase
          .from('documents')
          .select('title, modified_time')
          .eq('team_id', teamId)
          .eq('folder_type', 'projects')
          .order('modified_time', { ascending: false })
          .limit(10)
      ]);

      const dataSnapshot = {
        hasStrategyDocs: (strategyDocs.data?.length || 0) > 0,
        strategyCount: strategyDocs.data?.length || 0,
        hasMeetings: (meetings.data?.length || 0) > 0,
        meetingCount: meetings.data?.length || 0,
        hasFinancials: (financials.data?.length || 0) > 0,
        financialCount: financials.data?.length || 0,
        hasProjects: (projects.data?.length || 0) > 0,
        projectCount: projects.data?.length || 0
      };

      // Generate AI suggestions
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

      const prompt = `You are an expert AI assistant for Astra Intelligence. Based on the user's available data, generate exactly 3 personalized Daily Update Report suggestions.

Available Data:
- Strategy Documents: ${dataSnapshot.strategyCount} documents
- Meetings: ${dataSnapshot.meetingCount} meetings
- Financial Documents: ${dataSnapshot.financialCount} documents
- Project Documents: ${dataSnapshot.projectCount} documents

Requirements:
1. Focus on "Daily Update" style reports
2. Mix of recent documents, trends, and actionable insights
3. Use available data sources (strategy, meetings, financials, projects)
4. Keep titles concise (3-5 words)
5. Keep descriptions brief (1 sentence)
6. Keep prompts specific and actionable

CRITICAL WORDING RULES:
- NEVER use the term "meeting notes" - always say "recent meetings" or "most recent meeting"
- NEVER use specific numbers like "10 recent meetings" - use "recent meetings" or "most recent meeting" instead
- For documents and meetings: Use "recent" WITHOUT timeframes (NO "last 24 hours", "last 48 hours", etc.)
- For news/web searches ONLY: Use "recent industry news in the last 24-48 hours" to trigger web search
- Use phrases like "most recent" or "recent" rather than specific quantities or timeframes
- AVOID overly specific business terms like "KPIs", "OKRs", "quarterly targets", etc. - use generic terms like "measurables", "metrics", "performance indicators", "key metrics"

GOOD EXAMPLES:
- "Analyze recent strategy documents and highlight key changes"
- "Review recent meetings and identify action items"
- "Compare recent financial documents with recent industry news in the last 24-48 hours"
- "Summarize key metrics from recent financial documents"

BAD EXAMPLES:
- "Analyze strategy documents modified in the last 48 hours" ❌
- "Review meetings from the last 24 hours" ❌
- "10 recent meetings" ❌
- "Summarize KPIs from recent financial documents" ❌

Return ONLY valid JSON in this exact format:
[
  {
    "title": "Recent Strategy Updates",
    "description": "Key changes in recent strategy documents",
    "prompt": "Analyze recent strategy documents and highlight key changes, new initiatives, and action items"
  }
]`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Parse JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const generatedSuggestions = JSON.parse(jsonMatch[0]);
      setSuggestions(generatedSuggestions);
      setState('suggestions');
    } catch (err: any) {
      console.error('Error generating suggestions:', err);
      setError(err.message || 'Failed to generate report suggestions');
      setState('suggestions');

      // Fallback suggestions if AI fails
      setSuggestions([
        {
          title: 'Daily Meeting Action Digest',
          description: 'Summarize all pending action items and critical decisions from recent meetings',
          prompt: 'Review recent meetings and generate a prioritized list of open action items, identifying owners and critical deadlines for immediate follow-up'
        },
        {
          title: 'Strategic Priorities Update',
          description: 'Current progress on strategic initiatives',
          prompt: 'Analyze recent strategy documents and most recent meeting to provide an update on current strategic priorities, progress, and any blockers or action items that need attention'
        },
        {
          title: 'Daily News Brief',
          description: 'Industry updates aligned to your strategy',
          prompt: 'Provide a brief summary of recent industry news in the last 24-48 hours that is important for our business. Focus on the top 3 impacts to our business, and a recommendation of actions that align with our mission, core values or goals'
        }
      ]);
    }
  };

  const handleSelectSuggestion = async (suggestion: ReportSuggestion) => {
    setSelectedSuggestion(suggestion);
    await generateReport(suggestion);
  };

  const generateReport = async (suggestion: ReportSuggestion) => {
    try {
      setState('generating');
      setError(null);

      const teamId = user?.user_metadata?.team_id;
      const teamName = user?.user_metadata?.team_name || '';
      const role = user?.user_metadata?.role || 'member';
      const viewFinancial = user?.user_metadata?.view_financial !== false;
      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

      // Call N8N webhook to generate report
      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('N8N webhook URL not configured');
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatInput: suggestion.prompt,
          user_id: user?.id,
          user_email: user?.email,
          user_name: userName,
          team_id: teamId,
          team_name: teamName,
          role: role,
          view_financial: viewFinancial,
          mode: 'reports',
          metadata: {
            title: suggestion.title,
            report_title: suggestion.title,
            is_manual_run: true,
            from_launch_prep: true,
            executed_at: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`);
      }

      const responseText = await response.text();
      let reportContent = responseText;

      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.output) {
          reportContent = jsonResponse.output;
        }
      } catch (e) {
        // Use raw text if not JSON
      }

      // First, create the report configuration in astra_reports table
      const { data: reportConfig, error: reportConfigError } = await supabase
        .from('astra_reports')
        .insert({
          user_id: user?.id,
          title: suggestion.title,
          prompt: suggestion.prompt,
          schedule_type: 'manual',
          is_active: true,
          last_run_at: new Date().toISOString()
        })
        .select()
        .single();

      if (reportConfigError) {
        throw new Error(`Failed to create report configuration: ${reportConfigError.message}`);
      }

      // Save report execution result to astra_chats table
      const { data: chatData, error: chatError } = await supabase
        .from('astra_chats')
        .insert({
          user_id: user?.id,
          user_email: user?.email,
          user_name: 'Astra',
          message: reportContent,
          message_type: 'astra',
          conversation_id: null,
          response_time_ms: 0,
          tokens_used: {},
          model_used: 'n8n-workflow',
          metadata: {
            reportId: reportConfig.id,
            title: suggestion.title,
            report_title: suggestion.title,
            is_manual_run: true,
            from_launch_prep: true,
            executed_at: new Date().toISOString()
          },
          visualization: false,
          mode: 'reports',
          mentions: [],
          astra_prompt: suggestion.prompt,
          visualization_data: null
        })
        .select()
        .single();

      if (chatError) {
        throw new Error(`Failed to save report: ${chatError.message}`);
      }

      // Generate visualization
      await generateVisualization(chatData.id, reportContent);

      // Fetch the updated chat data with visualization
      const { data: updatedChat, error: fetchError } = await supabase
        .from('astra_chats')
        .select('*')
        .eq('id', chatData.id)
        .single();

      if (fetchError || !updatedChat?.visualization_data) {
        throw new Error('Visualization generation failed');
      }

      setReportData({
        messageId: chatData.id,
        content: reportContent,
        visualizationHtml: updatedChat.visualization_data
      });

      setState('viewing');
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.message || 'Failed to generate report');
      setState('suggestions');
    }
  };

  const handleProceed = async () => {
    setState('complete');
    await onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      {state === 'viewing' && reportData ? (
        <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
          {/* Visualization Content */}
          <div className="flex-1 overflow-auto p-4">
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: reportData.visualizationHtml }}
            />
          </div>

          {/* Proceed Button at Bottom Right */}
          <div className="p-4 bg-gray-900/95 border-t border-gray-700">
            <div className="max-w-7xl mx-auto flex justify-end">
              <button
                onClick={handleProceed}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2 min-h-[44px] shadow-lg"
              >
                <span>Proceed</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <FileBarChart className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Astra Reports</h2>
                <p className="text-sm text-gray-400">Generate on-demand insights</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Introduction */}
            {state === 'suggestions' && (
              <>
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-green-300 font-medium mb-1">
                        Create Your First Daily Update Report
                      </p>
                      <p className="text-sm text-gray-300">
                        Select one of these AI-generated reports based on your available data. Get instant insights across documents, meetings, and activity.
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI-Generated Suggestions */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Choose Your Daily Update Report:</h3>
                  <div className="space-y-3">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full text-left bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-green-500 rounded-lg p-4 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-base font-semibold text-white mb-1 group-hover:text-green-400 transition-colors">
                              {suggestion.title}
                            </p>
                            <p className="text-sm text-gray-400 mb-2 group-hover:text-gray-300">
                              {suggestion.description}
                            </p>
                            <p className="text-xs text-gray-500 italic line-clamp-2">
                              "{suggestion.prompt}"
                            </p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-green-400 flex-shrink-0 mt-1 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                    <p className="text-sm text-yellow-300">{error}</p>
                  </div>
                )}
              </>
            )}

            {/* Analyzing State */}
            {state === 'analyzing' && (
              <div className="py-8 space-y-6">
                {/* Warning Banner */}
                <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-orange-300 font-medium">Do not close or navigate away during this process</p>
                    <p className="text-orange-400/70 text-sm mt-1">Astra is analyzing your data</p>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader className="w-12 h-12 text-green-400 animate-spin" />
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white mb-1">
                      Analyzing Your Data
                    </p>
                    <p className="text-sm text-gray-400">
                      Creating personalized report suggestions...
                    </p>
                  </div>
                </div>

                <LoadingCarousel type="report" />
              </div>
            )}

            {/* Generating State */}
            {state === 'generating' && selectedSuggestion && (
              <div className="space-y-6">
                {/* Warning Banner */}
                <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-orange-300 font-medium">Do not close or navigate away during this process</p>
                    <p className="text-orange-400/70 text-sm mt-1">Astra is generating your report</p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                    <Loader className="w-8 h-8 text-green-400 animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Generating Your Report
                  </h3>
                  <p className="text-sm text-gray-400 mb-1">
                    {selectedSuggestion.title}
                  </p>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Astra is analyzing your data and creating comprehensive insights...
                  </p>
                </div>

                <LoadingCarousel type="report" />

                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                  <p className="text-xs text-blue-300 text-center">
                    This may take 30-60 seconds as Astra analyzes all your documents and data
                  </p>
                </div>
              </div>
            )}

            {/* Complete State */}
            {state === 'complete' && (
              <div className="py-8 space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Report Generated!
                  </h3>
                  <p className="text-sm text-gray-400">
                    Your Astra Report has been saved and is available in the Reports section.
                  </p>
                </div>

                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <p className="text-sm text-green-300 text-center">
                    🎉 You've unlocked Level 3! You can now create unlimited Astra Reports anytime.
                  </p>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={handleProceed}
                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2 min-h-[44px]"
                  >
                    <span>Proceed</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
