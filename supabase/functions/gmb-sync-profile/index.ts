/**
 * Edge Function: gmb-sync-profile
 *
 * Sincroniza Place ID e categorias do perfil Google Meu Negócio para a empresa.
 * Busca dados via Business Information API e atualiza companies.
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { company_id?: string }
 *
 * Secrets: CLERK_SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_ENCRYPTION_KEY
 *
 * Deploy DEV: npx supabase functions deploy gmb-sync-profile --project-ref mrkvvgofjyvlutqpvedt --no-verify-jwt
 * Deploy PROD: npx supabase functions deploy gmb-sync-profile --project-ref bctjodobbsxieywgulvl --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface GoogleConnectionRow {
  company_id: string
  access_token_encrypted: string
  refresh_token_encrypted?: string | null
  token_expires_at?: string | null
  selected_property_name?: string | null
}

interface RequestBody {
  company_id?: string
  token?: string
}

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

async function decryptToken(payload: string, encryptionKey: string): Promise<string> {
  const [ivPart, cipherPart] = payload.split(":")
  if (!ivPart || !cipherPart) {
    throw new Error("Token criptografado em formato inválido.")
  }
  const key = await getAesKey(encryptionKey)
  const iv = fromBase64Url(ivPart)
  const cipherBytes = fromBase64Url(cipherPart)
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    cipherBytes as BufferSource,
  )
  return new TextDecoder().decode(plainBuf)
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
  encryptionKey: string
} | { error: Response } {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim()
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim()
  const encryptionKey = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY")?.trim()

  if (!clientId || !clientSecret || !encryptionKey) {
    return {
      error: jsonResponse(
        {
          error: "Configuração do Google incompleta.",
          hint: "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_TOKEN_ENCRYPTION_KEY.",
        },
        500,
      ),
    }
  }
  return { clientId, clientSecret, encryptionKey }
}

function toPlaceType(raw: string | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  if (s.startsWith("gcid:")) return s.slice(5).trim() || null
  return s
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("", { status: 200, headers: corsHeaders })
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Método não permitido." }, 405)
    }

    let body: RequestBody
    try {
      body = (await req.json().catch(() => ({}))) as RequestBody
    } catch {
      body = {}
    }

  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")?.trim() ||
    (typeof body?.token === "string" ? body.token.trim() : null)

  if (!token) {
    return jsonResponse({ error: "Token ausente. Faça login novamente.", code: "MISSING_TOKEN" }, 401)
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret?.startsWith("sk_")) {
    return jsonResponse({ error: "Configuração do servidor inválida (CLERK_SECRET_KEY)." }, 500)
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch {
    return jsonResponse({ error: "Token inválido ou expirado. Faça login novamente.", code: "INVALID_TOKEN" }, 401)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Configuração do servidor inválida." }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, saas_admin")
    .eq("id", sub)
    .maybeSingle()

  const profileRow = profile as { company_id: string | null; saas_admin?: boolean } | null
  const profileCompanyId = profileRow?.company_id ?? null
  const isSaasAdmin = Boolean(profileRow?.saas_admin)
  const bodyCompanyId = typeof body.company_id === "string" ? body.company_id.trim() || null : null

  let companyId: string
  if (bodyCompanyId) {
    if (!isSaasAdmin && bodyCompanyId !== profileCompanyId) {
      return jsonResponse({ error: "Sem permissão para acessar esta empresa.", code: "FORBIDDEN" }, 403)
    }
    companyId = bodyCompanyId
  } else {
    companyId = profileCompanyId ?? ""
  }

  if (!companyId) {
    return jsonResponse({
      error: "Empresa não identificada.",
      hint: "Associe o usuário a uma company em profiles.company_id.",
    }, 400)
  }

  const config = getGoogleConfig()
  if ("error" in config) return config.error

  const { data: conn, error: connError } = await supabase
    .from("google_connections")
    .select("company_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, selected_property_name")
    .eq("company_id", companyId)
    .eq("service", "mybusiness")
    .maybeSingle()

  if (connError || !conn) {
    return jsonResponse({
      error: "Conexão Google Meu Negócio não encontrada.",
      hint: "Conecte o Google Meu Negócio em Configurações > Integrações e selecione o perfil.",
      code: "NOT_CONNECTED",
    }, 404)
  }

  const row = conn as GoogleConnectionRow
  const propertyName = row.selected_property_name?.trim()
  if (!propertyName || !propertyName.includes("/locations/")) {
    return jsonResponse({
      error: "Perfil do Google Meu Negócio não selecionado.",
      hint: "Selecione o perfil em Configurações > Integrações > Google Meu Negócio.",
      code: "NO_LOCATION_SELECTED",
    }, 400)
  }

  // Obter access token válido
  const BUFFER_SECONDS = 5 * 60
  const now = Date.now()
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0
  const isExpired = !row.token_expires_at || (expiresAt > 0 && now >= expiresAt - BUFFER_SECONDS * 1000)

  let accessToken: string
  if (!isExpired) {
    try {
      accessToken = await decryptToken(row.access_token_encrypted, config.encryptionKey)
    } catch (err) {
      console.error("[gmb-sync-profile] Falha ao descriptografar token:", err)
      return jsonResponse({
        error: "Token expirado. Reconecte o Google em Configurações > Integrações.",
        code: "TOKEN_EXPIRED",
      }, 401)
    }
  } else {
    const refreshEncrypted = row.refresh_token_encrypted?.trim()
    if (!refreshEncrypted) {
      return jsonResponse({
        error: "Token expirado. Reconecte o Google em Configurações > Integrações.",
        code: "TOKEN_EXPIRED",
      }, 401)
    }
    let refreshToken: string
    try {
      refreshToken = await decryptToken(refreshEncrypted, config.encryptionKey)
    } catch (err) {
      console.error("[gmb-sync-profile] Falha ao descriptografar refresh_token:", err)
      return jsonResponse({ error: "Erro ao acessar credenciais do Google." }, 500)
    }
    const tokenParams = new URLSearchParams()
    tokenParams.set("client_id", config.clientId)
    tokenParams.set("client_secret", config.clientSecret)
    tokenParams.set("refresh_token", refreshToken)
    tokenParams.set("grant_type", "refresh_token")
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    })
    const tokenData = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string }
    if (!res.ok || !tokenData.access_token) {
      return jsonResponse({ error: "Erro ao renovar acesso ao Google.", hint: tokenData.error }, 502)
    }
    accessToken = tokenData.access_token.trim()
    const expiresIn = typeof (tokenData as { expires_in?: number }).expires_in === "number"
      ? (tokenData as { expires_in: number }).expires_in
      : 3600
    const tokenExpiresAt = new Date(Date.now() + Math.max(expiresIn, 60) * 1000).toISOString()
    const newEncrypted = await encryptToken(accessToken, config.encryptionKey)
    await supabase
      .from("google_connections")
      .update({
        access_token_encrypted: newEncrypted,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("service", "mybusiness")
  }

  const locUrl = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${propertyName}`,
  )
  locUrl.searchParams.set(
    "readMask",
    "metadata.placeId,categories.primaryCategory,categories.additionalCategories",
  )

  const locRes = await fetch(locUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!locRes.ok) {
    const errText = await locRes.text()
    console.error("[gmb-sync-profile] Business Information API error:", locRes.status, errText)
    return jsonResponse({
      error: "Erro ao buscar dados do perfil no Google.",
      hint: errText.slice(0, 200),
      code: "GOOGLE_API_FAILED",
    }, 502)
  }

  const locData = (await locRes.json().catch(() => null)) as {
    metadata?: { placeId?: string }
    categories?: {
      primaryCategory?: { displayName?: string; name?: string }
      additionalCategories?: Array<{ displayName?: string; name?: string }>
    }
  } | null

  const placeId = locData?.metadata?.placeId?.trim() ?? null
  const primaryRaw =
    locData?.categories?.primaryCategory?.name ??
    locData?.categories?.primaryCategory?.displayName
  const secondaryRaw =
    locData?.categories?.additionalCategories?.[0]?.name ??
    locData?.categories?.additionalCategories?.[0]?.displayName
  const primaryType = toPlaceType(primaryRaw)
  const secondaryType = toPlaceType(secondaryRaw)

  const { error: updateErr } = await supabase
    .from("companies")
    .update({
      gmb_place_id: placeId,
      gmb_place_type: primaryType,
      gmb_place_type_secondary: secondaryType,
    })
    .eq("id", companyId)

  if (updateErr) {
    console.error("[gmb-sync-profile] Erro ao atualizar companies:", updateErr)
    return jsonResponse({
      error: "Erro ao salvar categorias na empresa.",
      hint: updateErr.message,
    }, 500)
  }

  return jsonResponse({
    success: true,
    synced: {
      gmb_place_id: placeId,
      gmb_place_type: primaryType,
      gmb_place_type_secondary: secondaryType,
    },
  })
  } catch (err) {
    console.error("[gmb-sync-profile] Unhandled error:", err)
    return jsonResponse({
      error: "Erro interno ao sincronizar.",
      hint: err instanceof Error ? err.message : String(err),
      code: "INTERNAL_ERROR",
    }, 500)
  }
})
