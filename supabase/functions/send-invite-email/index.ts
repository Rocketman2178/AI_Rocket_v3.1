import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InviteRequest {
  email: string;
  inviteCode: string;
  teamName: string;
  role: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string;
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      userId = payload.sub;
    } catch (e) {
      console.error("Failed to parse JWT:", e);
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await supabaseAdmin.auth.admin.getUserById(userId);

    if (result.error || !result.data.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User not found' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = result.data.user;
    const { email, inviteCode, teamName, role }: InviteRequest = await req.json();

    if (!email || !inviteCode || !teamName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inviterName = user.user_metadata?.full_name || user.email;
    const appUrl = 'https://airocket.app';

    const emailSubject = `Join ${teamName} on AI Rocket`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name=\"color-scheme\" content=\"light dark\">
          <meta name=\"supported-color-schemes\" content=\"light dark\">
          <style>
            :root {
              color-scheme: light dark;
              supported-color-schemes: light dark;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
              line-height: 1.6;
              color: #e5e7eb !important;
              margin: 0 !important;
              padding: 0 !important;
              background-color: #0f172a !important;
            }
            body[data-outlook-cycle] {
              background-color: #0f172a !important;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #1e293b !important;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            }
            .email-wrapper {
              background-color: #0f172a !important;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .header .tagline {
              margin: 8px 0 0 0;
              font-size: 14px;
              opacity: 0.95;
              font-weight: 500;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 18px;
              font-weight: 600;
              color: #f3f4f6;
              margin-bottom: 20px;
            }
            .message {
              font-size: 16px;
              color: #d1d5db;
              margin-bottom: 20px;
              line-height: 1.8;
            }
            .invite-box {
              background: #334155;
              border: 2px solid #475569;
              border-radius: 8px;
              padding: 24px;
              margin: 30px 0;
              text-align: center;
            }
            .invite-label {
              font-size: 12px;
              text-transform: uppercase;
              color: #94a3b8;
              font-weight: 600;
              letter-spacing: 1px;
              margin-bottom: 12px;
            }
            .invite-code {
              font-size: 32px;
              font-weight: 700;
              color: #4ade80;
              font-family: 'Courier New', monospace;
              letter-spacing: 3px;
              margin-bottom: 8px;
            }
            .email-display {
              font-size: 14px;
              color: #94a3b8;
              margin-top: 12px;
            }
            .email-value {
              font-weight: 600;
              color: #e5e7eb;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
              color: white;
              padding: 18px 48px;
              border-radius: 12px;
              text-decoration: none;
              font-weight: 700;
              font-size: 18px;
              margin: 10px 0;
              transition: transform 0.2s;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            .cta-container {
              text-align: center;
              margin: 20px 0;
            }
            .value-section {
              background: #334155;
              border-radius: 8px;
              padding: 24px;
              margin: 30px 0;
            }
            .value-title {
              font-size: 18px;
              font-weight: 700;
              color: #f3f4f6;
              margin-bottom: 16px;
            }
            .feature-list {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .feature-list li {
              padding: 8px 0 8px 28px;
              position: relative;
              color: #d1d5db;
              font-size: 15px;
            }
            .feature-list li:before {
              content: \"✅\";
              position: absolute;
              left: 0;
            }
            .use-case-section {
              margin: 30px 0;
            }
            .use-case-category {
              margin-bottom: 20px;
            }
            .category-title {
              font-size: 16px;
              font-weight: 700;
              color: #f3f4f6;
              margin-bottom: 8px;
            }
            .category-title:before {
              margin-right: 8px;
            }
            .use-case-list {
              list-style: none;
              padding: 0;
              margin: 0 0 0 24px;
            }
            .use-case-list li {
              color: #9ca3af;
              font-size: 14px;
              padding: 4px 0;
              font-style: italic;
            }
            .use-case-list li:before {
              content: \"•\";
              color: #64748b;
              margin-right: 8px;
            }
            .steps {
              background: #1e3a5f;
              border-left: 4px solid #3b82f6;
              padding: 20px;
              margin: 30px 0;
              border-radius: 4px;
            }
            .steps-title {
              font-weight: 600;
              color: #60a5fa;
              margin-bottom: 12px;
              font-size: 16px;
            }
            .steps ol {
              margin: 0;
              padding-left: 20px;
              color: #93c5fd;
            }
            .steps li {
              margin-bottom: 8px;
              font-size: 14px;
            }
            .pro-tips {
              background: #422006;
              border-left: 4px solid #f59e0b;
              padding: 20px;
              margin: 30px 0;
              border-radius: 4px;
            }
            .pro-tips-title {
              font-weight: 600;
              color: #fbbf24;
              margin-bottom: 12px;
              font-size: 16px;
            }
            .pro-tips p {
              margin: 8px 0;
              color: #fcd34d;
              font-size: 14px;
            }
            .footer {
              background: #0f172a;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #334155;
              font-size: 13px;
              color: #94a3b8;
            }
            .footer a {
              color: #60a5fa;
              text-decoration: none;
            }
            .divider {
              border-top: 1px solid #334155;
              margin: 30px 0;
            }
          </style>
        </head>
        <body>
          <div class=\"email-wrapper\">
            <div class=\"container\">
            <div class=\"header\">
              <h1>🚀 Welcome to AI Rocket + Astra Intelligence</h1>
              <p class=\"tagline\">AI that Works for Work</p>
            </div>
            <div class=\"content\">
              <div class=\"greeting\">
                Hi there!
              </div>
              <div class=\"message\">
                <strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on AI Rocket + Astra Intelligence.
              </div>

              <div class=\"invite-box\">
                <div class=\"invite-label\">Your Invite Code</div>
                <div class=\"invite-code\">${inviteCode}</div>
                <div class=\"email-display\">
                  Use with email: <span class=\"email-value\">${email}</span>
                </div>
              </div>

              <div class=\"cta-container\">
                <a href=\"${appUrl}\" class=\"cta-button\">
                  Create Your Account →
                </a>
              </div>

              <div class=\"divider\"></div>

              <div class=\"value-section\">
                <div class=\"value-title\">What is AI Rocket + Astra?</div>
                <div class=\"message\" style=\"margin-bottom: 16px;\">
                  Your team's AI intelligence platform that connects to ALL your data and provides insights you can trust:
                </div>
                <ul class=\"feature-list\">
                  <li><strong>Instant Answers</strong> - Ask questions about meetings, documents, financials, and strategy in plain English</li>
                  <li><strong>Smart Context</strong> - Astra knows your team's mission, goals, and recent activities</li>
                  <li><strong>Visual Insights</strong> - Get automatic charts, graphs, and reports from your data</li>
                  <li><strong>Team Collaboration</strong> - Work together with AI-assisted group chats and @mentions</li>
                  <li><strong>Private & Secure</strong> - Your data stays with your team, never shared across organizations</li>
                </ul>
              </div>

              <div class=\"use-case-section\">
                <div class=\"value-title\">What Can Astra Do For You?</div>

                <div class=\"use-case-category\">
                  <div class=\"category-title\">📊 Meeting Intelligence</div>
                  <ul class=\"use-case-list\">
                    <li>\"What were our key decisions from last week's Leadership Meeting?\"</li>
                    <li>\"Show me action items assigned to me this month\"</li>
                    <li>\"Summarize client feedback from recent calls\"</li>
                  </ul>
                </div>

                <div class=\"use-case-category\">
                  <div class=\"category-title\">📈 Strategic Insights</div>
                  <ul class=\"use-case-list\">
                    <li>\"How do our recent activities align with our quarterly goals?\"</li>
                    <li>\"What are the top initiatives we're working on?\"</li>
                    <li>\"Compare this quarter's progress to last quarter\"</li>
                  </ul>
                </div>

                <div class=\"use-case-category\">
                  <div class=\"category-title\">💰 Financial Analysis</div>
                  <ul class=\"use-case-list\">
                    <li>\"What's our revenue trend over the last 6 months?\"</li>
                    <li>\"Show me our biggest expenses this quarter\"</li>
                    <li>\"How does our current P&L compare to budget?\"</li>
                  </ul>
                </div>

                <div class=\"use-case-category\">
                  <div class=\"category-title\">🔍 Smart Search</div>
                  <ul class=\"use-case-list\">
                    <li>Find information across ALL your team's documents, meetings, and data</li>
                    <li>Get answers backed by specific sources and dates</li>
                    <li>Ask follow-up questions for deeper insights</li>
                  </ul>
                </div>
              </div>

              <div class=\"steps\">
                <div class=\"steps-title\">🎯 Get Started in 3 Minutes:</div>
                <ol>
                  <li>Click the button above to visit AI Rocket</li>
                  <li>Select \"Sign Up\" and enter your email: <strong>${email}</strong></li>
                  <li>Create a password for your account</li>
                  <li>Enter your invite code: <strong>${inviteCode}</strong></li>
                  <li>Start asking Astra anything about your team!</li>
                </ol>
              </div>

              <div class=\"pro-tips\">
                <div class=\"pro-tips-title\">💡 Pro Tips:</div>
                <p>• Try asking: \"What should I know about our team?\" to get started</p>
                <p>• Use @Astra in group chats to get AI help for everyone</p>
                <p>• Save your favorite insights as visualizations for quick access</p>
              </div>

              <div class=\"message\">
                <strong>Your Role:</strong> You'll be joining as a <strong>${role}</strong> with access to team conversations, AI-powered insights, meeting transcripts, action items, strategy documents, and company goals.
              </div>

              <div class=\"divider\"></div>

              <div class=\"invite-box\">
                <div class=\"invite-label\">Your Invite Code</div>
                <div class=\"invite-code\">${inviteCode}</div>
                <div class=\"email-display\">
                  Use with email: <span class=\"email-value\">${email}</span>
                </div>
              </div>

              <div class=\"cta-container\">
                <a href=\"${appUrl}\" class=\"cta-button\">
                  Create Your Account →
                </a>
              </div>
            </div>
            <div class=\"footer\">
              <p>
                This invitation was sent by ${inviterName} from ${teamName}.<br>
                Questions? Contact your team administrator.
              </p>
              <p style=\"margin-top: 20px;\">
                <a href=\"${appUrl}\">AI Rocket + Astra</a> - AI that Works for Work
              </p>
            </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AI Rocket Invite <invite@rockethub.ai>",
        to: email,
        reply_to: user.email,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: errorText,
          status: resendResponse.status
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendResponse.json();
    console.log("Invite email sent successfully:", resendData);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invite email sent successfully to ${email}`,
        emailId: resendData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-invite-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});