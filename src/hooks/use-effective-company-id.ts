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

  const effectiveCompanyId = previewCompanyId ?? storagePreviewId ?? profileCompanyId
  return effectiveCompanyId
}
