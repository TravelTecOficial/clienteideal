import { useClerk, useSignUp } from "@clerk/clerk-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SSO_CALLBACK_PATH = "/entrar/sso-callback"

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function SignupPage() {
  const { signUp, isLoaded } = useSignUp()
  const { setActive } = useClerk()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signUp || !isLoaded) return
    setError(null)
    setLoading(true)
    try {
      await signUp.create({
        emailAddress: email,
        password,
      })
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      })
      setVerifying(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar. Tente outro email."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signUp || !isLoaded || !setActive) return
    setError(null)
    setLoading(true)
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      })
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        navigate("/planos", { replace: true })
        return
      }
      setError("Verificação não concluída. Confira o código.")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Código inválido. Tente novamente."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSignUpWithGoogle = async () => {
    if (!signUp || !isLoaded) return
    setError(null)
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}${SSO_CALLBACK_PATH}`,
        redirectUrlComplete: "/planos",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar com Google.")
    }
  }

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="text-muted-foreground">Carregando…</div>
      </main>
    )
  }

  if (verifying) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold">Verificar email</h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um código para {email}. Digite abaixo.
            </p>
          </div>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={loading}
                className="h-10"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verificando…" : "Verificar"}
            </Button>
          </form>
        </div>
        <Link
          to="/"
          className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Voltar à página inicial
        </Link>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Cadastrar</h1>
          <p className="text-sm text-muted-foreground">
            Crie sua conta com email e senha ou Google
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
          <button
            type="button"
            onClick={handleSignUpWithGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-input bg-white px-4 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <GoogleIcon />
            Cadastrar com Google
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <span className="flex-1 border-t border-border" />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={loading}
              className="h-10"
              minLength={8}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando…" : "Continuar"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
      <Link
        to="/"
        className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Voltar à página inicial
      </Link>
    </main>
  )
}
