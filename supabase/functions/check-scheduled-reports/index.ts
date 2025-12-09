import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
      throw new Error('VITE_N8N_WEBHOOK_URL environment variable is not set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Checking for scheduled reports that need to run...');
    const now = new Date();
    console.log('⏰ Current time (UTC):', now.toISOString());

    // Find all active scheduled reports where next_run_at is in the past
    const { data: reportsToRun, error: fetchError } = await supabase
      .from('astra_reports')
      .select('*')
      .eq('is_active', true)
      .eq('schedule_type', 'scheduled')
      .not('next_run_at', 'is', null)
      .lte('next_run_at', now.toISOString())
      .order('next_run_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching scheduled reports:', fetchError);
      throw new Error(`Failed to fetch scheduled reports: ${fetchError.message}`);
    }

    if (!reportsToRun || reportsToRun.length === 0) {
      console.log('✅ No reports need to run at this time');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No reports need to run',
          checkedAt: now.toISOString()
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`📊 Found ${reportsToRun.length} report(s) to run:`,
      reportsToRun.map(r => ({ id: r.id, title: r.title, next_run_at: r.next_run_at }))
    );

    const results = [];

    // Process each report
    for (const report of reportsToRun) {
      try {
        console.log(`\n🚀 Running report: ${report.title} (${report.id})`);

        // Fetch user details
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(report.user_id);

        if (userError || !userData?.user?.email) {
          console.error(`❌ User not found for report ${report.id}:`, userError);
          results.push({
            reportId: report.id,
            reportTitle: report.title,
            success: false,
            error: 'User not found'
          });
          continue;
        }

        // Fetch team information directly from public.users and teams tables
        let teamId: string | null = null;
        let teamName = '';
        let role = 'member';
        let viewFinancial = true;
        let userName = userData.user.user_metadata?.full_name || userData.user.email || '';

        console.log(`🔍 Fetching team info for user ${report.user_id}...`);

        // Query public.users table directly (service role bypasses RLS)
        const { data: userRecord, error: userRecordError } = await supabase
          .from('users')
          .select('team_id, role, view_financial, name, teams(name)')
          .eq('id', report.user_id)
          .single();

        if (userRecordError) {
          console.error(`❌ Error fetching user record:`, userRecordError);
          console.log(`⚠️ Falling back to user_metadata`);
          // Fallback to user_metadata from auth.users
          teamId = userData.user.user_metadata?.team_id || null;
          role = userData.user.user_metadata?.role || 'member';
          viewFinancial = userData.user.user_metadata?.view_financial !== false;
        } else if (!userRecord) {
          console.warn(`⚠️ User record not found in public.users table`);
          // Fallback to user_metadata
          teamId = userData.user.user_metadata?.team_id || null;
          role = userData.user.user_metadata?.role || 'member';
          viewFinancial = userData.user.user_metadata?.view_financial !== false;
        } else {
          console.log(`✅ User record fetched:`, JSON.stringify(userRecord, null, 2));
          teamId = userRecord.team_id;
          teamName = userRecord.teams?.name || '';
          role = userRecord.role || 'member';
          viewFinancial = userRecord.view_financial !== false;
          userName = userRecord.name || userName;
          console.log(`📋 Extracted values: teamId=${teamId}, teamName=${teamName}, role=${role}, userName=${userName}`);
        }

        // Call n8n webhook to generate report
        console.log('🌐 Calling n8n webhook...');
        console.log(`📋 Payload preview: user=${userData.user.email}, team=${teamName} (${teamId}), role=${role}`);

        const webhookPayload = {
          chatInput: report.prompt,
          user_id: report.user_id,
          user_email: userData.user.email,
          user_name: userName,
          conversation_id: null,
          team_id: teamId,
          team_name: teamName,
          role: role,
          view_financial: viewFinancial,
          mode: 'reports',
          original_message: report.prompt,
          mentions: [],
          report_title: report.title,
          report_schedule: report.schedule_time,
          report_frequency: report.schedule_frequency,
          is_manual_run: false,
          is_team_report: report.is_team_report || false,
          created_by_user_id: report.created_by_user_id || null,
          executed_at: new Date().toISOString()
        };

        console.log('📦 Full webhook payload:', JSON.stringify(webhookPayload, null, 2));

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
          results.push({
            reportId: report.id,
            reportTitle: report.title,
            success: false,
            error: `Webhook failed: ${webhookResponse.status}`
          });
          continue;
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
              user_id: report.user_id,
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
            user_id: report.user_id,
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
              reportId: report.id,
              title: report.title,
              report_title: report.title,
              report_schedule: report.schedule_time,
              report_frequency: report.schedule_frequency,
              is_manual_run: false,
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
          results.push({
            reportId: report.id,
            reportTitle: report.title,
            success: false,
            error: `Failed to save report for some recipients`
          });
          continue;
        }

        console.log(`✅ Report delivered to all ${recipients.length} recipient(s)`);

        // Calculate next run time
        const nextRunAt = calculateNextRunTime(
          report.schedule_time,
          report.schedule_frequency,
          report.schedule_day
        );

        console.log('📅 Next run calculated:', nextRunAt);

        // Update last_run_at and next_run_at timestamps
        await supabase
          .from('astra_reports')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRunAt
          })
          .eq('id', report.id);

        console.log(`✅ Report ${report.title} completed successfully`);

        results.push({
          reportId: report.id,
          reportTitle: report.title,
          success: true,
          nextRunAt: nextRunAt
        });

      } catch (error) {
        console.error(`❌ Error processing report ${report.id}:`, error);
        results.push({
          reportId: report.id,
          reportTitle: report.title,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`\n📊 Summary: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${reportsToRun.length} report(s)`,
        successCount,
        failureCount,
        results,
        checkedAt: now.toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Error in check-scheduled-reports:', error);
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

// Helper function to calculate next run time (same logic as frontend)
function calculateNextRunTime(
  scheduleTime: string,
  scheduleFrequency: string,
  scheduleDay: number | null
): string {
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  const now = new Date();

  // Get current date/time in Eastern timezone
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const easternParts = easternFormatter.formatToParts(now);
  const easternValues: Record<string, string> = {};
  easternParts.forEach(part => {
    if (part.type !== 'literal') {
      easternValues[part.type] = part.value;
    }
  });

  const currentEasternHour = parseInt(easternValues.hour);
  const currentEasternMinute = parseInt(easternValues.minute);
  let targetDay = parseInt(easternValues.day);
  let targetMonth = parseInt(easternValues.month);
  let targetYear = parseInt(easternValues.year);

  const scheduledMinutes = hours * 60 + minutes;
  const currentMinutes = currentEasternHour * 60 + currentEasternMinute;
  const timeHasPassedToday = scheduledMinutes <= currentMinutes;

  if (scheduleFrequency === 'daily') {
    if (timeHasPassedToday) {
      const tomorrow = new Date(targetYear, targetMonth - 1, targetDay + 1);
      targetDay = tomorrow.getDate();
      targetMonth = tomorrow.getMonth() + 1;
      targetYear = tomorrow.getFullYear();
    }
  } else if (scheduleFrequency === 'weekly') {
    const targetDayOfWeek = scheduleDay ?? 1;
    const currentDate = new Date(targetYear, targetMonth - 1, targetDay);
    const currentDayOfWeek = currentDate.getDay();

    let daysUntilTarget = targetDayOfWeek - currentDayOfWeek;

    if (daysUntilTarget === 0 && timeHasPassedToday) {
      daysUntilTarget = 7;
    } else if (daysUntilTarget < 0) {
      daysUntilTarget += 7;
    }

    const nextDate = new Date(targetYear, targetMonth - 1, targetDay + daysUntilTarget);
    targetDay = nextDate.getDate();
    targetMonth = nextDate.getMonth() + 1;
    targetYear = nextDate.getFullYear();
  } else if (scheduleFrequency === 'monthly') {
    const targetDayOfMonth = scheduleDay ?? 1;

    if (targetDay > targetDayOfMonth || (targetDay === targetDayOfMonth && timeHasPassedToday)) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
    }

    targetDay = targetDayOfMonth;

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    if (targetDay > daysInMonth) {
      targetDay = daysInMonth;
    }
  }

  // Determine if target date is in EDT or EST
  // EDT (Daylight): Eastern is UTC-4, EST (Standard): Eastern is UTC-5
  // When user selects 7 AM Eastern, we need to convert to UTC
  // 7 AM EST (winter) = 12:00 UTC (add 5 hours)
  // 7 AM EDT (summer) = 11:00 UTC (add 4 hours)
  const testDate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 12, 0, 0));
  const isEDT = isEasternDaylightTime(testDate);
  const offsetHours = isEDT ? 4 : 5;

  console.log(`📅 Calculating next run: ${hours}:${minutes} Eastern -> UTC`);
  console.log(`📅 Is EDT: ${isEDT}, Offset: ${offsetHours} hours`);

  const utcTime = new Date(Date.UTC(
    targetYear,
    targetMonth - 1,
    targetDay,
    hours + offsetHours,  // Convert Eastern to UTC by adding offset
    minutes,
    0,
    0
  ));

  console.log(`📅 Calculated UTC time: ${utcTime.toISOString()}`);
  return utcTime.toISOString();
}

function isEasternDaylightTime(date: Date): boolean {
  const year = date.getFullYear();

  const marchSecondSunday = new Date(year, 2, 1);
  marchSecondSunday.setDate(1 + (7 - marchSecondSunday.getDay()) + 7);

  const novemberFirstSunday = new Date(year, 10, 1);
  novemberFirstSunday.setDate(1 + (7 - novemberFirstSunday.getDay()) % 7);

  return date >= marchSecondSunday && date < novemberFirstSunday;
}