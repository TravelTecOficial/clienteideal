/**
 * Edge Function: evolution-proxy
 *
 * Proxy para a Evolution API. Permite que o frontend chame a Evolution API
 * sem expor a API Key no cliente. A Edge Function lê as credenciais do banco
 * (companies) e faz as requisições server-side.
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { action: "create" | "connect" | "connectionState" | "fetchInstances", instanceName?: string }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface EvolutionConfig {
  evolution_api_url: string | null
  evolution_api_key: string | null
  evolution_instance_name: string | null
}

interface RequestBody {
  action: "create" | "connect" | "connectionState" | "fetchInstances" | "logout"
  instanceName?: string
  /** Token JWT do Clerk - enviado no body para evitar validação do gateway Supabase */
  token?: string
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
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

  const { data: company } = await supabase
    .from("companies")
    .select("evolution_api_url, evolution_api_key, evolution_instance_name")
    .eq("id", companyId)
    .maybeSingle()

  const config = company as EvolutionConfig | null
  const baseUrl = config?.evolution_api_url?.trim()
  const apiKey = config?.evolution_api_key?.trim()
  const storedInstanceName = config?.evolution_instance_name?.trim()

  if (!baseUrl || !apiKey) {
    return errorResponse(
      "Configure a URL e a API Key da Evolution API nas configurações.",
      400
    )
  }

  const action = body?.action
  const instanceName = body?.instanceName?.trim() || storedInstanceName

  if (!action) {
    return errorResponse("Ação obrigatória (create, connect, connectionState, fetchInstances, logout).", 400)
  }

  const url = normalizeEvolutionBaseUrl(baseUrl)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: apiKey,
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
      return jsonResponse(data)
    }

    if (action === "connect") {
      if (!instanceName) {
        return errorResponse("Nome da instância obrigatório para conectar.", 400)
      }
      const res = await fetch(`${url}/instance/connect/${encodeURIComponent(instanceName)}`, {
        method: "GET",
        headers,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return jsonResponse(data, res.status)
      }
      return jsonResponse(data)
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
