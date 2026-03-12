/**
 * Edge Function: google-oauth
 *
 * Fluxos:
 * - action: "getLoginUrl"     -> retorna URL do OAuth Google (access_type=offline, prompt=consent)
 * - action: "exchangeCode"    -> troca code por tokens, criptografa e salva em google_connections
 * - action: "getConnectionStatus" -> retorna se há conexão ativa (sem expor tokens)
 * - action: "disconnect"     -> remove conexão da empresa
 *
 * Scopes: GA4, Ads, My Business.
 * refresh_token é armazenado criptografado para renovação automática de access_token no futuro.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/business.manage",
]

interface ProfilesRow {
  company_id: string | null
  saas_admin?: boolean | null
}

interface AuthContext {
  sub: string
  companyId: string
  isSaasAdmin: boolean
}

type GoogleAction = "getLoginUrl" | "exchangeCode" | "getConnectionStatus" | "disconnect"

interface BaseRequestBody {
  action?: GoogleAction
  token?: string
}

interface GetLoginUrlBody extends BaseRequestBody {
  action: "getLoginUrl"
  state?: string
  company_id?: string
}

interface ExchangeCodeBody extends BaseRequestBody {
  action: "exchangeCode"
  code?: string
  state?: string
  company_id?: string
}

interface GetConnectionStatusBody extends BaseRequestBody {
  action: "getConnectionStatus"
  company_id?: string
}

interface DisconnectBody extends BaseRequestBody {
  action: "disconnect"
  company_id?: string
}

type RequestBody = GetLoginUrlBody | ExchangeCodeBody | GetConnectionStatusBody | DisconnectBody

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function toBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes)
  const b64 = btoa(bin)
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i)
  }
  return bytes
}

async function getAesKey(encryptionKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyBytes = encoder.encode(encryptionKey.padEnd(32).slice(0, 32))
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"])
}

async function encryptToken(plain: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await getAesKey(encryptionKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plain),
  )
  const cipherBytes = new Uint8Array(cipherBuf)
  const ivB64 = toBase64Url(iv)
  const cipherB64 = toBase64Url(cipherBytes)
  return `${ivB64}:${cipherB64}`
}

function getGoogleConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
  encryptionKey: string
} | { error: Response } {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim()
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim()
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")?.trim()
  const encryptionKey = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY")?.trim()

  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
    return {
      error: jsonResponse(
        {
          error: "Configuração do Google incompleta.",
          hint:
            "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI e GOOGLE_TOKEN_ENCRYPTION_KEY nas secrets do Supabase.",
        },
        500,
      ),
    }
  }
  return { clientId, clientSecret, redirectUri, encryptionKey }
}

async function requireAuthAndCompany(
  req: Request,
  body?: RequestBody,
): Promise<{ error?: Response; ctx?: AuthContext; supabase?: ReturnType<typeof createClient> }> {
  const authHeader = req.headers.get("Authorization")
  const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, "")?.trim() || null
  const tokenFromBody =
    typeof body?.token === "string" && body.token.trim().length > 0 ? body.token.trim() : null
  const token = tokenFromBody || tokenFromHeader

  if (!token) {
    return {
      error: jsonResponse(
        { error: "Token ausente. Faça login novamente.", code: "MISSING_TOKEN" },
        401,
      ),
    }
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret || !clerkSecret.startsWith("sk_")) {
    return {
      error: jsonResponse({ error: "Configuração do servidor inválida (CLERK_SECRET_KEY)." }, 500),
    }
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[google-oauth] verifyToken falhou:", msg)
    return {
      error: jsonResponse(
        {
          error: "Token inválido ou expirado. Faça login novamente.",
          hint: msg.slice(0, 120),
          code: "INVALID_TOKEN",
        },
        401,
      ),
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      error: jsonResponse(
        { error: "Configuração do servidor inválida (SUPABASE_URL/SERVICE_ROLE_KEY)." },
        500,
      ),
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, saas_admin")
    .eq("id", sub)
    .maybeSingle()

  const profileRow = profile as ProfilesRow | null
  const profileCompanyId = profileRow?.company_id ?? null
  const isSaasAdmin = Boolean(profileRow?.saas_admin)

  const bodyCompanyId =
    body && "company_id" in body && typeof body.company_id === "string"
      ? body.company_id.trim() || null
      : null

  let companyId: string
  if (bodyCompanyId) {
    if (!isSaasAdmin && bodyCompanyId !== profileCompanyId) {
      return {
        error: jsonResponse(
          { error: "Sem permissão para conectar esta empresa.", code: "FORBIDDEN" },
          403,
        ),
      }
    }
    companyId = bodyCompanyId
  } else {
    companyId = profileCompanyId ?? ""
  }

  if (!companyId) {
    return {
      error: jsonResponse(
        {
          error: "Empresa não identificada para este usuário.",
          hint: "Associe o usuário a uma company em profiles.company_id ou informe company_id (apenas saas_admin).",
        },
        400,
      ),
    }
  }

  return {
    ctx: { sub, companyId, isSaasAdmin },
    supabase,
  }
}

async function handleGetLoginUrl(body: GetLoginUrlBody): Promise<Response> {
  const config = getGoogleConfig()
  if ("error" in config) return config.error

  const { clientId, redirectUri } = config

  const providedState =
    typeof body.state === "string" && body.state.trim().length > 0
      ? body.state.trim()
      : crypto.randomUUID()

  const params = new URLSearchParams()
  params.set("client_id", clientId)
  params.set("redirect_uri", redirectUri)
  params.set("response_type", "code")
  params.set("scope", GOOGLE_SCOPES.join(" "))
  params.set("access_type", "offline")
  params.set("prompt", "consent")
  params.set("state", providedState)

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return jsonResponse({ url })
}

interface GoogleTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

async function handleExchangeCode(
  body: ExchangeCodeBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const config = getGoogleConfig()
  if ("error" in config) return config.error

  const { clientId, clientSecret, redirectUri, encryptionKey } = config

  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (!code) {
    return jsonResponse({ error: "Parâmetro 'code' é obrigatório." }, 400)
  }

  const tokenUrl = "https://oauth2.googleapis.com/token"
  const tokenParams = new URLSearchParams()
  tokenParams.set("client_id", clientId)
  tokenParams.set("client_secret", clientSecret)
  tokenParams.set("code", code)
  tokenParams.set("grant_type", "authorization_code")
  tokenParams.set("redirect_uri", redirectUri)

  let tokenData: GoogleTokenResponse = {}
  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    })
    tokenData = (await res.json().catch(() => ({}))) as GoogleTokenResponse
    if (!res.ok) {
      console.error("[google-oauth] Erro ao trocar code por token:", res.status, tokenData)
      const msg =
        tokenData.error_description ?? tokenData.error ?? `Erro ao obter tokens (${res.status}).`
      return jsonResponse({ error: msg }, 502)
    }
  } catch (err) {
    console.error("[google-oauth] Falha na requisição de token:", err)
    return jsonResponse({ error: "Erro ao comunicar com a API do Google." }, 502)
  }

  const accessToken =
    typeof tokenData.access_token === "string" ? tokenData.access_token.trim() : ""
  const refreshToken =
    typeof tokenData.refresh_token === "string" ? tokenData.refresh_token.trim() : ""

  if (!accessToken) {
    return jsonResponse(
      { error: "Resposta do Google não retornou access_token.", debug: tokenData },
      502,
    )
  }

  if (!refreshToken) {
    return jsonResponse(
      {
        error:
          "Google não retornou refresh_token. Isso pode ocorrer se o usuário já autorizou antes. Revogue o acesso em myaccount.google.com/permissions e tente novamente.",
        hint: "O refresh_token é essencial para atualização automática de dados no futuro.",
      },
      502,
    )
  }

  const expiresIn =
    typeof tokenData.expires_in === "number"
      ? tokenData.expires_in
      : typeof tokenData.expires_in === "string"
        ? Number(tokenData.expires_in)
        : null

  const tokenExpiresAt =
    expiresIn && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null

  let accessEncrypted: string
  let refreshEncrypted: string
  try {
    accessEncrypted = await encryptToken(accessToken, encryptionKey)
    refreshEncrypted = await encryptToken(refreshToken, encryptionKey)
  } catch (err) {
    console.error("[google-oauth] Falha ao criptografar tokens:", err)
    return jsonResponse({ error: "Erro ao proteger credenciais de acesso." }, 500)
  }

  const payload = {
    company_id: ctx.companyId,
    access_token_encrypted: accessEncrypted,
    refresh_token_encrypted: refreshEncrypted,
    token_expires_at: tokenExpiresAt,
    scopes: GOOGLE_SCOPES,
    status: "active",
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("google_connections").upsert(payload, {
    onConflict: "company_id",
  })

  if (error) {
    console.error("[google-oauth] Erro ao salvar conexão:", error)
    return jsonResponse(
      {
        error: "Erro ao salvar credenciais do Google.",
        hint: "Verifique se a tabela google_connections existe e a migration foi aplicada.",
      },
      500,
    )
  }

  return jsonResponse({ success: true })
}

async function handleGetConnectionStatus(
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const { data, error } = await supabase
    .from("google_connections")
    .select("id, status, connected_at")
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error) {
    console.error("[google-oauth] Erro ao buscar conexão:", error)
    return jsonResponse(
      { error: "Erro ao verificar status da conexão Google.", hint: error.message },
      500,
    )
  }

  const connected = Boolean(data && data.status === "active")
  return jsonResponse({
    connected,
    connected_at: data?.connected_at ?? null,
  })
}

async function handleDisconnect(
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const { error } = await supabase
    .from("google_connections")
    .delete()
    .eq("company_id", ctx.companyId)

  if (error) {
    console.error("[google-oauth] Erro ao desconectar:", error)
    return jsonResponse(
      { error: "Erro ao remover conexão Google.", hint: error.message },
      500,
    )
  }

  return jsonResponse({ success: true })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: "Body JSON inválido." }, 400)
  }

  const action = body?.action

  if (action === "getLoginUrl") {
    const config = getGoogleConfig()
    if ("error" in config) return config.error
    return handleGetLoginUrl(body as GetLoginUrlBody)
  }

  const authResult = await requireAuthAndCompany(req, body)
  if (authResult.error) return authResult.error
  const { ctx, supabase } = authResult
  if (!ctx || !supabase) return jsonResponse({ error: "Erro interno." }, 500)

  switch (action) {
    case "exchangeCode":
      return handleExchangeCode(body as ExchangeCodeBody, ctx, supabase)
    case "getConnectionStatus":
      return handleGetConnectionStatus(ctx, supabase)
    case "disconnect":
      return handleDisconnect(ctx, supabase)
    default:
      return jsonResponse({ error: `Action desconhecida: ${action}` }, 400)
  }
})
