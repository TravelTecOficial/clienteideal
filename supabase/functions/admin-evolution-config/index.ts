/**
 * Edge Function: admin-evolution-config
 *
 * Configuração global da Evolution API (URL e API Key).
 * GET ou POST sem body -> Retorna evolution_api_url (nunca API Key)
 * POST com evolution_api_url e/ou evolution_api_key -> Atualiza (apenas admin)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createClerkClient, verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    body.evolution_api_url !== undefined || body.evolution_api_key !== undefined

  if (req.method === "GET" || req.method === "POST" && !hasUpdate) {
    const { data, error } = await supabase
      .from("admin_evolution_config")
      .select("evolution_api_url")
      .limit(1)
      .maybeSingle()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const row = data as { evolution_api_url: string | null } | null
    return new Response(
      JSON.stringify({ evolution_api_url: row?.evolution_api_url ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const evolution_api_url = body.evolution_api_url as string | undefined
  const evolution_api_key = body.evolution_api_key as string | undefined

  const update: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  }
  if (evolution_api_url !== undefined) {
    update.evolution_api_url = evolution_api_url?.trim() || null
  }
  if (evolution_api_key !== undefined) {
    update.evolution_api_key = evolution_api_key?.trim() || null
  }

  const { data: existing } = await supabase
    .from("admin_evolution_config")
    .select("id")
    .limit(1)
    .maybeSingle()

  if (!existing) {
    const { error: insertErr } = await supabase
      .from("admin_evolution_config")
      .insert({
        evolution_api_url: update.evolution_api_url ?? null,
        evolution_api_key: update.evolution_api_key ?? null,
      })
    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    const { data: inserted } = await supabase
      .from("admin_evolution_config")
      .select("evolution_api_url")
      .limit(1)
      .maybeSingle()
    return new Response(
      JSON.stringify({ success: true, evolution_api_url: (inserted as { evolution_api_url: string | null } | null)?.evolution_api_url ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const { data, error } = await supabase
    .from("admin_evolution_config")
    .update(update)
    .eq("id", (existing as { id: string }).id)
    .select("evolution_api_url")
    .maybeSingle()

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const row = data as { evolution_api_url: string | null } | null
  return new Response(
    JSON.stringify({ success: true, evolution_api_url: row?.evolution_api_url ?? null }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
