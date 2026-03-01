/**
 * Edge Function: geocode-address
 *
 * Proxy para Nominatim (OpenStreetMap) - evita CORS no browser.
 * Geocodifica endereços brasileiros. Usado no GMB Local para exibir a empresa no mapa.
 * Auth: --no-verify-jwt (invocação com anon key).
 * Deploy DEV: npx supabase functions deploy geocode-address --project-ref mrkvvgofjyvlutqpvedt --no-verify-jwt
 * Deploy PROD: npx supabase functions deploy geocode-address --project-ref bctjodobbsxieywgulvl --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const USER_AGENT = "ClienteIdeal-GMB-Local/1.0 (contato@clienteideal.com.br)"

interface RequestBody {
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}

interface NominatimResult {
  lat: string
  lon: string
  display_name?: string
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function buildAddressString(addr: RequestBody): string {
  const parts: string[] = []
  if (addr.logradouro) parts.push(addr.logradouro)
  if (addr.numero) parts.push(addr.numero)
  const linha1 = parts.length ? parts.join(", ") : ""
  const linha2 = [addr.bairro, addr.cidade, addr.uf].filter(Boolean).join(", ")
  const linha3 = addr.cep ? `CEP ${addr.cep}` : ""
  return [linha1, linha2, linha3].filter(Boolean).join(" - ")
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function tryNominatim(params: URLSearchParams): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM_URL}?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  })
  if (!res.ok) return null
  const data = (await res.json()) as NominatimResult[]
  if (!data?.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405)
  }

  let bodyRaw: unknown
  try {
    bodyRaw = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON inválido." }, 400)
  }

  const addr = bodyRaw as RequestBody
  const baseParams = new URLSearchParams({
    format: "json",
    limit: "1",
    countrycodes: "br",
  })

  try {
    // 1. Busca estruturada (street + city + state)
    const street = [addr.logradouro, addr.numero].filter(Boolean).join(", ")
    if (street && addr.cidade && addr.uf) {
      const structured = new URLSearchParams(baseParams)
      structured.set("street", street)
      structured.set("city", addr.cidade)
      structured.set("state", addr.uf)
      structured.set("country", "Brasil")
      if (addr.cep) structured.set("postalcode", addr.cep.replace(/\D/g, ""))
      const result = await tryNominatim(structured)
      if (result) return jsonResponse(result)
      await delay(1100)
    }

    // 2. CEP + cidade
    if (addr.cep && addr.cidade) {
      const cepOnly = new URLSearchParams(baseParams)
      cepOnly.set("postalcode", addr.cep.replace(/\D/g, ""))
      cepOnly.set("city", addr.cidade)
      cepOnly.set("country", "Brasil")
      const result = await tryNominatim(cepOnly)
      if (result) return jsonResponse(result)
      await delay(1100)
    }

    // 3. Free-form com endereço completo
    const freeForm = buildAddressString(addr)
    if (freeForm) {
      const qParams = new URLSearchParams(baseParams)
      qParams.set("q", `${freeForm}, Brasil`)
      const result = await tryNominatim(qParams)
      if (result) return jsonResponse(result)
      await delay(1100)
    }

    // 4. Apenas cidade, UF
    if (addr.cidade && addr.uf) {
      const cityParams = new URLSearchParams(baseParams)
      cityParams.set("q", `${addr.cidade}, ${addr.uf}, Brasil`)
      const result = await tryNominatim(cityParams)
      if (result) return jsonResponse(result)
    }

    return jsonResponse({ error: "Endereço não encontrado." }, 404)
  } catch (err) {
    console.error("Geocode error:", err)
    return jsonResponse({ error: "Erro ao buscar localização." }, 500)
  }
})
