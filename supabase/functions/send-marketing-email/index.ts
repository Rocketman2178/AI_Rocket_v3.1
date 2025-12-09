import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MarketingEmailRequest {
  recipientEmails?: string[];
  subject?: string;
  htmlContent?: string;
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { recipientEmails, subject, htmlContent }: MarketingEmailRequest = await req.json();

    let recipients: { email: string; firstName: string }[] = [];

    if (recipientEmails && recipientEmails.length > 0) {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('email, name')
        .in('email', recipientEmails);

      if (error) {
        console.error("Error fetching test users:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch users" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      recipients = users.map(u => ({
        email: u.email,
        firstName: u.name?.split(' ')[0] || 'there'
      }));
    } else {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('email, name');

      if (error) {
        console.error("Error fetching all users:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch users" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      recipients = users.map(u => ({
        email: u.email,
        firstName: u.name?.split(' ')[0] || 'there'
      }));
    }

    const appUrl = 'https://airocket.app';
    const emailSubject = subject || 'Astra Guided Setup now Live';

    const results = [];
    const errors = [];

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      if (i > 0 && i % 2 === 0) {
        await delay(1000);
      }

      const emailHtml = htmlContent
        ? htmlContent.replace(/\{\{firstName\}\}/g, recipient.firstName)
        : `
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
                font-size: 22px;
                font-weight: 600;
                color: #f3f4f6;
                margin-bottom: 16px;
                text-align: center;
              }
              .hero-text {
                font-size: 18px;
                color: #d1d5db;
                margin-bottom: 24px;
                line-height: 1.7;
                text-align: center;
              }
              .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                color: white !important;
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
                margin: 30px 0;
              }
              .feature-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 16px;
                margin: 30px 0;
              }
              .feature-card {
                background: #334155;
                border: 2px solid #475569;
                border-radius: 12px;
                padding: 20px;
                text-align: center;
              }
              .feature-icon {
                font-size: 56px;
                margin-bottom: 12px;
              }
              .feature-title {
                font-size: 18px;
                font-weight: 700;
                color: #f3f4f6;
                margin-bottom: 4px;
              }
              .benefits-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin: 24px 0;
              }
              .benefit-card {
                background: #1e3a5f;
                border: 1px solid #3b82f6;
                border-radius: 10px;
                padding: 16px;
                text-align: center;
              }
              .benefit-icon {
                font-size: 32px;
                margin-bottom: 8px;
              }
              .benefit-text {
                font-size: 13px;
                font-weight: 600;
                color: #93c5fd;
              }
              .access-section {
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                border: 2px solid #f59e0b;
                border-radius: 16px;
                padding: 32px 24px;
                margin: 30px 0;
              }
              .access-title {
                font-weight: 700;
                color: #fbbf24;
                margin-bottom: 24px;
                font-size: 20px;
                text-align: center;
              }
              .steps-container {
                background: #475569;
                border-radius: 12px;
                padding: 24px;
              }
              .step-row {
                background: #1e293b;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 16px;
              }
              .step-row:last-child {
                margin-bottom: 0;
              }
              .step-number {
                flex-shrink: 0;
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #f97316 0%, #3b82f6 100%);
                border-radius: 50%;
                color: white;
                font-weight: 700;
                font-size: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .step-text {
                font-size: 15px;
                color: #e2e8f0;
                font-weight: 600;
              }
              .arrow-down {
                text-align: center;
                font-size: 24px;
                color: #64748b;
                margin: 8px 0;
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
            </style>
          </head>
          <body>
            <div class=\"email-wrapper\">
              <div class=\"container\">
                <div class=\"header\">
                  <h1>🚀 AI Rocket + Astra Intelligence</h1>
                  <p class=\"tagline\">AI that Works for Work</p>
                </div>

                <div class=\"content\">
                  <div class=\"greeting\">
                    Hi ${recipient.firstName}! 👋
                  </div>

                  <div class=\"hero-text\">
                    <strong>Astra Guided Setup</strong> is now live! Let Astra walk you through connecting your team's data in just 5 minutes.
                  </div>

                  <div class=\"cta-container\">
                    <a href=\"${appUrl}\" class=\"cta-button\">
                      Launch AI Rocket →
                    </a>
                  </div>

                  <div class=\"hero-text\" style=\"font-size: 16px; margin-bottom: 12px; color: #cbd5e1;\">
                    Connect your Strategy Documents, Meeting Notes, and Financial Data to unlock:
                  </div>

                  <div class=\"benefits-grid\">
                    <div class=\"benefit-card\">
                      <div class=\"benefit-icon\">📊</div>
                      <div class=\"benefit-text\">Strategy Intelligence</div>
                    </div>
                    <div class=\"benefit-card\">
                      <div class=\"benefit-icon\">📝</div>
                      <div class=\"benefit-text\">Meeting Insights</div>
                    </div>
                    <div class=\"benefit-card\">
                      <div class=\"benefit-icon\">💰</div>
                      <div class=\"benefit-text\">Financial Analysis</div>
                    </div>
                    <div class=\"benefit-card\">
                      <div class=\"benefit-icon\">🎯</div>
                      <div class=\"benefit-text\">Cross-Data Insights</div>
                    </div>
                    <div class=\"benefit-card\">
                      <div class=\"benefit-icon\">📈</div>
                      <div class=\"benefit-text\">Visual Reports</div>
                    </div>
                    <div class=\"benefit-card\">
                      <div class=\"benefit-icon\">🤝</div>
                      <div class=\"benefit-text\">Team Collaboration</div>
                    </div>
                  </div>

                  <div class=\"access-section\">
                    <div class=\"access-title\">🎯 How to Access Guided Setup</div>
                    <div class=\"steps-container\">
                      <div class=\"step-row\">
                        <div class=\"step-number\">1</div>
                        <div class=\"step-text\">Open AI Rocket app</div>
                      </div>
                      <div class=\"arrow-down\">↓</div>
                      <div class=\"step-row\">
                        <div class=\"step-number\">2</div>
                        <div class=\"step-text\">Click the <strong>+</strong> button in Features Menu</div>
                      </div>
                      <div class=\"arrow-down\">↓</div>
                      <div class=\"step-row\">
                        <div class=\"step-number\">3</div>
                        <div class=\"step-text\">Select \"Launch Guided Setup\"</div>
                      </div>
                      <div class=\"arrow-down\">↓</div>
                      <div class=\"step-row\">
                        <div class=\"step-number\">4</div>
                        <div class=\"step-text\">Follow Astra's guidance</div>
                      </div>
                    </div>
                  </div>

                  <div class=\"cta-container\">
                    <a href=\"${appUrl}\" class=\"cta-button\">
                      Launch AI Rocket →
                    </a>
                  </div>
                </div>

                <div class=\"footer\">
                  <p>
                    You're receiving this email because you have an account with AI Rocket.
                  </p>
                  <p style=\"margin-top: 20px;\">
                    <a href=\"${appUrl}\">AI Rocket + Astra</a> - AI that Works for Work
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `.replace(/\{\{firstName\}\}/g, recipient.firstName);

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Astra Intelligence <astra@rockethub.ai>",
            to: recipient.email,
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          console.error(`Failed to send to ${recipient.email}:`, resendResponse.status, errorText);
          errors.push({ email: recipient.email, error: errorText });
        } else {
          const resendData = await resendResponse.json();
          results.push({ email: recipient.email, emailId: resendData.id });
          console.log(`Email sent successfully to ${recipient.email}`);
        }
      } catch (error) {
        console.error(`Error sending to ${recipient.email}:`, error);
        errors.push({ email: recipient.email, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${results.length} emails successfully`,
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-marketing-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
