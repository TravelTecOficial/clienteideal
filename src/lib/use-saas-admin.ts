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
