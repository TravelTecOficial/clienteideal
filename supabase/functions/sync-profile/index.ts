/**
 * Edge Function: sync-profile
 *
 * Cria perfil e company sob demanda para usuários que se cadastraram sem
 * o webhook Clerk ter rodado (ex: cadastro antes do webhook, falha no webhook).
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body opcional: { email?: string, fullName?: string }
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
    console.error("[sync-profile] CLERK_SECRET_KEY não configurado")
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
    // JWT padrão pode não ter email/full_name; body do frontend pode sobrescrever
    if (typeof (verified as Record<string, unknown>).email === "string") {
      email = (verified as Record<string, unknown>).email as string
    }
    const fn = (verified as Record<string, unknown>).first_name
    const ln = (verified as Record<string, unknown>).last_name
    if (typeof fn === "string" || typeof ln === "string") {
      fullName = [fn, ln].filter(Boolean).join(" ").trim() || null
    }
  } catch (err) {
    console.error("[sync-profile] Token inválido:", err)
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado. Faça login novamente." }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  // Permitir override do body (dados do frontend)
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

  try {
    // 1. Verificar se perfil já existe
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

    // 2. Criar company (id explícito pois a tabela não tem default)
    const companyId = crypto.randomUUID()
    const { error: companyError } = await supabase.from("companies").insert({
      id: companyId,
      name: fullName || "Minha Empresa",
      slug: `company-${sub.replace(/^user_/, "")}`,
      plan_type: "free",
      status: "trialing",
    })

    if (companyError) {
      console.error("[sync-profile] Erro ao criar company:", companyError)
      return new Response(
        JSON.stringify({ error: companyError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // 3. Criar ou atualizar profile (perfil pode existir sem company_id se webhook falhou)
    if (existing) {
      // Perfil existe sem company_id: fazer UPDATE
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ company_id: companyId, role: "admin" })
        .eq("id", sub)

      if (updateError) {
        console.error("[sync-profile] Erro ao atualizar profile:", updateError)
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    } else {
      // Perfil não existe: fazer INSERT
      const { error: profileError } = await supabase.from("profiles").insert({
        id: sub,
        email: email || "",
        full_name: fullName,
        company_id: companyId,
        role: "admin",
      })

      if (profileError) {
        console.error("[sync-profile] Erro ao criar profile:", profileError)
        return new Response(
          JSON.stringify({ error: profileError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ companyId, created: true }),
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
