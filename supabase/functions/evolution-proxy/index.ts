/**
 * Edge Function: evolution-proxy
 *
 * Proxy para a Evolution API. Lê URL/API Key da config global (admin_evolution_config).
 * O usuário não vê URL nem API Key — apenas conecta a instância no Dashboard.
 *
 * Ao criar/conectar: configura webhook na Evolution para enviar a evolution-webhook
 * (todas as empresas usam a mesma URL). MESSAGES_UPSERT e webhook_base64 habilitados.
 *
 * Requer: body.token = Clerk JWT (ou Authorization header)
 * Body: { action, instanceName?, token? }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface EvolutionGlobalConfig {
  evolution_api_url: string | null
  evolution_api_key: string | null
}

interface CompanyRow {
  evolution_instance_name: string | null
  segment_type: string | null
}

interface RequestBody {
  action: "create" | "connect" | "connectionState" | "fetchInstances" | "logout"
  instanceName?: string
  /** Token JWT do Clerk - enviado no body para evitar validação do gateway Supabase */
  token?: string
}

interface WebhookAttempt {
  endpoint: string
  status: number
  ok: boolean
  responsePreview: string
}

interface WebhookDebugResult {
  configured: boolean
  attempts: WebhookAttempt[]
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

function normalizeEvolutionBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/$/, "")
  try {
    const parsed = new URL(trimmed)
    // Alguns usuários colam URL do painel (/manager). A API fica na raiz.
    parsed.pathname = parsed.pathname.replace(/\/manager\/?$/i, "").replace(/\/$/, "")
    return parsed.toString().replace(/\/$/, "")
  } catch {
    return trimmed.replace(/\/manager\/?$/i, "")
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  let body: RequestBody
  try {
    body = (await req.json().catch(() => ({}))) as RequestBody
  } catch {
    return errorResponse("Body inválido.", 400)
  }
  const token = body?.token?.trim() || req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")

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
  } catch {
    return errorResponse("Token inválido ou expirado. Faça login novamente.", 401)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) {
    return errorResponse("Configuração do servidor inválida.", 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", sub)
    .maybeSingle()

  const companyId = (profile as { company_id: string | null } | null)?.company_id
  if (!companyId) {
    return errorResponse("Empresa não encontrada.", 404)
  }

  const [{ data: globalConfig }, { data: company }] = await Promise.all([
    supabase
      .from("admin_evolution_config")
      .select("evolution_api_url, evolution_api_key")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("evolution_instance_name, segment_type")
      .eq("id", companyId)
      .maybeSingle(),
  ])

  const config = globalConfig as EvolutionGlobalConfig | null
  const baseUrl = config?.evolution_api_url?.trim()
  const apiKey = config?.evolution_api_key?.trim()

  const companyRow = company as CompanyRow | null
  const storedInstanceName = companyRow?.evolution_instance_name?.trim()

  if (!baseUrl || !apiKey) {
    return errorResponse(
      "Configure a URL e a API Key da Evolution API nas configurações do Admin.",
      400
    )
  }

  const action = body?.action
  const instanceName = body?.instanceName?.trim() || storedInstanceName

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'run3',hypothesisId:'HQR4',location:'evolution-proxy/index.ts:action-received',message:'Evolution proxy action received',data:{action,instanceName:instanceName??null,hasStoredInstance:Boolean(storedInstanceName)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!action) {
    return errorResponse("Ação obrigatória (create, connect, connectionState, fetchInstances, logout).", 400)
  }

  const url = normalizeEvolutionBaseUrl(baseUrl)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: apiKey,
  }

  const evolutionWebhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`

  async function setWebhookForInstance(instance: string): Promise<WebhookDebugResult> {
    const payloadBase = {
      enabled: true,
      url: evolutionWebhookUrl,
      webhook_by_events: false,
      webhook_base64: true,
      events: ["MESSAGES_UPSERT"],
    }
    const attempts: WebhookAttempt[] = []
    const targets: Array<{ endpoint: string; body: Record<string, unknown> }> = [
      { endpoint: `${url}/webhook/set/${encodeURIComponent(instance)}`, body: payloadBase },
      { endpoint: `${url}/webhook/set`, body: { ...payloadBase, instanceName: instance } },
      { endpoint: `${url}/webhook/instance/${encodeURIComponent(instance)}`, body: payloadBase },
      { endpoint: `${url}/webhook/instance`, body: { ...payloadBase, instanceName: instance } },
    ]

    for (const target of targets) {
      try {
        const webhookRes = await fetch(target.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(target.body),
        })
        const responseText = await webhookRes.text().catch(() => "")
        attempts.push({
          endpoint: target.endpoint,
          status: webhookRes.status,
          ok: webhookRes.ok,
          responsePreview: responseText.slice(0, 300),
        })

        if (webhookRes.ok) {
          return { configured: true, attempts }
        }
      } catch (err) {
        attempts.push({
          endpoint: target.endpoint,
          status: 0,
          ok: false,
          responsePreview: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
        })
      }
    }

    console.error(`[evolution-proxy] Falha ao configurar webhook para ${instance}:`, attempts)
    return { configured: false, attempts }
  }

  try {
    if (action === "create") {
      const instance = instanceName || `instance-${companyId}`
      const res = await fetch(`${url}/instance/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          instanceName: instance,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return jsonResponse(data, res.status)
      }
      const webhookDebug = await setWebhookForInstance(instance)
      return jsonResponse({ ...data, _webhook: webhookDebug })
    }

    if (action === "connect") {
      if (!instanceName) {
        return errorResponse("Nome da instância obrigatório para conectar.", 400)
      }
      const stateRes = await fetch(
        `${url}/instance/connectionState/${encodeURIComponent(instanceName)}`,
        { method: "GET", headers }
      )
      const stateData = await stateRes.json().catch(() => ({}))
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'run3',hypothesisId:'HQR4',location:'evolution-proxy/index.ts:connect-pre-state',message:'State before connect',data:{instanceName,status:stateRes.status,state:(stateData as { instance?: { state?: string }; state?: string })?.instance?.state ?? (stateData as { state?: string })?.state ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const res = await fetch(`${url}/instance/connect/${encodeURIComponent(instanceName)}`, {
        method: "GET",
        headers,
      })
      const data = await res.json().catch(() => ({}))
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'run3',hypothesisId:'HQR5',location:'evolution-proxy/index.ts:connect-response',message:'Connect response from Evolution',data:{instanceName,status:res.status,hasBase64:Boolean((data as { base64?: string }).base64),hasCode:Boolean((data as { code?: string }).code),hasPairingCode:Boolean((data as { pairingCode?: string }).pairingCode),count:(data as { count?: number }).count ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!res.ok) {
        return jsonResponse(data, res.status)
      }
      const webhookDebug = await setWebhookForInstance(instanceName)
      return jsonResponse({ ...data, _webhook: webhookDebug })
    }

    if (action === "connectionState") {
      if (!instanceName) {
        return errorResponse("Nome da instância obrigatório.", 400)
      }
      const res = await fetch(
        `${url}/instance/connectionState/${encodeURIComponent(instanceName)}`,
        { method: "GET", headers }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return jsonResponse(data, res.status)
      }
      return jsonResponse(data)
    }

    if (action === "fetchInstances") {
      const res = await fetch(`${url}/instance/fetchInstances`, {
        method: "GET",
        headers,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return jsonResponse(data, res.status)
      }
      return jsonResponse(data)
    }

    if (action === "logout") {
      if (!instanceName) {
        return errorResponse("Nome da instância obrigatório para desconectar.", 400)
      }
      const res = await fetch(
        `${url}/instance/logout/${encodeURIComponent(instanceName)}`,
        { method: "DELETE", headers }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return jsonResponse(data, res.status)
      }
      return jsonResponse(data)
    }

    return errorResponse("Ação inválida.", 400)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[evolution-proxy] Erro:", msg)
    return errorResponse(`Erro ao comunicar com Evolution API: ${msg}`, 500)
  }
})
