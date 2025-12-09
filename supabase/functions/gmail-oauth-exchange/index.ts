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
    const gmailRedirectUri = Deno.env.get('GMAIL_REDIRECT_URI');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!googleClientId || !googleClientSecret || !gmailRedirectUri) {
      throw new Error('Missing Google OAuth configuration. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GMAIL_REDIRECT_URI');
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
      console.log('📧 User ID from JWT:', userId);
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

    console.log('📧 Admin API getUserById result:');
    console.log('📧 - User ID queried:', userId);
    console.log('📧 - User found:', !!user);
    console.log('📧 - User email:', user?.email);
    console.log('📧 - Error:', userError);

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

    const finalRedirectUri = redirect_uri || gmailRedirectUri;

    console.log('📧 Exchanging authorization code for tokens...');
    console.log('📧 Client ID:', googleClientId?.substring(0, 30) + '...');
    console.log('📧 Using redirect URI:', finalRedirectUri);
    console.log('📧 Env GMAIL_REDIRECT_URI:', gmailRedirectUri);

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

    console.log('📧 Full profile response:', JSON.stringify(profile));

    if (!profile.email) {
      console.error('❌ No email in profile response');
      throw new Error('Gmail email address not found in authorization response. Please ensure you granted email permissions.');
    }

    console.log('📧 Gmail account:', profile.email);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    console.log('💾 Attempting to store Gmail auth for user:', user.id);
    console.log('💾 Email:', profile.email);
    console.log('💾 Expires at:', expiresAt.toISOString());

    const { data, error: dbError } = await supabase
      .from('gmail_auth')
      .upsert({
        user_id: user.id,
        email: profile.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'Bearer',
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope,
        is_active: true
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
      throw new Error(`Failed to store Gmail authentication: ${dbError.message}`);
    }

    console.log('✅ Data returned:', data);

    console.log('✅ Gmail authentication stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        email: profile.email
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
