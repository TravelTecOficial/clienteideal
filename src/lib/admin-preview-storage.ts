/**
 * Persistência do modo preview do admin ao visualizar dashboard de cliente.
 * Prioridade: sessionStorage > URL (?preview=companyId) para suportar nova aba e remoto.
 * Note: UI-level. API deve validar permissões.
 */

const ADMIN_PREVIEW_COMPANY_KEY = "admin_preview_company_id"
const URL_PARAM_PREVIEW = "preview"

const ADMIN_PREVIEW_PATH_PREFIX = "/admin/preview/"

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null
  const fromSession = window.sessionStorage?.getItem(key)
  if (fromSession?.trim()) return fromSession
  const fromLocal = window.localStorage?.getItem(key)
  if (fromLocal?.trim()) return fromLocal
  return null
}

function persistStorage(key: string, value: string): void {
  if (typeof window === "undefined") return
  window.sessionStorage?.setItem(key, value)
  window.localStorage?.setItem(key, value)
}

export function getAdminPreviewCompanyId(): string | null {
  const fromStorage = readStorage(ADMIN_PREVIEW_COMPANY_KEY)
  if (fromStorage) return fromStorage
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get(URL_PARAM_PREVIEW)?.trim()
    if (fromUrl) {
      persistStorage(ADMIN_PREVIEW_COMPANY_KEY, fromUrl)
      return fromUrl
    }
    const path = window.location.pathname || ""
    if (path.startsWith(ADMIN_PREVIEW_PATH_PREFIX)) {
      const companyId = path.slice(ADMIN_PREVIEW_PATH_PREFIX.length).split("/")[0]?.trim()
      if (companyId) {
        const decoded = decodeURIComponent(companyId)
        persistStorage(ADMIN_PREVIEW_COMPANY_KEY, decoded)
        return decoded
      }
    }
  }
  return null
}

export function setAdminPreviewCompanyId(companyId: string): void {
  persistStorage(ADMIN_PREVIEW_COMPANY_KEY, companyId)
}

export function clearAdminPreviewCompanyId(): void {
  if (typeof window === "undefined") return
  window.sessionStorage?.removeItem(ADMIN_PREVIEW_COMPANY_KEY)
  window.localStorage?.removeItem(ADMIN_PREVIEW_COMPANY_KEY)
}

/** Retorna o sufixo ?preview=companyId para usar em links quando em modo preview */
export function getPreviewUrlSuffix(companyId: string): string {
  return `?preview=${encodeURIComponent(companyId)}`
}
