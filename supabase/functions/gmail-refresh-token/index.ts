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

    console.log('🔄 Refreshing Gmail token for user:', user.id);

    const { data: gmailAuth, error: fetchError } = await supabase
      .from('gmail_auth')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !gmailAuth) {
      return new Response(
        JSON.stringify({ error: 'Gmail connection not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!gmailAuth.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No refresh token available. Please reconnect your Gmail account.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: gmailAuth.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('❌ Failed to refresh token:', tokens);

      if (tokens.error === 'invalid_grant') {
        await supabase
          .from('gmail_auth')
          .delete()
          .eq('user_id', user.id);

        throw new Error('Refresh token is invalid. Please reconnect your Gmail account.');
      }

      throw new Error(tokens.error_description || 'Failed to refresh token');
    }

    console.log('✅ Token refreshed successfully');

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const updateData: any = {
      access_token: tokens.access_token,
      expires_at: expiresAt.toISOString(),
      is_active: true
    };

    if (tokens.refresh_token) {
      updateData.refresh_token = tokens.refresh_token;
    }

    const { error: updateError } = await supabase
      .from('gmail_auth')
      .update(updateData)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Failed to update tokens:', updateError);
      throw new Error('Failed to update Gmail authentication');
    }

    console.log('✅ Tokens updated successfully');

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
