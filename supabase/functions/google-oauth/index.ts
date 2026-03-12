/**
 * Edge Function: google-oauth
 *
 * Fluxos:
 * - action: "getLoginUrl"     -> retorna URL do OAuth Google (access_type=offline, prompt=select_account consent)
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-application-name",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
}

const SCOPES_BY_SERVICE: Record<string, string[]> = {
  ga4: ["https://www.googleapis.com/auth/analytics.readonly"],
  ads: ["https://www.googleapis.com/auth/adwords"],
  mybusiness: ["https://www.googleapis.com/auth/business.manage"],
}

const VALID_SERVICES = ["ga4", "ads", "mybusiness"] as const
type GoogleService = (typeof VALID_SERVICES)[number]

interface GoogleConnectionRow {
  company_id: string
  service: GoogleService
  access_token_encrypted: string
  selected_account_name?: string | null
  selected_account_display_name?: string | null
  selected_property_name?: string | null
  selected_property_display_name?: string | null
}

interface ProfilesRow {
  company_id: string | null
  saas_admin?: boolean | null
}

interface AuthContext {
  sub: string
  companyId: string
  isSaasAdmin: boolean
}

type GoogleAction =
  | "getLoginUrl"
  | "exchangeCode"
  | "getConnectionStatus"
  | "listAnalyticsProperties"
  | "selectAnalyticsProperty"
  | "listMyBusinessLocations"
  | "selectMyBusinessLocation"
  | "getAdsAccountInfo"
  | "disconnect"

interface BaseRequestBody {
  action?: GoogleAction
  token?: string
}

interface GetLoginUrlBody extends BaseRequestBody {
  action: "getLoginUrl"
  state?: string
  company_id?: string
  service?: GoogleService
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

interface ListAnalyticsPropertiesBody extends BaseRequestBody {
  action: "listAnalyticsProperties"
  company_id?: string
}

interface SelectAnalyticsPropertyBody extends BaseRequestBody {
  action: "selectAnalyticsProperty"
  company_id?: string
  accountName?: string
  accountDisplayName?: string
  propertyName?: string
  propertyDisplayName?: string
}

interface ListMyBusinessLocationsBody extends BaseRequestBody {
  action: "listMyBusinessLocations"
  company_id?: string
}

interface SelectMyBusinessLocationBody extends BaseRequestBody {
  action: "selectMyBusinessLocation"
  company_id?: string
  accountName?: string
  accountDisplayName?: string
  propertyName?: string
  propertyDisplayName?: string
}

interface GetAdsAccountInfoBody extends BaseRequestBody {
  action: "getAdsAccountInfo"
  company_id?: string
}

interface DisconnectBody extends BaseRequestBody {
  action: "disconnect"
  company_id?: string
  service?: GoogleService
}

type RequestBody =
  | GetLoginUrlBody
  | ExchangeCodeBody
  | GetConnectionStatusBody
  | ListAnalyticsPropertiesBody
  | SelectAnalyticsPropertyBody
  | ListMyBusinessLocationsBody
  | SelectMyBusinessLocationBody
  | GetAdsAccountInfoBody
  | DisconnectBody

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

function encodeState(service: GoogleService): string {
  const nonce = crypto.randomUUID()
  const json = JSON.stringify({ nonce, service })
  const bytes = new TextEncoder().encode(json)
  return toBase64Url(bytes)
}

function decodeState(state: string): { service: GoogleService } {
  try {
    const bytes = fromBase64Url(state)
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json) as { service?: string }
    const service = parsed?.service
    if (VALID_SERVICES.includes(service as GoogleService)) {
      return { service: service as GoogleService }
    }
  } catch {
    /* fallback */
  }
  return { service: "ga4" }
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
  const decoder = new TextDecoder()
  return decoder.decode(plainBuf)
}

interface GoogleApiErrorResponse {
  error?: {
    code?: number
    message?: string
    status?: string
  } | null
}

interface GoogleAccountSummary {
  name?: string | null
  displayName?: string | null
  propertySummaries?: Array<{
    property?: string | null
    displayName?: string | null
  }> | null
}

interface GoogleAccountSummariesResponse extends GoogleApiErrorResponse {
  accountSummaries?: GoogleAccountSummary[] | null
  nextPageToken?: string | null
}

interface GoogleAnalyticsPropertyOption {
  accountName: string
  accountDisplayName: string
  propertyName: string
  propertyDisplayName: string
  propertyId: string
  isSelected: boolean
}

interface MyBusinessAccount {
  name?: string | null
  accountName?: string | null
}

interface MyBusinessLocation {
  name?: string | null
  title?: string | null
  locationName?: string | null
}

interface MyBusinessAccountsListResponse extends GoogleApiErrorResponse {
  accounts?: MyBusinessAccount[] | null
  nextPageToken?: string | null
}

interface MyBusinessLocationsListResponse extends GoogleApiErrorResponse {
  locations?: MyBusinessLocation[] | null
  nextPageToken?: string | null
}

interface MyBusinessLocationOption {
  accountName: string
  accountDisplayName: string
  propertyName: string
  propertyDisplayName: string
  propertyId: string
  isSelected: boolean
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

  const service =
    typeof body.service === "string" && VALID_SERVICES.includes(body.service as GoogleService)
      ? (body.service as GoogleService)
      : null

  if (!service) {
    return jsonResponse(
      {
        error: "Parâmetro 'service' é obrigatório.",
        hint: "Valores válidos: ga4, ads, mybusiness",
      },
      400,
    )
  }

  const { clientId, redirectUri } = config
  const scopes = SCOPES_BY_SERVICE[service] ?? SCOPES_BY_SERVICE.ga4
  const state = encodeState(service)

  const params = new URLSearchParams()
  params.set("client_id", clientId)
  params.set("redirect_uri", redirectUri)
  params.set("response_type", "code")
  params.set("scope", scopes.join(" "))
  params.set("access_type", "offline")
  params.set("prompt", "select_account consent")
  params.set("state", state)

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return jsonResponse({ url, state })
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

  const stateStr = typeof body.state === "string" ? body.state.trim() : ""
  const { service } = stateStr ? decodeState(stateStr) : { service: "ga4" as GoogleService }
  const scopes = SCOPES_BY_SERVICE[service] ?? SCOPES_BY_SERVICE.ga4

  let selectedAccountName: string | null = null
  let selectedAccountDisplayName: string | null = null

  if (service === "ads") {
    try {
      const adsRes = await fetch("https://googleads.googleapis.com/v20/customers:listAccessibleCustomers", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const adsRaw = await adsRes.text()
      const adsData = (() => {
        try {
          return JSON.parse(adsRaw) as { resourceNames?: string[]; error?: { message?: string } }
        } catch {
          return null
        }
      })()
      if (adsRes.ok && Array.isArray(adsData?.resourceNames) && adsData.resourceNames.length > 0) {
        const first = adsData.resourceNames[0]
        if (typeof first === "string" && first.startsWith("customers/")) {
          selectedAccountName = first
          const id = first.replace(/^customers\//, "")
          selectedAccountDisplayName = id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")
        }
      }
    } catch (err) {
      console.error("[google-oauth] Falha ao listar contas Ads:", err)
    }
  }

  const payload = {
    company_id: ctx.companyId,
    service,
    access_token_encrypted: accessEncrypted,
    refresh_token_encrypted: refreshEncrypted,
    token_expires_at: tokenExpiresAt,
    scopes,
    status: "active",
    selected_account_name: selectedAccountName,
    selected_account_display_name: selectedAccountDisplayName,
    selected_property_name: null,
    selected_property_display_name: null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("google_connections").upsert(payload, {
    onConflict: "company_id,service",
  })

  if (error) {
    console.error("[google-oauth] Erro ao salvar conexão:", error)
    // #region agent log - incluir erro Supabase para debug
    const supabaseErrorMsg = typeof error?.message === "string" ? error.message : String(error?.message ?? error)
    const supabaseErrorCode = (error as { code?: string })?.code
    const supabaseErrorDetails = (error as { details?: string })?.details
    return jsonResponse(
      {
        error: "Erro ao salvar credenciais do Google.",
        hint: "Verifique se a tabela google_connections existe e a migration foi aplicada.",
        supabaseError: supabaseErrorMsg,
        supabaseErrorCode,
        supabaseErrorDetails,
      },
      500,
    )
    // #endregion
  }

  return jsonResponse({ success: true, service })
}

async function getGoogleConnectionForService(
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
  service: GoogleService,
): Promise<{ error?: Response; row?: GoogleConnectionRow }> {
  const { data, error } = await supabase
    .from("google_connections")
    .select(
      "company_id, service, access_token_encrypted, selected_account_name, selected_account_display_name, selected_property_name, selected_property_display_name",
    )
    .eq("company_id", ctx.companyId)
    .eq("service", service)
    .maybeSingle()

  if (error) {
    console.error("[google-oauth] Erro ao buscar conexão Google:", error)
    return {
      error: jsonResponse(
        { error: "Erro ao buscar conexão Google.", hint: error.message },
        500,
      ),
    }
  }

  if (!data) {
    return {
      error: jsonResponse(
        { error: "Conexão Google não encontrada para esta empresa.", code: "NOT_CONNECTED" },
        404,
      ),
    }
  }

  return { row: data as GoogleConnectionRow }
}

async function handleGetConnectionStatus(
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const { data, error } = await supabase
    .from("google_connections")
    .select("service, status, selected_account_name, selected_account_display_name, selected_property_name, selected_property_display_name")
    .eq("company_id", ctx.companyId)

  if (error) {
    console.error("[google-oauth] Erro ao buscar conexão:", error)
    return jsonResponse(
      { error: "Erro ao verificar status da conexão Google.", hint: error.message },
      500,
    )
  }

  const rows = (data ?? []) as Array<{
    service?: string
    status?: string
    selected_account_name?: string | null
    selected_account_display_name?: string | null
    selected_property_name?: string | null
    selected_property_display_name?: string | null
  }>
  const active = new Set(rows.filter((r) => r.status === "active").map((r) => r.service))
  const ga4Row = rows.find((r) => r.service === "ga4" && r.status === "active") ?? null
  const adsRow = rows.find((r) => r.service === "ads" && r.status === "active") ?? null
  const mybusinessRow = rows.find((r) => r.service === "mybusiness" && r.status === "active") ?? null

  return jsonResponse({
    ga4: active.has("ga4"),
    ads: active.has("ads"),
    mybusiness: active.has("mybusiness"),
    ga4SelectedPropertyName: ga4Row?.selected_property_name ?? null,
    ga4SelectedPropertyDisplayName: ga4Row?.selected_property_display_name ?? null,
    ga4SelectedAccountDisplayName: ga4Row?.selected_account_display_name ?? null,
    adsSelectedAccountId: adsRow?.selected_account_name ?? null,
    adsSelectedAccountDisplayName: adsRow?.selected_account_display_name ?? null,
    mybusinessSelectedPropertyName: mybusinessRow?.selected_property_name ?? null,
    mybusinessSelectedPropertyDisplayName: mybusinessRow?.selected_property_display_name ?? null,
    mybusinessSelectedAccountDisplayName: mybusinessRow?.selected_account_display_name ?? null,
  })
}

async function handleListAnalyticsProperties(
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const config = getGoogleConfig()
  if ("error" in config) return config.error

  const connectionResult = await getGoogleConnectionForService(ctx, supabase, "ga4")
  if (connectionResult.error) return connectionResult.error
  const row = connectionResult.row
  if (!row) {
    return jsonResponse({ error: "Conexão Google Analytics não encontrada." }, 404)
  }

  let accessToken: string
  try {
    accessToken = await decryptToken(row.access_token_encrypted, config.encryptionKey)
  } catch (err) {
    console.error("[google-oauth] Falha ao descriptografar token Google:", err)
    return jsonResponse({ error: "Erro ao acessar credenciais do Google." }, 500)
  }

  const propertyOptions: GoogleAnalyticsPropertyOption[] = []
  let nextPageToken: string | null = null
  let pageCount = 0

  do {
    const url = new URL("https://analyticsadmin.googleapis.com/v1beta/accountSummaries")
    url.searchParams.set("pageSize", "200")
    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken)
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const raw = await res.text()
    const data = (() => {
      try {
        return JSON.parse(raw) as GoogleAccountSummariesResponse
      } catch {
        return null
      }
    })()

    if (!res.ok) {
      const errorMessage =
        data?.error?.message ??
        (raw && raw.length < 400 ? raw : null) ??
        `Erro ao listar propriedades do Google Analytics (${res.status}).`
      return jsonResponse(
        {
          error: "Erro ao listar propriedades do Google Analytics.",
          hint: errorMessage,
          code: "GOOGLE_ANALYTICS_LIST_FAILED",
        },
        502,
      )
    }

    for (const account of data?.accountSummaries ?? []) {
      const accountName = account.name?.trim() ?? ""
      const accountDisplayName = account.displayName?.trim() || accountName
      if (!accountName) continue

      for (const property of account.propertySummaries ?? []) {
        const propertyName = property.property?.trim() ?? ""
        if (!propertyName) continue
        propertyOptions.push({
          accountName,
          accountDisplayName,
          propertyName,
          propertyDisplayName: property.displayName?.trim() || propertyName,
          propertyId: propertyName.split("/").pop() ?? propertyName,
          isSelected: propertyName === (row.selected_property_name ?? null),
        })
      }
    }

    nextPageToken = data?.nextPageToken?.trim() || null
    pageCount += 1
  } while (nextPageToken && pageCount < 10)

  propertyOptions.sort((a, b) =>
    `${a.accountDisplayName} ${a.propertyDisplayName}`.localeCompare(
      `${b.accountDisplayName} ${b.propertyDisplayName}`,
      "pt-BR",
    ),
  )

  return jsonResponse({ properties: propertyOptions })
}

async function handleSelectAnalyticsProperty(
  body: SelectAnalyticsPropertyBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const accountName = typeof body.accountName === "string" ? body.accountName.trim() : ""
  const propertyName = typeof body.propertyName === "string" ? body.propertyName.trim() : ""

  if (!accountName || !propertyName) {
    return jsonResponse(
      {
        error: "Selecione uma conta e uma propriedade do GA4 antes de confirmar.",
        code: "MISSING_ANALYTICS_PROPERTY",
      },
      400,
    )
  }

  const accountDisplayName =
    typeof body.accountDisplayName === "string" ? body.accountDisplayName.trim() : accountName
  const propertyDisplayName =
    typeof body.propertyDisplayName === "string" ? body.propertyDisplayName.trim() : propertyName

  const { error } = await supabase
    .from("google_connections")
    .update({
      selected_account_name: accountName,
      selected_account_display_name: accountDisplayName,
      selected_property_name: propertyName,
      selected_property_display_name: propertyDisplayName,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", ctx.companyId)
    .eq("service", "ga4")

  if (error) {
    console.error("[google-oauth] Erro ao salvar propriedade GA4:", error)
    return jsonResponse(
      {
        error: "Erro ao salvar a propriedade selecionada do Google Analytics.",
        hint: error.message,
      },
      500,
    )
  }

  return jsonResponse({
    success: true,
    selected: {
      accountName,
      accountDisplayName,
      propertyName,
      propertyDisplayName,
    },
  })
}

async function handleListMyBusinessLocations(
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const config = getGoogleConfig()
  if ("error" in config) return config.error

  const connectionResult = await getGoogleConnectionForService(ctx, supabase, "mybusiness")
  if (connectionResult.error) return connectionResult.error
  const row = connectionResult.row
  if (!row) {
    return jsonResponse({ error: "Conexão Google Meu Negócio não encontrada." }, 404)
  }

  let accessToken: string
  try {
    accessToken = await decryptToken(row.access_token_encrypted, config.encryptionKey)
  } catch (err) {
    console.error("[google-oauth] Falha ao descriptografar token Google:", err)
    return jsonResponse({ error: "Erro ao acessar credenciais do Google." }, 500)
  }

  const locationOptions: MyBusinessLocationOption[] = []
  let accountsNextPageToken: string | null = null
  let accountsPageCount = 0

  do {
    const accountsUrl = new URL("https://mybusinessaccountmanagement.googleapis.com/v1/accounts")
    accountsUrl.searchParams.set("pageSize", "20")
    if (accountsNextPageToken) {
      accountsUrl.searchParams.set("pageToken", accountsNextPageToken)
    }

    const accountsRes = await fetch(accountsUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const accountsRaw = await accountsRes.text()
    const accountsData = (() => {
      try {
        return JSON.parse(accountsRaw) as MyBusinessAccountsListResponse
      } catch {
        return null
      }
    })()

    if (!accountsRes.ok) {
      const errorMessage =
        accountsData?.error?.message ??
        (accountsRaw && accountsRaw.length < 400 ? accountsRaw : null) ??
        `Erro ao listar contas do Google Meu Negócio (${accountsRes.status}).`
      const errDetail = accountsData?.error
        ? `status=${accountsRes.status} code=${(accountsData.error as { code?: number }).code}`
        : `status=${accountsRes.status}`
      console.error("[google-oauth] Accounts API failed:", errDetail, accountsRaw?.slice(0, 500))
      return jsonResponse(
        {
          error: "Erro ao listar perfis do Google Meu Negócio.",
          hint: errorMessage,
          code: "GOOGLE_MYBUSINESS_LIST_FAILED",
          googleStatus: accountsRes.status,
          googleError: accountsData?.error ?? null,
        },
        502,
      )
    }

    for (const account of accountsData?.accounts ?? []) {
      const accountName = account.name?.trim() ?? ""
      const accountDisplayName = account.accountName?.trim() || accountName
      if (!accountName) continue

      let locationsNextPageToken: string | null = null
      let locationsPageCount = 0

      do {
        const locationsUrl = new URL(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
        )
        locationsUrl.searchParams.set("pageSize", "100")
        locationsUrl.searchParams.set("readMask", "name,title")
        if (locationsNextPageToken) {
          locationsUrl.searchParams.set("pageToken", locationsNextPageToken)
        }

        const locationsRes = await fetch(locationsUrl.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        const locationsRaw = await locationsRes.text()
        const locationsData = (() => {
          try {
            return JSON.parse(locationsRaw) as MyBusinessLocationsListResponse
          } catch {
            return null
          }
        })()

        if (!locationsRes.ok) {
          const errMsg =
            locationsData?.error?.message ??
            (locationsRaw && locationsRaw.length < 300 ? locationsRaw : null) ??
            `Erro ao listar locais (${locationsRes.status})`
          return jsonResponse(
            {
              error: "Erro ao listar perfis do Google Meu Negócio.",
              hint: errMsg,
              code: "GOOGLE_MYBUSINESS_LOCATIONS_FAILED",
            },
            502,
          )
        }

        for (const loc of locationsData?.locations ?? []) {
          let propertyName = loc.name?.trim() ?? ""
          if (!propertyName) continue
          if (propertyName.startsWith("locations/")) {
            propertyName = `${accountName}/${propertyName}`
          } else if (!propertyName.startsWith("accounts/")) {
            propertyName = `${accountName}/locations/${propertyName}`
          }
          const displayName = loc.title?.trim() ?? loc.locationName?.trim() ?? propertyName
          locationOptions.push({
            accountName,
            accountDisplayName,
            propertyName,
            propertyDisplayName: displayName,
            propertyId: propertyName.split("/").pop() ?? propertyName,
            isSelected: propertyName === (row.selected_property_name ?? null),
          })
        }

        locationsNextPageToken = locationsData?.nextPageToken?.trim() || null
        locationsPageCount += 1
      } while (locationsNextPageToken && locationsPageCount < 10)
    }

    accountsNextPageToken = accountsData?.nextPageToken?.trim() || null
    accountsPageCount += 1
  } while (accountsNextPageToken && accountsPageCount < 10)

  locationOptions.sort((a, b) =>
    `${a.accountDisplayName} ${a.propertyDisplayName}`.localeCompare(
      `${b.accountDisplayName} ${b.propertyDisplayName}`,
      "pt-BR",
    ),
  )

  return jsonResponse({ locations: locationOptions })
}

async function handleSelectMyBusinessLocation(
  body: SelectMyBusinessLocationBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const accountName = typeof body.accountName === "string" ? body.accountName.trim() : ""
  const propertyName = typeof body.propertyName === "string" ? body.propertyName.trim() : ""

  if (!accountName || !propertyName) {
    return jsonResponse(
      {
        error: "Selecione uma conta e um perfil do Meu Negócio antes de confirmar.",
        code: "MISSING_MYBUSINESS_LOCATION",
      },
      400,
    )
  }

  const accountDisplayName =
    typeof body.accountDisplayName === "string" ? body.accountDisplayName.trim() : accountName
  const propertyDisplayName =
    typeof body.propertyDisplayName === "string" ? body.propertyDisplayName.trim() : propertyName

  const { error } = await supabase
    .from("google_connections")
    .update({
      selected_account_name: accountName,
      selected_account_display_name: accountDisplayName,
      selected_property_name: propertyName,
      selected_property_display_name: propertyDisplayName,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", ctx.companyId)
    .eq("service", "mybusiness")

  if (error) {
    console.error("[google-oauth] Erro ao salvar perfil Meu Negócio:", error)
    return jsonResponse(
      {
        error: "Erro ao salvar o perfil selecionado do Google Meu Negócio.",
        hint: error.message,
      },
      500,
    )
  }

  return jsonResponse({
    success: true,
    selected: {
      accountName,
      accountDisplayName,
      propertyName,
      propertyDisplayName,
    },
  })
}

async function handleGetAdsAccountInfo(
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const config = getGoogleConfig()
  if ("error" in config) return config.error

  const connectionResult = await getGoogleConnectionForService(ctx, supabase, "ads")
  if (connectionResult.error) return connectionResult.error
  const row = connectionResult.row
  if (!row) {
    return jsonResponse({ error: "Conexão Google Ads não encontrada." }, 404)
  }

  let accessToken: string
  try {
    accessToken = await decryptToken(row.access_token_encrypted, config.encryptionKey)
  } catch (err) {
    console.error("[google-oauth] Falha ao descriptografar token Google:", err)
    return jsonResponse({ error: "Erro ao acessar credenciais do Google." }, 500)
  }

  try {
    const adsRes = await fetch("https://googleads.googleapis.com/v20/customers:listAccessibleCustomers", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const adsRaw = await adsRes.text()
    const adsData = (() => {
      try {
        return JSON.parse(adsRaw) as { resourceNames?: string[]; error?: { message?: string } }
      } catch {
        return null
      }
    })()
    if (!adsRes.ok || !Array.isArray(adsData?.resourceNames) || adsData.resourceNames.length === 0) {
      const errMsg = adsData?.error?.message ?? (adsRaw?.slice(0, 200) ?? `Erro ${adsRes.status}`)
      return jsonResponse(
        { error: "Erro ao obter conta Google Ads.", hint: errMsg },
        502,
      )
    }
    const first = adsData.resourceNames[0]
    if (typeof first !== "string" || !first.startsWith("customers/")) {
      return jsonResponse({ error: "Resposta inválida da API Google Ads." }, 502)
    }
    const id = first.replace(/^customers\//, "")
    const displayName = id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")

    await supabase
      .from("google_connections")
      .update({
        selected_account_name: first,
        selected_account_display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", ctx.companyId)
      .eq("service", "ads")

    return jsonResponse({
      accountId: first,
      accountDisplayName: displayName,
    })
  } catch (err) {
    console.error("[google-oauth] getAdsAccountInfo:", err)
    return jsonResponse(
      { error: "Erro ao obter conta Google Ads.", hint: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
}

async function handleDisconnect(
  body: DisconnectBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const service =
    typeof body.service === "string" && VALID_SERVICES.includes(body.service as GoogleService)
      ? (body.service as GoogleService)
      : null

  if (!service) {
    return jsonResponse(
      {
        error: "Parâmetro 'service' é obrigatório para desconectar.",
        hint: "Valores válidos: ga4, ads, mybusiness",
      },
      400,
    )
  }

  const { error } = await supabase
    .from("google_connections")
    .delete()
    .eq("company_id", ctx.companyId)
    .eq("service", service)

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
    return new Response("ok", { status: 200, headers: corsHeaders })
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
    const authResult = await requireAuthAndCompany(req, body)
    if (authResult.error) return authResult.error
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
    case "listAnalyticsProperties":
      return handleListAnalyticsProperties(ctx, supabase)
    case "selectAnalyticsProperty":
      return handleSelectAnalyticsProperty(body as SelectAnalyticsPropertyBody, ctx, supabase)
    case "listMyBusinessLocations": {
      try {
        return await handleListMyBusinessLocations(ctx, supabase)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? err.stack : undefined
        console.error("[google-oauth] listMyBusinessLocations crash:", msg, stack)
        return jsonResponse(
          {
            error: "Erro ao listar perfis do Google Meu Negócio.",
            hint: msg,
            code: "MYBUSINESS_CRASH",
            debug: stack ? stack.slice(0, 500) : undefined,
          },
          500,
        )
      }
    }
    case "selectMyBusinessLocation":
      return handleSelectMyBusinessLocation(body as SelectMyBusinessLocationBody, ctx, supabase)
    case "getAdsAccountInfo":
      return handleGetAdsAccountInfo(ctx, supabase)
    case "disconnect":
      return handleDisconnect(body as DisconnectBody, ctx, supabase)
    default:
      return jsonResponse({ error: `Action desconhecida: ${action}` }, 400)
  }
})
