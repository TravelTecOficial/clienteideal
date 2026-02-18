/**
 * Edge Function: persona-template-generate-avatar
 *
 * Gera avatar para modelo de persona (persona_templates) usando Stability AI.
 * Apenas admin do SaaS pode executar.
 *
 * Body: { template_id: string, token?: string }
 * Auth header: Bearer <anon key> (gateway) com token Clerk no body.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createClerkClient, verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface RequestBody {
  template_id: string
  token?: string
}

interface PersonaTemplateRow {
  id: string
  profile_name: string | null
  age_range: string | null
  gender: string | null
  location: string | null
  job_title: string | null
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status)
}

function buildPrompt(template: PersonaTemplateRow): string {
  const parts = [
    "Professional portrait photograph",
    "close-up face portrait",
    "head and shoulders",
    "neutral background",
    "realistic",
  ]

  if (template.age_range?.trim()) parts.push(`age ${template.age_range.trim()}`)
  if (template.gender?.trim()) parts.push(template.gender.trim().toLowerCase())
  if (template.job_title?.trim()) parts.push(`professional ${template.job_title.trim()}`)
  if (template.location?.trim()) parts.push(`from ${template.location.trim()}`)
  if (template.profile_name?.trim()) parts.push(`named ${template.profile_name.trim()}`)

  return parts.join(", ")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return errorResponse("Método não permitido.", 405)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return errorResponse("Body JSON inválido.", 400)
  }

  const tokenFromBody = body?.token?.trim() || ""
  const tokenFromHeader =
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")?.trim() || ""
  const token = tokenFromBody || tokenFromHeader

  if (!token) return errorResponse("Token ausente. Faça login novamente.", 401)

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret || !clerkSecret.startsWith("sk_")) {
    return errorResponse("Configuração do servidor inválida.", 500)
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch {
    return errorResponse("Token inválido ou expirado. Faça login novamente.", 401)
  }

  const clerkClient = createClerkClient({ secretKey: clerkSecret })
  try {
    const user = await clerkClient.users.getUser(sub)
    const saasRole = user.publicMetadata?.role as string | undefined
    if (saasRole !== "admin") {
      return errorResponse("Acesso negado. Apenas administradores do sistema.", 403)
    }
  } catch {
    return errorResponse("Erro ao verificar permissões.", 403)
  }

  const templateId = typeof body.template_id === "string" ? body.template_id.trim() : ""
  if (!templateId) return errorResponse("template_id é obrigatório.", 400)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const stabilityApiKey = Deno.env.get("STABILITY_API_KEY")?.trim()
  if (!supabaseUrl || !supabaseServiceKey) {
    return errorResponse("Configuração do servidor inválida.", 500)
  }
  if (!stabilityApiKey) {
    return errorResponse("STABILITY_API_KEY não configurada no servidor.", 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: template, error: templateError } = await supabase
    .from("persona_templates")
    .select("id, profile_name, age_range, gender, location, job_title")
    .eq("id", templateId)
    .maybeSingle()

  if (templateError) return errorResponse("Erro ao carregar modelo de persona.", 500)
  if (!template) return errorResponse("Modelo de persona não encontrado.", 404)

  const prompt = buildPrompt(template as PersonaTemplateRow)
  const stabilityBody = {
    prompt,
    output_format: "png",
  }

  let imageBytes: ArrayBuffer
  try {
    const stabilityRes = await fetch(
      "https://api.stability.ai/v2beta/stable-image/generate/core",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stabilityApiKey}`,
          Accept: "image/*",
        },
        body: new Blob([new URLSearchParams(stabilityBody)]),
      }
    )

    if (!stabilityRes.ok) {
      const errText = await stabilityRes.text()
      if (stabilityRes.status === 401) return errorResponse("Chave da Stability AI inválida.", 503)
      if (stabilityRes.status === 429) {
        return errorResponse("Limite de requisições atingido. Tente novamente mais tarde.", 429)
      }
      return errorResponse(
        `Falha ao gerar imagem. stability_status=${stabilityRes.status} stability_error=${errText.slice(0, 300)}`,
        502
      )
    }

    imageBytes = await stabilityRes.arrayBuffer()
  } catch {
    return errorResponse("Falha ao comunicar com o serviço de geração de imagens.", 502)
  }

  const storagePath = `global/persona-templates/${templateId}.png`
  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(storagePath, imageBytes, {
      contentType: "image/png",
      upsert: true,
    })

  if (uploadError) {
    return errorResponse(
      `Falha ao salvar imagem. storage_error=${uploadError.message ?? "unknown"}`,
      500
    )
  }

  const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(storagePath)
  const avatarUrl = urlData.publicUrl

  const { error: updateError } = await supabase
    .from("persona_templates")
    .update({ avatar_url: avatarUrl })
    .eq("id", templateId)

  if (updateError) return errorResponse("Imagem gerada, mas falha ao atualizar modelo.", 500)

  return jsonResponse({ avatar_url: avatarUrl })
})
