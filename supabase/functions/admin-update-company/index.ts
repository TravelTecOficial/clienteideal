/**
 * Edge Function: admin-update-company
 *
 * Permite ao admin do SaaS atualizar segment_type de uma company.
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Body: { company_id: string, segment_type: "produtos" | "consorcio" }
 *
 * Apenas usuários com publicMetadata.role === "admin" podem chamar.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createClerkClient, verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface UpdateBody {
  company_id: string
  segment_type: "produtos" | "consorcio"
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

  const clerkClient = createClerkClient({ secretKey: clerkSecret })
  let user: { publicMetadata?: Record<string, unknown> }
  try {
    user = await clerkClient.users.getUser(sub)
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro ao verificar permissões." }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const saasRole = user.publicMetadata?.role as string | undefined
  if (saasRole !== "admin") {
    return new Response(
      JSON.stringify({ error: "Acesso negado. Apenas administradores do sistema." }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  let body: UpdateBody
  try {
    body = (await req.json()) as UpdateBody
  } catch {
    return new Response(
      JSON.stringify({ error: "Body JSON inválido." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  const { company_id, segment_type } = body
  if (!company_id || !segment_type) {
    return new Response(
      JSON.stringify({ error: "company_id e segment_type são obrigatórios." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  if (segment_type !== "produtos" && segment_type !== "consorcio") {
    return new Response(
      JSON.stringify({ error: "segment_type deve ser 'produtos' ou 'consorcio'." }),
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

  const { data, error } = await supabase
    .from("companies")
    .update({ segment_type })
    .eq("id", company_id)
    .select("id, segment_type")
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  return new Response(
    JSON.stringify({ success: true, company: data }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  )
})
