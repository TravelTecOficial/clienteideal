/**
 * CompanyMap - Google Maps com localização da empresa
 *
 * Usa Edge Function geocode-address (proxy Nominatim) para evitar CORS.
 * Requer VITE_GOOGLE_MAPS_API_KEY no .env (mesma chave do Places, com Maps JavaScript API habilitada).
 * Note: UI-level display only. Dados vêm do Supabase com RLS.
 */
import { useEffect, useState, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export interface CompanyAddress {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

function buildAddressString(addr: CompanyAddress): string {
  const parts: string[] = [];
  if (addr.logradouro) parts.push(addr.logradouro);
  if (addr.numero) parts.push(addr.numero);
  const linha1 = parts.length ? parts.join(", ") : "";
  const linha2 = [addr.bairro, addr.cidade, addr.uf].filter(Boolean).join(", ");
  const linha3 = addr.cep ? `CEP ${addr.cep}` : "";
  return [linha1, linha2, linha3].filter(Boolean).join(" - ");
}

/** Verifica se há dados suficientes para geocoding */
function hasAddressData(addr: CompanyAddress | null): boolean {
  if (!addr) return false;
  return !!(addr.cidade || addr.cep || (addr.logradouro && addr.cidade));
}

async function geocodeAddress(addr: CompanyAddress): Promise<{ lat: number; lng: number } | null> {
  const url = `${SUPABASE_URL}/functions/v1/geocode-address`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        logradouro: addr.logradouro ?? undefined,
        numero: addr.numero ?? undefined,
        bairro: addr.bairro ?? undefined,
        cidade: addr.cidade ?? undefined,
        uf: addr.uf ?? undefined,
        cep: addr.cep ?? undefined,
      }),
    });
  } catch (err) {
    throw err;
  }
  const rawText = await res.text();
  let parsed: { lat?: number; lng?: number; error?: string } | null = null;
  try {
    parsed = JSON.parse(rawText) as { lat?: number; lng?: number; error?: string };
  } catch {
    return null;
  }
  if (!res.ok || parsed?.error) return null;
  if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
    return { lat: parsed.lat, lng: parsed.lng };
  }
  return null;
}

export interface CompetitorPlace {
  name: string;
  address: string;
  rating: number | null;
  userRatingCount: number | null;
  lat: number | null;
  lng: number | null;
  businessStatus?: string | null;
}

interface CompanyMapProps {
  address: CompanyAddress | null;
  companyName?: string | null;
  className?: string;
  minHeight?: number;
  onLocationReady?: (lat: number, lng: number) => void;
  competitors?: CompetitorPlace[];
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || "";
/** Map ID para AdvancedMarker. Fallback DEMO_MAP_ID evita aviso de depreciação do Marker; em produção use VITE_GOOGLE_MAPS_MAP_ID (crie em Map Management). */
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID";

function MapContent({
  coords,
  companyName,
  addressStr,
  competitors,
  minHeight,
}: {
  coords: [number, number];
  companyName?: string | null;
  addressStr: string;
  competitors: CompetitorPlace[];
  minHeight: number;
}) {
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const validCompetitors = competitors.filter((c) => c.lat != null && c.lng != null);

  return (
    <Map
      mapId={GOOGLE_MAPS_MAP_ID}
      defaultCenter={{ lat: coords[0], lng: coords[1] }}
      defaultZoom={15}
      gestureHandling="greedy"
      style={{ width: "100%", height: "100%", minHeight }}
    >
      <AdvancedMarker
        position={{ lat: coords[0], lng: coords[1] }}
        onClick={() => setOpenInfo(openInfo === "company" ? null : "company")}
      />
      {openInfo === "company" && (
        <InfoWindow
          position={{ lat: coords[0], lng: coords[1] }}
          onCloseClick={() => setOpenInfo(null)}
        >
          <div className="text-sm p-1">
            <strong>{companyName || "Empresa"}</strong>
            <br />
            {addressStr}
          </div>
        </InfoWindow>
      )}
      {validCompetitors.map((c, i) => (
        <AdvancedMarker
          key={`${c.name}-${i}`}
          position={{ lat: c.lat!, lng: c.lng! }}
          onClick={() => setOpenInfo(openInfo === `comp-${i}` ? null : `comp-${i}`)}
        />
      ))}
      {validCompetitors.map(
        (c, i) =>
          openInfo === `comp-${i}` && (
            <InfoWindow
              key={`iw-${c.name}-${i}`}
              position={{ lat: c.lat!, lng: c.lng! }}
              onCloseClick={() => setOpenInfo(null)}
            >
              <div className="text-sm p-1">
                <strong>{c.name}</strong>
                {c.rating != null && (
                  <>
                    <br />
                    {c.rating.toFixed(1)} ★ ({c.userRatingCount ?? 0} avaliações)
                  </>
                )}
                {c.address && (
                  <>
                    <br />
                    <span className="text-muted-foreground">{c.address}</span>
                  </>
                )}
              </div>
            </InfoWindow>
          )
      )}
    </Map>
  );
}

export function CompanyMap({
  address,
  companyName,
  className = "",
  minHeight = 400,
  onLocationReady,
  competitors = [],
}: CompanyMapProps) {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressStr = useMemo(() => (address ? buildAddressString(address) : ""), [address]);
  const canGeocode = address && hasAddressData(address);

  useEffect(() => {
    if (!canGeocode) {
      setCoords(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    geocodeAddress(address!)
      .then((result) => {
        if (result) {
          setCoords([result.lat, result.lng]);
          setError(null);
          onLocationReady?.(result.lat, result.lng);
        } else {
          setCoords(null);
          setError("Endereço não encontrado no mapa.");
        }
      })
      .catch(() => {
        setCoords(null);
        setError("Erro ao buscar localização.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLocationReady omitido para evitar loop (callback instável do parent)
  }, [canGeocode, addressStr]);

  if (!address || !canGeocode) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-4 ${className}`}
        style={{ minHeight }}
      >
        <span className="text-muted-foreground text-sm text-center">
          {!address
            ? "Cadastre o endereço da empresa em Configurações para exibir no mapa."
            : "Endereço incompleto. Preencha ao menos cidade e UF (ou CEP) em Configurações."}
        </span>
        {addressStr && (
          <span className="text-muted-foreground text-xs text-center max-w-xs">{addressStr}</span>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-border bg-muted/30 ${className}`}
        style={{ minHeight }}
      >
        <span className="text-muted-foreground text-sm">Buscando localização...</span>
      </div>
    );
  }

  if (error || !coords) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 p-4 ${className}`}
        style={{ minHeight }}
      >
        <span className="text-muted-foreground text-sm text-center">
          {error ?? "Endereço incompleto."}
        </span>
        <span className="text-muted-foreground text-xs text-center max-w-xs">
          {addressStr || "Verifique logradouro, cidade e UF em Configurações."}
        </span>
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 p-4 ${className}`}
        style={{ minHeight }}
      >
        <span className="text-muted-foreground text-sm text-center">
          Configure VITE_GOOGLE_MAPS_API_KEY no .env para exibir o mapa do Google.
        </span>
        <span className="text-muted-foreground text-xs text-center max-w-xs">
          Use a mesma chave do Places API e habilite &quot;Maps JavaScript API&quot; no Google Cloud Console.
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border border-border ${className}`} style={{ minHeight }}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <MapContent
          coords={coords}
          companyName={companyName}
          addressStr={addressStr}
          competitors={competitors}
          minHeight={minHeight}
        />
      </APIProvider>
    </div>
  );
}
