import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react"

/**
 * Página de callback após OAuth (ex.: Google). O Clerk redireciona aqui
 * após o provedor autenticar; o componente conclui o sign-in e redireciona.
 * redirectUrlComplete é passado em LoginPage.authenticateWithRedirect().
 * Note: UI-level only. API enforcement required.
 */
export function SSOCallbackPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="text-muted-foreground">Concluindo login…</div>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/planos"
      />
    </main>
  )
}
