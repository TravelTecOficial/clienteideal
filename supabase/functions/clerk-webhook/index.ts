// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Webhook } from "npm:svix@1"

// Tipos do payload Clerk (user.created)
interface ClerkUserData {
  id: string
  email_addresses?: { id: string; email_address: string }[]
  primary_email_address_id?: string | null
  first_name?: string | null
  last_name?: string | null
}

interface ClerkWebhookEvent {
  type: string
  data: ClerkUserData
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const webhookSecret = Deno.env.get("CLERK_WEBHOOK_SECRET")
  if (!webhookSecret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET não configurado")
    return new Response(
      JSON.stringify({ error: "Webhook secret não configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")

  console.log("[clerk-webhook] Requisição recebida:", {
    method: req.method,
    hasSvixId: !!svixId,
    hasSvixTimestamp: !!svixTimestamp,
    hasSvixSignature: !!svixSignature,
  })

  const rawBody = await req.text()
  if (!rawBody) {
    console.log("[clerk-webhook] Body vazio - ignorando")
    return new Response(
      JSON.stringify({ error: "Body vazio" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.log("[clerk-webhook] Headers Svix ausentes - possivelmente não é um webhook do Clerk")
    return new Response(
      JSON.stringify({ error: "Missing svix headers (svix-id, svix-timestamp, svix-signature)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  let evt: ClerkWebhookEvent
  try {
    const wh = new Webhook(webhookSecret)
    evt = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent
    console.log("[clerk-webhook] Assinatura verificada com sucesso. Evento:", evt.type)
  } catch (err) {
    console.error("[clerk-webhook] Falha na verificação da assinatura:", err)
    return new Response(
      JSON.stringify({ error: "Invalid signature - verifique se CLERK_WEBHOOK_SECRET corresponde ao secret no painel Clerk" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (evt.type !== "user.created") {
    console.log("[clerk-webhook] Evento ignorado:", evt.type)
    return new Response(
      JSON.stringify({ received: true, type: evt.type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const { id, email_addresses = [], primary_email_address_id, first_name, last_name } = evt.data
  const primaryEmail = primary_email_address_id
    ? email_addresses.find((e) => e.id === primary_email_address_id)?.email_address
    : email_addresses[0]?.email_address
  const fullName = [first_name, last_name].filter(Boolean).join(" ").trim() || null

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[clerk-webhook] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados")
    return new Response(
      JSON.stringify({ error: "Configuração Supabase ausente" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. Criar company (necessária para o perfil)
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: fullName || "Minha Empresa",
        slug: `company-${id.replace(/^user_/, "")}`,
        plan_type: "free",
        status: "trialing",
      })
      .select("id")
      .single()

    if (companyError) {
      console.error("[clerk-webhook] Erro ao criar company:", companyError)
      return new Response(
        JSON.stringify({ error: companyError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Criar profile vinculado à company
    const { error: profileError } = await supabase.from("profiles").insert({
      id,
      email: primaryEmail ?? "",
      full_name: fullName,
      company_id: company.id,
      role: "admin",
    })

    if (profileError) {
      console.error("[clerk-webhook] Erro ao criar profile:", profileError)
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("[clerk-webhook] Perfil criado com sucesso:", { userId: id, companyId: company.id })
    return new Response(
      JSON.stringify({ success: true, userId: id, companyId: company.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("[clerk-webhook] Erro inesperado:", err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
