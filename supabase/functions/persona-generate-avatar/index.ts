/**
 * Edge Function: persona-generate-avatar
 *
 * Gera o rosto do persona (Cliente Ideal) usando Stability AI.
 * Monta o prompt concatenando os campos do persona e envia para a API.
 * Salva a imagem no Storage e atualiza avatar_url em ideal_customers.
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { persona_id: string }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface RequestBody {
  persona_id: string
  /** Token JWT do Clerk - enviado no body para o gateway aceitar anon key */
  token?: string
}

interface IdealCustomerRow {
  id: string
  company_id: string
  profile_name: string | null
  age_range: string | null
  gender: string | null
  location: string | null
  job_title: string | null
  income_level: string | null
  hobbies_interests: string | null
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

function buildPrompt(persona: IdealCustomerRow): string {
  const parts = [
    "Professional portrait photograph",
    "close-up face portrait",
    "head and shoulders",
    "neutral background",
    "realistic",
  ]

  if (persona.age_range?.trim()) {
    parts.push(`age ${persona.age_range.trim()}`)
  }
  if (persona.gender?.trim()) {
    parts.push(persona.gender.trim().toLowerCase())
  }
  if (persona.job_title?.trim()) {
    parts.push(`professional ${persona.job_title.trim()}`)
  }
  if (persona.location?.trim()) {
    parts.push(`from ${persona.location.trim()}`)
  }
  if (persona.profile_name?.trim()) {
    parts.push(`named ${persona.profile_name.trim()}`)
  }

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

  const authHeader = req.headers.get("Authorization")
  const tokenFromBody = body?.token?.trim() || ""
  const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, "")?.trim() || ""
  const tokenSource = tokenFromBody ? "body" : tokenFromHeader ? "header" : "none"
  const token = tokenFromBody || tokenFromHeader

  if (!token) {
    return errorResponse("Token ausente. Faça login novamente.", 401)
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret || !clerkSecret.startsWith("sk_")) {
    return errorResponse("Configuração do servidor inválida.", 500)
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const looksJwt = token.startsWith("eyJ")
    console.error("[persona-generate-avatar] verifyToken failed:", {
      msg,
      tokenSource,
      looksJwt,
      tokenLength: token.length,
    })
    return errorResponse(
      `Token inválido ou expirado (source=${tokenSource}, looksJwt=${looksJwt}, len=${token.length}). Verifique se CLERK_SECRET_KEY no Supabase (Edge Functions > Secrets) é a Secret Key correta do Clerk (sk_test_ ou sk_live_).`,
      401
    )
  }

  const personaId = typeof body.persona_id === "string" ? body.persona_id.trim() : ""
  if (!personaId) {
    return errorResponse("persona_id é obrigatório.", 400)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const stabilityApiKey = Deno.env.get("STABILITY_API_KEY")?.trim()

  if (!supabaseUrl || !supabaseServiceKey) {
    return errorResponse("Configuração do servidor inválida.", 500)
  }

  if (!stabilityApiKey) {
    return errorResponse(
      "STABILITY_API_KEY não configurada. Configure nas Secrets do Supabase.",
      503
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Verificar se o usuário pertence à empresa
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", sub)
    .maybeSingle()

  const userCompanyId = (profile as { company_id: string | null } | null)?.company_id
  if (!userCompanyId) {
    return errorResponse("Empresa não encontrada.", 404)
  }

  // Buscar persona e verificar company_id
  const { data: persona, error: personaError } = await supabase
    .from("ideal_customers")
    .select("id, company_id, profile_name, age_range, gender, location, job_title, income_level, hobbies_interests")
    .eq("id", personaId)
    .eq("company_id", userCompanyId)
    .maybeSingle()

  if (personaError || !persona) {
    return errorResponse("Persona não encontrado ou sem permissão.", 404)
  }

  const personaRow = persona as IdealCustomerRow
  const prompt = buildPrompt(personaRow)

  // Chamar Stability AI (engine confirmado disponível no projeto).
  const stabilityUrl = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image"

  const stabilityBody = {
    text_prompts: [{ text: prompt, weight: 1 }],
    cfg_scale: 7,
    // SDXL exige dimensões específicas; 1024x1024 é suportado.
    height: 1024,
    width: 1024,
    samples: 1,
    steps: 20,
    style_preset: "photographic",
  }

  let imageBytes: ArrayBuffer
  try {
    const stabilityRes = await fetch(stabilityUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stabilityApiKey}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify(stabilityBody),
    })

    if (!stabilityRes.ok) {
      const errText = await stabilityRes.text()
      console.error("[persona-generate-avatar] Stability API error:", stabilityRes.status, errText)
      if (stabilityRes.status === 401) {
        return errorResponse("Chave da Stability AI inválida.", 503)
      }
      if (stabilityRes.status === 429) {
        return errorResponse("Limite de requisições atingido. Tente novamente mais tarde.", 429)
      }
      return errorResponse(
        `Falha ao gerar imagem. stability_status=${stabilityRes.status} stability_error=${errText.slice(0, 300)}`,
        502
      )
    }

    imageBytes = await stabilityRes.arrayBuffer()
  } catch (err) {
    console.error("[persona-generate-avatar] Erro ao chamar Stability:", err)
    return errorResponse("Falha ao comunicar com o serviço de geração de imagens.", 502)
  }

  // Upload para Storage
  const storagePath = `${userCompanyId}/personas/${personaId}.png`

  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(storagePath, imageBytes, {
      contentType: "image/png",
      upsert: true,
    })

  if (uploadError) {
    console.error("[persona-generate-avatar] Erro ao fazer upload:", uploadError)
    return errorResponse(
      `Falha ao salvar imagem. storage_error=${uploadError.message ?? "unknown"} path=${storagePath}`,
      500
    )
  }

  const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(storagePath)
  const avatarUrl = urlData.publicUrl

  // Atualizar ideal_customers.avatar_url
  const { error: updateError } = await supabase
    .from("ideal_customers")
    .update({ avatar_url: avatarUrl })
    .eq("id", personaId)
    .eq("company_id", userCompanyId)

  if (updateError) {
    console.error("[persona-generate-avatar] Erro ao atualizar avatar_url:", updateError)
    return errorResponse("Imagem gerada mas falha ao atualizar registro.", 500)
  }

  return jsonResponse({ avatar_url: avatarUrl })
})
