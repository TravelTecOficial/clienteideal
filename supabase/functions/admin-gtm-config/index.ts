/**
 * Edge Function: admin-gtm-config
 *
 * Configuração global do Google Tag Manager (head e body).
 * GET ou POST sem body -> Retorna gtm_head e gtm_body (apenas admin)
 * POST com gtm_head e/ou gtm_body -> Atualiza (apenas admin)
 * Validação: conteúdo deve conter googletagmanager.com ou ser vazio/null
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createClerkClient, verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const GTM_ALLOWED_DOMAIN = "googletagmanager.com"

function isValidGtmContent(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.trim() === "") return true
  return value.includes(GTM_ALLOWED_DOMAIN)
}

async function requireAdmin(req: Request): Promise<{ error?: Response; sub?: string }> {
  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")

  if (!token) {
    return {
      error: new Response(
        JSON.stringify({ error: "Token ausente. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    }
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret || !clerkSecret.startsWith("sk_")) {
    return {
      error: new Response(
        JSON.stringify({ error: "Configuração do servidor inválida." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    }
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch {
    return {
      error: new Response(
        JSON.stringify({ error: "Token inválido ou expirado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    }
  }

  return { sub }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const authResult = await requireAdmin(req)
  if (authResult.error) return authResult.error

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const sub = authResult.sub as string

  let isAdmin = false
  try {
    const clerkClient = createClerkClient({ secretKey: Deno.env.get("CLERK_SECRET_KEY") as string })
    const user = await clerkClient.users.getUser(sub)
    const saasRole = user.publicMetadata?.role as string | undefined
    isAdmin = saasRole === "admin"
  } catch {
    // fallback via profiles
  }

  if (!isAdmin) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sub)
      .maybeSingle()
    const role = (profile as { role?: string } | null)?.role
    isAdmin = role === "admin"
  }
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: "Acesso negado. Apenas administradores." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  let body: Record<string, unknown> = {}
  try {
    const ct = req.headers.get("content-type") ?? ""
    if (req.method === "POST" && (ct.includes("application/json") || ct === "")) {
      const raw = await req.text()
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    }
  } catch {
    body = {}
  }

  const hasUpdate =
    body.gtm_head !== undefined || body.gtm_body !== undefined

  if (req.method === "GET" || (req.method === "POST" && !hasUpdate)) {
    const { data, error } = await supabase
      .from("admin_gtm_config")
      .select("gtm_head, gtm_body")
      .limit(1)
      .maybeSingle()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const row = data as { gtm_head: string | null; gtm_body: string | null } | null
    return new Response(
      JSON.stringify({
        gtm_head: row?.gtm_head ?? null,
        gtm_body: row?.gtm_body ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const gtm_head = body.gtm_head as string | undefined
  const gtm_body = body.gtm_body as string | undefined

  if (!isValidGtmContent(gtm_head)) {
    return new Response(
      JSON.stringify({
        error: "O código do head deve conter googletagmanager.com ou estar vazio.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
  if (!isValidGtmContent(gtm_body)) {
    return new Response(
      JSON.stringify({
        error: "O código do body deve conter googletagmanager.com ou estar vazio.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const update: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  }
  if (gtm_head !== undefined) {
    update.gtm_head = gtm_head?.trim() || null
  }
  if (gtm_body !== undefined) {
    update.gtm_body = gtm_body?.trim() || null
  }

  const { data: existing } = await supabase
    .from("admin_gtm_config")
    .select("id")
    .limit(1)
    .maybeSingle()

  if (!existing) {
    const { error: insertErr } = await supabase
      .from("admin_gtm_config")
      .insert({
        gtm_head: update.gtm_head ?? null,
        gtm_body: update.gtm_body ?? null,
      })
    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    const { data: inserted } = await supabase
      .from("admin_gtm_config")
      .select("gtm_head, gtm_body")
      .limit(1)
      .maybeSingle()
    const row = inserted as { gtm_head: string | null; gtm_body: string | null } | null
    return new Response(
      JSON.stringify({
        success: true,
        gtm_head: row?.gtm_head ?? null,
        gtm_body: row?.gtm_body ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const { data, error } = await supabase
    .from("admin_gtm_config")
    .update(update)
    .eq("id", (existing as { id: string }).id)
    .select("gtm_head, gtm_body")
    .maybeSingle()

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const row = data as { gtm_head: string | null; gtm_body: string | null } | null
  return new Response(
    JSON.stringify({
      success: true,
      gtm_head: row?.gtm_head ?? null,
      gtm_body: row?.gtm_body ?? null,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
