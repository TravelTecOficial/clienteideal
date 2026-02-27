import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { clearAdminPreviewCompanyId } from "@/lib/admin-preview-storage"

/**
 * Faixa fixa no topo quando admin visualiza dashboard de cliente.
 * Persiste durante toda a navegação no dashboard.
 * Note: UI-level. Exibido apenas quando sessionStorage indica modo preview.
 */
export function AdminPreviewBanner() {
  const handleBack = () => {
    clearAdminPreviewCompanyId()
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex min-h-10 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-red-300 bg-red-50 px-4 py-2 text-red-800">
      <span className="text-sm font-medium">
        Modo suporte ativo: você está acessando esta licença via painel administrativo.
      </span>
      <Link
        to="/admin"
        onClick={handleBack}
        className="flex shrink-0 items-center gap-2 text-sm font-semibold hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar para o Admin
      </Link>
    </div>
  )
}
