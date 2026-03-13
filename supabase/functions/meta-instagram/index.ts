/**
 * Edge Function: meta-instagram
 *
 * Fluxos:
 * - action: "getLoginUrl"    -> retorna URL do diálogo OAuth da Meta
 * - action: "exchangeCode"   -> troca code por access_token e salva por company_id
 * - action: "listAccounts"   -> chama /me/accounts?fields=name,instagram_business_account
 * - action: "getInsights"    -> chama /{instagram_id}/insights?metric=impressions,reach&period=day
 *
 * Segurança:
 * - Valida Clerk JWT (Authorization: Bearer <clerk_jwt>)
 * - company_id obtido via tabela profiles
 * - access_token nunca é retornado ao frontend; apenas dados agregados.
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

interface ProfilesRow {
  company_id: string | null
  saas_admin?: boolean | null
}

interface MetaIntegrationRow {
  id: string
  company_id: string
  facebook_user_id: string | null
  facebook_user_name: string | null
  scopes: string[] | null
  access_token_encrypted: string
  token_expires_at: string | null
  selected_page_id?: string | null
  selected_page_name?: string | null
  selected_instagram_id?: string | null
  selected_instagram_username?: string | null
  selected_ad_account_id?: string | null
}

interface FacebookInstagramBusinessAccount {
  id?: string | null
}

interface FacebookPage {
  id?: string | null
  name?: string | null
  instagram_business_account?: FacebookInstagramBusinessAccount | null
}

interface MeAccountsResponse {
  data?: FacebookPage[] | null
  error?: { message?: string; type?: string; code?: number } | null
}

interface MetaAdAccount {
  id?: string | null
  account_id?: string | null
  name?: string | null
}

interface MeAdAccountsResponse {
  data?: MetaAdAccount[] | null
  error?: { message?: string; type?: string; code?: number } | null
}

interface InsightValue {
  value?: number | string | null
  end_time?: string | null
}

interface InsightMetric {
  name?: string | null
  period?: string | null
  values?: InsightValue[] | null
}

interface InsightsResponse {
  data?: InsightMetric[] | null
  error?: { message?: string; type?: string; code?: number } | null
}

const SCOPES_BY_SERVICE: Record<string, string[]> = {
  instagram: ["instagram_basic", "instagram_manage_insights", "pages_read_engagement", "pages_show_list"],
  facebook: ["pages_read_engagement", "pages_show_list", "read_insights"],
  meta_ads: ["ads_read"],
}

const VALID_META_SERVICES = ["instagram", "facebook", "meta_ads"] as const
type MetaService = (typeof VALID_META_SERVICES)[number]

type MetaAction =
  | "getLoginUrl"
  | "exchangeCode"
  | "getConnectionStatus"
  | "getConnectionSummary"
  | "listAccounts"
  | "getInsights"
  | "getInstagramOverview"
  | "getFacebookOverview"
  | "selectAccount"
  | "disconnect"

interface BaseRequestBody {
  action?: MetaAction
  token?: string
}

interface GetLoginUrlBody extends BaseRequestBody {
  action: "getLoginUrl"
  state?: string
  service?: MetaService
}

interface ExchangeCodeBody extends BaseRequestBody {
  action: "exchangeCode"
  code?: string
  state?: string
}

interface GetConnectionStatusBody extends BaseRequestBody {
  action: "getConnectionStatus"
  company_id?: string
}

interface GetConnectionSummaryBody extends BaseRequestBody {
  action: "getConnectionSummary"
  company_id?: string
}

interface DisconnectBody extends BaseRequestBody {
  action: "disconnect"
  service?: MetaService
  company_id?: string
}

interface ListAccountsBody extends BaseRequestBody {
  action: "listAccounts"
  service?: MetaService
  company_id?: string
}

interface GetInsightsBody extends BaseRequestBody {
  action: "getInsights"
  instagramId?: string
  company_id?: string
}

interface SelectAccountBody extends BaseRequestBody {
  action: "selectAccount"
  pageId?: string
  pageName?: string
  instagramId?: string
  instagramUsername?: string
  adAccountId?: string
  adAccountName?: string
  service?: MetaService
  company_id?: string
}

interface InstagramOverviewBody extends BaseRequestBody {
  action: "getInstagramOverview"
  instagramId?: string
  company_id?: string
}

interface FacebookOverviewBody extends BaseRequestBody {
  action: "getFacebookOverview"
  pageId?: string
  company_id?: string
}

type RequestBody =
  | GetLoginUrlBody
  | ExchangeCodeBody
  | GetConnectionStatusBody
  | GetConnectionSummaryBody
  | DisconnectBody
  | ListAccountsBody
  | GetInsightsBody
  | SelectAccountBody
  | InstagramOverviewBody
  | FacebookOverviewBody

interface AuthContext {
  sub: string
  companyId: string
  isSaasAdmin: boolean
}

/** Resolve company_id para admin preview: usa body.company_id se admin, senão ctx.companyId */
function resolveCompanyId(
  ctx: AuthContext,
  bodyCompanyId: string | undefined,
): string {
  if (ctx.isSaasAdmin && typeof bodyCompanyId === "string" && bodyCompanyId.trim().length > 0) {
    return bodyCompanyId.trim()
  }
  return ctx.companyId
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function requireAuthAndCompany(
  req: Request,
  body?: RequestBody,
): Promise<{ error?: Response; ctx?: AuthContext; supabase?: ReturnType<typeof createClient> }> {
  const authHeader = req.headers.get("Authorization")
  const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, "")?.trim() || null
  const tokenFromBody =
    typeof body?.token === "string" && body.token.trim().length > 0
      ? body.token.trim()
      : null
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
    console.error("[meta-instagram] verifyToken falhou:", msg)
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
      error: jsonResponse({ error: "Configuração do servidor inválida (SUPABASE_URL/SERVICE_ROLE_KEY)." }, 500),
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, saas_admin")
    .eq("id", sub)
    .maybeSingle()

  const profileRow = profile as ProfilesRow | null
  const companyId = profileRow?.company_id ?? null
  const isSaasAdmin = Boolean(profileRow?.saas_admin)

  if (!companyId && !isSaasAdmin) {
    return {
      error: jsonResponse(
        {
          error: "Empresa não identificada para este usuário.",
          hint: "Associe o usuário a uma company em profiles.company_id.",
        },
        400,
      ),
    }
  }

  return {
    ctx: {
      sub,
      companyId: companyId ?? "",
      isSaasAdmin,
    },
    supabase,
  }
}

function getMetaConfig() {
  const appId = Deno.env.get("META_APP_ID")?.trim()
  const appSecret = Deno.env.get("META_APP_SECRET")?.trim()
  const redirectUri = Deno.env.get("META_REDIRECT_URI")?.trim()
  const graphVersion = Deno.env.get("META_GRAPH_VERSION")?.trim() || "v21.0"
  const scopesRaw =
    Deno.env.get("META_SCOPES")?.trim() ||
    "pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights,ads_read,ads_management,business_management"
  const encryptionKey = Deno.env.get("META_TOKEN_ENCRYPTION_KEY")?.trim()

  if (!appId || !appSecret || !redirectUri || !encryptionKey) {
    return {
      error: jsonResponse(
        {
          error: "Configuração da Meta incompleta.",
          hint:
            "Configure META_APP_ID, META_APP_SECRET, META_REDIRECT_URI e META_TOKEN_ENCRYPTION_KEY nas secrets do Supabase.",
        },
        500,
      ),
    } as const
  }

  const scopes = scopesRaw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return {
    appId,
    appSecret,
    redirectUri,
    graphVersion,
    scopes,
    encryptionKey,
  } as const
}

function getMetaConfigMinimal(): { appId: string; redirectUri: string; graphVersion: string } | { error: Response } {
  const appId = Deno.env.get("META_APP_ID")?.trim()
  const redirectUri = Deno.env.get("META_REDIRECT_URI")?.trim()
  const graphVersion = Deno.env.get("META_GRAPH_VERSION")?.trim() || "v21.0"
  if (!appId || !redirectUri) {
    return {
      error: jsonResponse(
        {
          error: "Configuração da Meta incompleta.",
          hint: "Configure META_APP_ID e META_REDIRECT_URI nas secrets do Supabase.",
        },
        500,
      ),
    }
  }
  return { appId, redirectUri, graphVersion }
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

function encodeMetaState(service: MetaService): string {
  const nonce = crypto.randomUUID()
  const json = JSON.stringify({ nonce, service })
  const bytes = new TextEncoder().encode(json)
  return toBase64Url(bytes)
}

function decodeMetaState(state: string): { service: MetaService } {
  try {
    const bytes = fromBase64Url(state)
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json) as { service?: string }
    const service = parsed?.service
    if (typeof service === "string" && VALID_META_SERVICES.includes(service as MetaService)) {
      return { service: service as MetaService }
    }
  } catch {
    // fallback
  }
  return { service: "instagram" }
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
    { name: "AES-GCM", iv },
    key,
    cipherBytes,
  )
  const decoder = new TextDecoder()
  return decoder.decode(plainBuf)
}

async function handleGetLoginUrl(body: GetLoginUrlBody) {
  const metaConfig = getMetaConfigMinimal()
  if ("error" in metaConfig) {
    return metaConfig.error
  }

  const { appId, redirectUri, graphVersion } = metaConfig

  const service =
    typeof body.service === "string" && VALID_META_SERVICES.includes(body.service as MetaService)
      ? (body.service as MetaService)
      : "instagram"

  const scopes = SCOPES_BY_SERVICE[service] ?? SCOPES_BY_SERVICE.instagram
  const state = encodeMetaState(service)

  const params = new URLSearchParams()
  params.set("client_id", appId)
  params.set("redirect_uri", redirectUri)
  params.set("response_type", "code")
  params.set("scope", scopes.join(","))
  params.set("state", state)

  const url = `https://www.facebook.com/${graphVersion}/dialog/oauth?${params.toString()}`

  return jsonResponse({ url, state })
}

async function handleExchangeCode(body: ExchangeCodeBody, ctx: AuthContext, supabase: ReturnType<typeof createClient>) {
  const metaConfig = getMetaConfig()
  if ("error" in metaConfig) {
    return metaConfig.error
  }

  const { appId, appSecret, redirectUri, graphVersion, encryptionKey } = metaConfig

  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (!code) {
    return jsonResponse({ error: "Parâmetro 'code' é obrigatório." }, 400)
  }

  const stateStr = typeof body.state === "string" ? body.state.trim() : ""
  const { service } = stateStr ? decodeMetaState(stateStr) : { service: "instagram" as MetaService }

  const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`)
  tokenUrl.searchParams.set("client_id", appId)
  tokenUrl.searchParams.set("client_secret", appSecret)
  tokenUrl.searchParams.set("redirect_uri", redirectUri)
  tokenUrl.searchParams.set("code", code)

  let tokenData: Record<string, unknown> = {}
  try {
    const res = await fetch(tokenUrl.toString(), { method: "GET" })
    tokenData = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      console.error("[meta-instagram] Erro ao trocar code por token:", res.status, tokenData)
      const msg =
        (tokenData.error as { message?: string } | undefined)?.message ??
        `Erro ao obter access_token (${res.status}).`
      return jsonResponse({ error: msg }, 502)
    }
  } catch (err) {
    console.error("[meta-instagram] Falha na requisição de token:", err)
    return jsonResponse({ error: "Erro ao comunicar com a API do Facebook." }, 502)
  }

  const accessToken = typeof tokenData.access_token === "string" ? tokenData.access_token.trim() : ""
  const expiresIn =
    typeof tokenData.expires_in === "number"
      ? tokenData.expires_in
      : typeof tokenData.expires_in === "string"
        ? Number(tokenData.expires_in)
        : null

  if (!accessToken) {
    return jsonResponse(
      { error: "Resposta da Meta não retornou access_token.", debug: tokenData },
      502,
    )
  }

  const expiresAt = expiresIn && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null

  let encrypted: string
  try {
    encrypted = await encryptToken(accessToken, encryptionKey)
  } catch (err) {
    console.error("[meta-instagram] Falha ao criptografar token:", err)
    return jsonResponse({ error: "Erro ao proteger credenciais de acesso." }, 500)
  }

  const { error } = await supabase
    .from("meta_connections")
    .upsert(
      {
        company_id: ctx.companyId,
        clerk_user_id: ctx.sub,
        provider_type: service,
        access_token: encrypted,
        token_expires_at: expiresAt,
        external_account_id: null,
        external_phone_id: null,
        display_phone_number: null,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,provider_type" },
    )

  if (error) {
    const errMsg = typeof error?.message === "string" ? error.message : String(error)
    const errCode = (error as { code?: string })?.code
    console.error("[meta-instagram] Erro ao salvar integração em meta_connections:", error)
    return jsonResponse(
      {
        error: "Erro ao salvar credenciais de integração da Meta.",
        hint: errCode ? `[${errCode}] ${errMsg}` : errMsg || "Verifique se a migration meta_connections foi aplicada.",
      },
      500,
    )
  }

  return jsonResponse({ success: true, service })
}

async function handleGetConnectionStatus(
  body: GetConnectionStatusBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const companyId = resolveCompanyId(ctx, body.company_id)
  const { data, error } = await supabase
    .from("meta_connections")
    .select("provider_type")
    .eq("company_id", companyId)
    .in("provider_type", ["instagram", "facebook", "meta_ads"])

  if (error) {
    console.error("[meta-instagram] Erro ao buscar meta_connections:", error)
    return jsonResponse(
      { error: "Erro ao buscar status das conexões Meta.", hint: error.message },
      500,
    )
  }

  const types = Array.isArray(data) ? data.map((r) => r?.provider_type).filter(Boolean) : []
  return jsonResponse({
    instagram: types.includes("instagram"),
    facebook: types.includes("facebook"),
    meta_ads: types.includes("meta_ads"),
  })
}

async function handleGetConnectionSummary(
  body: GetConnectionSummaryBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const companyId =
    ctx.isSaasAdmin && typeof body.company_id === "string" && body.company_id.trim().length > 0
      ? body.company_id.trim()
      : ctx.companyId
  if (!companyId) {
    return jsonResponse(
      { error: "company_id é obrigatório. Informe no body para usuários admin." },
      400,
    )
  }
  const { data, error } = await supabase
    .from("meta_connections")
    .select("provider_type, selected_page_id, selected_page_name, selected_instagram_id, selected_instagram_username, selected_ad_account_id, selected_ad_account_name")
    .eq("company_id", companyId)
    .in("provider_type", ["instagram", "facebook", "meta_ads"])

  if (error) {
    console.error("[meta-instagram] Erro ao buscar meta_connections (getConnectionSummary):", error)
    return jsonResponse(
      { error: "Erro ao buscar resumo das conexões Meta.", hint: error.message },
      500,
    )
  }

  const rows = Array.isArray(data) ? data : []
  const summary: {
    instagram?: { page_id?: string; page_name?: string; instagram_id?: string; instagram_username?: string }
    facebook?: { page_id?: string; page_name?: string; instagram_id?: string; instagram_username?: string }
    meta_ads?: { ad_account_id?: string; ad_account_name?: string }
  } = {}

  for (const row of rows) {
    const r = row as Record<string, unknown>
    const providerType = r?.provider_type as string | undefined
    const pageId = typeof r.selected_page_id === "string" ? r.selected_page_id : undefined
    const pageName = typeof r.selected_page_name === "string" ? r.selected_page_name : undefined
    const instagramId = typeof r.selected_instagram_id === "string" ? r.selected_instagram_id : undefined
    const instagramUsername = typeof r.selected_instagram_username === "string" ? r.selected_instagram_username : undefined
    const adAccountId = typeof r.selected_ad_account_id === "string" ? r.selected_ad_account_id : undefined
    const adAccountName = typeof r.selected_ad_account_name === "string" ? r.selected_ad_account_name : undefined

    if (providerType === "instagram") {
      summary.instagram = { page_id: pageId, page_name: pageName, instagram_id: instagramId, instagram_username: instagramUsername }
    } else if (providerType === "facebook") {
      summary.facebook = { page_id: pageId, page_name: pageName, instagram_id: instagramId, instagram_username: instagramUsername }
    } else if (providerType === "meta_ads") {
      summary.meta_ads = { ad_account_id: adAccountId, ad_account_name: adAccountName }
    }
  }

  return jsonResponse({ company_id: companyId, ...summary })
}

async function getActiveMetaConnectionForService(
  companyId: string,
  service: MetaService,
  supabase: ReturnType<typeof createClient>,
): Promise<{
  error?: Response
  accessTokenEncrypted?: string
  metaConfig?: ReturnType<typeof getMetaConfig>
  selectedPageId?: string | null
  selectedPageName?: string | null
  selectedInstagramId?: string | null
  selectedInstagramUsername?: string | null
  selectedAdAccountId?: string | null
}> {
  const metaConfig = getMetaConfig()
  if ("error" in metaConfig) return { error: metaConfig.error }

  const { data, error } = await supabase
    .from("meta_connections")
    .select("access_token, selected_page_id, selected_page_name, selected_instagram_id, selected_instagram_username, selected_ad_account_id, selected_ad_account_name")
    .eq("company_id", companyId)
    .eq("provider_type", service)
    .maybeSingle()

  if (error) {
    return {
      error: jsonResponse(
        { error: "Erro ao buscar conexão Meta.", hint: error.message },
        500,
      ),
    }
  }

  if (!data?.access_token) {
    return { metaConfig }
  }

  const row = data as Record<string, unknown>
  return {
    accessTokenEncrypted: data.access_token as string,
    metaConfig,
    selectedPageId: (typeof row.selected_page_id === "string" ? row.selected_page_id : null) ?? null,
    selectedPageName: (typeof row.selected_page_name === "string" ? row.selected_page_name : null) ?? null,
    selectedInstagramId: (typeof row.selected_instagram_id === "string" ? row.selected_instagram_id : null) ?? null,
    selectedInstagramUsername: (typeof row.selected_instagram_username === "string" ? row.selected_instagram_username : null) ?? null,
    selectedAdAccountId: (typeof row.selected_ad_account_id === "string" ? row.selected_ad_account_id : null) ?? null,
  }
}

async function getActiveIntegrationForCompany(
  companyId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ error?: Response; row?: MetaIntegrationRow; metaConfig?: ReturnType<typeof getMetaConfig> }> {
  const metaConfig = getMetaConfig()
  if ("error" in metaConfig) return { error: metaConfig.error }

  const { data, error } = await supabase
    .from("meta_instagram_integrations")
    .select(
      "id, company_id, facebook_user_id, facebook_user_name, scopes, access_token_encrypted, token_expires_at, " +
        "selected_page_id, selected_page_name, selected_instagram_id, selected_instagram_username, selected_ad_account_id",
    )
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) {
    console.error("[meta-instagram] Erro ao buscar integração:", error)
    return {
      error: jsonResponse(
        {
          error: "Erro ao buscar integração Meta/Instagram.",
          hint: "Verifique se a tabela meta_instagram_integrations existe.",
        },
        500,
      ),
    }
  }

  if (!data) {
    return {
      error: jsonResponse(
        {
          error: "Nenhuma integração Meta/Instagram encontrada para esta empresa.",
        },
        404,
      ),
    }
  }

  return {
    row: data as MetaIntegrationRow,
    metaConfig,
  }
}

async function handleListAccounts(
  body: ListAccountsBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
) {
  const companyId = resolveCompanyId(ctx, body.company_id)
  const service =
    typeof body.service === "string" && VALID_META_SERVICES.includes(body.service as MetaService)
      ? (body.service as MetaService)
      : null

  let token: string
  let selectedPageId: string | null = null
  let selectedInstagramId: string | null = null
  let selectedAdAccountId: string | null = null

  if (service && (service === "instagram" || service === "facebook")) {
    const result = await getActiveMetaConnectionForService(companyId, service, supabase)
    if (result.error) return result.error
    if (!result.accessTokenEncrypted || !result.metaConfig) {
      return jsonResponse({ error: "Integração não encontrada para este serviço." }, 404)
    }
    selectedPageId = result.selectedPageId ?? null
    selectedInstagramId = result.selectedInstagramId ?? null
    try {
      token = await decryptToken(result.accessTokenEncrypted, result.metaConfig.encryptionKey)
    } catch (err) {
      console.error("[meta-instagram] Falha ao descriptografar token:", err)
      return jsonResponse(
        { error: "Erro ao ler credenciais da Meta. Peça para reconectar a conta." },
        500,
      )
    }
  } else if (service && service === "meta_ads") {
    const result = await getActiveMetaConnectionForService(companyId, "meta_ads", supabase)
    if (result.error) return result.error
    if (!result.accessTokenEncrypted || !result.metaConfig) {
      return jsonResponse({ error: "Integração não encontrada para Meta Ads." }, 404)
    }
    selectedAdAccountId = result.selectedAdAccountId ?? null
    try {
      token = await decryptToken(result.accessTokenEncrypted, result.metaConfig.encryptionKey)
    } catch (err) {
      console.error("[meta-instagram] Falha ao descriptografar token:", err)
      return jsonResponse(
        { error: "Erro ao ler credenciais da Meta. Peça para reconectar a conta." },
        500,
      )
    }
  } else {
    const instagramResult = await getActiveMetaConnectionForService(companyId, "instagram", supabase)
    const facebookResult = await getActiveMetaConnectionForService(companyId, "facebook", supabase)
    const result = instagramResult.accessTokenEncrypted ? instagramResult : facebookResult
    if (result.error) return result.error
    if (!result.accessTokenEncrypted || !result.metaConfig) {
      return jsonResponse({ error: "Integração Meta não encontrada. Conecte Instagram ou Facebook na aba Integrações." }, 404)
    }
    try {
      token = await decryptToken(result.accessTokenEncrypted, result.metaConfig.encryptionKey)
    } catch (err) {
      console.error("[meta-instagram] Falha ao descriptografar token:", err)
      return jsonResponse(
        { error: "Erro ao ler credenciais da Meta. Peça para reconectar a conta." },
        500,
      )
    }
    selectedPageId = result.selectedPageId ?? null
    selectedInstagramId = result.selectedInstagramId ?? null
  }

  const metaConfig = getMetaConfig()
  if ("error" in metaConfig) return metaConfig.error

  if (service && service === "meta_ads") {
    const url = new URL(`https://graph.facebook.com/${metaConfig.graphVersion}/me/adaccounts`)
    url.searchParams.set("fields", "name,account_id")
    url.searchParams.set("access_token", token)

    let payload: MeAdAccountsResponse = {}
    try {
      const res = await fetch(url.toString(), { method: "GET" })
      payload = (await res.json().catch(() => ({}))) as MeAdAccountsResponse
      if (!res.ok) {
        console.error("[meta-instagram] /me/adaccounts erro:", res.status, payload)
        const msg = payload.error?.message ?? `Erro ${res.status} ao obter contas de anúncios.`
        return jsonResponse({ error: msg }, 502)
      }
    } catch (err) {
      console.error("[meta-instagram] Falha /me/adaccounts:", err)
      return jsonResponse({ error: "Erro ao comunicar com a API do Facebook." }, 502)
    }

    const adAccounts = Array.isArray(payload.data) ? payload.data : []
    const accounts = adAccounts.map((acc): { id: string; name: string; instagramBusinessId: string | null; isSelected: boolean } => {
      const id = typeof acc.id === "string" ? acc.id : (typeof acc.account_id === "string" ? `act_${acc.account_id}` : "")
      const name = typeof acc.name === "string" ? acc.name : ""
      const isSelected = selectedAdAccountId === id || selectedAdAccountId === acc.account_id
      return { id, name, instagramBusinessId: null, isSelected }
    })
    return jsonResponse({ accounts })
  }

  const url = new URL(`https://graph.facebook.com/${metaConfig.graphVersion}/me/accounts`)
  url.searchParams.set("fields", "name,instagram_business_account")
  url.searchParams.set("access_token", token)

  let payload: MeAccountsResponse = {}
  try {
    const res = await fetch(url.toString(), { method: "GET" })
    payload = (await res.json().catch(() => ({}))) as MeAccountsResponse
    if (!res.ok) {
      console.error("[meta-instagram] /me/accounts erro:", res.status, payload)
      const msg = payload.error?.message ?? `Erro ${res.status} ao obter contas.`
      return jsonResponse({ error: msg }, 502)
    }
  } catch (err) {
    console.error("[meta-instagram] Falha /me/accounts:", err)
    return jsonResponse({ error: "Erro ao comunicar com a API do Facebook." }, 502)
  }

  const pages = Array.isArray(payload.data) ? payload.data : []
  const accounts = pages.map((page): {
    id: string
    name: string
    instagramBusinessId: string | null
    isSelected: boolean
  } => {
    const id = typeof page.id === "string" ? page.id : ""
    const name = typeof page.name === "string" ? page.name : ""
    const igId =
      typeof page.instagram_business_account?.id === "string"
        ? page.instagram_business_account.id
        : null
    const isSelected =
      selectedPageId === id && (selectedInstagramId == null || selectedInstagramId === igId)
    return { id, name, instagramBusinessId: igId, isSelected }
  })

  return jsonResponse({ accounts })
}

async function handleGetInsights(
  body: GetInsightsBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
) {
  const companyId = resolveCompanyId(ctx, body.company_id)
  const instagramResult = await getActiveMetaConnectionForService(companyId, "instagram", supabase)
  const facebookResult = instagramResult.error
    ? await getActiveMetaConnectionForService(companyId, "facebook", supabase)
    : instagramResult

  const result = instagramResult.error ? facebookResult : instagramResult
  if (result.error) return result.error
  if (!result.accessTokenEncrypted || !result.metaConfig) {
    return jsonResponse({ error: "Integração Meta/Instagram não encontrada para esta empresa." }, 404)
  }

  let instagramId = typeof body.instagramId === "string" ? body.instagramId.trim() : ""
  if (!instagramId) {
    const selectedIg = result.selectedInstagramId?.trim() ?? ""
    if (!selectedIg) {
      return jsonResponse(
        {
          error: "Nenhuma conta Instagram selecionada para a empresa.",
          hint: "Selecione uma conta na aba Integrações antes de buscar insights.",
        },
        400,
      )
    }
    instagramId = selectedIg
  }

  let token: string
  try {
    token = await decryptToken(result.accessTokenEncrypted, result.metaConfig.encryptionKey)
  } catch (err) {
    console.error("[meta-instagram] Falha ao descriptografar token para insights:", err)
    return jsonResponse(
      { error: "Erro ao ler credenciais da Meta. Peça para reconectar a conta." },
      500,
    )
  }

  const url = new URL(
    `https://graph.facebook.com/${metaConfig.graphVersion}/${encodeURIComponent(instagramId)}/insights`,
  )
  // Algumas contas/versões da API não aceitam mais "impressions" e exigem metric_type para profile_views.
  // Para manter o fluxo simples e estável para App Review, usamos apenas a métrica reach.
  url.searchParams.set("metric", "reach")
  url.searchParams.set("period", "day")
  url.searchParams.set("access_token", token)

  let payload: InsightsResponse = {}
  try {
    const res = await fetch(url.toString(), { method: "GET" })
    payload = (await res.json().catch(() => ({}))) as InsightsResponse
    if (!res.ok) {
      console.error("[meta-instagram] /insights erro:", res.status, payload)
      const msg = payload.error?.message ?? `Erro ${res.status} ao obter insights.`
      return jsonResponse({ error: msg }, 502)
    }
  } catch (err) {
    console.error("[meta-instagram] Falha /insights:", err)
    return jsonResponse({ error: "Erro ao comunicar com a API do Instagram." }, 502)
  }

  const metrics = Array.isArray(payload.data) ? payload.data : []
  const normalized = metrics.map((metric) => {
    const name = typeof metric.name === "string" ? metric.name : ""
    const period = typeof metric.period === "string" ? metric.period : ""
    const values = Array.isArray(metric.values) ? metric.values : []
    const normalizedValues = values.map((v) => {
      const raw = v?.value
      const num =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(raw)
            : 0
      const endTime = typeof v?.end_time === "string" ? v.end_time : null
      return { value: Number.isFinite(num) ? num : 0, endTime }
    })
    return { metric: name, period, values: normalizedValues }
  })

  return jsonResponse({ metrics: normalized })
}

async function handleInstagramOverview(
  body: InstagramOverviewBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
) {
  // Se a Meta não estiver configurada (secrets), retorna 200 com dados vazios para o dashboard não quebrar.
  const metaConfig = getMetaConfig()
  if ("error" in metaConfig) {
    return jsonResponse({ metrics: [] })
  }
  const delegateBody: GetInsightsBody = {
    action: "getInsights",
    instagramId: body.instagramId,
    token: body.token,
    company_id: body.company_id,
  }
  return handleGetInsights(delegateBody, ctx, supabase)
}

async function handleFacebookOverview(
  body: FacebookOverviewBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
) {
  const metaConfigCheck = getMetaConfig()
  if ("error" in metaConfigCheck) {
    return jsonResponse({ pageId: "", metrics: [] })
  }
  const companyId = resolveCompanyId(ctx, body.company_id)
  const facebookResult = await getActiveMetaConnectionForService(companyId, "facebook", supabase)
  const instagramResult = facebookResult.error
    ? await getActiveMetaConnectionForService(companyId, "instagram", supabase)
    : facebookResult

  const result = facebookResult.error ? instagramResult : facebookResult
  if (result.error) return result.error
  if (!result.accessTokenEncrypted || !result.metaConfig) {
    return jsonResponse({ error: "Integração Meta/Facebook não encontrada para esta empresa." }, 404)
  }

  const pageIdFromBody = typeof body.pageId === "string" ? body.pageId.trim() : ""
  const selectedPageId = result.selectedPageId?.trim() ?? null
  const pageId = pageIdFromBody || selectedPageId

  if (!pageId) {
    return jsonResponse(
      {
        error: "Nenhuma página Facebook selecionada para a empresa.",
        hint: "Selecione uma página na aba Integrações antes de buscar insights de Facebook.",
      },
      400,
    )
  }

  let userToken: string
  try {
    userToken = await decryptToken(result.accessTokenEncrypted, result.metaConfig.encryptionKey)
  } catch (err) {
    console.error("[meta-instagram] Falha ao descriptografar token para Facebook overview:", err)
    return jsonResponse(
      {
        error: "Erro ao ler credenciais da Meta. Peça para reconectar a conta.",
      },
      500,
    )
  }

  // 1) Obter page access token via /me/accounts
  const accountsUrl = new URL(`https://graph.facebook.com/${metaConfig.graphVersion}/me/accounts`)
  accountsUrl.searchParams.set("fields", "id,name,access_token")
  accountsUrl.searchParams.set("access_token", userToken)

  let pageAccessToken: string | null = null
  try {
    const res = await fetch(accountsUrl.toString(), { method: "GET" })
    const raw = (await res.json().catch(() => ({}))) as {
      data?: { id?: string; name?: string; access_token?: string }[]
      error?: { message?: string }
    }
    if (!res.ok) {
      console.error("[meta-instagram] /me/accounts para Facebook overview erro:", res.status, raw)
      const msg = raw.error?.message ?? `Erro ${res.status} ao obter páginas.`
      return jsonResponse({ error: msg }, 502)
    }
    const pages = Array.isArray(raw.data) ? raw.data : []
    const target = pages.find((p) => typeof p.id === "string" && p.id === pageId)
    const tokenCandidate =
      target && typeof target.access_token === "string" ? target.access_token.trim() : ""
    pageAccessToken = tokenCandidate || null
  } catch (err) {
    console.error("[meta-instagram] Falha /me/accounts para Facebook overview:", err)
    return jsonResponse({ error: "Erro ao comunicar com a API do Facebook (páginas)." }, 502)
  }

  if (!pageAccessToken) {
    return jsonResponse(
      {
        error: "Não foi possível obter o access_token da página selecionada.",
        hint: "Verifique se o usuário ainda administra a página e se os escopos de permissões estão corretos.",
      },
      400,
    )
  }

  // 2) Buscar insights básicos da página
  const insightsUrl = new URL(
    `https://graph.facebook.com/${metaConfig.graphVersion}/${encodeURIComponent(pageId)}/insights`,
  )
  // Algumas combinações de métricas podem não ser aceitas dependendo da conta/versão.
  // Para manter o fluxo estável, usamos apenas page_impressions aqui.
  const facebookMetrics = "page_impressions"
  insightsUrl.searchParams.set("metric", facebookMetrics)
  insightsUrl.searchParams.set("period", "day")
  insightsUrl.searchParams.set("access_token", pageAccessToken)

  let payload: { data?: InsightsResponse["data"]; error?: InsightsResponse["error"] } = {}
  try {
    const res = await fetch(insightsUrl.toString(), { method: "GET" })
    payload = (await res.json().catch(() => ({}))) as {
      data?: InsightsResponse["data"]
      error?: InsightsResponse["error"]
    }
    if (!res.ok) {
      console.error("[meta-instagram] /{page-id}/insights erro:", res.status, payload)
      const metaError = payload.error

      // Se a Meta retornar código 100 (métrica inválida), tratamos como "sem dados"
      // em vez de estourar erro 502 para o frontend.
      if (metaError && typeof metaError.code === "number" && metaError.code === 100) {
        // #region agent log - meta-instagram facebook insights code 100
        fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "f42ba2",
          },
          body: JSON.stringify({
            sessionId: "f42ba2",
            runId: "fb-soft-100",
            hypothesisId: "FB-metric-100",
            location: "supabase/functions/meta-instagram/index.ts:752",
            message: "facebook insights metric invalid (code 100) - returning empty metrics",
            data: {
              metricsParam: facebookMetrics,
              metaErrorMessage: metaError.message ?? null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion agent log - meta-instagram facebook insights code 100

        return jsonResponse(
          {
            pageId,
            metrics: [],
            hint:
              metaError.message ??
              "Meta retornou código 100 (métrica inválida) para insights da página.",
          },
          200,
        )
      }

      // #region agent log - meta-instagram facebook insights other error
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "f42ba2",
        },
        body: JSON.stringify({
          sessionId: "f42ba2",
          runId: "fb-other-error",
          hypothesisId: "FB-metric-other",
          location: "supabase/functions/meta-instagram/index.ts:770",
          message: "facebook insights other error from Meta",
          data: {
            status: res.status,
            metricsParam: facebookMetrics,
            metaErrorMessage: metaError?.message ?? null,
            metaErrorType: metaError?.type ?? null,
            metaErrorCode: metaError?.code ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion agent log - meta-instagram facebook insights other error

      const msg = metaError?.message ?? `Erro ${res.status} ao obter insights da página.`
      return jsonResponse({ error: msg }, 502)
    }
  } catch (err) {
    console.error("[meta-instagram] Falha /{page-id}/insights:", err)
    return jsonResponse({ error: "Erro ao comunicar com a API do Facebook (insights da página)." }, 502)
  }

  const metrics = Array.isArray(payload.data) ? payload.data : []
  const normalized = metrics.map((metric) => {
    const name = typeof metric.name === "string" ? metric.name : ""
    const period = typeof metric.period === "string" ? metric.period : ""
    const values = Array.isArray(metric.values) ? metric.values : []
    const normalizedValues = values.map((v) => {
      const raw = v?.value
      const num =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(raw)
            : 0
      const endTime = typeof v?.end_time === "string" ? v.end_time : null
      return { value: Number.isFinite(num) ? num : 0, endTime }
    })
    return { metric: name, period, values: normalizedValues }
  })

  return jsonResponse({
    pageId,
    metrics: normalized,
  })
}

async function handleSelectAccount(
  body: SelectAccountBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
) {
  const companyId = resolveCompanyId(ctx, body.company_id)
  const pageIdRaw = body.pageId
  const instagramIdRaw = body.instagramId
  const adAccountIdRaw = body.adAccountId
  const pageId = typeof pageIdRaw === "string" ? pageIdRaw.trim() : ""
  const adAccountId = typeof adAccountIdRaw === "string" ? adAccountIdRaw.trim() : ""

  const service =
    typeof body.service === "string" && VALID_META_SERVICES.includes(body.service as MetaService)
      ? (body.service as MetaService)
      : null

  if (service && service === "meta_ads") {
    if (!adAccountId) {
      return jsonResponse({ error: "adAccountId é obrigatório para Meta Ads." }, 400)
    }
    const adAccountName =
      typeof body.adAccountName === "string" && body.adAccountName.trim().length > 0
        ? body.adAccountName.trim()
        : null

    const { error: updateError } = await supabase
      .from("meta_connections")
      .update({
        selected_ad_account_id: adAccountId,
        selected_ad_account_name: adAccountName,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("provider_type", "meta_ads")

    if (updateError) {
      console.error("[meta-instagram] Erro ao salvar seleção Meta Ads:", updateError)
      return jsonResponse(
        { error: "Erro ao salvar conta Meta Ads selecionada para a empresa." },
        500,
      )
    }

    return jsonResponse({
      success: true,
      selected: { adAccountId, adAccountName },
    })
  }

  if (!pageId) {
    return jsonResponse({ error: "pageId é obrigatório." }, 400)
  }

  const pageName =
    typeof body.pageName === "string" && body.pageName.trim().length > 0
      ? body.pageName.trim()
      : null
  const instagramId =
    typeof instagramIdRaw === "string" && instagramIdRaw.trim().length > 0
      ? instagramIdRaw.trim()
      : null
  const instagramUsername =
    typeof body.instagramUsername === "string" && body.instagramUsername.trim().length > 0
      ? body.instagramUsername.trim()
      : null

  if (service && (service === "instagram" || service === "facebook")) {
    const { error: updateError } = await supabase
      .from("meta_connections")
      .update({
        selected_page_id: pageId,
        selected_page_name: pageName,
        selected_instagram_id: instagramId,
        selected_instagram_username: instagramUsername,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("provider_type", service)

    if (updateError) {
      console.error("[meta-instagram] Erro ao salvar seleção em meta_connections:", updateError)
      return jsonResponse(
        { error: "Erro ao salvar conta Meta selecionada para a empresa." },
        500,
      )
    }

    return jsonResponse({
      success: true,
      selected: { pageId, pageName, instagramId, instagramUsername },
    })
  }

  return jsonResponse(
    { error: "Parâmetro service inválido. Use 'instagram', 'facebook' ou 'meta_ads'." },
    400,
  )
}

async function handleDisconnect(
  body: DisconnectBody,
  ctx: AuthContext,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const companyId = resolveCompanyId(ctx, body.company_id)
  const service =
    typeof body.service === "string" && VALID_META_SERVICES.includes(body.service as MetaService)
      ? (body.service as MetaService)
      : "instagram"

  const { error } = await supabase
    .from("meta_connections")
    .delete()
    .eq("company_id", companyId)
    .eq("provider_type", service)

  if (error) {
    console.error("[meta-instagram] Erro ao desconectar integração Meta:", error)
    return jsonResponse(
      {
        error: "Erro ao desconectar a integração da Meta.",
        hint: "Verifique se a tabela meta_connections existe e se há uma linha para esta empresa.",
      },
      500,
    )
  }

  return jsonResponse({ success: true })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido. Use POST." }, 405)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: "Body JSON inválido." }, 400)
  }

  const action = body?.action
  // #region agent log - meta-instagram request received
  fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "f42ba2",
    },
    body: JSON.stringify({
      sessionId: "f42ba2",
      runId: "pre-fix-1",
      hypothesisId: "H1",
      location: "supabase/functions/meta-instagram/index.ts:891",
      message: "meta-instagram request received",
      data: { action },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion agent log - meta-instagram request received

  if (!action) {
    return jsonResponse({ error: "Parâmetro 'action' é obrigatório." }, 400)
  }

  const authResult = await requireAuthAndCompany(req, body)
  if (authResult.error) return authResult.error
  const ctx = authResult.ctx as AuthContext
  const supabase = authResult.supabase as ReturnType<typeof createClient>

  switch (action) {
    case "getLoginUrl":
      return handleGetLoginUrl(body as GetLoginUrlBody)
    case "exchangeCode":
      return handleExchangeCode(body as ExchangeCodeBody, ctx, supabase)
    case "getConnectionStatus":
      return handleGetConnectionStatus(body as GetConnectionStatusBody, ctx, supabase)
    case "getConnectionSummary":
      return handleGetConnectionSummary(body as GetConnectionSummaryBody, ctx, supabase)
    case "listAccounts":
      return handleListAccounts(body as ListAccountsBody, ctx, supabase)
    case "getInsights":
      return handleGetInsights(body as GetInsightsBody, ctx, supabase)
    case "getInstagramOverview":
      return handleInstagramOverview(body as InstagramOverviewBody, ctx, supabase)
    case "getFacebookOverview":
      return handleFacebookOverview(body as FacebookOverviewBody, ctx, supabase)
    case "selectAccount":
      return handleSelectAccount(body as SelectAccountBody, ctx, supabase)
    case "disconnect":
      return handleDisconnect(body as DisconnectBody, ctx, supabase)
    default:
      // #region agent log - meta-instagram unsupported action
      fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "f42ba2",
        },
        body: JSON.stringify({
          sessionId: "f42ba2",
          runId: "pre-fix-1",
          hypothesisId: "H2",
          location: "supabase/functions/meta-instagram/index.ts:918",
          message: "meta-instagram unsupported action reached",
          data: { action: String(action) },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion agent log - meta-instagram unsupported action

      return jsonResponse({ error: `Ação '${String(action)}' não suportada.` }, 400)
  }
})

