import { ShieldAlert } from "lucide-react"

/**
 * Banner para informar que o acesso de suporte está habilitado na licença.
 * Note: UI-level only. A autorização real deve ser aplicada no backend.
 */
export function SupportAccessBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[95] flex min-h-10 items-center justify-center gap-2 border-b border-red-300 bg-red-50 px-4 py-2 text-red-800">
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
      <span className="text-sm font-medium">
        Atenção: o acesso de suporte da Cliente Ideal está habilitado para esta licença.
      </span>
    </div>
  )
}
