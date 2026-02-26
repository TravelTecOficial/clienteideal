/**
 * Persistência do modo preview do admin ao visualizar dashboard de cliente.
 * Note: UI-level. API deve validar permissões.
 */

const ADMIN_PREVIEW_COMPANY_KEY = "admin_preview_company_id"

export function getAdminPreviewCompanyId(): string | null {
  if (typeof sessionStorage === "undefined") return null
  return sessionStorage.getItem(ADMIN_PREVIEW_COMPANY_KEY)
}

export function setAdminPreviewCompanyId(companyId: string): void {
  sessionStorage?.setItem(ADMIN_PREVIEW_COMPANY_KEY, companyId)
}

export function clearAdminPreviewCompanyId(): void {
  sessionStorage?.removeItem(ADMIN_PREVIEW_COMPANY_KEY)
}
