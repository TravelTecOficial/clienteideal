/**
 * Edge Function: meta-connections-n8n
 *
 * Retorna metadados das conexões Meta (Instagram, Facebook, Meta Ads) por empresa
 * para uso em workflows n8n. Não expõe tokens.
 *
 * Autenticação: api_key (query/body) ou header X-N8N-API-Key
 * Secret: N8N_META_CONNECTIONS_API_KEY
 *
 * GET ou POST: ?company_id=xxx&api_key=yyy
 * Ou: body { company_id, api_key }
 * Ou: header X-N8N-API-Key: yyy + company_id em query/body
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

interface MetaConnectionRow {
  provider_type: string
  selected_page_id?: string | null
  selected_page_name?: string | null
  selected_instagram_id?: string | null
  selected_instagram_username?: string | null
  selected_ad_account_id?: string | null
  selected_ad_account_name?: string | null
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido. Use GET ou POST." }, 405)
  }

  const apiKeySecret = Deno.env.get("N8N_META_CONNECTIONS_API_KEY")?.trim()
  if (!apiKeySecret) {
    console.error("[meta-connections-n8n] N8N_META_CONNECTIONS_API_KEY não configurada")
    return jsonResponse(
      { error: "Configuração do servidor incompleta." },
      500,
    )
  }

  let companyId = ""
  let apiKey = ""

  if (req.method === "GET") {
    const url = new URL(req.url)
    companyId = url.searchParams.get("company_id")?.trim() ?? ""
    apiKey = url.searchParams.get("api_key")?.trim() ?? req.headers.get("X-N8N-API-Key")?.trim() ?? ""
  } else {
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      companyId = (typeof body.company_id === "string" ? body.company_id : "").trim()
      apiKey =
        (typeof body.api_key === "string" ? body.api_key : "").trim() ||
        req.headers.get("X-N8N-API-Key")?.trim() ||
        ""
    } catch {
      return jsonResponse({ error: "Body JSON inválido." }, 400)
    }
  }

  if (!companyId) {
    return jsonResponse({ error: "Parâmetro company_id é obrigatório." }, 400)
  }

  if (!apiKey || apiKey !== apiKeySecret) {
    return jsonResponse({ error: "API key inválida ou ausente." }, 401)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()?.replace(/\/$/, "")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Configuração do servidor inválida." }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: rows, error } = await supabase
    .from("meta_connections")
    .select("provider_type, selected_page_id, selected_page_name, selected_instagram_id, selected_instagram_username, selected_ad_account_id, selected_ad_account_name")
    .eq("company_id", companyId)
    .in("provider_type", ["instagram", "facebook", "meta_ads"])

  if (error) {
    console.error("[meta-connections-n8n] Erro ao buscar meta_connections:", error)
    return jsonResponse(
      { error: "Erro ao buscar conexões Meta.", hint: error.message },
      500,
    )
  }

  const list = Array.isArray(rows) ? rows : []
  const result: {
    company_id: string
    instagram?: { page_id?: string; page_name?: string; instagram_business_id?: string; instagram_username?: string }
    facebook?: { page_id?: string; page_name?: string; instagram_business_id?: string; instagram_username?: string }
    meta_ads?: { ad_account_id?: string; ad_account_name?: string }
  } = { company_id: companyId }

  for (const row of list as MetaConnectionRow[]) {
    const providerType = row?.provider_type
    const pageId = typeof row?.selected_page_id === "string" ? row.selected_page_id : undefined
    const pageName = typeof row?.selected_page_name === "string" ? row.selected_page_name : undefined
    const instagramBusinessId = typeof row?.selected_instagram_id === "string" ? row.selected_instagram_id : undefined
    const instagramUsername = typeof row?.selected_instagram_username === "string" ? row.selected_instagram_username : undefined
    const adAccountId = typeof row?.selected_ad_account_id === "string" ? row.selected_ad_account_id : undefined
    const adAccountName = typeof row?.selected_ad_account_name === "string" ? row.selected_ad_account_name : undefined

    if (providerType === "instagram") {
      result.instagram = {
        page_id: pageId,
        page_name: pageName,
        instagram_business_id: instagramBusinessId,
        instagram_username: instagramUsername,
      }
    } else if (providerType === "facebook") {
      result.facebook = {
        page_id: pageId,
        page_name: pageName,
        instagram_business_id: instagramBusinessId,
        instagram_username: instagramUsername,
      }
    } else if (providerType === "meta_ads") {
      result.meta_ads = { ad_account_id: adAccountId, ad_account_name: adAccountName }
    }
  }

  return jsonResponse(result)
})
