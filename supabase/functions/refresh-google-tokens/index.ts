import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Edge Function: Refresh Google Tokens (Gmail + Drive)
 *
 * This function runs automatically via pg_cron every 10 minutes to ensure
 * all active Google OAuth tokens (Gmail and Drive) are refreshed BEFORE they expire.
 * This ensures n8n workflows always have valid tokens to work with.
 *
 * Process:
 * 1. Find all tokens expiring in the next 45 minutes
 * 2. Refresh them using the refresh_token
 * 3. Update the database with new access_tokens
 * 4. Mark as inactive if refresh fails
 */
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
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!googleClientId || !googleClientSecret) {
      throw new Error('Missing Google OAuth configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting automatic Google token refresh...');

    // Calculate 45 minutes from now (refresh before expiry)
    const refreshThreshold = new Date(Date.now() + 45 * 60 * 1000).toISOString();

    // REFRESH GMAIL TOKENS
    console.log('📧 Checking Gmail tokens...');
    const { data: gmailAuths, error: gmailError } = await supabase
      .from('gmail_auth')
      .select('*')
      .eq('is_active', true)
      .lt('expires_at', refreshThreshold);

    if (gmailError) {
      console.error('❌ Error fetching Gmail auths:', gmailError);
    } else {
      console.log(`📧 Found ${gmailAuths?.length || 0} Gmail tokens to refresh`);

      for (const auth of gmailAuths || []) {
        try {
          console.log(`🔄 Refreshing Gmail token for user: ${auth.user_id}`);

          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              refresh_token: auth.refresh_token,
              grant_type: 'refresh_token'
            })
          });

          const tokens = await tokenResponse.json();

          if (!tokenResponse.ok) {
            console.error(`❌ Failed to refresh Gmail token for ${auth.user_id}:`, tokens);

            // If invalid grant, mark as inactive
            if (tokens.error === 'invalid_grant') {
              await supabase
                .from('gmail_auth')
                .update({ is_active: false })
                .eq('user_id', auth.user_id);
              console.log(`⚠️ Marked Gmail auth as inactive for user: ${auth.user_id}`);
            }
            continue;
          }

          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

          const updateData: any = {
            access_token: tokens.access_token,
            expires_at: expiresAt.toISOString(),
            is_active: true
          };

          if (tokens.refresh_token) {
            updateData.refresh_token = tokens.refresh_token;
          }

          await supabase
            .from('gmail_auth')
            .update(updateData)
            .eq('user_id', auth.user_id);

          console.log(`✅ Gmail token refreshed for user: ${auth.user_id}`);
        } catch (err) {
          console.error(`❌ Error refreshing Gmail token for ${auth.user_id}:`, err);
        }
      }
    }

    // REFRESH GOOGLE DRIVE TOKENS
    console.log('💾 Checking Google Drive tokens...');
    const { data: driveConnections, error: driveError } = await supabase
      .from('user_drive_connections')
      .select('*')
      .eq('is_active', true)
      .eq('connection_status', 'connected')
      .lt('token_expires_at', refreshThreshold);

    if (driveError) {
      console.error('❌ Error fetching Drive connections:', driveError);
    } else {
      console.log(`💾 Found ${driveConnections?.length || 0} Drive tokens to refresh`);

      for (const connection of driveConnections || []) {
        const previousExpiry = connection.token_expires_at;

        try {
          console.log(`🔄 Refreshing Drive token for user: ${connection.user_id}`);

          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              refresh_token: connection.refresh_token,
              grant_type: 'refresh_token'
            })
          });

          const tokens = await tokenResponse.json();

          if (!tokenResponse.ok) {
            console.error(`❌ Failed to refresh Drive token for ${connection.user_id}:`, tokens);

            // Log the failure
            await supabase.from('token_refresh_logs').insert({
              user_id: connection.user_id,
              team_id: connection.team_id,
              service: 'google_drive',
              success: false,
              error_code: tokens.error || 'unknown',
              error_message: tokens.error_description || 'Token refresh failed',
              previous_expiry: previousExpiry
            });

            // If invalid grant, mark as error
            if (tokens.error === 'invalid_grant') {
              await supabase
                .from('user_drive_connections')
                .update({
                  is_active: false,
                  connection_status: 'token_expired'
                })
                .eq('user_id', connection.user_id);
              console.log(`⚠️ Marked Drive connection as expired for user: ${connection.user_id}`);
            }
            continue;
          }

          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

          const updateData: any = {
            access_token: tokens.access_token,
            token_expires_at: expiresAt.toISOString(),
            is_active: true,
            connection_status: 'connected'
          };

          if (tokens.refresh_token) {
            updateData.refresh_token = tokens.refresh_token;
          }

          await supabase
            .from('user_drive_connections')
            .update(updateData)
            .eq('user_id', connection.user_id);

          // Log the success
          await supabase.from('token_refresh_logs').insert({
            user_id: connection.user_id,
            team_id: connection.team_id,
            service: 'google_drive',
            success: true,
            previous_expiry: previousExpiry,
            new_expiry: expiresAt.toISOString()
          });

          console.log(`✅ Drive token refreshed for user: ${connection.user_id}`);
        } catch (err) {
          console.error(`❌ Error refreshing Drive token for ${connection.user_id}:`, err);

          // Log the exception
          await supabase.from('token_refresh_logs').insert({
            user_id: connection.user_id,
            team_id: connection.team_id,
            service: 'google_drive',
            success: false,
            error_code: 'exception',
            error_message: err instanceof Error ? err.message : 'Unknown error',
            previous_expiry: previousExpiry
          });
        }
      }
    }

    const summary = {
      success: true,
      gmail_tokens_checked: gmailAuths?.length || 0,
      drive_tokens_checked: driveConnections?.length || 0,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Token refresh complete:', summary);

    return new Response(
      JSON.stringify(summary),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Token refresh error:', error);
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