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
    const driveRedirectUri = Deno.env.get('GOOGLE_DRIVE_REDIRECT_URI');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!googleClientId || !googleClientSecret || !driveRedirectUri) {
      throw new Error('Missing Google OAuth configuration. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_DRIVE_REDIRECT_URI');
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
      console.log('📁 User ID from JWT:', userId);
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

    // Verify user exists and get team_id from public.users table
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);

    console.log('📁 Admin API getUserById result:');
    console.log('📁 - User ID queried:', userId);
    console.log('📁 - User found:', !!user);
    console.log('📁 - User email:', user?.email);
    console.log('📁 - Error:', userError);

    if (userError || !user) {
      console.error('❌ User verification failed:', userError);
      return new Response(
        JSON.stringify({
          error: 'User not found in database. Please ensure you have signed up with this email address first.',
          details: userError?.message
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get team_id from public.users table (more reliable than user metadata)
    const { data: publicUserData, error: publicUserError } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', userId)
      .maybeSingle();

    const teamId = publicUserData?.team_id || null;
    console.log('📁 Team ID from public.users table:', teamId);

    console.log('✅ User verified:', user.email);

    const { code, redirect_uri } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization code' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const finalRedirectUri = redirect_uri || driveRedirectUri;

    console.log('📁 Exchanging authorization code for tokens...');
    console.log('📁 Client ID:', googleClientId?.substring(0, 30) + '...');
    console.log('📁 Using redirect URI:', finalRedirectUri);
    console.log('📁 Env GOOGLE_DRIVE_REDIRECT_URI:', driveRedirectUri);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: finalRedirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('❌ Failed to get tokens from Google');
      console.error('❌ Status:', tokenResponse.status);
      console.error('❌ Error:', tokens.error);
      console.error('❌ Error description:', tokens.error_description);
      console.error('❌ Full response:', JSON.stringify(tokens));
      throw new Error(tokens.error_description || tokens.error || 'Failed to get tokens');
    }

    console.log('✅ Tokens received successfully');

    // Get user profile to confirm Google account email
    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      }
    );

    if (!profileResponse.ok) {
      console.error('❌ Failed to get user profile from Google');
      throw new Error('Failed to retrieve user profile from Google');
    }

    const profile = await profileResponse.json();

    console.log('📁 Full profile response:', JSON.stringify(profile));

    if (!profile.email) {
      console.error('❌ No email in profile response');
      throw new Error('Google account email not found in authorization response.');
    }

    console.log('📁 Google account:', profile.email);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    console.log('💾 Attempting to store Google Drive auth for user:', user.id);
    console.log('💾 Email:', profile.email);
    console.log('💾 Team ID:', teamId);
    console.log('💾 Expires at:', expiresAt.toISOString());

    // Clean tokens to remove any newlines or whitespace that could break HTTP headers
    const cleanAccessToken = tokens.access_token?.replace?.(/[\r\n]/g, '') || tokens.access_token;
    const cleanRefreshToken = tokens.refresh_token?.replace?.(/[\r\n]/g, '') || tokens.refresh_token;

    // Store in user_drive_connections table
    const { data, error: dbError } = await supabase
      .from('user_drive_connections')
      .upsert({
        user_id: user.id,
        team_id: teamId || null,
        access_token: cleanAccessToken,
        refresh_token: cleanRefreshToken,
        token_expires_at: expiresAt.toISOString(),
        google_account_email: profile.email,
        is_active: true,
        connection_status: 'connected',
        scope_version: 2, // Current scope version (includes Sheets API)
        // Folder IDs will be set later via the UI
        meetings_folder_id: null,
        meetings_folder_name: null,
        strategy_folder_id: null,
        strategy_folder_name: null
      }, {
        onConflict: 'user_id'
      })
      .select();

    if (dbError) {
      console.error('❌ Failed to store tokens');
      console.error('❌ Error code:', dbError.code);
      console.error('❌ Error message:', dbError.message);
      console.error('❌ Error details:', dbError.details);
      console.error('❌ Error hint:', dbError.hint);
      console.error('❌ Full error:', JSON.stringify(dbError));
      throw new Error(`Failed to store Google Drive authentication: ${dbError.message}`);
    }

    console.log('✅ Data returned:', data);
    console.log('✅ Google Drive authentication stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        email: profile.email,
        connection_id: data[0]?.id
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ OAuth exchange error:', error);
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