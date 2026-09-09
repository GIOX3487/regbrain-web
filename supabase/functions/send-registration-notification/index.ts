import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
const ADMIN_EMAIL = "regbrain.contact@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegistrationNotificationRequest {
  email: string;
  userId: string;
  metadata?: {
    jurisdiction?: string;
    sector?: string;
    compliance_role?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userId, metadata }: RegistrationNotificationRequest = await req.json();

    console.log("Sending registration notification for user:", email);

    const registrationDate = new Date().toLocaleString("it-IT", {
      dateStyle: "full",
      timeStyle: "medium",
    });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
      from: "RegBrain <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: "🔔 Nuova Registrazione - RegBrain Platform",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #f9fafb;
                padding: 30px;
                border: 1px solid #e5e7eb;
                border-top: none;
              }
              .info-box {
                background: white;
                border-left: 4px solid #667eea;
                padding: 15px;
                margin: 15px 0;
                border-radius: 4px;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #f3f4f6;
              }
              .info-row:last-child {
                border-bottom: none;
              }
              .label {
                font-weight: 600;
                color: #6b7280;
              }
              .value {
                color: #111827;
                font-weight: 500;
              }
              .footer {
                text-align: center;
                padding: 20px;
                color: #6b7280;
                font-size: 14px;
                background: #f9fafb;
                border-radius: 0 0 10px 10px;
                border: 1px solid #e5e7eb;
                border-top: none;
              }
              .badge {
                display: inline-block;
                padding: 4px 12px;
                background: #dbeafe;
                color: #1e40af;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">🎉 Nuova Registrazione</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">RegBrain Compliance Platform</p>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; margin-top: 0;">
                Un nuovo utente si è appena registrato sulla piattaforma RegBrain.
              </p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #667eea;">📋 Dettagli Utente</h3>
                
                <div class="info-row">
                  <span class="label">Email:</span>
                  <span class="value">${email}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">User ID:</span>
                  <span class="value" style="font-family: monospace; font-size: 12px;">${userId}</span>
                </div>
                
                <div class="info-row">
                  <span class="label">Data Registrazione:</span>
                  <span class="value">${registrationDate}</span>
                </div>
                
                ${metadata?.compliance_role ? `
                <div class="info-row">
                  <span class="label">Ruolo:</span>
                  <span class="value"><span class="badge">${metadata.compliance_role}</span></span>
                </div>
                ` : ''}
                
                ${metadata?.sector ? `
                <div class="info-row">
                  <span class="label">Settore:</span>
                  <span class="value">${metadata.sector}</span>
                </div>
                ` : ''}
                
                ${metadata?.jurisdiction ? `
                <div class="info-row">
                  <span class="label">Giurisdizione:</span>
                  <span class="value">${metadata.jurisdiction}</span>
                </div>
                ` : ''}
              </div>
              
              <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">
                💡 <strong>Nota di Sicurezza:</strong> Per motivi di sicurezza, le credenziali di accesso non vengono incluse in questa notifica. L'utente ha ricevuto un'email di conferma separata.
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 0;">
                <strong>RegBrain Platform</strong> - Sistema di Gestione Compliance
              </p>
              <p style="margin: 5px 0 0 0; font-size: 13px;">
                Notifica automatica generata dal sistema
              </p>
            </div>
          </body>
        </html>
      `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${emailResponse.status} ${errorText}`);
    }

    const emailResult = await emailResponse.json();

    console.log("Registration notification sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notification sent",
        emailId: emailResult.id 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error sending registration notification:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
