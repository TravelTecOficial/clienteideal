/**
 * Edge Function: admin-list-companies
 *
 * Lista todas as empresas (companies) para o Admin configurar Evolution API.
 * Apenas admin (Clerk publicMetadata.role === "admin") pode acessar.
 *
 * Requer: Authorization: Bearer <clerk_jwt>
 * Retorna: { companies: Array<{ id, name, evolution_api_url, evolution_instance_name }> }
 * Nota: evolution_api_key nunca é retornado por segurança.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createClerkClient, verifyToken } from "npm:@clerk/backend@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface CompanyRow {
  id: string
  name: string | null
  evolution_api_url: string | null
  evolution_instance_name: string | null
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
      JSON.stringify({
        error: "Acesso negado. Apenas administradores do sistema.",
      }),
      {
        status: 403,
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

  try {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, evolution_api_url, evolution_instance_name")
      .order("name", { ascending: true })

    if (error) {
      console.error("[admin-list-companies] Erro:", error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const companies = (data ?? []) as CompanyRow[]

    return new Response(
      JSON.stringify({ companies }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (err) {
    console.error("[admin-list-companies] Erro inesperado:", err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
