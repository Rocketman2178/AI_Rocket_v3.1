import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const superAdminEmails = ['clay@rockethub.ai', 'derek@rockethub.ai', 'marshall@rockethub.ai'];
    if (!user.email || !superAdminEmails.includes(user.email)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Super admin access only' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Now use service role to bypass RLS and get all data
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const timeFilter = url.searchParams.get('timeFilter') || '30days';

    // Calculate date range
    let dateThreshold = new Date();
    if (timeFilter === '7days') {
      dateThreshold.setDate(dateThreshold.getDate() - 7);
    } else if (timeFilter === '30days') {
      dateThreshold.setDate(dateThreshold.getDate() - 30);
    } else if (timeFilter === '90days') {
      dateThreshold.setDate(dateThreshold.getDate() - 90);
    } else {
      dateThreshold = new Date('2000-01-01');
    }

    // Calculate today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Fetch all data directly using service role
    const [
      usersResult,
      teamsResult,
      documentsResult,
      chatsResult,
      reportsResult,
      gmailConnectionsResult,
      driveConnectionsResult,
      feedbackResult,
      todayChatsResult,
      privateChatsCount,
      teamChatsCount,
      reportsChatsCount
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*'),
      supabaseAdmin.from('teams').select('*'),
      supabaseAdmin.from('documents').select('*'),
      supabaseAdmin.from('astra_chats').select('id, user_id, mode'),
      supabaseAdmin.from('user_reports').select('*'),
      supabaseAdmin.from('gmail_auth').select('*'),
      supabaseAdmin.from('user_drive_connections').select('*'),
      supabaseAdmin.from('user_feedback_submissions').select('*'),
      supabaseAdmin.from('astra_chats').select('user_id, mode, created_at').gte('created_at', todayISO),
      supabaseAdmin.from('astra_chats').select('*', { count: 'exact', head: true }).eq('mode', 'private'),
      supabaseAdmin.from('astra_chats').select('*', { count: 'exact', head: true }).eq('mode', 'team'),
      supabaseAdmin.from('astra_chats').select('*', { count: 'exact', head: true }).eq('mode', 'reports')
    ]);

    if (usersResult.error) {
      console.error('Error fetching users:', usersResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate active users today
    const todayChats = todayChatsResult.data || [];
    const activeUsersToday = new Map();

    todayChats.forEach((chat: any) => {
      if (!activeUsersToday.has(chat.user_id)) {
        activeUsersToday.set(chat.user_id, {
          user_id: chat.user_id,
          private_messages: 0,
          team_messages: 0,
          reports: 0
        });
      }

      const userStats = activeUsersToday.get(chat.user_id);
      if (chat.mode === 'private') {
        userStats.private_messages++;
      } else if (chat.mode === 'team') {
        userStats.team_messages++;
      } else if (chat.mode === 'reports') {
        userStats.reports++;
      }
    });

    // Convert to array with user details
    const activeUsersList = Array.from(activeUsersToday.values()).map((stats: any) => {
      const user = (usersResult.data || []).find((u: any) => u.id === stats.user_id);
      const team = (teamsResult.data || []).find((t: any) => t.id === user?.team_id);

      return {
        id: stats.user_id,
        email: user?.email || 'Unknown',
        team_name: team?.name || 'No Team',
        private_messages_today: stats.private_messages,
        team_messages_today: stats.team_messages,
        reports_today: stats.reports,
        total_actions_today: stats.private_messages + stats.team_messages + stats.reports
      };
    });

    // Return feedback as a single array - the frontend will split it by support_type
    const responseData = {
      users: usersResult.data || [],
      teams: teamsResult.data || [],
      documents: documentsResult.data || [],
      chats: chatsResult.data || [],
      reports: reportsResult.data || [],
      gmail_connections: gmailConnectionsResult.data || [],
      drive_connections: driveConnectionsResult.data || [],
      feedback: feedbackResult.data || [],
      active_users_today: activeUsersList,
      chat_counts: {
        private: privateChatsCount.count || 0,
        team: teamChatsCount.count || 0,
        reports: reportsChatsCount.count || 0,
        total: (privateChatsCount.count || 0) + (teamChatsCount.count || 0) + (reportsChatsCount.count || 0)
      }
    };

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in admin-dashboard-data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});