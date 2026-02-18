/**
 * Edge Function: admin-qualificacao-templates
 *
 * CRUD de modelos de qualificação (qualificacao_templates + perguntas + respostas).
 * Apenas admin do SaaS (Clerk publicMetadata.role === "admin") pode acessar.
 *
 * POST body: { action: "list" | "create" | "update" | "delete", token?, ... }
 * - list: retorna { templates: [...] } com perguntas e respostas aninhadas
 * - create: { nome, segment_type?, perguntas: [{ pergunta, peso, ordem, resposta_fria, resposta_morna, resposta_quente }] }
 * - update: { id, nome?, segment_type?, perguntas: [...] } -> substitui todas as perguntas
 * - delete: { id }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createClerkClient, verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const PONTOS_TIPO = { fria: 1, morna: 5, quente: 10 } as const

interface PerguntaPayload {
  pergunta: string
  peso?: number
  ordem?: number
  resposta_fria?: string
  resposta_morna?: string
  resposta_quente?: string
}

interface RequestBody {
  action: "list" | "create" | "update" | "delete"
  token?: string
  id?: string
  nome?: string
  segment_type?: "geral" | "produtos" | "consorcio" | "seguros"
  perguntas?: PerguntaPayload[]
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
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const tokenFromBody = body?.token?.trim() || ""
  const tokenFromHeader = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")?.trim() || ""
  const token = tokenFromBody || tokenFromHeader

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
    const verified = await verifyToken(token, { secretKey: clerkSecret })
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
  const action = body.action ?? "list"

  if (action === "list") {
    const { data: templates, error } = await supabase
      .from("qualificacao_templates")
      .select("id, nome, segment_type, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const result: Array<Record<string, unknown>> = []
    for (const t of templates ?? []) {
      const { data: perguntas } = await supabase
        .from("qualificacao_template_perguntas")
        .select("id, pergunta, peso, ordem")
        .eq("template_id", t.id)
        .order("ordem", { ascending: true })

      const perguntasComRespostas: Array<Record<string, unknown>> = []
      for (const p of perguntas ?? []) {
        const { data: respostas } = await supabase
          .from("qualificacao_template_respostas")
          .select("tipo, resposta_texto, pontuacao")
          .eq("pergunta_id", p.id)

        const respMap: Record<string, string> = {}
        const pontMap: Record<string, number> = {}
        ;(respostas ?? []).forEach((r: { tipo: string; resposta_texto: string; pontuacao: number }) => {
          respMap[r.tipo] = r.resposta_texto
          pontMap[r.tipo] = r.pontuacao
        })

        perguntasComRespostas.push({
          id: p.id,
          pergunta: p.pergunta,
          peso: p.peso ?? 1,
          ordem: p.ordem ?? 1,
          resposta_fria: respMap.fria ?? "",
          resposta_morna: respMap.morna ?? "",
          resposta_quente: respMap.quente ?? "",
        })
      }

      result.push({
        ...t,
        perguntas: perguntasComRespostas,
      })
    }

    return new Response(
      JSON.stringify({ templates: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (action === "create") {
    if (!body.nome?.trim()) {
      return new Response(
        JSON.stringify({ error: "nome é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    if (!isValidSegment(body.segment_type)) {
      return new Response(
        JSON.stringify({ error: "segment_type inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { data: template, error: errT } = await supabase
      .from("qualificacao_templates")
      .insert({
        nome: body.nome.trim(),
        segment_type: body.segment_type ?? "geral",
        updated_at: new Date().toISOString(),
      })
      .select("id, nome, segment_type")
      .single()

    if (errT || !template) {
      return new Response(
        JSON.stringify({ error: errT?.message ?? "Falha ao criar template." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const perguntas = body.perguntas ?? []
    for (let i = 0; i < perguntas.length; i++) {
      const p = perguntas[i]
      if (!p.pergunta?.trim()) continue
      const peso = Math.min(3, Math.max(1, p.peso ?? 1))
      const ordem = p.ordem ?? i + 1

      const { data: pergunta, error: errP } = await supabase
        .from("qualificacao_template_perguntas")
        .insert({
          template_id: template.id,
          pergunta: p.pergunta.trim(),
          peso,
          ordem,
        })
        .select("id")
        .single()

      if (errP || !pergunta) continue

      const respostas: Array<{ pergunta_id: string; resposta_texto: string; tipo: "fria" | "morna" | "quente"; pontuacao: number }> = []
      if (p.resposta_fria?.trim()) respostas.push({ pergunta_id: pergunta.id, resposta_texto: p.resposta_fria.trim(), tipo: "fria", pontuacao: peso * PONTOS_TIPO.fria })
      if (p.resposta_morna?.trim()) respostas.push({ pergunta_id: pergunta.id, resposta_texto: p.resposta_morna.trim(), tipo: "morna", pontuacao: peso * PONTOS_TIPO.morna })
      if (p.resposta_quente?.trim()) respostas.push({ pergunta_id: pergunta.id, resposta_texto: p.resposta_quente.trim(), tipo: "quente", pontuacao: peso * PONTOS_TIPO.quente })

      if (respostas.length > 0) {
        await supabase.from("qualificacao_template_respostas").insert(respostas)
      }
    }

    return new Response(
      JSON.stringify({ success: true, template }),
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
    if (!isValidSegment(body.segment_type)) {
      return new Response(
        JSON.stringify({ error: "segment_type inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.nome !== undefined) updatePayload.nome = body.nome.trim()
    if (body.segment_type !== undefined) updatePayload.segment_type = body.segment_type

    const { error: errU } = await supabase
      .from("qualificacao_templates")
      .update(updatePayload)
      .eq("id", id)

    if (errU) {
      return new Response(
        JSON.stringify({ error: errU.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (body.perguntas !== undefined) {
      const { data: oldPerguntas } = await supabase
        .from("qualificacao_template_perguntas")
        .select("id")
        .eq("template_id", id)

      for (const op of oldPerguntas ?? []) {
        await supabase.from("qualificacao_template_respostas").delete().eq("pergunta_id", op.id)
      }
      await supabase.from("qualificacao_template_perguntas").delete().eq("template_id", id)

      const perguntas = body.perguntas
      for (let i = 0; i < perguntas.length; i++) {
        const p = perguntas[i]
        if (!p.pergunta?.trim()) continue
        const peso = Math.min(3, Math.max(1, p.peso ?? 1))
        const ordem = p.ordem ?? i + 1

        const { data: pergunta, error: errP } = await supabase
          .from("qualificacao_template_perguntas")
          .insert({
            template_id: id,
            pergunta: p.pergunta.trim(),
            peso,
            ordem,
          })
          .select("id")
          .single()

        if (errP || !pergunta) continue

        const respostas: Array<{ pergunta_id: string; resposta_texto: string; tipo: "fria" | "morna" | "quente"; pontuacao: number }> = []
        if (p.resposta_fria?.trim()) respostas.push({ pergunta_id: pergunta.id, resposta_texto: p.resposta_fria.trim(), tipo: "fria", pontuacao: peso * PONTOS_TIPO.fria })
        if (p.resposta_morna?.trim()) respostas.push({ pergunta_id: pergunta.id, resposta_texto: p.resposta_morna.trim(), tipo: "morna", pontuacao: peso * PONTOS_TIPO.morna })
        if (p.resposta_quente?.trim()) respostas.push({ pergunta_id: pergunta.id, resposta_texto: p.resposta_quente.trim(), tipo: "quente", pontuacao: peso * PONTOS_TIPO.quente })

        if (respostas.length > 0) {
          await supabase.from("qualificacao_template_respostas").insert(respostas)
        }
      }
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

    const { error } = await supabase.from("qualificacao_templates").delete().eq("id", id)
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
    JSON.stringify({ error: "action inválida. Use list, create, update ou delete." }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
