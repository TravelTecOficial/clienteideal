import { useClerk, useSignUp } from "@clerk/clerk-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
            Crie sua conta com email e senha
          </p>
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
