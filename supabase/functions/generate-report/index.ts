import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  userId: string;
  reportId: string;
  prompt: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const n8nWebhookUrl = Deno.env.get('VITE_N8N_WEBHOOK_URL');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!n8nWebhookUrl) {
      throw new Error('VITE_N8N_WEBHOOK_URL environment variable is not set. Please configure it in your Supabase project settings.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, reportId, prompt }: RequestBody = await req.json();

    console.log('📊 Generating report for user:', userId, 'reportId:', reportId);

    // Fetch user details
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !userData?.user?.email) {
      throw new Error('User not found or email unavailable');
    }

    // Fetch team information from the public.users table using service function
    let teamId = '';
    let teamName = '';
    let role = 'member';
    let viewFinancial = true;
    let userName = userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'Unknown User';

    try {
      console.log(`🔍 Fetching team info for user ${userId}...`);
      const { data: userTeamData, error: teamError } = await supabase.rpc('get_user_team_info_service', {
        p_user_id: userId
      });

      if (teamError) {
        console.error(`❌ RPC error fetching team info:`, teamError);
        // Fallback to user_metadata
        teamId = userData.user.user_metadata?.team_id || '';
        role = userData.user.user_metadata?.role || 'member';
        viewFinancial = userData.user.user_metadata?.view_financial !== false;
      } else if (!userTeamData || userTeamData.length === 0) {
        console.warn(`⚠️ No team data returned for user ${userId}`);
        // Fallback to user_metadata
        teamId = userData.user.user_metadata?.team_id || '';
        role = userData.user.user_metadata?.role || 'member';
        viewFinancial = userData.user.user_metadata?.view_financial !== false;
      } else {
        const userInfo = userTeamData[0];
        console.log(`✅ Team data fetched successfully:`, userInfo);
        teamId = userInfo.team_id || '';
        teamName = userInfo.team_name || '';
        role = userInfo.role || 'member';
        viewFinancial = userInfo.view_financial !== false;
        userName = userInfo.user_name || userName;
        console.log(`📋 Extracted values: teamId=${teamId}, teamName=${teamName}, role=${role}`);
      }
    } catch (err) {
      console.error('❌ Exception fetching team info:', err);
      // Fallback to user_metadata
      teamId = userData.user.user_metadata?.team_id || '';
      role = userData.user.user_metadata?.role || 'member';
      viewFinancial = userData.user.user_metadata?.view_financial !== false;
    }

    // Fetch report configuration
    const { data: report, error: reportError } = await supabase
      .from('astra_reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', userId)
      .single();

    if (reportError || !report) {
      throw new Error('Report not found or access denied');
    }

    // Use the prompt from the database to ensure we have the latest version
    const latestPrompt = report.prompt;
    console.log('📊 Using prompt from database:', latestPrompt.substring(0, 100) + '...');

    // Call n8n webhook to generate report with accurate data
    console.log('🌐 Calling n8n webhook for report generation...');

    const webhookPayload = {
      chatInput: latestPrompt,
      user_id: userId,
      user_email: userData.user.email,
      user_name: userName,
      conversation_id: null,
      team_id: teamId,
      team_name: teamName,
      role: role,
      view_financial: viewFinancial,
      mode: 'reports',
      original_message: latestPrompt,
      mentions: [],
      report_title: report.title,
      report_schedule: report.schedule_time,
      report_frequency: report.schedule_frequency,
      is_manual_run: true,
      is_team_report: report.is_team_report || false,
      created_by_user_id: report.created_by_user_id || null,
      executed_at: new Date().toISOString()
    };

    console.log('📤 Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    const webhookResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('❌ n8n webhook failed:', webhookResponse.status, errorText);
      throw new Error('Failed to get report from n8n webhook');
    }

    const responseText = await webhookResponse.text();
    let reportText = responseText;

    // Try to parse JSON response
    try {
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.output) {
        reportText = jsonResponse.output;
      }
    } catch (e) {
      // Use raw text if not JSON
    }

    console.log('✅ Report generated successfully from n8n webhook');

    // Determine recipients based on whether this is a team report
    const recipients = [];

    if (report.is_team_report && teamId) {
      console.log(`📤 Team report detected - sending to all members of team: ${teamId}`);

      // Fetch all team members
      const { data: teamMembers, error: membersError } = await supabase
        .from('users')
        .select('id, raw_user_meta_data')
        .eq('team_id', teamId);

      if (membersError) {
        console.error('❌ Error fetching team members:', membersError);
        // Fallback to just the creator
        recipients.push({
          user_id: userId,
          user_email: userData.user.email,
          user_name: userName
        });
      } else if (teamMembers && teamMembers.length > 0) {
        console.log(`✅ Found ${teamMembers.length} team members`);
        for (const member of teamMembers) {
          // Get member's auth info
          const { data: memberAuth } = await supabase.auth.admin.getUserById(member.id);
          if (memberAuth?.user?.email) {
            recipients.push({
              user_id: member.id,
              user_email: memberAuth.user.email,
              user_name: member.raw_user_meta_data?.full_name || memberAuth.user.email
            });
          }
        }
      }
    } else {
      // Regular report - send only to creator
      recipients.push({
        user_id: userId,
        user_email: userData.user.email,
        user_name: userName
      });
    }

    console.log(`📬 Sending report to ${recipients.length} recipient(s)`);

    // Save report message for each recipient
    const insertPromises = recipients.map(recipient =>
      supabase.from('astra_chats').insert({
        user_id: recipient.user_id,
        user_email: recipient.user_email,
        mode: 'reports',
        message: reportText,
        message_type: 'astra',
        metadata: {
          reportId: reportId,
          title: report.title,
          report_title: report.title,
          report_schedule: report.schedule_time,
          report_frequency: report.schedule_frequency,
          is_manual_run: true,
          executed_at: new Date().toISOString(),
          is_team_report: report.is_team_report || false,
          created_by_user_id: report.created_by_user_id || null,
          created_by_name: report.is_team_report ? userName : null
        }
      })
    );

    const insertResults = await Promise.allSettled(insertPromises);
    const failedInserts = insertResults.filter(r => r.status === 'rejected');

    if (failedInserts.length > 0) {
      console.error(`❌ ${failedInserts.length} insert(s) failed`);
      throw new Error(`Failed to save report for some recipients`);
    }

    console.log(`✅ Report delivered to all ${recipients.length} recipient(s)`);

    // Update last_run_at timestamp
    await supabase
      .from('astra_reports')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', reportId);

    console.log('✅ Report saved to database');

    return new Response(
      JSON.stringify({ success: true, message: 'Report generated successfully' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error generating report:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});