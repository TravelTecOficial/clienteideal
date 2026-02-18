/**
 * Edge Function: evolution-webhook
 *
 * Recebe webhooks da Evolution API (evento MESSAGES_UPSERT) e encaminha ao N8N
 * no formato esperado pelo N8N:
 *   body.instance = nome da instância cadastrada na licença
 *   body.data.key.remoteJidAlt = telefone
 *   body.data.message.conversation = mensagem do chat de conhecimento
 *
 * Todas as empresas usam a mesma URL de webhook (webhook_chat em admin_webhook_config).
 * A Evolution API deve ser configurada para enviar webhooks para esta URL.
 * verify_jwt: false — a Evolution envia sem JWT.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

/** Payload que a Evolution API envia (MESSAGES_UPSERT) */
interface EvolutionWebhookPayload {
  instance?: string
  numberId?: string
  data?: {
    key?: {
      remoteJid?: string
      remoteJidAlt?: string
      fromMe?: boolean
      id?: string
    }
    message?: {
      conversation?: string
      extendedTextMessage?: { text?: string }
    }
  }
  key?: { remoteJid?: string; remoteJidAlt?: string }
  message?: { conversation?: string; extendedTextMessage?: { text?: string } }
}

/** Formato enviado ao N8N: {{ $json.body.instance }}, {{ $json.body.data.key.remoteJidAlt }}, {{ $json.body.data.message.conversation }} */
interface N8NWebhookBody {
  body: {
    instance: string
    data: {
      key: {
        remoteJid?: string
        remoteJidAlt: string
      }
      message: {
        conversation: string
      }
    }
  }
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

  let payload: EvolutionWebhookPayload
  try {
    payload = (await req.json()) as EvolutionWebhookPayload
  } catch {
    return jsonResponse({ error: "Body JSON inválido." }, 400)
  }

  const instance =
    payload.instance ??
    payload.numberId ??
    (payload as Record<string, unknown>).instanceName
  if (!instance || typeof instance !== "string") {
    return jsonResponse(
      { error: "Payload sem instance/numberId." },
      400
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[evolution-webhook] SUPABASE_URL ou SERVICE_ROLE_KEY ausentes")
    return jsonResponse({ error: "Configuração do servidor inválida." }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Todas as empresas usam a mesma URL de webhook (webhook_chat global)
  const { data: webhookConfig } = await supabase
    .from("admin_webhook_config")
    .select("webhook_chat")
    .eq("config_type", "chat")
    .maybeSingle()

  const webhookUrl = (webhookConfig as { webhook_chat: string | null } | null)
    ?.webhook_chat?.trim()

  if (!webhookUrl) {
    console.warn(
      "[evolution-webhook] Webhook do Chat não configurado. Configure em Admin > Configurações (webhook_chat)."
    )
    return jsonResponse({ received: true, forwarded: false }, 200)
  }

  const key = payload.data?.key ?? payload.key
  const message = payload.data?.message ?? payload.message
  const remoteJid = key?.remoteJid ?? ""
  const remoteJidAlt = key?.remoteJidAlt ?? remoteJid
  const conversation =
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    ""

  const n8nBody: N8NWebhookBody = {
    body: {
      instance: String(instance),
      data: {
        key: {
          remoteJid: remoteJid || undefined,
          remoteJidAlt,
        },
        message: {
          conversation,
        },
      },
    },
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nBody),
    })

    if (!res.ok) {
      console.error(
        `[evolution-webhook] N8N retornou ${res.status}:`,
        await res.text()
      )
    }
  } catch (err) {
    console.error("[evolution-webhook] Erro ao encaminhar para N8N:", err)
    return jsonResponse(
      { error: "Falha ao encaminhar webhook." },
      502
    )
  }

  return jsonResponse({ received: true, forwarded: true }, 200)
})
