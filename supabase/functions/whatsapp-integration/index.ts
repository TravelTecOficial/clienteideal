import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient as createSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"
import axios from "https://esm.sh/axios@1.7.7"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const WHATSAPP_SCOPES = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "business_management",
]

type WhatsappAction = "getLoginUrl" | "exchangeCode" | "getPhoneNumbers" | "selectPhoneNumber"

interface BaseBody {
  action?: WhatsappAction
  token?: string
}

interface GetLoginUrlBody extends BaseBody {
  action: "getLoginUrl"
  state?: string
}

interface ExchangeCodeBody extends BaseBody {
  action: "exchangeCode"
  code: string
  state?: string
}

interface GetPhoneNumbersBody extends BaseBody {
  action: "getPhoneNumbers"
}

interface SelectPhoneNumberBody extends BaseBody {
  action: "selectPhoneNumber"
  phone_number_id?: string
}

type WhatsappRequestBody = GetLoginUrlBody | ExchangeCodeBody | GetPhoneNumbersBody | SelectPhoneNumberBody

interface MetaOAuthTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

interface MetaWaba {
  id?: string | null
  name?: string | null
}

interface MetaMeResponse {
  id?: string | null
  name?: string | null
  whatsapp_business_accounts?: {
    data?: MetaWaba[] | null
  } | null
}

interface MetaPhoneNumber {
  id?: string | null
  display_phone_number?: string | null
  verified_name?: string | null
}

interface MetaPhoneNumbersResponse {
  data?: MetaPhoneNumber[] | null
}

interface PhoneNumberDTO {
  id: string
  display_phone_number: string
  verified_name: string | null
}

interface ConnectSuccessResponse {
  success: true
  wabaId: string
  expiresAt: string
  phoneNumbers: PhoneNumberDTO[]
}

interface ErrorResponse {
  error: string
  code?: string
  hint?: string
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function getAuthSub(
  req: Request,
  body?: WhatsappRequestBody,
): Promise<{ sub?: string; error?: Response }> {
  let token: string | undefined
  if (typeof body?.token === "string" && body.token.trim().length > 0) {
    token = body.token.trim()
  } else {
    const authHeader = req.headers.get("Authorization")
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
    if (bearer) token = bearer
  }

  if (!token) {
    return {
      error: jsonResponse(
        {
          error: "Token de autenticação ausente. Envie 'token' no body ou Authorization: Bearer.",
          code: "MISSING_TOKEN",
        } satisfies ErrorResponse,
        401,
      ),
    }
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret || !clerkSecret.startsWith("sk_")) {
    return {
      error: jsonResponse(
        {
          error: "Configuração do servidor inválida (CLERK_SECRET_KEY).",
          code: "SERVER_CONFIG_ERROR",
        } satisfies ErrorResponse,
        500,
      ),
    }
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: clerkSecret,
    })
    const sub = payload.sub ?? (payload as { userId?: string }).userId
    if (!sub || typeof sub !== "string") {
      return {
        error: jsonResponse(
          {
            error: "Token inválido: usuário não identificado.",
            code: "INVALID_TOKEN",
          } satisfies ErrorResponse,
          401,
        ),
      }
    }
    return { sub }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[whatsapp-integration] verifyToken falhou:", msg)
    return {
      error: jsonResponse(
        {
          error: "Token inválido ou expirado. Faça login novamente.",
          code: "INVALID_TOKEN",
          hint: msg.slice(0, 120),
        } satisfies ErrorResponse,
        401,
      ),
    }
  }
}

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Configuração do servidor inválida (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).")
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}

const META_GRAPH_VERSION = "v19.0"

function getWhatsappConfig(): { appId: string; appSecret: string; redirectUri: string } | { error: Response } {
  const appId = Deno.env.get("META_APP_ID")?.trim()
  const appSecret = Deno.env.get("META_APP_SECRET")?.trim()
  const redirectUri = Deno.env.get("META_WHATSAPP_REDIRECT_URI")?.trim()
  if (!appId || !appSecret || !redirectUri) {
    return {
      error: jsonResponse(
        {
          error: "Configuração da Meta/WhatsApp incompleta.",
          hint: "Configure META_APP_ID, META_APP_SECRET e META_WHATSAPP_REDIRECT_URI nas secrets do Supabase.",
        } satisfies ErrorResponse,
        500,
      ),
    }
  }
  return { appId, appSecret, redirectUri }
}

async function handleGetLoginUrl(body: GetLoginUrlBody): Promise<Response> {
  const config = getWhatsappConfig()
  if ("error" in config) return config.error

  const { appId, redirectUri } = config
  const providedState =
    typeof body.state === "string" && body.state.trim().length > 0
      ? body.state.trim()
      : crypto.randomUUID()

  const params = new URLSearchParams()
  params.set("client_id", appId)
  params.set("redirect_uri", redirectUri)
  params.set("response_type", "code")
  params.set("scope", WHATSAPP_SCOPES.join(","))
  params.set("state", providedState)

  const url = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`
  return jsonResponse({ url })
}

async function handleExchangeCode(
  body: ExchangeCodeBody,
  sub: string,
): Promise<Response> {
  const config = getWhatsappConfig()
  if ("error" in config) return config.error

  const { appId, appSecret, redirectUri } = config
  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (!code) {
    return jsonResponse(
      { error: "Parâmetro 'code' é obrigatório.", code: "MISSING_CODE" } satisfies ErrorResponse,
      400,
    )
  }

  const tokenUrl = new URL(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
  )
  tokenUrl.searchParams.set("client_id", appId)
  tokenUrl.searchParams.set("client_secret", appSecret)
  tokenUrl.searchParams.set("redirect_uri", redirectUri)
  tokenUrl.searchParams.set("code", code)

  let tokenData: Record<string, unknown> = {}
  try {
    const res = await fetch(tokenUrl.toString(), { method: "GET" })
    tokenData = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      console.error("[whatsapp-integration] Erro ao trocar code por token:", res.status, tokenData)
      const msg =
        (tokenData.error as { message?: string } | undefined)?.message ??
        `Erro ao obter access_token (${res.status}).`
      return jsonResponse({ error: msg, code: "META_TOKEN_ERROR" } satisfies ErrorResponse, 502)
    }
  } catch (err) {
    console.error("[whatsapp-integration] Falha na requisição de token:", err)
    return jsonResponse(
      { error: "Erro ao comunicar com a API do Facebook.", code: "META_REQUEST_ERROR" } satisfies ErrorResponse,
      502,
    )
  }

  const accessToken =
    typeof tokenData.access_token === "string" ? tokenData.access_token.trim() : ""
  const expiresIn =
    typeof tokenData.expires_in === "number"
      ? tokenData.expires_in
      : typeof tokenData.expires_in === "string"
        ? Number(tokenData.expires_in)
        : 60 * 24 * 60 * 60
  const expiresAt =
    expiresIn && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  if (!accessToken) {
    return jsonResponse(
      {
        error: "Resposta da Meta não retornou access_token.",
        code: "META_TOKEN_ERROR",
      } satisfies ErrorResponse,
      502,
    )
  }

  let wabaId: string
  try {
    const meRes = await axios.get<MetaMeResponse>(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
      {
        params: {
          fields: "id,name,whatsapp_business_accounts",
          access_token: accessToken,
        },
      },
    )
    const me = meRes.data
    const wabas = me.whatsapp_business_accounts?.data ?? []
    const firstWaba = wabas.find((w) => typeof w.id === "string" && w.id.trim().length > 0)
    if (!firstWaba?.id) {
      return jsonResponse(
        {
          error: "Nenhuma conta WhatsApp Business (WABA) encontrada para este usuário.",
          code: "NO_WABA_FOUND",
        } satisfies ErrorResponse,
        404,
      )
    }
    wabaId = firstWaba.id.trim()
  } catch (err) {
    const axiosErr = err as { response?: { status: number; data?: unknown }; message?: string }
    console.error("[whatsapp-integration] Erro ao buscar WABA:", axiosErr)
    const metaError = (axiosErr.response?.data as { error?: { message?: string } } | undefined)?.error
    const message =
      metaError?.message ?? axiosErr.message ?? "Erro ao comunicar com a API da Meta (WABA)."
    return jsonResponse(
      { error: message, code: "META_WABA_ERROR" } satisfies ErrorResponse,
      (axiosErr.response?.status && axiosErr.response.status >= 400 && axiosErr.response.status < 600)
        ? axiosErr.response.status
        : 502,
    )
  }

  let phoneNumbers: PhoneNumberDTO[] = []
  try {
    const phonesRes = await axios.get<MetaPhoneNumbersResponse>(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(wabaId)}/phone_numbers`,
      {
        params: {
          fields: "id,display_phone_number,verified_name",
          access_token: accessToken,
        },
      },
    )
    const data = phonesRes.data
    const rawPhones = Array.isArray(data.data) ? data.data : []
    phoneNumbers = rawPhones
      .map((p): PhoneNumberDTO | null => {
        const id = typeof p.id === "string" ? p.id.trim() : ""
        const display =
          typeof p.display_phone_number === "string" ? p.display_phone_number.trim() : ""
        const verifiedName =
          typeof p.verified_name === "string" ? p.verified_name.trim() : null
        if (!id || !display) return null
        return { id, display_phone_number: display, verified_name: verifiedName }
      })
      .filter((p): p is PhoneNumberDTO => p !== null)
  } catch (err) {
    const axiosErr = err as { response?: { status: number; data?: unknown }; message?: string }
    console.error("[whatsapp-integration] Erro ao listar phone_numbers:", axiosErr)
    const metaError = (axiosErr.response?.data as { error?: { message?: string } } | undefined)?.error
    const message =
      metaError?.message ?? axiosErr.message ?? "Erro ao listar números da Meta."
    return jsonResponse(
      { error: message, code: "META_PHONE_NUMBERS_ERROR" } satisfies ErrorResponse,
      (axiosErr.response?.status && axiosErr.response.status >= 400 && axiosErr.response.status < 600)
        ? axiosErr.response.status
        : 502,
    )
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id: sub,
        provider: "whatsapp",
        access_token: accessToken,
        waba_id: wabaId,
        phone_number_id: null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    )

  if (error) {
    console.error("[whatsapp-integration] Erro ao salvar integração:", error)
    return jsonResponse(
      {
        error: "Erro ao salvar integração WhatsApp no banco de dados.",
        code: "SUPABASE_ERROR",
      } satisfies ErrorResponse,
      500,
    )
  }

  return jsonResponse({ success: true, phoneNumbers })
}

async function handleGetPhoneNumbers(_body: GetPhoneNumbersBody, sub: string): Promise<Response> {
  const supabase = getSupabaseClient()
  const { data: row, error } = await supabase
    .from("integrations")
    .select("access_token, waba_id")
    .eq("user_id", sub)
    .eq("provider", "whatsapp")
    .maybeSingle()

  if (error || !row?.access_token || !row?.waba_id) {
    return jsonResponse(
      {
        error: "Nenhuma integração WhatsApp encontrada. Conecte primeiro via OAuth.",
        code: "INTEGRATION_NOT_FOUND",
      } satisfies ErrorResponse,
      404,
    )
  }

  try {
    const phonesRes = await axios.get<MetaPhoneNumbersResponse>(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(row.waba_id)}/phone_numbers`,
      {
        params: {
          fields: "id,display_phone_number,verified_name",
          access_token: row.access_token,
        },
      },
    )
    const data = phonesRes.data
    const rawPhones = Array.isArray(data.data) ? data.data : []
    const phoneNumbers = rawPhones
      .map((p): PhoneNumberDTO | null => {
        const id = typeof p.id === "string" ? p.id.trim() : ""
        const display =
          typeof p.display_phone_number === "string" ? p.display_phone_number.trim() : ""
        const verifiedName =
          typeof p.verified_name === "string" ? p.verified_name.trim() : null
        if (!id || !display) return null
        return { id, display_phone_number: display, verified_name: verifiedName }
      })
      .filter((p): p is PhoneNumberDTO => p !== null)
    return jsonResponse({ phoneNumbers })
  } catch (err) {
    const axiosErr = err as { response?: { status: number; data?: unknown }; message?: string }
    console.error("[whatsapp-integration] Erro ao listar phone_numbers (getPhoneNumbers):", axiosErr)
    const metaError = (axiosErr.response?.data as { error?: { message?: string } } | undefined)?.error
    const message =
      metaError?.message ?? axiosErr.message ?? "Erro ao listar números da Meta."
    return jsonResponse(
      { error: message, code: "META_PHONE_NUMBERS_ERROR" } satisfies ErrorResponse,
      (axiosErr.response?.status && axiosErr.response.status >= 400 && axiosErr.response.status < 600)
        ? axiosErr.response.status
        : 502,
    )
  }
}

async function handleSelectPhoneNumber(
  _req: Request,
  body: SelectPhoneNumberBody,
  sub: string,
): Promise<Response> {
  const supabase = getSupabaseClient()

  const phoneNumberId =
    typeof body.phone_number_id === "string" ? body.phone_number_id.trim() : ""

  if (!phoneNumberId) {
    return jsonResponse(
      {
        error: "Parâmetro 'phone_number_id' é obrigatório.",
        code: "MISSING_PHONE_NUMBER_ID",
      } satisfies ErrorResponse,
      400,
    )
  }

  try {
    const { error, data } = await supabase
      .from("integrations")
      .update({
        phone_number_id: phoneNumberId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", sub)
      .eq("provider", "whatsapp")
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("[whatsapp-integration] Erro ao atualizar phone_number_id:", error)
      return jsonResponse(
        {
          error: "Erro ao atualizar o número do WhatsApp para esta integração.",
          code: "SUPABASE_ERROR",
        } satisfies ErrorResponse,
        500,
      )
    }

    if (!data) {
      return jsonResponse(
        {
          error: "Nenhuma integração WhatsApp encontrada para este usuário.",
          code: "INTEGRATION_NOT_FOUND",
        } satisfies ErrorResponse,
        404,
      )
    }
  } catch (err) {
    console.error("[whatsapp-integration] Exceção ao atualizar phone_number_id:", err)
    return jsonResponse(
      {
        error: "Erro interno ao atualizar número do WhatsApp.",
        code: "SUPABASE_EXCEPTION",
      } satisfies ErrorResponse,
      500,
    )
  }

  return jsonResponse({ success: true }, 200)
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Método não permitido. Use POST.",
        code: "METHOD_NOT_ALLOWED",
      } satisfies ErrorResponse,
      405,
    )
  }

  let body: WhatsappRequestBody
  try {
    body = (await req.json()) as WhatsappRequestBody
  } catch {
    return jsonResponse(
      {
        error: "Body inválido. Envie um JSON.",
        code: "INVALID_JSON",
      } satisfies ErrorResponse,
      400,
    )
  }

  const action = body.action
  if (
    action !== "getLoginUrl" &&
    action !== "exchangeCode" &&
    action !== "getPhoneNumbers" &&
    action !== "selectPhoneNumber"
  ) {
    return jsonResponse(
      {
        error:
          "Parâmetro 'action' inválido. Use 'getLoginUrl', 'exchangeCode', 'getPhoneNumbers' ou 'selectPhoneNumber'.",
        code: "INVALID_ACTION",
      } satisfies ErrorResponse,
      400,
    )
  }

  // getLoginUrl não exige auth (opcional: pode exigir token para registrar state por usuário)
  if (action === "getLoginUrl") {
    return handleGetLoginUrl(body as GetLoginUrlBody)
  }

  // exchangeCode, getPhoneNumbers e selectPhoneNumber exigem auth
  const { sub, error } = await getAuthSub(req, body)
  if (error || !sub) {
    return error ?? jsonResponse({ error: "Erro de autenticação." }, 401)
  }

  if (action === "exchangeCode") {
    return handleExchangeCode(body as ExchangeCodeBody, sub)
  }
  if (action === "getPhoneNumbers") {
    return handleGetPhoneNumbers(body as GetPhoneNumbersBody, sub)
  }
  return handleSelectPhoneNumber(req, body as SelectPhoneNumberBody, sub)
})

