import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateTokens, refreshAccessToken, corsHeaders } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { grant_type, client_id, client_secret, refresh_token } = body;

    // Grant type: client_credentials → issue access + refresh tokens
    if (grant_type === 'client_credentials') {
      if (!client_id || !client_secret) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'Bad Request – client_id and client_secret are required',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokens = await generateTokens(client_id, client_secret);
      if (!tokens) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'Unauthorized – invalid credentials',
        }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(tokens), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Grant type: refresh_token → issue new access token
    if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'Bad Request – refresh_token is required',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await refreshAccessToken(refresh_token);
      if (!result) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'Unauthorized – invalid or expired refresh token',
        }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      status: 'error',
      error: 'Bad Request – grant_type must be "client_credentials" or "refresh_token"',
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('api-v1-token error:', error);
    return new Response(JSON.stringify({ status: 'error', error: 'Internal Server Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
