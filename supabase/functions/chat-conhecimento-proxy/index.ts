/**
 * Edge Function: chat-conhecimento-proxy
 *
 * Recebe mensagem do Chat de Conhecimento, monta payload no formato Evolution API
 * e encaminha ao webhook N8N global. Todas as empresas usam a mesma URL.
 *
 * Payload enviado ao N8N:
 *   body.instance = evolution_instance_name (nome da instância na licença)
 *   body.data.key.remoteJidAlt = celular_atendimento (telefone da empresa)
 *   body.data.message.conversation = mensagem do usuário
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { message: string, company_id: string, qualificador_id?: string, qualificador_nome?: string }
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
  message: string
  company_id: string
  qualificador_id?: string
  qualificador_nome?: string
}

interface CompanyRow {
  evolution_instance_name: string | null
  celular_atendimento: string | null
  evolution_api_url: string | null
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

  // Verificar se o usuário pertence à empresa
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", sub)
    .maybeSingle()

  const userCompanyId = (profile as { company_id: string | null } | null)?.company_id
  if (userCompanyId !== companyId) {
    return jsonResponse({ error: "Empresa não autorizada." }, 403)
  }

  // Buscar dados da empresa
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("evolution_instance_name, celular_atendimento, evolution_api_url")
    .eq("id", companyId)
    .maybeSingle()

  if (companyError || !company) {
    return jsonResponse({ error: "Empresa não encontrada." }, 404)
  }

  const row = company as CompanyRow
  const instance = row.evolution_instance_name?.trim() || ""
  const remoteJidAlt = row.celular_atendimento?.trim() || ""
  const serverUrl = row.evolution_api_url?.trim() || ""

  // Buscar webhook do Chat. Primeiro tenta config_type=chat e, se não existir,
  // usa qualquer webhook_testar_atendente preenchido (fallback compatível com schema atual).
  const { data: chatConfig, error: chatConfigError } = await supabase
    .from("admin_webhook_config")
    .select("webhook_testar_atendente")
    .eq("config_type", "chat")
    .maybeSingle()

  let webhookUrl =
    (chatConfig as { webhook_testar_atendente: string | null } | null)?.webhook_testar_atendente?.trim() || ""

  if (!webhookUrl) {
    const { data: fallbackConfig, error: fallbackError } = await supabase
      .from("admin_webhook_config")
      .select("webhook_testar_atendente")
      .not("webhook_testar_atendente", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    webhookUrl =
      (fallbackConfig as { webhook_testar_atendente: string | null } | null)?.webhook_testar_atendente?.trim() || ""
  }

  if (!webhookUrl) {
    return jsonResponse(
      { error: "Webhook do Chat de Conhecimento não configurado. Configure no Admin." },
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
      },
    },
    destination: webhookUrl,
    date_time: now.toISOString(),
    sender,
    server_url: serverUrl,
    // Segurança: manter o campo para compatibilidade estrutural sem vazar segredo.
    apikey: "",
    webhookUrl,
    executionMode: "production",
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
