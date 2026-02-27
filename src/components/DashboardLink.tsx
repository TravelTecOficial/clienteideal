import { Link, type LinkProps } from "react-router-dom"
import { useCompanyPreview } from "@/lib/company-preview-context"
import { getAdminPreviewCompanyId } from "@/lib/admin-preview-storage"

/**
 * Link para /dashboard que preserva ?preview=companyId quando em modo preview do admin.
 */
export function DashboardLink({ children, ...props }: Omit<LinkProps, "to">) {
  const { companyId } = useCompanyPreview()
  const storageId = getAdminPreviewCompanyId()
  const previewId = companyId ?? storageId
  const href = previewId ? `/dashboard?preview=${encodeURIComponent(previewId)}` : "/dashboard"
  return (
    <Link to={href} {...props}>
      {children}
    </Link>
  )
}
