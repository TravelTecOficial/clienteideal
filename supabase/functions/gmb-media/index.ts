/**
 * Edge Function: gmb-media
 *
 * Proxy para Google My Business API v4 - upload e listagem de mídia do perfil.
 * - action "upload": POST media via sourceUrl (URL pública) - COVER ou ADDITIONAL
 * - action "list": lista fotos/vídeos da location
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { action: "upload" | "list", company_id?: string, mediaFormat?: "PHOTO"|"VIDEO", category?: "COVER"|"ADDITIONAL", sourceUrl?: string }
 *
 * Secrets: CLERK_SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_ENCRYPTION_KEY
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const MYBUSINESS_API_BASE = "https://mybusiness.googleapis.com/v4"

interface GoogleConnectionRow {
  company_id: string
  access_token_encrypted: string
  refresh_token_encrypted?: string | null
  token_expires_at?: string | null
  selected_property_name?: string | null
}

interface RequestBody {
  action?: "upload" | "list"
  company_id?: string
  token?: string
  mediaFormat?: "PHOTO" | "VIDEO"
  category?: "COVER" | "ADDITIONAL"
  sourceUrl?: string
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function getAesKey(encryptionKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyBytes = encoder.encode(encryptionKey.padEnd(32).slice(0, 32))
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"])
}

async function decryptToken(payload: string, encryptionKey: string): Promise<string> {
  const [ivPart, cipherPart] = payload.split(":")
  if (!ivPart || !cipherPart) throw new Error("Token criptografado em formato inválido.")
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

function toBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function encryptToken(plain: string, encryptionKey: string): Promise<string> {
  const key = await getAesKey(encryptionKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  )
  return `${toBase64Url(iv)}:${toBase64Url(new Uint8Array(cipherBuf))}`
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
    return { error: jsonResponse({ error: "Configuração do Google incompleta." }, 500) }
  }
  return { clientId, clientSecret, encryptionKey }
}

async function getValidAccessToken(
  row: GoogleConnectionRow,
  config: { clientId: string; clientSecret: string; encryptionKey: string },
  supabase: ReturnType<typeof createClient>,
  companyId: string,
): Promise<{ error?: Response; accessToken?: string }> {
  const BUFFER_SECONDS = 5 * 60
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0
  const isExpired = !row.token_expires_at || Date.now() >= expiresAt - BUFFER_SECONDS * 1000

  if (!isExpired) {
    try {
      return { accessToken: await decryptToken(row.access_token_encrypted, config.encryptionKey) }
    } catch {
      return { error: jsonResponse({ error: "Erro ao acessar credenciais." }, 500) }
    }
  }

  const refreshEncrypted = row.refresh_token_encrypted?.trim()
  if (!refreshEncrypted) {
    return { error: jsonResponse({ error: "Token expirado. Reconecte o Google.", code: "TOKEN_EXPIRED" }, 401) }
  }

  let refreshToken: string
  try {
    refreshToken = await decryptToken(refreshEncrypted, config.encryptionKey)
  } catch {
    return { error: jsonResponse({ error: "Erro ao acessar credenciais." }, 500) }
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  const tokenData = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number }
  if (!res.ok || !tokenData.access_token) {
    return { error: jsonResponse({ error: "Erro ao renovar token." }, 502) }
  }

  const newToken = (tokenData.access_token as string).trim()
  const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600
  const newEncrypted = await encryptToken(newToken, config.encryptionKey)
  await supabase
    .from("google_connections")
    .update({
      access_token_encrypted: newEncrypted,
      token_expires_at: new Date(Date.now() + Math.max(expiresIn, 60) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("service", "mybusiness")
  return { accessToken: newToken }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("", { status: 200, headers: corsHeaders })
    if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405)

    const body = (await req.json().catch(() => ({}))) as RequestBody
    const token =
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")?.trim() ??
      (typeof body?.token === "string" ? body.token.trim() : null)
    if (!token) return jsonResponse({ error: "Token ausente.", code: "MISSING_TOKEN" }, 401)

    const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
    if (!clerkSecret?.startsWith("sk_")) return jsonResponse({ error: "Configuração inválida." }, 500)

    let sub: string
    try {
      sub = (await verifyToken(token, { secretKey: clerkSecret })).sub as string
    } catch {
      return jsonResponse({ error: "Token inválido.", code: "INVALID_TOKEN" }, 401)
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()
    if (!supabaseUrl || !supabaseServiceKey) return jsonResponse({ error: "Configuração inválida." }, 500)

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
        return jsonResponse({ error: "Sem permissão.", code: "FORBIDDEN" }, 403)
      }
      companyId = bodyCompanyId
    } else {
      companyId = profileCompanyId ?? ""
    }
    if (!companyId) return jsonResponse({ error: "Empresa não identificada.", code: "NO_COMPANY" }, 400)

    const config = getGoogleConfig()
    if ("error" in config) return config.error

    const { data: conn, error: connError } = await supabase
      .from("google_connections")
      .select("company_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, selected_property_name")
      .eq("company_id", companyId)
      .eq("service", "mybusiness")
      .maybeSingle()
    if (connError || !conn) {
      return jsonResponse({ error: "Google Meu Negócio não conectado.", code: "NOT_CONNECTED" }, 404)
    }

    const row = conn as GoogleConnectionRow
    const locationName = row.selected_property_name?.trim()
    if (!locationName || !locationName.includes("/locations/")) {
      return jsonResponse({ error: "Perfil GMB não selecionado.", code: "NO_LOCATION_SELECTED" }, 400)
    }

    const tokenResult = await getValidAccessToken(row, config, supabase, companyId)
    if (tokenResult.error) return tokenResult.error
    const accessToken = tokenResult.accessToken
    if (!accessToken) return jsonResponse({ error: "Erro ao obter token." }, 500)

    const action = body.action === "list" ? "list" : "upload"

    if (action === "list") {
      const url = `${MYBUSINESS_API_BASE}/${locationName}/media`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) {
        const errText = await res.text()
        console.error("[gmb-media] List error:", res.status, errText)
        return jsonResponse({ error: "Erro ao listar mídia.", hint: errText.slice(0, 200) }, 502)
      }
      const data = (await res.json().catch(() => ({}))) as { mediaItems?: unknown[] }
      return jsonResponse({ mediaItems: data.mediaItems ?? [] })
    }

    // upload
    const mediaFormat = body.mediaFormat === "VIDEO" ? "VIDEO" : "PHOTO"
    const category = body.category === "COVER" ? "COVER" : "ADDITIONAL"
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : ""
    if (!sourceUrl || !sourceUrl.startsWith("https://")) {
      return jsonResponse({ error: "sourceUrl obrigatório e deve ser uma URL https." }, 400)
    }

    const mediaUrl = `${MYBUSINESS_API_BASE}/${locationName}/media`
    const mediaBody = {
      mediaFormat,
      locationAssociation: { category },
      sourceUrl,
    }
    const uploadRes = await fetch(mediaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(mediaBody),
    })
    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      console.error("[gmb-media] Upload error:", uploadRes.status, errText)
      return jsonResponse({ error: "Erro ao enviar mídia ao Google.", hint: errText.slice(0, 200) }, 502)
    }
    const mediaItem = (await uploadRes.json().catch(() => null)) as Record<string, unknown>
    return jsonResponse({ success: true, mediaItem })
  } catch (err) {
    console.error("[gmb-media] Unhandled:", err)
    return jsonResponse({ error: "Erro interno.", hint: err instanceof Error ? err.message : String(err) }, 500)
  }
})
