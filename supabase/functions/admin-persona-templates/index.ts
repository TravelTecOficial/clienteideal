/**
 * Edge Function: admin-persona-templates
 *
 * CRUD de modelos de persona (persona_templates).
 * Apenas admin do SaaS (Clerk publicMetadata.role === "admin") pode acessar.
 *
 * POST body: { action: "list" | "create" | "update" | "delete", ... }
 * - list: retorna { templates: [...] }
 * - create: { profile_name, description?, age_range?, ... } -> cria template
 * - update: { id, profile_name?, description?, ... } -> atualiza template
 * - delete: { id } -> remove template
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createClerkClient, verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

async function debugLog(params: {
  runId: string
  hypothesisId: string
  location: string
  message: string
  data?: Record<string, unknown>
}) {
  // #region agent log
  await fetch("http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "3aa62b",
    },
    body: JSON.stringify({
      sessionId: "3aa62b",
      runId: params.runId,
      hypothesisId: params.hypothesisId,
      location: params.location,
      message: params.message,
      data: params.data ?? {},
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

interface TemplatePayload {
  profile_name?: string
  description?: string | null
  age_range?: string | null
  gender?: string | null
  location?: string | null
  income_level?: string | null
  job_title?: string | null
  goals_dreams?: string | null
  pain_points?: string | null
  values_list?: string | null
  hobbies_interests?: string | null
  buying_journey?: string | null
  decision_criteria?: string | null
  common_objections?: string | null
  target_product?: string | null
  avatar_url?: string | null
  segment_type?: "geral" | "produtos" | "consorcio" | "seguros"
}

interface RequestBody {
  action: "list" | "create" | "update" | "delete"
  /** Token JWT do Clerk - enviado no body para o gateway aceitar anon key */
  token?: string
  id?: string
  profile_name?: string
  description?: string | null
  age_range?: string | null
  gender?: string | null
  location?: string | null
  income_level?: string | null
  job_title?: string | null
  goals_dreams?: string | null
  pain_points?: string | null
  values_list?: string | null
  hobbies_interests?: string | null
  buying_journey?: string | null
  decision_criteria?: string | null
  common_objections?: string | null
  target_product?: string | null
  avatar_url?: string | null
  segment_type?: "geral" | "produtos" | "consorcio" | "seguros"
}

function toTemplatePayload(body: RequestBody): TemplatePayload {
  return {
    profile_name: body.profile_name,
    description: body.description ?? null,
    age_range: body.age_range ?? null,
    gender: body.gender ?? null,
    location: body.location ?? null,
    income_level: body.income_level ?? null,
    job_title: body.job_title ?? null,
    goals_dreams: body.goals_dreams ?? null,
    pain_points: body.pain_points ?? null,
    values_list: body.values_list ?? null,
    hobbies_interests: body.hobbies_interests ?? null,
    buying_journey: body.buying_journey ?? null,
    decision_criteria: body.decision_criteria ?? null,
    common_objections: body.common_objections ?? null,
    target_product: body.target_product ?? null,
    avatar_url: body.avatar_url ?? null,
    segment_type: body.segment_type ?? "geral",
  }
}

function isValidSegment(
  segment: string | undefined
): segment is "geral" | "produtos" | "consorcio" | "seguros" {
  return (
    segment === undefined ||
    segment === "geral" ||
    segment === "produtos" ||
    segment === "consorcio" ||
    segment === "seguros"
  )
}

Deno.serve(async (req) => {
  const runId = "persona-pre-fix-1"
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  let body: RequestBody = { action: "list" }
  try {
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      body = (await req.json()) as RequestBody
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Body JSON inválido." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const authHeader = req.headers.get("Authorization")
  const tokenFromBody = body?.token?.trim() || ""
  const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, "")?.trim() || ""
  const token = tokenFromBody || tokenFromHeader
  await debugLog({
    runId,
    hypothesisId: "H1",
    location: "admin-persona-templates/index.ts:request-parsed",
    message: "Request parsed",
    data: {
      method: req.method,
      action: body.action ?? "list",
      hasTokenFromBody: Boolean(tokenFromBody),
      hasTokenFromHeader: Boolean(tokenFromHeader),
    },
  })

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Token ausente. Faça login novamente." }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret || !clerkSecret.startsWith("sk_")) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch {
    return new Response(
      JSON.stringify({
        error: "Token inválido ou expirado. Faça login novamente.",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const clerkClient = createClerkClient({ secretKey: clerkSecret })
  let user: { publicMetadata?: Record<string, unknown> }
  try {
    user = await clerkClient.users.getUser(sub)
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao verificar permissões." }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const saasRole = user.publicMetadata?.role as string | undefined
  if (saasRole !== "admin") {
    return new Response(
      JSON.stringify({ error: "Acesso negado. Apenas administradores do sistema." }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  await debugLog({
    runId,
    hypothesisId: "H2",
    location: "admin-persona-templates/index.ts:env-check",
    message: "Supabase env check",
    data: {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(supabaseServiceKey),
      supabaseHost: supabaseUrl ? new URL(supabaseUrl).host : "",
    },
  })
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const action = body.action ?? "list"

  if (action === "list") {
    await debugLog({
      runId,
      hypothesisId: "H3",
      location: "admin-persona-templates/index.ts:list-start",
      message: "Starting list query persona_templates",
      data: {},
    })
    const { data, error } = await supabase
      .from("persona_templates")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      await debugLog({
        runId,
        hypothesisId: "H3",
        location: "admin-persona-templates/index.ts:list-error",
        message: "List query failed",
        data: {
          errorMessage: error.message,
          errorCode: error.code ?? "",
        },
      })
      console.error("[admin-persona-templates] list error:", error.message, error.code)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({ templates: data ?? [] }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  if (action === "create") {
    if (!isValidSegment(body.segment_type)) {
      return new Response(
        JSON.stringify({ error: "segment_type inválido." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (!body.profile_name?.trim()) {
      return new Response(
        JSON.stringify({ error: "profile_name é obrigatório." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const payload = toTemplatePayload(body)
    const insert = {
      ...payload,
      profile_name: body.profile_name!.trim(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("persona_templates")
      .insert(insert)
      .select()
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, template: data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  if (action === "update") {
    if (!isValidSegment(body.segment_type)) {
      return new Response(
        JSON.stringify({ error: "segment_type inválido." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const id = body.id
    if (!id) {
      return new Response(
        JSON.stringify({ error: "id é obrigatório para atualizar." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const payload = toTemplatePayload(body)
    const update: Record<string, unknown> = {
      ...payload,
      updated_at: new Date().toISOString(),
    }
    if (body.profile_name !== undefined) {
      update.profile_name = body.profile_name.trim()
    }

    const { data, error } = await supabase
      .from("persona_templates")
      .update(update)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, template: data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  if (action === "delete") {
    const id = body.id
    if (!id) {
      return new Response(
        JSON.stringify({ error: "id é obrigatório para excluir." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const { error } = await supabase
      .from("persona_templates")
      .delete()
      .eq("id", id)

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  return new Response(
    JSON.stringify({ error: "action inválida. Use list, create, update ou delete." }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  )
})
