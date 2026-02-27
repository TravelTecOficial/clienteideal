/**
 * Edge Function: crm-webhook-stage-change
 *
 * Recebe POST com { id_lead, external_id, stage } e encaminha ao webhook CRM.
 * Usado quando o estágio de uma oportunidade é alterado (Kanban ou formulário).
 * Requer JWT do Clerk (usuário autenticado).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { verifyToken } from "npm:@clerk/backend@2"

const CRM_WEBHOOK_URL = "https://jobs.traveltec.com.br/webhook/crm"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
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

  try {
    await verifyToken(token, { secretKey: clerkSecret })
  } catch {
    return jsonResponse({ error: "Token inválido ou expirado." }, 401)
  }

  let body: { id_lead?: string | null; external_id?: string | null; stage?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return jsonResponse({ error: "Body JSON inválido." }, 400)
  }

  const payload = {
    id_lead: body.id_lead ?? null,
    external_id: body.external_id ?? null,
    stage: body.stage ?? "",
  }

  try {
    const res = await fetch(CRM_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[crm-webhook-stage-change] Webhook retornou", res.status, text)
      return jsonResponse(
        { error: `Webhook retornou ${res.status}` },
        502
      )
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error("[crm-webhook-stage-change] Erro ao enviar webhook:", err)
    return jsonResponse(
      { error: "Falha ao enviar webhook." },
      502
    )
  }
})
