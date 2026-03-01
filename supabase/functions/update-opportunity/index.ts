/**
 * Edge Function: update-opportunity
 *
 * Atualiza oportunidade contornando RLS (usa service role).
 * Verifica permissão: saas_admin ou company_id do profile.
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { id: string, title?: string, value?: number, expected_closing_date?: string | null, stage?: string, lead_id?: string | null, seller_id?: string | null, product_id?: string | null, sinopse?: string | null }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface UpdateBody {
  id: string
  title?: string
  value?: number
  expected_closing_date?: string | null
  stage?: string
  lead_id?: string | null
  seller_id?: string | null
  product_id?: string | null
  sinopse?: string | null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Token ausente. Faça login novamente." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret?.startsWith("sk_")) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch {
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado. Faça login novamente." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  let body: UpdateBody
  try {
    body = (await req.json()) as UpdateBody
  } catch {
    return new Response(
      JSON.stringify({ error: "Body inválido." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (!body?.id) {
    return new Response(
      JSON.stringify({ error: "ID da oportunidade é obrigatório." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: opp } = await supabase
    .from("opportunities")
    .select("company_id")
    .eq("id", body.id)
    .maybeSingle()

  if (!opp) {
    return new Response(
      JSON.stringify({ error: "Oportunidade não encontrada." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const oppCompanyId = (opp as { company_id?: string | null }).company_id

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, saas_admin")
    .eq("id", sub)
    .maybeSingle()

  const profileRow = profile as { company_id?: string | null; saas_admin?: boolean } | null
  const isSaasAdmin = Boolean(profileRow?.saas_admin)
  const profileCompanyId = profileRow?.company_id ?? null

  const canUpdate =
    isSaasAdmin ||
    (profileCompanyId && oppCompanyId === profileCompanyId)

  if (!canUpdate) {
    return new Response(
      JSON.stringify({ error: "Sem permissão para atualizar esta oportunidade." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const payload: Record<string, unknown> = {}
  if (body.title !== undefined) payload.title = (body.title ?? "").toString().trim()
  if (body.value !== undefined) payload.value = Number(body.value) || 0
  if (body.expected_closing_date !== undefined) payload.expected_closing_date = body.expected_closing_date || null
  if (body.stage !== undefined) payload.stage = body.stage
  if (body.lead_id !== undefined) payload.lead_id = body.lead_id || null
  if (body.seller_id !== undefined) payload.seller_id = body.seller_id || null
  if (body.product_id !== undefined) payload.product_id = body.product_id || null
  if (body.sinopse !== undefined) payload.sinopse = body.sinopse || null

  const { error } = await supabase
    .from("opportunities")
    .update(payload)
    .eq("id", body.id)

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  return new Response(
    JSON.stringify({ success: true, id: body.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
