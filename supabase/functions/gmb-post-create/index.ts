/**
 * Edge Function: gmb-post-create
 *
 * Proxy para Late API - POST /api/v1/posts (criar post no Google Business).
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { content: string, mediaUrl?: string, accountId: string }
 * Secret: LATE_API_KEY
 *
 * Deploy: npx supabase functions deploy gmb-post-create --project-ref mrkvvgofjyvlutqpvedt --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const LATE_API_URL = "https://getlate.dev/api/v1/posts"

interface RequestBody {
  content: string
  mediaUrl?: string
  accountId: string
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405)
  }

  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")?.trim()

  if (!token) {
    return jsonResponse({ error: "Token ausente. Faça login novamente." }, 401)
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret?.startsWith("sk_")) {
    return jsonResponse({ error: "Configuração do servidor inválida." }, 500)
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch {
    return jsonResponse(
      { error: "Token inválido ou expirado. Faça login novamente." },
      401
    )
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: "Body JSON inválido." }, 400)
  }

  const content = typeof body.content === "string" ? body.content.trim() : ""
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : ""
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() || undefined : undefined

  if (!content) {
    return jsonResponse({ error: "content é obrigatório." }, 400)
  }
  if (!accountId) {
    return jsonResponse({ error: "accountId é obrigatório." }, 400)
  }

  const lateApiKey = Deno.env.get("LATE_API_KEY")?.trim()
  if (!lateApiKey) {
    return jsonResponse(
      { error: "LATE_API_KEY não configurada. Configure nas Secrets do Supabase." },
      503
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
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

  const { data: gmbAccount } = await supabase
    .from("gmb_accounts")
    .select("company_id")
    .eq("late_account_id", accountId)
    .maybeSingle()

  const gmbCompanyId = (gmbAccount as { company_id?: string } | null)?.company_id ?? null

  const canPost =
    isSaasAdmin ||
    (profileCompanyId !== null &&
      gmbCompanyId !== null &&
      profileCompanyId === gmbCompanyId)

  if (!canPost) {
    if (!gmbCompanyId) {
      return jsonResponse(
        { error: "Cadastre o Late Account ID na aba Gerenciar Perfil antes de publicar." },
        403
      )
    }
    return jsonResponse(
      { error: "Sem permissão para publicar neste account. O accountId não pertence à sua empresa." },
      403
    )
  }

  const latePayload: Record<string, unknown> = {
    content,
    platforms: [{ platform: "googlebusiness", accountId }],
    publishNow: true,
  }

  if (mediaUrl && mediaUrl.startsWith("https://")) {
    latePayload.mediaItems = [{ type: "image", url: mediaUrl }]
  }

  try {
    const lateRes = await fetch(LATE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lateApiKey}`,
      },
      body: JSON.stringify(latePayload),
    })

    const lateData = (await lateRes.json().catch(() => ({}))) as Record<string, unknown>

    if (!lateRes.ok) {
      console.error("[gmb-post-create] Late API error:", lateRes.status, lateData)
      const errMsg =
        (lateData?.message as string) ??
        (lateData?.error as string) ??
        `Late API retornou ${lateRes.status}`
      return jsonResponse({ error: errMsg }, 502)
    }

    return jsonResponse(lateData)
  } catch (err) {
    console.error("[gmb-post-create] Fetch error:", err)
    return jsonResponse({ error: "Erro ao publicar no Google Business." }, 500)
  }
})
