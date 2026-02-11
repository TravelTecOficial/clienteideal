/**
 * Edge Function: sync-profile-client
 *
 * Sync sob demanda para o frontend quando o webhook Clerk não rodou
 * (ex: cadastro antes do webhook, falha no webhook).
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body opcional: { email?: string, fullName?: string }
 *
 * Usa CLERK_SECRET_KEY para validar o JWT de sessão.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface SyncRequestBody {
  email?: string
  fullName?: string
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Token ausente. Faça login novamente." }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")
  if (!clerkSecret) {
    console.error("[sync-profile-client] CLERK_SECRET_KEY não configurado")
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  let sub: string
  let email = ""
  let fullName: string | null = null

  try {
    const verified = await verifyToken(token, {
      secretKey: clerkSecret,
    })
    sub = verified.sub as string
    if (typeof (verified as Record<string, unknown>).email === "string") {
      email = (verified as Record<string, unknown>).email as string
    }
    const fn = (verified as Record<string, unknown>).first_name
    const ln = (verified as Record<string, unknown>).last_name
    if (typeof fn === "string" || typeof ln === "string") {
      fullName = [fn, ln].filter(Boolean).join(" ").trim() || null
    }
  } catch (err) {
    console.error("[sync-profile-client] Token inválido:", err)
    return new Response(
      JSON.stringify({
        error: "Token inválido ou expirado. Faça login novamente.",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SyncRequestBody
    if (body.email) email = body.email
    if (body.fullName) fullName = body.fullName
  } catch {
    // ignorar body inválido
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const companyId = `company-${sub.replace(/^user_/, "")}`

  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, company_id, email, full_name")
      .eq("id", sub)
      .maybeSingle()

    if (existing?.company_id) {
      return new Response(
        JSON.stringify({ companyId: existing.company_id, created: false }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Upsert company (IDs como string)
    const { error: companyError } = await supabase
      .from("companies")
      .upsert(
        {
          id: companyId,
          name: fullName || "Minha Empresa",
          slug: `company-${sub.replace(/^user_/, "")}`,
          plan_type: "free",
          status: "trialing",
        },
        { onConflict: "id" }
      )

    if (companyError) {
      console.error("[sync-profile-client] Erro ao upsert company:", companyError)
      return new Response(
        JSON.stringify({ error: companyError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Upsert profile
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: sub,
        email: email || "",
        full_name: fullName,
        company_id: companyId,
        role: "admin",
      },
      { onConflict: "id" }
    )

    if (profileError) {
      console.error("[sync-profile-client] Erro ao upsert profile:", profileError)
      return new Response(
        JSON.stringify({ error: profileError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({ companyId, created: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (err) {
    console.error("[sync-profile-client] Erro inesperado:", err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
