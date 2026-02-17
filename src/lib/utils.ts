import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formato de erro do Supabase/PostgREST */
interface PostgrestErrorLike {
  message?: string
  details?: string
  hint?: string
  code?: string
}

/**
 * Extrai mensagem de erro de exceções (Error, PostgrestError, etc).
 * Para PostgrestError, inclui details e hint quando disponíveis.
 * Útil para exibir erros do Supabase em toasts.
 */
export function getErrorMessage(err: unknown, fallback = "Erro desconhecido"): string {
  if (err instanceof Error) return err.message
  if (typeof err === "object" && err !== null) {
    const obj = err as PostgrestErrorLike
    const msg = typeof obj.message === "string" ? obj.message : fallback
    const parts: string[] = [msg]
    if (typeof obj.details === "string" && obj.details) parts.push(obj.details)
    if (typeof obj.hint === "string" && obj.hint) parts.push(obj.hint)
    return parts.join(" — ")
  }
  return fallback
}