import { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, TrendingDown, Minus, Download, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface FeedbackStats {
  totalSubmissions: number;
  avgRatings: Record<string, number>;
  recentSuggestions: Array<{
    id: string;
    user_name: string;
    submitted_at: string;
    question_text: string;
    rating: number;
    comment: string;
  }>;
  generalFeedback: Array<{
    id: string;
    user_name: string;
    submitted_at: string;
    general_feedback: string;
  }>;
}

export function FeedbackAnalyticsPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'all'>('7days');

  const superAdminEmails = ['clay@rockethub.ai', 'derek@rockethub.ai', 'marshall@rockethub.ai'];
  const isSuperAdmin = user?.email && superAdminEmails.includes(user.email);

  useEffect(() => {
    if (isSuperAdmin) {
      loadFeedbackStats();
    }
  }, [isSuperAdmin, dateRange]);

  const loadFeedbackStats = async () => {
    // Only super admins can access this panel
    if (!isSuperAdmin) return;

    console.log('[FeedbackAnalytics] Loading stats for super admin:', user?.email);

    try {
      setLoading(true);
      setError('');

      let dateFilter = '';
      const now = new Date();

      if (dateRange === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = sevenDaysAgo.toISOString();
      } else if (dateRange === '30days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = thirtyDaysAgo.toISOString();
      }

      // Query all feedback answers with submission info (no nested user join)
      let answersQuery = supabase
        .from('user_feedback_answers')
        .select(`
          id,
          rating,
          comment,
          created_at,
          submission_id,
          user_feedback_submissions!inner(
            submitted_at,
            user_id,
            general_feedback
          ),
          feedback_questions(question_text, category)
        `);

      if (dateFilter) {
        answersQuery = answersQuery.gte('created_at', dateFilter);
      }

      const { data: answers, error: answersError } = await answersQuery;

      console.log('[FeedbackAnalytics] Answers fetched:', {
        count: answers?.length || 0,
        dateRange
      });

      if (answersError) {
        if (answersError.code === '42P01') {
          console.warn('Feedback tables not yet created');
          setLoading(false);
          return;
        }
        throw answersError;
      }

      // Get all unique user IDs from answers
      const userIds = [...new Set(answers?.map(a => a.user_feedback_submissions?.user_id).filter(Boolean))];

      // Fetch user data separately
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      const userMap = new Map(usersData?.map(u => [u.id, { name: u.name, email: u.email }]) || []);

      console.log('[FeedbackAnalytics] Users fetched:', {
        userCount: usersData?.length || 0,
        userIds: userIds.length
      });

      // Calculate average ratings by question
      const questionStats: Record<string, { total: number; sum: number }> = {};
      answers?.forEach(answer => {
        const questionText = answer.feedback_questions?.question_text || 'Unknown';
        if (!questionStats[questionText]) {
          questionStats[questionText] = { total: 0, sum: 0 };
        }
        questionStats[questionText].total += 1;
        questionStats[questionText].sum += answer.rating;
      });

      const avgRatings: Record<string, number> = {};
      Object.entries(questionStats).forEach(([question, stats]) => {
        avgRatings[question] = stats.sum / stats.total;
      });

      // Get recent suggestions with comments
      const recentSuggestions = answers
        ?.filter(a => a.comment && a.comment.trim() !== '')
        .slice(0, 20)
        .map(a => {
          const userId = a.user_feedback_submissions?.user_id;
          const userData = userId ? userMap.get(userId) : null;
          return {
            id: a.id,
            user_name: userData?.name || userData?.email || 'Anonymous',
            submitted_at: a.user_feedback_submissions?.submitted_at || '',
            question_text: a.feedback_questions?.question_text || '',
            rating: a.rating,
            comment: a.comment || ''
          };
        }) || [];

      // Get unique submissions with general feedback
      const submissionsMap = new Map();
      answers?.forEach(answer => {
        const submission = answer.user_feedback_submissions;
        if (submission && submission.general_feedback && submission.general_feedback.trim() !== '') {
          if (!submissionsMap.has(submission.user_id)) {
            const userData = userMap.get(submission.user_id);
            submissionsMap.set(submission.user_id, {
              id: answer.submission_id,
              user_name: userData?.name || userData?.email || 'Anonymous',
              submitted_at: submission.submitted_at,
              general_feedback: submission.general_feedback
            });
          }
        }
      });

      const generalFeedback = Array.from(submissionsMap.values());

      // Count unique submissions
      const uniqueSubmissions = new Set(answers?.map(a => a.submission_id));

      setStats({
        totalSubmissions: uniqueSubmissions.size,
        avgRatings,
        recentSuggestions,
        generalFeedback
      });

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading feedback stats:', err);
      setError(err.message || 'Failed to load feedback data');
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!stats) return;

    const csvRows: string[] = [];
    csvRows.push('User,Date,Question,Rating,Comment');

    stats.recentSuggestions.forEach(item => {
      const row = [
        item.user_name,
        new Date(item.submitted_at).toLocaleDateString(),
        `"${item.question_text}"`,
        item.rating.toString(),
        `"${item.comment.replace(/"/g, '""')}"`
      ].join(',');
      csvRows.push(row);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!isAdmin) return null;

  const getTrendIcon = (rating: number) => {
    if (rating >= 8) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (rating >= 6) return <Minus className="w-4 h-4 text-yellow-400" />;
    return <TrendingDown className="w-4 h-4 text-red-400" />;
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-400';
    if (rating >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Team Feedback Analytics</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg border border-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={exportToCSV}
            disabled={!stats || stats.recentSuggestions.length === 0}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {!loading && stats && (
        <>
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">Total Submissions</p>
              </div>
              <p className="text-3xl font-bold text-white">{stats.totalSubmissions}</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <MessageSquare className="w-4 h-4 text-orange-400" />
                <p className="text-sm text-gray-400">Feature Requests</p>
              </div>
              <p className="text-3xl font-bold text-white">{stats.generalFeedback.length}</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">Comments</p>
              </div>
              <p className="text-3xl font-bold text-white">{stats.recentSuggestions.length}</p>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-white font-semibold mb-3">Average Ratings by Question</h4>
            <div className="space-y-3">
              {Object.entries(stats.avgRatings).map(([question, rating]) => (
                <div key={question} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm text-gray-300 flex-1">{question}</p>
                    <div className="flex items-center space-x-2 ml-3">
                      {getTrendIcon(rating)}
                      <span className={`text-lg font-bold ${getRatingColor(rating)}`}>
                        {rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        rating >= 8 ? 'bg-green-500' : rating >= 6 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${(rating / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {stats.generalFeedback.length > 0 && (
            <div className="mb-6">
              <h4 className="text-white font-semibold mb-3">General Suggestions & Feature Requests</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {stats.generalFeedback.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="bg-gradient-to-r from-orange-500/10 to-blue-500/10 rounded-lg p-4 border border-orange-500/30"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <p className="text-sm font-medium text-white">{feedback.user_name}</p>
                      <span className="text-xs text-gray-500">•</span>
                      <p className="text-xs text-gray-500">
                        {new Date(feedback.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm text-gray-300">{feedback.general_feedback}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.recentSuggestions.length > 0 && (
            <div>
              <h4 className="text-white font-semibold mb-3">Question-Specific Comments</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {stats.recentSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-white">{suggestion.user_name}</p>
                        <span className="text-xs text-gray-500">•</span>
                        <p className="text-xs text-gray-500">
                          {new Date(suggestion.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${getRatingColor(suggestion.rating)}`}>
                        {suggestion.rating}/10
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{suggestion.question_text}</p>
                    <p className="text-sm text-gray-300">{suggestion.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.recentSuggestions.length === 0 && stats.totalSubmissions > 0 && (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No comments received yet</p>
            </div>
          )}

          {stats.totalSubmissions === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No feedback submissions yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Team members will start receiving feedback prompts 24 hours after onboarding
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
