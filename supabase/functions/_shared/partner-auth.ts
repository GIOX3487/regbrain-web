/**
 * Shared OAuth2-like authentication for Partner API.
 * Replaces static x-api-key with JWT access tokens + refresh tokens.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const JWT_ACCESS_EXPIRY_SECONDS = 3600; // 1 hour
const JWT_REFRESH_EXPIRY_DAYS = 90;

interface PartnerClaims {
  partner_id: string;
  tenant_id: string;
  scopes: string[];
  exp: number;
  iat: number;
  type: 'access' | 'refresh';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-tenant-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export { corsHeaders };

async function getSigningKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('PARTNER_API_KEY') || 'fallback-partner-key';
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret.padEnd(32, '0').substring(0, 32));
  return await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signJWT(payload: PartnerClaims): Promise<string> {
  const key = await getSigningKey();
  const encoder = new TextEncoder();
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const data = encoder.encode(`${header}.${body}`);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return `${header}.${body}.${base64UrlEncode(signature)}`;
}

async function verifyJWT(token: string): Promise<PartnerClaims | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const key = await getSigningKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlDecode(parts[2]);
    const signatureBuffer = signature.slice().buffer as ArrayBuffer;
    const dataBuffer = data.slice().buffer as ArrayBuffer;
    const valid = await crypto.subtle.verify("HMAC", key, signatureBuffer, dataBuffer);
    if (!valid) return null;
    const payload: PartnerClaims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hashBuffer));
}

export async function generateTokens(partnerId: string, clientSecret: string): Promise<{
  access_token: string; refresh_token: string; expires_in: number; token_type: string;
} | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const secretHash = await hashString(clientSecret);

  const { data: partner, error } = await supabase
    .from('partner_api_tokens')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('client_secret_hash', secretHash)
    .eq('active', true)
    .maybeSingle();

  if (error || !partner) return null;

  const now = Math.floor(Date.now() / 1000);

  const accessPayload: PartnerClaims = {
    partner_id: partner.partner_id,
    tenant_id: partner.tenant_id,
    scopes: partner.scopes,
    type: 'access',
    iat: now,
    exp: now + JWT_ACCESS_EXPIRY_SECONDS,
  };

  const refreshPayload: PartnerClaims = {
    partner_id: partner.partner_id,
    tenant_id: partner.tenant_id,
    scopes: partner.scopes,
    type: 'refresh',
    iat: now,
    exp: now + (JWT_REFRESH_EXPIRY_DAYS * 86400),
  };

  const accessToken = await signJWT(accessPayload);
  const refreshToken = await signJWT(refreshPayload);

  // Store refresh token hash
  const refreshHash = await hashString(refreshToken);
  await supabase
    .from('partner_api_tokens')
    .update({
      refresh_token_hash: refreshHash,
      refresh_token_expires_at: new Date((now + JWT_REFRESH_EXPIRY_DAYS * 86400) * 1000).toISOString(),
    })
    .eq('id', partner.id);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: JWT_ACCESS_EXPIRY_SECONDS,
    token_type: 'Bearer',
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string; expires_in: number; token_type: string;
} | null> {
  const claims = await verifyJWT(refreshToken);
  if (!claims || claims.type !== 'refresh') return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const refreshHash = await hashString(refreshToken);
  const { data: partner } = await supabase
    .from('partner_api_tokens')
    .select('*')
    .eq('partner_id', claims.partner_id)
    .eq('refresh_token_hash', refreshHash)
    .eq('active', true)
    .maybeSingle();

  if (!partner) return null;

  const now = Math.floor(Date.now() / 1000);
  const accessPayload: PartnerClaims = {
    partner_id: partner.partner_id,
    tenant_id: partner.tenant_id,
    scopes: partner.scopes,
    type: 'access',
    iat: now,
    exp: now + JWT_ACCESS_EXPIRY_SECONDS,
  };

  return {
    access_token: await signJWT(accessPayload),
    expires_in: JWT_ACCESS_EXPIRY_SECONDS,
    token_type: 'Bearer',
  };
}

export interface AuthResult {
  partner_id: string;
  tenant_id: string;
  scopes: string[];
}

/**
 * Validates the request: checks Bearer token + X-Tenant-ID header.
 * Returns AuthResult or null if invalid.
 */
export async function validateRequest(req: Request): Promise<AuthResult | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const claims = await verifyJWT(token);
  if (!claims || claims.type !== 'access') return null;

  // Validate X-Tenant-ID matches token
  const tenantId = req.headers.get('X-Tenant-ID');
  if (!tenantId || tenantId !== claims.tenant_id) return null;

  return {
    partner_id: claims.partner_id,
    tenant_id: claims.tenant_id,
    scopes: claims.scopes,
  };
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({
    status: 'error',
    error: 'Unauthorized – invalid or missing Bearer token, or X-Tenant-ID mismatch',
  }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function forbiddenResponse(scope: string): Response {
  return new Response(JSON.stringify({
    status: 'error',
    error: `Forbidden – missing scope: ${scope}`,
  }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
