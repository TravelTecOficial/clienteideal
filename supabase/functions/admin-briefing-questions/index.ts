/**
 * Edge Function: admin-briefing-questions
 *
 * CRUD de perguntas do Questionário de Briefing Estratégico.
 * Apenas admin do SaaS (Clerk publicMetadata.role === "admin") pode acessar.
 *
 * Auth: --no-verify-jwt (validação via Clerk verifyToken na função).
 * Secret: CLERK_SECRET_KEY.
 * Deploy DEV: npx supabase functions deploy admin-briefing-questions --project-ref mrkvvgofjyvlutqpvedt --no-verify-jwt
 * Deploy PROD: npx supabase functions deploy admin-briefing-questions --project-ref bctjodobbsxieywgulvl --no-verify-jwt
 *
 * POST body: { action: "create" | "update" | "delete" | "reorder", token?, ... }
 * - create: { category, question_text, help_text?, input_type, slug, is_atrito?, options?, ordem? }
 * - update: { id, question_text?, help_text?, input_type?, slug?, is_atrito?, options?, ordem? }
 * - delete: { id }
 * - reorder: { category, order_ids: string[] } - ids na ordem desejada
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createClerkClient, verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const CATEGORIES = [
  "dna_empresa",
  "produto_oferta",
  "publico_persona",
  "mercado_concorrencia",
  "objetivos_metas",
] as const

const INPUT_TYPES = ["texto_curto", "texto_longo", "selecao", "numerico"] as const

function isValidCategory(v: string): v is (typeof CATEGORIES)[number] {
  return CATEGORIES.includes(v as (typeof CATEGORIES)[number])
}

function isValidInputType(v: string): v is (typeof INPUT_TYPES)[number] {
  return INPUT_TYPES.includes(v as (typeof INPUT_TYPES)[number])
}

function isValidSlug(s: string): boolean {
  return /^[a-z0-9_]+$/.test(s) && s.length >= 2 && s.length <= 80
}

interface RequestBody {
  action: "create" | "update" | "delete" | "reorder"
  token?: string
  id?: string
  category?: string
  order_ids?: string[]
  question_text?: string
  help_text?: string | null
  input_type?: string
  slug?: string
  is_atrito?: boolean
  options?: string[] | null
  ordem?: number
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  let body: RequestBody = { action: "create" }
  try {
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      body = (await req.json()) as RequestBody
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Body JSON inválido." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const token =
    body?.token?.trim() ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")?.trim() ||
    ""

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Token ausente. Faça login novamente." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret || !clerkSecret.startsWith("sk_")) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  let sub: string
  try {
    const verified = await verifyToken(token, {
      secretKey: clerkSecret,
      clockSkewInMs: 60_000, // 60s de tolerância para dessincronia de relógio
    })
    sub = verified.sub as string
  } catch {
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado. Faça login novamente." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const clerkClient = createClerkClient({ secretKey: clerkSecret })
  let user: { publicMetadata?: Record<string, unknown> }
  try {
    user = await clerkClient.users.getUser(sub)
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao verificar permissões." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const saasRole = user.publicMetadata?.role as string | undefined
  if (saasRole !== "admin") {
    return new Response(
      JSON.stringify({ error: "Acesso negado. Apenas administradores do sistema." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
  const action = body.action ?? "create"

  if (action === "create") {
    if (!body.category || !isValidCategory(body.category)) {
      return new Response(
        JSON.stringify({ error: "category é obrigatório e deve ser um dos pilares válidos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    if (!body.question_text?.trim()) {
      return new Response(
        JSON.stringify({ error: "question_text é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    const inputType = body.input_type ?? "texto_curto"
    if (!isValidInputType(inputType)) {
      return new Response(
        JSON.stringify({ error: "input_type inválido. Use: texto_curto, texto_longo, selecao ou numerico." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    const slug = (body.slug ?? "").trim().toLowerCase()
    if (!slug || !isValidSlug(slug)) {
      return new Response(
        JSON.stringify({ error: "slug é obrigatório. Use apenas letras minúsculas, números e underscore (ex: oferta_ticket_medio)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    if (inputType === "selecao" && (!body.options || !Array.isArray(body.options) || body.options.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Para tipo seleção, options deve ser um array com pelo menos uma opção." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const insertPayload = {
      category: body.category,
      question_text: body.question_text.trim(),
      help_text: body.help_text?.trim() || null,
      input_type: inputType,
      slug,
      is_atrito: Boolean(body.is_atrito),
      options: inputType === "selecao" && Array.isArray(body.options)
        ? body.options.filter((o) => typeof o === "string" && o.trim()).map((o) => o.trim())
        : null,
      ordem: Math.max(1, Math.floor(body.ordem ?? 1)),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("briefing_questions")
      .insert(insertPayload)
      .select("id, category, question_text, slug, ordem")
      .single()

    if (error) {
      if (error.code === "23505") {
        return new Response(
          JSON.stringify({ error: "Já existe uma pergunta com este slug. Use outro identificador." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, question: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (action === "update") {
    const id = body.id
    if (!id) {
      return new Response(
        JSON.stringify({ error: "id é obrigatório para atualizar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.question_text !== undefined) updatePayload.question_text = body.question_text.trim()
    if (body.help_text !== undefined) updatePayload.help_text = body.help_text?.trim() || null
    if (body.input_type !== undefined) {
      if (!isValidInputType(body.input_type)) {
        return new Response(
          JSON.stringify({ error: "input_type inválido." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      updatePayload.input_type = body.input_type
    }
    if (body.slug !== undefined) {
      const slug = body.slug.trim().toLowerCase()
      if (!slug || !isValidSlug(slug)) {
        return new Response(
          JSON.stringify({ error: "slug inválido. Use snake_case." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      updatePayload.slug = slug
    }
    if (body.is_atrito !== undefined) updatePayload.is_atrito = Boolean(body.is_atrito)
    if (body.options !== undefined) {
      updatePayload.options =
        body.options && Array.isArray(body.options)
          ? body.options.filter((o) => typeof o === "string" && o.trim()).map((o) => o.trim())
          : null
    }
    if (body.ordem !== undefined) updatePayload.ordem = Math.max(1, Math.floor(body.ordem))

    const { error } = await supabase
      .from("briefing_questions")
      .update(updatePayload)
      .eq("id", id)

    if (error) {
      if (error.code === "23505") {
        return new Response(
          JSON.stringify({ error: "Já existe uma pergunta com este slug." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (action === "reorder") {
    const orderIds = body.order_ids
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "order_ids é obrigatório (array de ids na ordem desejada)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    if (!body.category || !isValidCategory(body.category)) {
      return new Response(
        JSON.stringify({ error: "category é obrigatório para reordenar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    for (let i = 0; i < orderIds.length; i++) {
      const id = orderIds[i]
      if (typeof id !== "string" || !id) continue
      await supabase
        .from("briefing_questions")
        .update({ ordem: i + 1, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("category", body.category)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (action === "delete") {
    const id = body.id
    if (!id) {
      return new Response(
        JSON.stringify({ error: "id é obrigatório para excluir." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { error } = await supabase.from("briefing_questions").delete().eq("id", id)
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  return new Response(
    JSON.stringify({ error: "action inválida. Use create, update ou delete." }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
