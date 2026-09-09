import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT secret key - use environment variable or fallback to password-based key
const getJWTSecret = async (): Promise<CryptoKey> => {
  const secretString = Deno.env.get('SITE_ACCESS_PASSWORD') || 'fallback-secret-key';
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretString.padEnd(32, '0').substring(0, 32));
  
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
};

// Rate limiting: store failed attempts by IP
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Handle token verification endpoint
    if (action === 'verify-token') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Token mancante' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      try {
        const secret = await getJWTSecret();
        const payload = await verify(token, secret);
        
        // Check token expiration
        if (payload.exp && payload.exp < Date.now() / 1000) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Token scaduto' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
          );
        }

        return new Response(
          JSON.stringify({ valid: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.warn('Token verification failed');
        return new Response(
          JSON.stringify({ valid: false, error: 'Token non valido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
    }
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Check rate limiting
    const attempts = failedAttempts.get(clientIP);
    if (attempts && attempts.count >= MAX_ATTEMPTS) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
      if (timeSinceLastAttempt < LOCKOUT_DURATION) {
        const remainingMinutes = Math.ceil((LOCKOUT_DURATION - timeSinceLastAttempt) / 60000);
        console.warn(`Rate limit exceeded for IP: ${clientIP}`);
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: `Troppi tentativi falliti. Riprova tra ${remainingMinutes} minuti.` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      } else {
        // Reset after lockout period
        failedAttempts.delete(clientIP);
      }
    }

    const { password } = await req.json();

    // Strict validation - NEVER log the password
    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Password non valida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Additional length check to prevent extremely long inputs
    if (password.length > 200) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Password non valida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get the password from environment variable - NEVER log it
    const correctPassword = Deno.env.get('SITE_ACCESS_PASSWORD');

    if (!correctPassword) {
      console.error('CRITICAL: SITE_ACCESS_PASSWORD not configured');
      return new Response(
        JSON.stringify({ valid: false, error: 'Errore di configurazione del server' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Constant-time comparison to prevent timing attacks
    // Use TextEncoder to ensure consistent byte representation
    const encoder = new TextEncoder();
    const correctBytes = encoder.encode(correctPassword);
    const providedBytes = encoder.encode(password.padEnd(correctPassword.length));
    
    // Ensure both arrays are same length before comparison
    let isValid = correctBytes.length === providedBytes.length;
    
    // Constant-time byte comparison - always check all bytes
    if (isValid) {
      let mismatch = 0;
      for (let i = 0; i < correctBytes.length; i++) {
        mismatch |= correctBytes[i] ^ providedBytes[i];
      }
      isValid = mismatch === 0;
    }

    if (!isValid) {
      // Track failed attempt - log IP only, never the password
      const current = failedAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
      failedAttempts.set(clientIP, {
        count: current.count + 1,
        lastAttempt: Date.now()
      });
      console.warn(`Failed login from IP: ${clientIP} (${current.count + 1}/${MAX_ATTEMPTS})`);
      
      return new Response(
        JSON.stringify({ valid: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clear failed attempts on success
    failedAttempts.delete(clientIP);
    console.info(`Successful login from IP: ${clientIP}`);

    // Generate secure JWT token
    const secret = await getJWTSecret();
    const jwt = await create(
      { alg: "HS256", typ: "JWT" },
      { 
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        iat: Math.floor(Date.now() / 1000),
        iss: "regbrain-site-auth"
      },
      secret
    );

    return new Response(
      JSON.stringify({ valid: true, token: jwt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // SECURITY: Never log error details that might contain password
    console.error('Error in password verification (details hidden for security)');
    return new Response(
      JSON.stringify({ valid: false, error: 'Errore del server' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
