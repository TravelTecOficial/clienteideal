/**
 * Edge Function: admin-webhook-config
 *
 * POST sem body ou com action: "get" -> Retorna as configurações (apenas admin)
 * POST com config_type e webhooks -> Atualiza uma configuração (apenas admin)
 *
 * Body update: { config_type: "consorcio" | "produtos", webhook_testar_atendente?: string, webhook_enviar_arquivos?: string }
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
    // fallback abaixo via profiles
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
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      body = (await req.json()) as Record<string, unknown>
    }
  } catch { /* empty body */ }

  const isUpdate = body.config_type && (body.webhook_testar_atendente !== undefined || body.webhook_enviar_arquivos !== undefined)

  if (req.method === "GET" || !isUpdate) {
    const { data, error } = await supabase
      .from("admin_webhook_config")
      .select("config_type, webhook_testar_atendente, webhook_enviar_arquivos")
      .order("config_type")

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ configs: data ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (isUpdate) {
    const { config_type, webhook_testar_atendente, webhook_enviar_arquivos } = body as {
      config_type: string
      webhook_testar_atendente?: string
      webhook_enviar_arquivos?: string
    }
    if (!config_type || (config_type !== "consorcio" && config_type !== "produtos")) {
      return new Response(
        JSON.stringify({ error: "config_type deve ser 'consorcio' ou 'produtos'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const update: Record<string, string | null> = { updated_at: new Date().toISOString() }
    if (webhook_testar_atendente !== undefined) {
      update.webhook_testar_atendente = webhook_testar_atendente?.trim() || null
    }
    if (webhook_enviar_arquivos !== undefined) {
      update.webhook_enviar_arquivos = webhook_enviar_arquivos?.trim() || null
    }

    const { data, error } = await supabase
      .from("admin_webhook_config")
      .update(update)
      .eq("config_type", config_type)
      .select()
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, config: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  return new Response(
    JSON.stringify({ error: "Método não permitido." }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
