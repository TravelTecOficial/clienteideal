/**
 * Edge Function: place-from-url
 *
 * Recebe URL do Google Maps (maps.app.goo.gl ou google.com/maps), resolve o redirect,
 * extrai Place ID, chama Place Details e retorna primaryType (categoria) + placeId.
 * Usado em Configurações para identificar negócio e gravar categoria automaticamente.
 * Auth: --no-verify-jwt. Secret: GOOGLE_PLACES_API_KEY.
 * Deploy: npx supabase functions deploy place-from-url --project-ref mrkvvgofjyvlutqpvedt --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places"
const PLACES_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"
const FIELD_MASK_DETAILS = "id,displayName,primaryType,types"

const VALID_HOSTS = [
  "maps.app.goo.gl",
  "goo.gl",
  "www.google.com",
  "google.com",
  "maps.google.com",
]

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function isValidMapsUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    const host = u.hostname.replace(/^www\./, "")
    return VALID_HOSTS.some((h) => host === h || host.endsWith("." + h))
  } catch {
    return false
  }
}

/** Extrai Place ID da URL (ChIJ...) */
function extractPlaceIdFromUrl(urlStr: string): string | null {
  const placeIdParam = urlStr.match(/[?&](?:query_place_id|place_id)=([^&]+)/i)
  if (placeIdParam) return decodeURIComponent(placeIdParam[1]).trim()

  const chijMatch = urlStr.match(/ChIJ[A-Za-z0-9_-]{20,}/)
  if (chijMatch) return chijMatch[0]

  const dataMatch = urlStr.match(/!1s(0x[0-9a-fA-F]+|ChIJ[A-Za-z0-9_-]+)/)
  if (dataMatch) {
    const id = dataMatch[1]
    if (id.startsWith("ChIJ")) return id
  }
  return null
}

/** Extrai nome do lugar e coordenadas da URL /place/Nome/@lat,lng ou !3d...!4d... */
function extractPlaceNameAndCoords(urlStr: string): { name: string; lat: number; lng: number } | null {
  let name = ""
  let lat = NaN
  let lng = NaN

  const placeMatch = urlStr.match(/\/place\/([^/]+)\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (placeMatch) {
    name = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim()
    lat = parseFloat(placeMatch[2])
    lng = parseFloat(placeMatch[3])
  }

  const d3d4Match = urlStr.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (d3d4Match) {
    if (isNaN(lat)) lat = parseFloat(d3d4Match[1])
    if (isNaN(lng)) lng = parseFloat(d3d4Match[2])
  }

  if (!name) name = "estabelecimento"
  if (isNaN(lat) || isNaN(lng)) return null
  return { name, lat, lng }
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

  const body = bodyRaw as { mapsUrl?: string }
  const mapsUrl = typeof body.mapsUrl === "string" ? body.mapsUrl.trim() : ""
  if (!mapsUrl) {
    return jsonResponse({ error: "mapsUrl é obrigatório." }, 400)
  }

  if (!isValidMapsUrl(mapsUrl)) {
    return jsonResponse({ error: "URL inválida. Use um link do Google Maps (maps.app.goo.gl ou google.com/maps)." }, 400)
  }

  try {
    let urlToParse = mapsUrl
    const isShortUrl = /^(https?:\/\/)?(www\.)?(maps\.app\.goo\.gl|goo\.gl)\//i.test(mapsUrl)
    if (isShortUrl) {
      const res = await fetch(mapsUrl, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0" },
      })
      urlToParse = res.url || mapsUrl
    }

    let placeId = extractPlaceIdFromUrl(urlToParse)
    let parsed = extractPlaceNameAndCoords(urlToParse)

    if (!placeId && parsed) {
      const runSearch = async (payload: Record<string, unknown>) => {
        const res = await fetch(PLACES_TEXT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.location",
          },
          body: JSON.stringify(payload),
        })
        if (!res.ok) return { ok: false, status: res.status, body: await res.text() }
        const data = (await res.json()) as { places?: Array<{ id?: string }> }
        return { ok: true, first: data.places?.[0] }
      }

      const payloadWithLocation = {
        textQuery: parsed.name,
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: { latitude: parsed.lat, longitude: parsed.lng },
            radius: 5000,
          },
        },
        languageCode: "pt-BR",
        regionCode: "BR",
      }
      let result = await runSearch(payloadWithLocation)
      if (result.ok && result.first?.id) placeId = result.first.id

      if (!placeId && result.ok) {
        const payloadTextOnly = {
          textQuery: parsed.name,
          maxResultCount: 5,
          languageCode: "pt-BR",
          regionCode: "BR",
        }
        result = await runSearch(payloadTextOnly)
        if (result.ok && result.first?.id) placeId = result.first.id
      }

      if (!placeId && !result.ok) {
        const err = result as { status: number; body: string }
        console.error("searchText error:", err.status, err.body)
        return jsonResponse({ error: "Busca Google falhou. Verifique se a chave Places API está configurada no Supabase." }, 502)
      }
      if (!placeId && result.ok) {
        return jsonResponse({ error: "A busca não encontrou o negócio. Tente um link maps.app.goo.gl ou o Place ID." }, 404)
      }
    }

    if (!placeId) {
      const msg = parsed
        ? "Busca não retornou resultados."
        : "Não foi possível extrair nome e coordenadas do link. Use maps.app.goo.gl ou link com /place/Nome/@lat,lng"
      return jsonResponse({ error: msg }, 404)
    }

    const detailsRes = await fetch(`${PLACES_DETAILS_URL}/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK_DETAILS,
      },
    })

    if (!detailsRes.ok) {
      const errText = await detailsRes.text()
      console.error("Place Details error:", detailsRes.status, errText)
      return jsonResponse({ error: "Erro ao buscar dados do negócio no Google." }, 502)
    }

    const details = (await detailsRes.json()) as {
      id?: string
      displayName?: { text?: string }
      primaryType?: string
      types?: string[]
    }

    const primaryType = details.primaryType ?? details.types?.[0] ?? null
    const displayName = details.displayName?.text ?? ""

    return jsonResponse({
      placeId: details.id ?? placeId,
      primaryType,
      types: details.types ?? [],
      displayName,
    })
  } catch (err) {
    console.error("place-from-url error:", err)
    return jsonResponse({ error: "Erro ao processar o link." }, 500)
  }
})
