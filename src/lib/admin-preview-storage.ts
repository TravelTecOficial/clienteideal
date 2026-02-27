/**
 * Persistência do modo preview do admin ao visualizar dashboard de cliente.
 * Prioridade: sessionStorage > URL (?preview=companyId) para suportar nova aba e remoto.
 * Note: UI-level. API deve validar permissões.
 */

const ADMIN_PREVIEW_COMPANY_KEY = "admin_preview_company_id"
const URL_PARAM_PREVIEW = "preview"

export function getAdminPreviewCompanyId(): string | null {
  if (typeof sessionStorage !== "undefined") {
    const fromStorage = sessionStorage.getItem(ADMIN_PREVIEW_COMPANY_KEY)
    if (fromStorage?.trim()) return fromStorage
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get(URL_PARAM_PREVIEW)?.trim()
    if (fromUrl) return fromUrl
  }
  return null
}

export function setAdminPreviewCompanyId(companyId: string): void {
  sessionStorage?.setItem(ADMIN_PREVIEW_COMPANY_KEY, companyId)
}

export function clearAdminPreviewCompanyId(): void {
  sessionStorage?.removeItem(ADMIN_PREVIEW_COMPANY_KEY)
}

/** Retorna o sufixo ?preview=companyId para usar em links quando em modo preview */
export function getPreviewUrlSuffix(companyId: string): string {
  return `?preview=${encodeURIComponent(companyId)}`
}
