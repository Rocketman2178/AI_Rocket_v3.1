import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has N8N access
    const { data: accessRecord } = await supabase
      .from('n8n_user_access')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_enabled', true)
      .maybeSingle();

    if (!accessRecord) {
      return new Response(
        JSON.stringify({ error: 'N8N access not enabled for this user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const n8nUrl = Deno.env.get('N8N_URL');
    const n8nApiKey = Deno.env.get('N8N_API_KEY');

    if (!n8nUrl || !n8nApiKey) {
      return new Response(
        JSON.stringify({ error: 'N8N not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const n8nPath = url.searchParams.get('path') || '/workflows';
    const n8nEndpoint = `${n8nUrl}/api/v1${n8nPath}`;

    // Only parse JSON body for POST/PUT/PATCH requests
    let requestBody = null;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        const text = await req.text();
        if (text) {
          requestBody = JSON.parse(text);
        }
      } catch (e) {
        // No body or invalid JSON, that's okay for some requests
      }
    }

    const n8nResponse = await fetch(n8nEndpoint, {
      method: req.method,
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Content-Type': 'application/json',
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      return new Response(
        JSON.stringify({ error: `N8N API Error: ${n8nResponse.status} - ${errorText}` }),
        { status: n8nResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // N8N DELETE responses may not have a JSON body
    let n8nData;
    const responseText = await n8nResponse.text();
    if (responseText) {
      try {
        n8nData = JSON.parse(responseText);
      } catch (e) {
        n8nData = { success: true, message: 'Operation completed' };
      }
    } else {
      n8nData = { success: true, message: 'Operation completed' };
    }

    return new Response(
      JSON.stringify(n8nData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in n8n-proxy:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});