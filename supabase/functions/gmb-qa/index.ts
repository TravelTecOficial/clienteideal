/**
 * Edge Function: gmb-qa
 *
 * Proxy para Google My Business Q&A API - listar perguntas e criar/atualizar respostas.
 * ATENÇÃO: A API de Q&A será descontinuada em 3 de novembro de 2025.
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { action: "listQuestions" | "upsertAnswer", company_id?: string, questionId?: string, text?: string, pageToken?: string }
 *
 * Secrets: CLERK_SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_ENCRYPTION_KEY
 *
 * Deploy: npx supabase functions deploy gmb-qa --project-ref mrkvvgofjyvlutqpvedt --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const QA_API_BASE = "https://mybusinessqanda.googleapis.com/v1"

interface GoogleConnectionRow {
  company_id: string
  access_token_encrypted: string
  refresh_token_encrypted?: string | null
  token_expires_at?: string | null
  selected_property_name?: string | null
}

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type GmbQaAction = "listQuestions" | "upsertAnswer"

interface RequestBody {
  action?: GmbQaAction
  token?: string
  company_id?: string
  questionId?: string
  text?: string
  pageToken?: string
  pageSize?: number
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
        { error: "Configuração do Google incompleta.", hint: "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_TOKEN_ENCRYPTION_KEY." },
        500,
      ),
    }
  }
  return { clientId, clientSecret, encryptionKey }
}

async function requireAuth(
  req: Request,
  body: RequestBody,
): Promise<
  { error?: Response; companyId?: string; supabase?: ReturnType<typeof createClient> }
> {
  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")?.trim() ||
    (typeof body?.token === "string" ? body.token.trim() : null)

  if (!token) {
    return { error: jsonResponse({ error: "Token ausente. Faça login novamente.", code: "MISSING_TOKEN" }, 401) }
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret?.startsWith("sk_")) {
    return { error: jsonResponse({ error: "Configuração do servidor inválida (CLERK_SECRET_KEY)." }, 500) }
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch {
    return { error: jsonResponse({ error: "Token inválido ou expirado. Faça login novamente.", code: "INVALID_TOKEN" }, 401) }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()
  if (!supabaseUrl || !supabaseServiceKey) {
    return { error: jsonResponse({ error: "Configuração do servidor inválida." }, 500) }
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
      return { error: jsonResponse({ error: "Sem permissão para acessar esta empresa.", code: "FORBIDDEN" }, 403) }
    }
    companyId = bodyCompanyId
  } else {
    companyId = profileCompanyId ?? ""
  }

  if (!companyId) {
    return {
      error: jsonResponse({
        error: "Empresa não identificada.",
        hint: "Associe o usuário a uma company em profiles.company_id.",
      }, 400),
    }
  }

  return { companyId, supabase }
}

async function getValidAccessToken(
  row: GoogleConnectionRow,
  config: { clientId: string; clientSecret: string; encryptionKey: string },
  supabase: ReturnType<typeof createClient>,
  companyId: string,
): Promise<{ error?: Response; accessToken?: string }> {
  const BUFFER_SECONDS = 5 * 60
  const now = Date.now()
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0
  const isExpired = !row.token_expires_at || (expiresAt > 0 && now >= expiresAt - BUFFER_SECONDS * 1000)

  if (!isExpired) {
    try {
      const token = await decryptToken(row.access_token_encrypted, config.encryptionKey)
      return { accessToken: token }
    } catch (err) {
      console.error("[gmb-qa] Falha ao descriptografar token:", err)
      return { error: jsonResponse({ error: "Erro ao acessar credenciais do Google." }, 500) }
    }
  }

  const refreshEncrypted = row.refresh_token_encrypted?.trim()
  if (!refreshEncrypted) {
    return {
      error: jsonResponse({
        error: "Token expirado. Reconecte o Google em Configurações > Integrações.",
        code: "TOKEN_EXPIRED",
      }, 401),
    }
  }

  let refreshToken: string
  try {
    refreshToken = await decryptToken(refreshEncrypted, config.encryptionKey)
  } catch (err) {
    console.error("[gmb-qa] Falha ao descriptografar refresh_token:", err)
    return { error: jsonResponse({ error: "Erro ao acessar credenciais do Google." }, 500) }
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

  const tokenData = (await res.json().catch(() => ({}))) as GoogleTokenResponse
  if (!res.ok) {
    console.error("[gmb-qa] Erro ao renovar token:", res.status, tokenData)
    const msg = (tokenData as { error_description?: string }).error_description ??
      (tokenData as { error?: string }).error ??
      `Erro ao renovar token (${res.status}).`
    return { error: jsonResponse({ error: "Erro ao renovar acesso ao Google.", hint: msg }, 502) }
  }

  const newAccessToken = typeof tokenData.access_token === "string" ? tokenData.access_token.trim() : ""
  if (!newAccessToken) {
    return { error: jsonResponse({ error: "Google não retornou novo access_token." }, 502) }
  }

  const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600
  const tokenExpiresAt = new Date(Date.now() + Math.max(expiresIn, 60) * 1000).toISOString()

  let newAccessEncrypted: string
  try {
    newAccessEncrypted = await encryptToken(newAccessToken, config.encryptionKey)
  } catch (err) {
    console.error("[gmb-qa] Falha ao criptografar novo token:", err)
    return { error: jsonResponse({ error: "Erro ao proteger credenciais." }, 500) }
  }

  await supabase
    .from("google_connections")
    .update({
      access_token_encrypted: newAccessEncrypted,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("service", "mybusiness")

  return { accessToken: newAccessToken }
}

async function handleListQuestions(
  accessToken: string,
  locationName: string,
  pageToken?: string,
  pageSize = 10,
): Promise<Response> {
  const url = new URL(`${QA_API_BASE}/${locationName}/questions`)
  url.searchParams.set("pageSize", String(Math.min(10, Math.max(1, pageSize))))
  if (pageToken) url.searchParams.set("pageToken", pageToken)

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const errMsg = data?.error?.message ?? (typeof data === "object" ? JSON.stringify(data) : `Erro ${res.status}`)
    console.error("[gmb-qa] List questions failed:", res.status, errMsg)
    return jsonResponse(
      {
        error: "Erro ao listar perguntas do Google Business.",
        hint: errMsg,
        code: "GOOGLE_QA_LIST_FAILED",
      },
      502,
    )
  }

  return jsonResponse({
    questions: data?.questions ?? [],
    totalSize: data?.totalSize ?? 0,
    nextPageToken: data?.nextPageToken ?? null,
  })
}

async function handleUpsertAnswer(
  accessToken: string,
  questionName: string,
  text: string,
): Promise<Response> {
  const url = `${QA_API_BASE}/${questionName}/answers:upsert`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ answer: { text } }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const errMsg = data?.error?.message ?? (typeof data === "object" ? JSON.stringify(data) : `Erro ${res.status}`)
    console.error("[gmb-qa] Upsert answer failed:", res.status, errMsg)
    return jsonResponse(
      {
        error: "Erro ao responder à pergunta.",
        hint: errMsg,
        code: "GOOGLE_QA_UPSERT_FAILED",
      },
      502,
    )
  }

  return jsonResponse({ success: true, answer: data })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders })
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
  if (action !== "listQuestions" && action !== "upsertAnswer") {
    return jsonResponse(
      { error: "Parâmetro 'action' obrigatório. Valores: listQuestions, upsertAnswer." },
      400,
    )
  }

  const authResult = await requireAuth(req, body)
  if (authResult.error) return authResult.error
  const { companyId, supabase } = authResult
  if (!companyId || !supabase) return jsonResponse({ error: "Erro interno." }, 500)

  const config = getGoogleConfig()
  if ("error" in config) return config.error

  const { data: conn, error: connError } = await supabase
    .from("google_connections")
    .select("company_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, selected_property_name")
    .eq("company_id", companyId)
    .eq("service", "mybusiness")
    .maybeSingle()

  if (connError || !conn) {
    return jsonResponse(
      {
        error: "Conexão Google Meu Negócio não encontrada.",
        hint: "Conecte o Google Meu Negócio em Configurações > Integrações e selecione o perfil.",
        code: "NOT_CONNECTED",
      },
      404,
    )
  }

  const row = conn as GoogleConnectionRow
  const locationName = row.selected_property_name?.trim()
  if (!locationName || !locationName.includes("/locations/")) {
    return jsonResponse(
      {
        error: "Perfil do Google Meu Negócio não selecionado.",
        hint: "Selecione o perfil em Configurações > Integrações > Google Meu Negócio.",
        code: "NO_LOCATION_SELECTED",
      },
      400,
    )
  }

  const tokenResult = await getValidAccessToken(row, config, supabase, companyId)
  if (tokenResult.error) return tokenResult.error
  const accessToken = tokenResult.accessToken
  if (!accessToken) return jsonResponse({ error: "Erro ao obter token de acesso." }, 500)

  if (action === "listQuestions") {
    const pageToken = typeof body.pageToken === "string" ? body.pageToken.trim() || undefined : undefined
    const pageSize = typeof body.pageSize === "number" ? body.pageSize : 10
    return handleListQuestions(accessToken, locationName, pageToken, pageSize)
  }

  if (action === "upsertAnswer") {
    const questionId = typeof body.questionId === "string" ? body.questionId.trim() : ""
    const text = typeof body.text === "string" ? body.text.trim() : ""
    if (!questionId) return jsonResponse({ error: "questionId é obrigatório." }, 400)
    if (!text) return jsonResponse({ error: "text é obrigatório." }, 400)
    const questionName = questionId.includes("/questions/")
      ? questionId
      : `${locationName}/questions/${questionId}`
    return handleUpsertAnswer(accessToken, questionName, text)
  }

  return jsonResponse({ error: "Action não implementada." }, 400)
})
