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
      // #region agent log
      const shortCircuitPayload = {sessionId:'8ad401',runId:'cliente-ideal-pre-fix',hypothesisId:'H1',location:'use-effective-company-id.ts:short-circuit',message:'Short-circuit before profile query',data:{hasUserId:Boolean(userId),previewCompanyId,storagePreviewId,path:typeof window!=='undefined'?window.location.pathname:null,search:typeof window!=='undefined'?window.location.search:null},timestamp:Date.now()};
      fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ad401'},body:JSON.stringify(shortCircuitPayload)}).catch(()=>{});
      console.log('[debug 8ad401]', shortCircuitPayload);
      // #endregion
      if (!previewCompanyId && !storagePreviewId) setProfileCompanyId(null)
      return
    }
    let cancelled = false
    fetchProfileCompanyId(supabase, userId).then((cid) => {
      // #region agent log
      const profilePayload = {sessionId:'8ad401',runId:'cliente-ideal-pre-fix',hypothesisId:'H2',location:'use-effective-company-id.ts:profile-query',message:'Profile company_id loaded',data:{cid,userId},timestamp:Date.now()};
      fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ad401'},body:JSON.stringify(profilePayload)}).catch(()=>{});
      console.log('[debug 8ad401]', profilePayload);
      // #endregion
      if (!cancelled) setProfileCompanyId(cid)
    })
    return () => {
      cancelled = true
    }
  }, [userId, supabase, previewCompanyId, storagePreviewId])

  const effectiveCompanyId = previewCompanyId ?? storagePreviewId ?? profileCompanyId
  // #region agent log
  const resolvedPayload = {sessionId:'8ad401',runId:'cliente-ideal-pre-fix',hypothesisId:'H1',location:'use-effective-company-id.ts:return',message:'Resolved effective company id',data:{previewCompanyId,storagePreviewId,profileCompanyId,effectiveCompanyId,path:typeof window!=='undefined'?window.location.pathname:null,search:typeof window!=='undefined'?window.location.search:null},timestamp:Date.now()};
  fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ad401'},body:JSON.stringify(resolvedPayload)}).catch(()=>{});
  console.log('[debug 8ad401]', resolvedPayload);
  // #endregion
  return effectiveCompanyId
}
