/**
 * Utilitário para identificar o admin do SaaS (Clerk publicMetadata.role === "admin").
 * Diferente do admin do cliente (profiles.role no Supabase), o admin do SaaS
 * gerencia todo o sistema.
 *
 * Note: UI-level check only. API enforcement required.
 */

export function isSaasAdmin(
  publicMetadata: Record<string, unknown> | undefined
): boolean {
  return publicMetadata?.role === "admin"
}

/**
 * Indica se a aplicação está rodando em localhost.
 * Em localhost, não redirecionamos para /admin para permitir testar o fluxo de usuário.
 * O admin pode acessar /admin manualmente se necessário.
 */
export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false
  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]"
}
