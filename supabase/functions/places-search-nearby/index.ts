/**
 * Edge Function: places-search-nearby
 *
 * Proxy para Google Places API (New) - searchNearby + searchText (fallback).
 * Busca lugares por tipo próximo a uma coordenada. Usado no GMB Local para listar concorrentes.
 * Auth: --no-verify-jwt (invocação com anon key). Secret: GOOGLE_PLACES_API_KEY.
 * Deploy DEV: npx supabase functions deploy places-search-nearby --project-ref mrkvvgofjyvlutqpvedt --no-verify-jwt
 * Deploy PROD: npx supabase functions deploy places-search-nearby --project-ref bctjodobbsxieywgulvl --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
const PLACES_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"
// Pro: displayName, formattedAddress, location. Enterprise: rating, userRatingCount, businessStatus
const FIELD_MASK = "places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.businessStatus"
const DEFAULT_RADIUS_M = 3000
const MAX_RESULTS = 20

/** Mapeia place type ID para termo de busca em português (fallback searchText) */
const PLACE_TYPE_TO_QUERY: Record<string, string> = {
  real_estate_agency: "imobiliária",
  dentist: "dentista",
  lawyer: "advogado",
  doctor: "médico",
  restaurant: "restaurante",
  insurance_agency: "seguradora",
  insurance_agent: "corretor de seguros",
  accounting: "contabilidade",
  hair_salon: "salão de beleza",
  pharmacy: "farmácia",
  gym: "academia",
  veterinary_care: "veterinário",
  car_dealer: "concessionária",
  bakery: "padaria",
  cafe: "café",
}

interface RequestBody {
  lat: number
  lng: number
  placeType: string
  radius?: number
}

interface PlaceLocation {
  latitude?: number
  longitude?: number
}

interface PlaceResponse {
  displayName?: { text?: string }
  formattedAddress?: string
  rating?: number
  userRatingCount?: number
  location?: PlaceLocation
  businessStatus?: string
}

interface PlacesApiResponse {
  places?: PlaceResponse[]
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
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
  const bodyObj = bodyRaw as Record<string, unknown>

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY")?.trim()
  if (!apiKey) {
    return jsonResponse({ error: "Google Places API não configurada." }, 500)
  }

  const body = bodyObj as RequestBody
  const { lat, lng, placeType, radius = DEFAULT_RADIUS_M } = body

  if (typeof lat !== "number" || typeof lng !== "number" || !placeType || typeof placeType !== "string") {
    return jsonResponse({ error: "lat, lng e placeType são obrigatórios." }, 400)
  }

  const trimmedType = placeType.trim()
  if (!trimmedType) {
    return jsonResponse({ error: "placeType não pode ser vazio." }, 400)
  }

  const radiusM = Math.min(Math.max(radius, 1000), 5000)
  const commonHeaders = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": FIELD_MASK,
  }
  const locationRestriction = {
    circle: {
      center: { latitude: lat, longitude: lng },
      radius: radiusM,
    },
  }

  function mapPlaces(data: PlacesApiResponse): Array<{
    name: string
    address: string
    rating: number | null
    userRatingCount: number | null
    lat: number | null
    lng: number | null
    businessStatus: string | null
  }> {
    return (data.places ?? []).map((p) => ({
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? null,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      businessStatus: p.businessStatus ?? null,
    }))
  }

  try {
    // Preferir searchText quando há mapeamento: retorna rating/userRatingCount de forma
    // consistente (DEV e Remoto). searchNearby em produção costuma vir sem avaliações.
    const textQuery = PLACE_TYPE_TO_QUERY[trimmedType] ?? trimmedType.replace(/_/g, " ")
    const hasTextMapping = trimmedType in PLACE_TYPE_TO_QUERY

    if (hasTextMapping) {
      const textPayload = {
        textQuery,
        maxResultCount: MAX_RESULTS,
        locationRestriction,
        rankPreference: "DISTANCE",
        languageCode: "pt-BR",
        regionCode: "BR",
      }
      const textRes = await fetch(PLACES_TEXT_URL, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(textPayload),
      })
      if (textRes.ok) {
        const textData = (await textRes.json()) as PlacesApiResponse
        const places = mapPlaces(textData)
        if (places.length > 0) {
          return jsonResponse({ places })
        }
      } else {
        console.error("Places searchText error:", textRes.status, await textRes.text())
      }
    }

    // searchNearby (ou fallback quando searchText não tem mapeamento / falhou)
    const nearbyPayload = {
      includedTypes: [trimmedType],
      maxResultCount: MAX_RESULTS,
      locationRestriction,
      rankPreference: "DISTANCE",
      languageCode: "pt-BR",
      regionCode: "BR",
    }
    const nearbyRes = await fetch(PLACES_NEARBY_URL, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify(nearbyPayload),
    })

    if (nearbyRes.ok) {
      const nearbyData = (await nearbyRes.json()) as PlacesApiResponse
      const places = mapPlaces(nearbyData)
      if (places.length > 0) {
        return jsonResponse({ places })
      }
    } else {
      console.error("Places searchNearby error:", nearbyRes.status, await nearbyRes.text())
    }

    // Último fallback: searchText sem mapeamento (ex.: tipo customizado)
    if (!hasTextMapping) {
      const textPayload = {
        textQuery,
        maxResultCount: MAX_RESULTS,
        locationRestriction,
        rankPreference: "DISTANCE",
        languageCode: "pt-BR",
        regionCode: "BR",
      }
      const textRes = await fetch(PLACES_TEXT_URL, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(textPayload),
      })
      if (textRes.ok) {
        const textData = (await textRes.json()) as PlacesApiResponse
        const places = mapPlaces(textData)
        if (places.length > 0) {
          return jsonResponse({ places })
        }
      }
    }

    return jsonResponse({ error: "Nenhum resultado encontrado.", places: [] }, 200)
  } catch (err) {
    console.error("Places search error:", err)
    return jsonResponse({ error: "Erro ao buscar lugares." }, 500)
  }
})
