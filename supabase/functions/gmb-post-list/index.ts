/**
 * Edge Function: gmb-post-list
 *
 * Proxy para Late API - GET /api/v1/posts (listar posts do Google Business).
 * Requer: Authorization: Bearer <clerk_jwt>
 * Query: opcional status (scheduled, published, etc.)
 * Secret: LATE_API_KEY
 *
 * Deploy: npx supabase functions deploy gmb-post-list --project-ref mrkvvgofjyvlutqpvedt --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

const LATE_POSTS_URL = "https://getlate.dev/api/v1/posts"

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

  if (req.method !== "GET") {
    return jsonResponse({ error: "Método não permitido." }, 405)
  }

  const requestUrl = new URL(req.url)
  const queryCompanyId = requestUrl.searchParams.get("company_id")?.trim() || null

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

  const companyId =
    queryCompanyId && (isSaasAdmin || profileCompanyId === queryCompanyId)
      ? queryCompanyId
      : profileCompanyId

  if (!companyId) {
    return jsonResponse(
      { error: "Usuário sem empresa vinculada." },
      403
    )
  }

  const { data: gmbAccount } = await supabase
    .from("gmb_accounts")
    .select("late_account_id")
    .eq("company_id", companyId)
    .maybeSingle()

  const lateAccountId = (gmbAccount as { late_account_id?: string } | null)?.late_account_id?.trim()

  if (!lateAccountId) {
    return jsonResponse(
      { error: "Nenhuma conta Google Meu Negócio vinculada. Cadastre o Late Account ID na tela GMB Local." },
      404
    )
  }


  const lateApiKey = Deno.env.get("LATE_API_KEY")?.trim()
  if (!lateApiKey) {
    return jsonResponse(
      { error: "LATE_API_KEY não configurada. Configure nas Secrets do Supabase." },
      503
    )
  }

  const url = new URL(LATE_POSTS_URL)
  url.searchParams.set("social_account_id", lateAccountId)

  try {
    const lateRes = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${lateApiKey}`,
      },
    })

    const lateData = await lateRes.json().catch(() => ({}))

    if (!lateRes.ok) {
      const errMsg =
        (lateData?.message as string) ??
        (lateData?.error as string) ??
        `Late API retornou ${lateRes.status}`
      return jsonResponse({ error: errMsg }, 502)
    }

    const raw = Array.isArray(lateData) ? lateData : (lateData?.data ?? lateData?.posts ?? [])
    const list = Array.isArray(raw) ? raw : []

    const posts = list.map((p: Record<string, unknown>) => {
      const mediaItems = (p.media_items ?? p.mediaItems ?? p.media) as Array<{ url?: string; type?: string }> | undefined
      const firstMedia = Array.isArray(mediaItems) && mediaItems.length > 0 ? mediaItems[0] : null
      const mediaUrl =
        (firstMedia && typeof firstMedia === "object" && typeof firstMedia.url === "string" ? firstMedia.url : null) ??
        (typeof p.image_url === "string" ? p.image_url : null) ??
        (typeof p.thumbnail_url === "string" ? p.thumbnail_url : null)
      return {
        id: p.id ?? p._id ?? "",
        content: typeof p.content === "string" ? p.content : (p.text as string) ?? "",
        status: typeof p.status === "string" ? p.status : (p.state as string) ?? "",
        createdAt: p.created_at ?? p.createdAt ?? null,
        scheduledAt: p.scheduled_at ?? p.scheduledAt ?? null,
        publishedAt: p.published_at ?? p.publishedAt ?? null,
        platform: typeof p.platform === "string" ? p.platform : null,
        mediaUrl: mediaUrl ?? null,
      }
    })

    const byDate = (a: { publishedAt: string | null; scheduledAt: string | null; createdAt: string | null }, b: { publishedAt: string | null; scheduledAt: string | null; createdAt: string | null }) => {
      const da = a.publishedAt || a.scheduledAt || a.createdAt || ""
      const db = b.publishedAt || b.scheduledAt || b.createdAt || ""
      return db.localeCompare(da)
    }
    posts.sort(byDate)

    return jsonResponse({ posts })
  } catch (err) {
    console.error("[gmb-post-list] Fetch error:", err)
    return jsonResponse({ error: "Erro ao listar postagens do Google Business." }, 500)
  }
})
