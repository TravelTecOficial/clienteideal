import { useState, useEffect } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSupabaseClient } from "@/lib/supabase-context"
import { useCompanyPreview } from "@/lib/company-preview-context"
import { getAdminPreviewCompanyId } from "@/lib/admin-preview-storage"
import type { SupabaseClient } from "@supabase/supabase-js"

async function fetchProfileCompanyId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("Erro ao buscar company_id:", error)
    return null
  }
  const profile = data as { company_id: string | null } | null
  return profile?.company_id ?? null
}

/**
 * Retorna o companyId efetivo: preview (admin) ou do perfil do usuário.
 * Fallback: sessionStorage quando CompanyPreviewProvider ainda não envolveu (timing).
 * Note: UI-level. API enforcement required.
 */
export function useEffectiveCompanyId(): string | null {
  const { userId } = useAuth()
  const supabase = useSupabaseClient()
  const { companyId: previewCompanyId } = useCompanyPreview()
  const storagePreviewId = getAdminPreviewCompanyId()
  const [profileCompanyId, setProfileCompanyId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || previewCompanyId || storagePreviewId) {
      if (!previewCompanyId && !storagePreviewId) setProfileCompanyId(null)
      return
    }
    let cancelled = false
    fetchProfileCompanyId(supabase, userId).then((cid) => {
      if (!cancelled) setProfileCompanyId(cid)
    })
    return () => {
      cancelled = true
    }
  }, [userId, supabase, previewCompanyId, storagePreviewId])

  const effective = previewCompanyId ?? storagePreviewId ?? profileCompanyId
  // #region agent log
  const logPayload = {sessionId:'8ad401',location:'use-effective-company-id.ts',message:'useEffectiveCompanyId result',data:{previewCompanyId,storagePreviewId,profileCompanyId,effective,hostname:typeof window!=='undefined'?window.location.hostname:null},hypothesisId:'H1',timestamp:Date.now()};
  if (typeof window!=='undefined' && (window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')) {
    fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ad401'},body:JSON.stringify(logPayload)}).catch(()=>{});
  } else {
    console.log('[debug 8ad401]', logPayload);
  }
  // #endregion
  return effective
}
