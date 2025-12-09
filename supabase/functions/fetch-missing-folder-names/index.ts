import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FolderMetadata {
  id: string;
  name: string;
}

async function getFolderName(folderId: string, accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch folder ${folderId}:`, response.status);
      return null;
    }

    const data: FolderMetadata = await response.json();
    return data.name;
  } catch (error) {
    console.error(`Error fetching folder ${folderId}:`, error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get all active connections with missing folder names
    const { data: connections, error: fetchError } = await supabaseClient
      .from("user_drive_connections")
      .select("id, user_id, access_token, strategy_folder_id, strategy_folder_name, meetings_folder_id, meetings_folder_name, financial_folder_id, financial_folder_name")
      .eq("is_active", true)
      .or("strategy_folder_name.is.null,meetings_folder_name.is.null,financial_folder_name.is.null");

    if (fetchError) {
      console.error("Error fetching connections:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch connections" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Array<{ connectionId: string; updates: Record<string, string> }> = [];

    // Process each connection
    for (const conn of connections || []) {
      const updateData: Record<string, string> = {};

      // Check strategy folder
      if (conn.strategy_folder_id && !conn.strategy_folder_name) {
        const name = await getFolderName(conn.strategy_folder_id, conn.access_token);
        if (name) {
          updateData.strategy_folder_name = name;
          console.log(`Found strategy folder name: ${name}`);
        }
      }

      // Check meetings folder
      if (conn.meetings_folder_id && !conn.meetings_folder_name) {
        const name = await getFolderName(conn.meetings_folder_id, conn.access_token);
        if (name) {
          updateData.meetings_folder_name = name;
          console.log(`Found meetings folder name: ${name}`);
        }
      }

      // Check financial folder
      if (conn.financial_folder_id && !conn.financial_folder_name) {
        const name = await getFolderName(conn.financial_folder_id, conn.access_token);
        if (name) {
          updateData.financial_folder_name = name;
          console.log(`Found financial folder name: ${name}`);
        }
      }

      // Update database if we found any names
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseClient
          .from("user_drive_connections")
          .update(updateData)
          .eq("id", conn.id);

        if (updateError) {
          console.error(`Failed to update connection ${conn.id}:`, updateError);
        } else {
          updates.push({ connectionId: conn.id, updates: updateData });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      updated: updates.length,
      details: updates
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in fetch-missing-folder-names:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});