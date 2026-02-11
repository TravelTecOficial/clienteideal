/**
 * Edge Function: sync-profile
 *
 * Endpoint para Webhooks do Clerk (comunicação servidor-para-servidor).
 * Valida assinatura Svix e sincroniza user.created no Supabase.
 *
 * Requer: Headers svix-id, svix-timestamp, svix-signature
 * Secret: CLERK_WEBHOOK_SECRET (não CLERK_SECRET_KEY)
 *
 * NOTA: Para sync sob demanda (frontend), use um endpoint separado com Bearer token.
 * Este endpoint é exclusivo para webhooks do Clerk.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Webhook } from "npm:svix@1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const webhookSecret = Deno.env.get("CLERK_WEBHOOK_SECRET")
  if (!webhookSecret) {
    console.error("[sync-profile] CLERK_WEBHOOK_SECRET não configurado")
    return new Response(
      JSON.stringify({ error: "Webhook secret não configurado" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.log("[sync-profile] Headers Svix ausentes - requisição inválida")
    return new Response(
      JSON.stringify({
        error:
          "Missing svix headers (svix-id, svix-timestamp, svix-signature)",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const rawBody = await req.text()
  if (!rawBody) {
    return new Response(
      JSON.stringify({ error: "Body vazio" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
    console.log("[sync-profile] Assinatura verificada. Evento:", evt.type)
  } catch (err) {
    console.error("[sync-profile] Falha na verificação Svix:", err)
    return new Response(
      JSON.stringify({
        error:
          "Invalid signature - verifique se CLERK_WEBHOOK_SECRET corresponde ao secret no painel Clerk",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  if (evt.type !== "user.created") {
    console.log("[sync-profile] Evento ignorado:", evt.type)
    return new Response(
      JSON.stringify({ received: true, type: evt.type }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const {
    id: clerkUserId,
    email_addresses = [],
    primary_email_address_id,
    first_name,
    last_name,
  } = evt.data

  const primaryEmail = primary_email_address_id
    ? email_addresses.find((e) => e.id === primary_email_address_id)
        ?.email_address
    : email_addresses[0]?.email_address
  const fullName =
    [first_name, last_name].filter(Boolean).join(" ").trim() || null

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[sync-profile] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes")
    return new Response(
      JSON.stringify({ error: "Configuração Supabase ausente" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // IDs como strings (tabelas com id TEXT)
  const companyId = `company-${clerkUserId.replace(/^user_/, "")}`

  try {
    // 1. Upsert company (evita duplicidade)
    const { error: companyError } = await supabase
      .from("companies")
      .upsert(
        {
          id: companyId,
          name: fullName || "Minha Empresa",
          slug: `company-${clerkUserId.replace(/^user_/, "")}`,
          plan_type: "free",
          status: "trialing",
        },
        { onConflict: "id" }
      )

    if (companyError) {
      console.error("[sync-profile] Erro ao upsert company:", companyError)
      return new Response(
        JSON.stringify({ error: companyError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // 2. Upsert profile (vincula ao company_id)
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: clerkUserId,
          email: primaryEmail ?? "",
          full_name: fullName,
          company_id: companyId,
          role: "admin",
        },
        { onConflict: "id" }
      )

    if (profileError) {
      console.error("[sync-profile] Erro ao upsert profile:", profileError)
      return new Response(
        JSON.stringify({ error: profileError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("[sync-profile] Perfil sincronizado:", {
      userId: clerkUserId,
      companyId,
    })
    return new Response(
      JSON.stringify({ success: true, userId: clerkUserId, companyId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (err) {
    console.error("[sync-profile] Erro inesperado:", err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
