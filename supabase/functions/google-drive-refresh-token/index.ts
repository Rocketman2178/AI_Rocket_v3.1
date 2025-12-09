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
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!googleClientId || !googleClientSecret) {
      throw new Error('Missing Google OAuth configuration');
    }

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');

    // Parse JWT to get user ID
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
    } catch (e) {
      console.error('❌ Failed to parse JWT:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user exists
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) {
      console.error('❌ User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🔄 Refreshing Google Drive token for user:', user.id);

    // Fetch the user's Google Drive connection
    const { data: driveConnection, error: fetchError } = await supabase
      .from('user_drive_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !driveConnection) {
      return new Response(
        JSON.stringify({ error: 'Google Drive connection not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!driveConnection.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No refresh token available. Please reconnect your Google Drive account.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🔄 Requesting new access token from Google...');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: driveConnection.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('❌ Failed to refresh token:', tokens);

      // If refresh token is invalid, mark connection as error and require reconnection
      if (tokens.error === 'invalid_grant') {
        await supabase
          .from('user_drive_connections')
          .update({
            is_active: false,
            connection_status: 'token_expired'
          })
          .eq('user_id', user.id);

        throw new Error('Refresh token is invalid. Please reconnect your Google Drive account.');
      }

      throw new Error(tokens.error_description || 'Failed to refresh token');
    }

    console.log('✅ Token refreshed successfully');

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Clean tokens to remove any newlines or whitespace that could break HTTP headers
    const cleanAccessToken = tokens.access_token?.replace?.(/[\r\n]/g, '') || tokens.access_token;
    const cleanRefreshToken = tokens.refresh_token?.replace?.(/[\r\n]/g, '') || tokens.refresh_token;

    // Update the access token (and refresh token if a new one was provided)
    const updateData: any = {
      access_token: cleanAccessToken,
      token_expires_at: expiresAt.toISOString(),
      is_active: true,
      connection_status: 'connected'
    };

    // Google sometimes issues a new refresh token
    if (cleanRefreshToken) {
      updateData.refresh_token = cleanRefreshToken;
    }

    const { error: updateError } = await supabase
      .from('user_drive_connections')
      .update(updateData)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Failed to update tokens:', updateError);
      throw new Error('Failed to update Google Drive authentication');
    }

    console.log('✅ Tokens updated successfully');
    console.log('✅ New expiration:', expiresAt.toISOString());

    return new Response(
      JSON.stringify({
        success: true,
        expires_at: expiresAt.toISOString()
      }),
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