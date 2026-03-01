import { useState, useEffect } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSupabaseClient } from "@/lib/supabase-context"
import { useCompanyPreview } from "@/lib/company-preview-context"
import { getAdminPreviewCompanyId } from "@/lib/admin-preview-storage"
import type { SupabaseClient } from "@supabase/supabase-js"

type ProfileData = { company_id: string | null; saas_admin?: boolean | null } | null

async function fetchProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileData> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id, saas_admin")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("Erro ao buscar perfil:", error)
    return null
  }
  return data as ProfileData
}

/**
 * Retorna o companyId efetivo: preview (admin) ou do perfil do usuário.
 * Usa storage/preview apenas quando saas_admin=true; caso contrário usa profile.company_id
 * para evitar que usuários comuns usem company_id de preview em storage (stale).
 * Note: UI-level. API enforcement required.
 */
export function useEffectiveCompanyId(): string | null {
  const { userId } = useAuth()
  const supabase = useSupabaseClient()
  const { companyId: previewCompanyId } = useCompanyPreview()
  const storagePreviewId = getAdminPreviewCompanyId()
  const [profile, setProfile] = useState<ProfileData>(null)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    let cancelled = false
    fetchProfile(supabase, userId).then((p) => {
      if (!cancelled) setProfile(p)
    })
    return () => {
      cancelled = true
    }
  }, [userId, supabase])

  const profileCompanyId = profile?.company_id ?? null
  const isSaasAdmin = Boolean(profile?.saas_admin)
  const previewId = previewCompanyId ?? storagePreviewId

  const effectiveCompanyId = isSaasAdmin && previewId
    ? previewId
    : profileCompanyId

  return effectiveCompanyId
}
