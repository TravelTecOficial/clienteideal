/**
 * Edge Function: upload-kb-to-webhook
 *
 * Recebe upload de arquivo da base de conhecimento, envia ao webhook cadastrado no admin
 * e insere em kb_files_control.
 *
 * POST JSON: { file_base64: string, file_name: string, training_type: string, description?: string }
 * Requer: Authorization: Bearer <clerk_jwt>
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")
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
      JSON.stringify({ error: "Token inválido ou expirado." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  let body: { file_base64?: string; file_name?: string; training_type?: string; description?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response(
      JSON.stringify({ error: "Body JSON inválido." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const { file_base64, file_name, training_type, description } = body
  if (!file_base64 || !file_name || !training_type?.trim()) {
    return new Response(
      JSON.stringify({ error: "file_base64, file_name e training_type são obrigatórios." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const trainingType = training_type.trim()
  const desc = description?.trim() || null

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", sub)
    .maybeSingle()

  const companyId = (profile as { company_id: string | null } | null)?.company_id
  if (!companyId) {
    return new Response(
      JSON.stringify({ error: "Empresa não identificada." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const { data: company } = await supabase
    .from("companies")
    .select("segment_type")
    .eq("id", companyId)
    .maybeSingle()

  const segmentType = ((company as { segment_type: string | null } | null)?.segment_type === "consorcio")
    ? "consorcio"
    : "produtos"

  const { data: webhookConfig } = await supabase
    .from("admin_webhook_config")
    .select("webhook_enviar_arquivos")
    .eq("config_type", segmentType)
    .maybeSingle()

  const webhookUrl = (webhookConfig as { webhook_enviar_arquivos: string | null } | null)?.webhook_enviar_arquivos?.trim()

  if (webhookUrl) {
    try {
      const binary = Uint8Array.from(atob(file_base64.replace(/^data:[^;]+;base64,/, "")), (c) => c.charCodeAt(0))
      const blob = new Blob([binary])
      const formToSend = new FormData()
      formToSend.append("file", blob, file_name)
      formToSend.append("training_type", trainingType)
      if (desc) formToSend.append("description", desc)
      formToSend.append("company_id", companyId)

      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        body: formToSend,
      })

      if (!webhookRes.ok) {
        console.error("[upload-kb-to-webhook] Webhook retornou", webhookRes.status, await webhookRes.text())
      }
    } catch (err) {
      console.error("[upload-kb-to-webhook] Erro ao enviar ao webhook:", err)
    }
  }

  const drive_file_id = `drive_${crypto.randomUUID()}`
  const { data: inserted, error } = await supabase
    .from("kb_files_control")
    .insert({
      company_id: companyId,
      user_id: sub,
      file_name,
      training_type: trainingType,
      description: desc,
      drive_file_id,
    })
    .select("id")
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  return new Response(
    JSON.stringify({ success: true, id: inserted?.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
