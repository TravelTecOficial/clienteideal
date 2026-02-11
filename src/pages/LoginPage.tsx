import { SignIn } from "@clerk/clerk-react"
import { Link } from "react-router-dom"

export function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-sm flex-col items-center justify-center">
        <SignIn 
          path="/entrar" 
          routing="path" 
          signUpUrl="/cadastrar"
          forceRedirectUrl="/dashboard"
        />
      </div>
      <Link
        to="/"
        className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Voltar à página inicial
      </Link>
    </main>
  )
}