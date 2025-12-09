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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { folderId, strategyData } = await req.json();

    if (!folderId) {
      return new Response(JSON.stringify({ error: "Folder ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!strategyData || typeof strategyData !== 'object') {
      return new Response(JSON.stringify({ error: "Strategy data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if at least one field is filled
    const hasContent = Object.values(strategyData).some(value =>
      typeof value === 'string' && value.trim() !== ''
    );

    if (!hasContent) {
      return new Response(JSON.stringify({ error: "Please provide at least one piece of information" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const teamId = user.user_metadata?.team_id;
    if (!teamId) {
      return new Response(JSON.stringify({ error: "No team ID found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get team name
    const { data: team, error: teamError } = await supabaseClient
      .from("teams")
      .select("name")
      .eq("id", teamId)
      .maybeSingle();

    const teamName = team?.name || "Team";

    // Get Google Drive access token
    const { data: connection, error: connError } = await supabaseClient
      .from("user_drive_connections")
      .select("access_token")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .maybeSingle();

    if (connError || !connection?.access_token) {
      return new Response(JSON.stringify({ error: "No active Google Drive connection" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper to escape HTML and preserve line breaks
    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
    };

    // Build HTML content for the document
    let htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>`;
    htmlContent += `<h1>${escapeHtml(teamName)} Mission and Strategy</h1>`;
    htmlContent += `<p><em>Created: ${new Date().toLocaleDateString()}</em></p>`;
    htmlContent += `<hr>`;

    if (strategyData.mission) {
      htmlContent += `<h2>Mission</h2>`;
      htmlContent += `<p>${escapeHtml(strategyData.mission)}</p>`;
    }

    if (strategyData.coreValues) {
      htmlContent += `<h2>Core Values</h2>`;
      htmlContent += `<p>${escapeHtml(strategyData.coreValues)}</p>`;
    }

    if (strategyData.oneYearGoals) {
      htmlContent += `<h2>One-Year Goals</h2>`;
      htmlContent += `<p>${escapeHtml(strategyData.oneYearGoals)}</p>`;
    }

    if (strategyData.threeYearGoals) {
      htmlContent += `<h2>Three-Year Goals</h2>`;
      htmlContent += `<p>${escapeHtml(strategyData.threeYearGoals)}</p>`;
    }

    if (strategyData.problems) {
      htmlContent += `<h2>Problems We're Solving</h2>`;
      htmlContent += `<p>${escapeHtml(strategyData.problems)}</p>`;
    }

    if (strategyData.products) {
      htmlContent += `<h2>Our Products</h2>`;
      htmlContent += `<p>${escapeHtml(strategyData.products)}</p>`;
    }

    if (strategyData.uniqueness) {
      htmlContent += `<h2>What Makes Us Different</h2>`;
      htmlContent += `<p>${escapeHtml(strategyData.uniqueness)}</p>`;
    }

    if (strategyData.marketing) {
      htmlContent += `<h2>Marketing Strategy</h2>`;
      htmlContent += `<p>${escapeHtml(strategyData.marketing)}</p>`;
    }

    htmlContent += `</body></html>`;

    // Create multipart request body
    const boundary = "boundary_" + Math.random().toString(36).substring(2);
    const metadata = {
      name: `${teamName} Mission and Strategy`,
      mimeType: "application/vnd.google-apps.document",
      parents: [folderId],
    };

    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: text/html',
      '',
      htmlContent,
      `--${boundary}--`,
    ].join('\r\n');

    // Create Google Doc with content using multipart upload
    const createResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Google Drive API error:", errorText);
      console.error("Status:", createResponse.status);
      return new Response(JSON.stringify({
        error: "Failed to create document with content",
        details: errorText
      }), {
        status: createResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const doc = await createResponse.json();

    return new Response(JSON.stringify({ document: doc }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-strategy-document:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
