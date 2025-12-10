import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("[list-google-drive-folders] Starting folder list request");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("[list-google-drive-folders] Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[list-google-drive-folders] User authenticated:", user.id, user.email);

    const { data: connection, error: connError } = await supabaseClient
      .from("user_drive_connections")
      .select("access_token, token_expires_at, google_account_email")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (connError) {
      console.error("[list-google-drive-folders] DB error:", connError);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!connection?.access_token) {
      console.error("[list-google-drive-folders] No active connection found for user:", user.id);
      return new Response(JSON.stringify({ error: "No active Google Drive connection" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[list-google-drive-folders] Found connection for Google account:", connection.google_account_email);

    // Fetch ONLY folders from Google Drive
    // Using explicit mimeType filter for folders only
    // Excludes shortcuts (application/vnd.google-apps.shortcut) and all file types
    const driveUrl = "https://www.googleapis.com/drive/v3/files?" + new URLSearchParams({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id,name,mimeType,createdTime)",
      orderBy: "name",
      pageSize: "1000"
    }).toString();

    console.log("[list-google-drive-folders] Calling Google Drive API for account:", connection.google_account_email);

    const response = await fetch(driveUrl, {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[list-google-drive-folders] Google Drive API error:", response.status, errorText);

      if (response.status === 401) {
        return new Response(JSON.stringify({ 
          error: "Google Drive token expired. Please reconnect.",
          googleAccount: connection.google_account_email
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Failed to fetch folders from Google Drive" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const allItems = data.files || [];
    
    // Double-filter to ensure ONLY folders are returned (belt and suspenders)
    const folders = allItems.filter((item: any) => 
      item.mimeType === 'application/vnd.google-apps.folder'
    );

    // Log any non-folder items that somehow got through
    const nonFolders = allItems.filter((item: any) => 
      item.mimeType !== 'application/vnd.google-apps.folder'
    );
    if (nonFolders.length > 0) {
      console.warn("[list-google-drive-folders] Filtered out non-folder items:", 
        nonFolders.map((f: any) => ({ name: f.name, mimeType: f.mimeType })));
    }

    const sampleNames = folders.slice(0, 5).map((f: any) => f.name);
    console.log("[list-google-drive-folders] Success - returned", folders.length, "folders. Sample:", sampleNames);

    return new Response(JSON.stringify({ 
      folders,
      googleAccount: connection.google_account_email,
      totalCount: folders.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[list-google-drive-folders] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});