/**
 * Edge Function: place-from-name
 *
 * Recebe nome do estabelecimento (e opcionalmente cidade/UF/endereço),
 * faz uma busca no Google Places (searchText) e retorna uma lista de
 * candidatos com placeId, nome, endereço e categorias.
 *
 * Auth: --no-verify-jwt (invocação com anon key).
 * Secret: GOOGLE_PLACES_API_KEY (NUNCA expor no frontend).
 *
 * Deploy (exemplo DEV):
 *   npx supabase functions deploy place-from-name --project-ref <project-ref> --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const PLACES_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"
const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.primaryType,places.types,places.location"

interface PlaceLocation {
  latitude?: number
  longitude?: number
}

interface PlacesTextPlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  primaryType?: string
  types?: string[]
  location?: PlaceLocation
}

interface PlacesTextResponse {
  places?: PlacesTextPlace[]
}

interface RequestBody {
  textQuery?: string
  city?: string
  state?: string
  country?: string
  fullAddress?: string
  maxResults?: number
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function buildQuery(body: RequestBody): string {
  const parts: string[] = []
  if (body.textQuery) parts.push(body.textQuery.trim())
  if (body.fullAddress) {
    parts.push(body.fullAddress.trim())
  } else {
    if (body.city) parts.push(body.city.trim())
    if (body.state) parts.push(body.state.trim())
    if (body.country) parts.push(body.country.trim())
  }
  return parts
    .filter((p) => p.length > 0)
    .join(", ")
    .trim()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405)
  }

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim()
  if (!apiKey) {
    return jsonResponse({ error: "Google Places API não configurada." }, 500)
  }

  let bodyRaw: unknown
  try {
    bodyRaw = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON inválido." }, 400)
  }

  const body = bodyRaw as RequestBody
  const textQuery = typeof body.textQuery === "string" ? body.textQuery.trim() : ""

  if (!textQuery) {
    return jsonResponse({ error: "textQuery é obrigatório (nome do estabelecimento)." }, 400)
  }
  if (textQuery.length > 120) {
    return jsonResponse({ error: "textQuery muito longo. Use até 120 caracteres." }, 400)
  }

  const combinedQuery = buildQuery({ ...body, textQuery })
  if (!combinedQuery) {
    return jsonResponse({ error: "Parâmetros insuficientes para busca." }, 400)
  }

  const maxResultsRaw = typeof body.maxResults === "number" ? body.maxResults : 5
  const maxResultCount = Math.min(Math.max(maxResultsRaw, 1), 10)

  const payload = {
    textQuery: combinedQuery,
    maxResultCount,
    languageCode: "pt-BR",
    regionCode: "BR",
  }

  try {
    const res = await fetch(PLACES_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error("places:searchText error:", res.status, errText)
      return jsonResponse(
        { error: "Erro ao buscar estabelecimentos no Google. Verifique a configuração da Places API." },
        502,
      )
    }

    const data = (await res.json()) as PlacesTextResponse
    const places = (data.places ?? []).map((p) => {
      const primaryType = p.primaryType ?? p.types?.[0] ?? null
      const secondaryTypes =
        p.types && primaryType ? p.types.filter((t) => t !== primaryType) : p.types ?? []

      return {
        placeId: p.id ?? null,
        displayName: p.displayName?.text ?? "",
        formattedAddress: p.formattedAddress ?? "",
        primaryType,
        types: p.types ?? [],
        secondaryTypes,
        location: p.location
          ? {
              lat: typeof p.location.latitude === "number" ? p.location.latitude : null,
              lng: typeof p.location.longitude === "number" ? p.location.longitude : null,
            }
          : { lat: null, lng: null },
      }
    })

    if (places.length === 0) {
      return jsonResponse({ candidates: [], message: "Nenhum estabelecimento encontrado para a busca." }, 200)
    }

    return jsonResponse({ candidates: places }, 200)
  } catch (err) {
    console.error("place-from-name error:", err)
    return jsonResponse({ error: "Erro interno ao buscar estabelecimentos." }, 500)
  }
})

