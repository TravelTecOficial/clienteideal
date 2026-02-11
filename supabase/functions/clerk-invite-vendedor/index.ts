/**
 * Edge Function: clerk-invite-vendedor
 *
 * Envia convite Clerk para um e-mail, passando company_id no publicMetadata.
 * Usa CLERK_SECRET_KEY (não SDK client-side).
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { email: string }
 *
 * O company_id é obtido do profile do usuário autenticado (Supabase).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createClerkClient, verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface InviteRequestBody {
  email?: string
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

  const clerkSecret = Deno.env.get("CLERK_SECRET_KEY")?.trim()
  if (!clerkSecret || !clerkSecret.startsWith("sk_")) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  let sub: string
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecret })
    sub = verified.sub as string
  } catch {
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

  let body: InviteRequestBody
  try {
    body = (await req.json().catch(() => ({}))) as InviteRequestBody
  } catch {
    return new Response(
      JSON.stringify({ error: "Body inválido." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email) {
    return new Response(
      JSON.stringify({ error: "E-mail é obrigatório." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", sub)
    .maybeSingle()

  if (profileError) {
    console.error("[clerk-invite-vendedor] Erro ao buscar profile:", profileError)
    return new Response(
      JSON.stringify({ error: "Erro ao verificar sua empresa." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const companyId = (profile as { company_id: string | null } | null)?.company_id ?? null
  if (!companyId) {
    return new Response(
      JSON.stringify({ error: "Você não está vinculado a uma empresa. Complete o cadastro antes de convidar." }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const clerkClient = createClerkClient({ secretKey: clerkSecret })

  try {
    await clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { company_id: companyId },
      ignoreExisting: true,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error("[clerk-invite-vendedor] Erro ao criar convite:", err)

    if (errMsg.toLowerCase().includes("already exists") || errMsg.toLowerCase().includes("already invited")) {
      return new Response(
        JSON.stringify({ error: "Este e-mail já foi convidado ou já possui conta." }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({ error: errMsg || "Erro ao enviar convite." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  return new Response(
    JSON.stringify({ success: true, message: "Convite enviado com sucesso." }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  )
})
