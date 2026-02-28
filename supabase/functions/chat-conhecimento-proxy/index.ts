/**
 * Edge Function: chat-conhecimento-proxy
 *
 * Recebe mensagem do Chat de Conhecimento, monta payload no formato Evolution API
 * e encaminha ao webhook N8N do segmento da empresa (Consórcio ou Produtos).
 *
 * Webhook escolhido: admin_webhook_config[segment_type].webhook_producao ou webhook_teste
 * conforme webhook_mode (produção|teste).
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { message, company_id, qualificador_id?, qualificador_nome?, prompt_atendimento_id?, webhook_mode?: "produção"|"teste" }
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
  message: string
  company_id: string
  qualificador_id?: string
  qualificador_nome?: string
  prompt_atendimento_id?: string
  webhook_mode?: "produção" | "teste"
}

interface CompanyRow {
  evolution_instance_name: string | null
  celular_atendimento: string | null
  evolution_api_url: string | null
  support_access_enabled?: boolean | null
  segment_type: string | null
}

interface ProfileRow {
  company_id: string | null
  saas_admin?: boolean | null
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405)
  }

  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")

  if (!token) {
    return jsonResponse({ error: "Token ausente. Faça login novamente." }, 401)
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret || !clerkSecret.startsWith("sk_")) {
    return jsonResponse({ error: "Configuração do servidor inválida." }, 500)
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch {
    return jsonResponse({ error: "Token inválido ou expirado." }, 401)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: "Body JSON inválido." }, 400)
  }

  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const companyId = typeof body?.company_id === "string" ? body.company_id.trim() : ""

  if (!message || !companyId) {
    return jsonResponse({ error: "message e company_id são obrigatórios." }, 400)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Configuração do servidor inválida." }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Buscar perfil (company_id, saas_admin) e empresa em paralelo
  const [{ data: profile }, { data: company, error: companyError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("company_id, saas_admin")
      .eq("id", sub)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("evolution_instance_name, celular_atendimento, evolution_api_url, support_access_enabled, segment_type")
      .eq("id", companyId)
      .maybeSingle(),
  ])

  const profileRow = profile as ProfileRow | null
  const userCompanyId = profileRow?.company_id ?? null
  let isSaasAdmin = Boolean(profileRow?.saas_admin)

  const belongsToCompany = userCompanyId === companyId
  const companyRow = company as CompanyRow | null
  const supportAccessEnabled = Boolean(companyRow?.support_access_enabled)

  if (companyError || !company) {
    return jsonResponse({ error: "Empresa não encontrada." }, 404)
  }

  if (!isSaasAdmin && !belongsToCompany && supportAccessEnabled) {
    try {
      const clerkClient = createClerkClient({ secretKey: clerkSecret })
      const clerkUser = await clerkClient.users.getUser(sub)
      const role = clerkUser.publicMetadata?.role as string | undefined
      if (role === "admin") {
        isSaasAdmin = true
      }
    } catch {
      // Fallback falhou; mantém isSaasAdmin false
    }
  }

  const adminPreviewAllowed = isSaasAdmin && supportAccessEnabled

  if (!belongsToCompany && !adminPreviewAllowed) {
    return jsonResponse({ error: "Empresa não autorizada." }, 403)
  }

  const row = company as CompanyRow
  const instance = row.evolution_instance_name?.trim() || ""
  const remoteJidAlt = row.celular_atendimento?.trim() || ""
  const serverUrl = row.evolution_api_url?.trim() || ""

  // Segmento da empresa: consorcio ou produtos (fallback produtos)
  const segmentType =
    (row.segment_type?.trim()?.toLowerCase() === "consorcio" ? "consorcio" : "produtos") as "consorcio" | "produtos"

  const webhookMode = body.webhook_mode === "teste" ? "teste" : "produção"

  const { data: webhookConfig } = await supabase
    .from("admin_webhook_config")
    .select("webhook_producao, webhook_teste")
    .eq("config_type", segmentType)
    .maybeSingle()

  const cfg = webhookConfig as { webhook_producao?: string | null; webhook_teste?: string | null } | null
  let webhookUrl =
    (webhookMode === "teste" ? cfg?.webhook_teste : cfg?.webhook_producao)?.trim() || ""

  if (!webhookUrl && webhookMode === "produção") {
    webhookUrl = Deno.env.get("N8N_CHAT_WEBHOOK_URL")?.trim() || ""
  }

  if (!webhookUrl) {
    return jsonResponse(
      {
        error: `Webhook do Chat (${webhookMode}) não configurado para o segmento ${segmentType}. Configure em Admin > Configurações.`,
      },
      503
    )
  }

  const sender = remoteJidAlt ? `${remoteJidAlt}@s.whatsapp.net` : ""
  const now = new Date()
  const messageTimestamp = Math.floor(now.getTime() / 1000)
  const messageId = crypto.randomUUID()

  const payload = {
    event: "MESSAGES_UPSERT",
    instance,
    data: {
      key: {
        remoteJid: sender || undefined,
        remoteJidAlt,
        fromMe: true,
        id: messageId,
      },
      message: {
        conversation: message,
      },
      messageType: "conversation",
      messageTimestamp,
      instanceId: instance,
      source: "chat-desenvolvimento",
      context: {
        company_id: companyId,
        qualificador_id: body.qualificador_id ?? null,
        qualificador_nome: body.qualificador_nome ?? null,
        prompt_atendimento_id: body.prompt_atendimento_id ?? null,
        webhook_mode: webhookMode,
      },
    },
    destination: webhookUrl,
    date_time: now.toISOString(),
    sender,
    server_url: serverUrl,
    // Segurança: manter o campo para compatibilidade estrutural sem vazar segredo.
    apikey: "",
    webhookUrl,
    executionMode: webhookMode === "teste" ? "test" : "production",
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return jsonResponse(data, res.status)
    }
    return jsonResponse(data)
  } catch (err) {
    console.error("[chat-conhecimento-proxy] Erro ao chamar N8N:", err)
    return jsonResponse(
      { error: "Falha ao comunicar com o assistente." },
      502
    )
  }
})
