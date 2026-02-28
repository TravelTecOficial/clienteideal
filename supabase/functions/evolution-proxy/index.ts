/**
 * Edge Function: evolution-proxy
 *
 * Proxy para a Evolution API. Lê URL/API Key da config global (admin_evolution_config).
 * Ao criar/conectar: configura webhook na Evolution para enviar diretamente ao N8N
 * usando admin_webhook_config.webhook_producao do segmento da empresa.
 * Se webhook_producao não estiver configurado, usa evolution-webhook (Supabase) como fallback.
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
  action: "create" | "connect" | "connectionState" | "fetchInstances" | "logout" | "setWebhook" | "delete"
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
  fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a5cace'},body:JSON.stringify({sessionId:'a5cace',runId:'pre-fix-1',hypothesisId:'H1',location:'evolution-proxy/index.ts:154',message:'Ação recebida no proxy',data:{action:action ?? null,hasBodyInstance:!!body?.instanceName,hasStoredInstance:!!storedInstanceName,segmentType:companyRow?.segment_type ?? null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!action) {
    return errorResponse("Ação obrigatória (create, connect, connectionState, fetchInstances, logout, setWebhook, delete).", 400)
  }

  const url = normalizeEvolutionBaseUrl(baseUrl)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: apiKey,
  }

  const segmentType =
    (companyRow?.segment_type?.trim()?.toLowerCase() === "consorcio" ? "consorcio" : "produtos") as "consorcio" | "produtos"
  const { data: webhookConfig } = await supabase
    .from("admin_webhook_config")
    .select("webhook_producao")
    .eq("config_type", segmentType)
    .maybeSingle()
  const webhookProducao = (webhookConfig as { webhook_producao?: string | null } | null)?.webhook_producao?.trim()
  const evolutionWebhookUrl =
    webhookProducao || `${supabaseUrl}/functions/v1/evolution-webhook`

  async function setWebhookForInstance(instance: string): Promise<WebhookDebugResult> {
    // Evolution API v2 exige camelCase (webhookByEvents, webhookBase64). v1 usa snake_case.
    // Enviamos ambos para compatibilidade com qualquer versão.
    const payloadFlat = {
      enabled: true,
      url: evolutionWebhookUrl,
      webhook_by_events: false,
      webhook_base64: true,
      webhookByEvents: false,
      webhookBase64: true,
      byEvents: false,
      base64: true,
      events: ["MESSAGES_UPSERT"],
    }
    const payloadWithWebhookObject = {
      webhook: payloadFlat,
    }
    const attempts: WebhookAttempt[] = []
    const hasMessagesUpsert = (events: unknown): boolean =>
      Array.isArray(events) && events.some((e) => String(e).toUpperCase() === "MESSAGES_UPSERT")
    const readBoolean = (obj: Record<string, unknown>, keys: string[]): boolean | null => {
      for (const key of keys) {
        if (typeof obj[key] === "boolean") return obj[key] as boolean
      }
      return null
    }
    const readString = (obj: Record<string, unknown>, keys: string[]): string => {
      for (const key of keys) {
        if (typeof obj[key] === "string") return String(obj[key])
      }
      return ""
    }
    async function isWebhookApplied(): Promise<{ ok: boolean; details: string }> {
      try {
        const findRes = await fetch(`${url}/webhook/find/${encodeURIComponent(instance)}`, {
          method: "GET",
          headers,
        })
        const raw = await findRes.text().catch(() => "")
        if (!findRes.ok) {
          return { ok: false, details: `find=${findRes.status}:${raw.slice(0, 120)}` }
        }
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const root = (parsed.webhook && typeof parsed.webhook === "object"
          ? parsed.webhook
          : parsed) as Record<string, unknown>
        const inner = (root.webhook && typeof root.webhook === "object"
          ? root.webhook
          : root) as Record<string, unknown>
        const configuredUrl = readString(inner, ["url"])
        const enabled = readBoolean(inner, ["enabled"]) === true
        const base64Enabled =
          readBoolean(inner, ["webhookBase64", "webhook_base64", "base64"]) === true
        const events = inner.events ?? root.events
        const hasUpsert = hasMessagesUpsert(events)
        const sameUrl = configuredUrl === evolutionWebhookUrl
        return {
          ok: enabled && base64Enabled && hasUpsert && sameUrl,
          details: `enabled=${enabled};base64=${base64Enabled};upsert=${hasUpsert};sameUrl=${sameUrl};url=${configuredUrl.slice(0, 120)}`,
        }
      } catch (err) {
        return {
          ok: false,
          details: err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120),
        }
      }
    }
    const targets: Array<{ endpoint: string; body: Record<string, unknown> }> = [
      // Algumas versões (como visto em runtime) exigem objeto "webhook" aninhado.
      { endpoint: `${url}/webhook/set/${encodeURIComponent(instance)}`, body: payloadWithWebhookObject },
      { endpoint: `${url}/webhook/set`, body: { ...payloadWithWebhookObject, instanceName: instance } },
      { endpoint: `${url}/webhook/instance/${encodeURIComponent(instance)}`, body: payloadWithWebhookObject },
      { endpoint: `${url}/webhook/instance`, body: { ...payloadWithWebhookObject, instanceName: instance } },
      // Fallback para versões que aceitam payload flat.
      { endpoint: `${url}/webhook/set/${encodeURIComponent(instance)}`, body: payloadFlat },
      { endpoint: `${url}/webhook/set`, body: { ...payloadFlat, instanceName: instance } },
      { endpoint: `${url}/webhook/instance/${encodeURIComponent(instance)}`, body: payloadFlat },
      { endpoint: `${url}/webhook/instance`, body: { ...payloadFlat, instanceName: instance } },
    ]
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a5cace'},body:JSON.stringify({sessionId:'a5cace',runId:'pre-fix-1',hypothesisId:'H3',location:'evolution-proxy/index.ts:196',message:'Início configuração webhook por instância',data:{instance,targetCount:targets.length,firstEndpoint:targets[0]?.endpoint ?? null,usesCamelCase:true,usesSnakeCase:true,event:'MESSAGES_UPSERT'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a5cace'},body:JSON.stringify({sessionId:'a5cace',runId:'pre-fix-1',hypothesisId:'H4',location:'evolution-proxy/index.ts:213',message:'Resposta tentativa webhook',data:{instance,endpoint:target.endpoint,status:webhookRes.status,ok:webhookRes.ok,responsePreview:responseText.slice(0,120)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        if (webhookRes.ok) {
          const verification = await isWebhookApplied()
          if (!verification.ok) {
            attempts.push({
              endpoint: `${target.endpoint}#verify`,
              status: 0,
              ok: false,
              responsePreview: verification.details,
            })
            continue
          }
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a5cace'},body:JSON.stringify({sessionId:'a5cace',runId:'pre-fix-1',hypothesisId:'H5',location:'evolution-proxy/index.ts:217',message:'Webhook configurado com sucesso',data:{instance,endpoint:target.endpoint,status:webhookRes.status,attemptsSoFar:attempts.length},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        // 403 é o único erro documentado para "nome já em uso" no endpoint /instance/create
        if (res.status === 403) {
          return jsonResponse({ instanceAlreadyExists: true, message: "Instância já criada" }, 200)
        }
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
      await stateRes.json().catch(() => ({}))
      const res = await fetch(`${url}/instance/connect/${encodeURIComponent(instanceName)}`, {
        method: "GET",
        headers,
      })
      const data = await res.json().catch(() => ({}))
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

    if (action === "setWebhook") {
      if (!instanceName) {
        return errorResponse("Nome da instância obrigatório para configurar webhook.", 400)
      }
      const webhookDebug = await setWebhookForInstance(instanceName)
      return jsonResponse({ success: webhookDebug.configured, _webhook: webhookDebug })
    }

    if (action === "delete") {
      if (!instanceName) {
        return errorResponse("Nome da instância obrigatório para excluir.", 400)
      }
      const res = await fetch(
        `${url}/instance/delete/${encodeURIComponent(instanceName)}`,
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
