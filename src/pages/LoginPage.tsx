import { useAuth, useClerk, useSignIn } from "@clerk/clerk-react"
import { useState } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { ChevronRight, ThumbsUp } from "lucide-react"

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

export function LoginPage() {
  const { isSignedIn: isAuthSignedIn, isLoaded: isAuthLoaded } = useAuth()
  const { signIn, isLoaded } = useSignIn()
  const { setActive } = useClerk()
  const navigate = useNavigate()
  const location = useLocation()

  const searchParams = new URLSearchParams(location.search)
  const redirectParam = searchParams.get("redirect")
  const previewParam = searchParams.get("preview")
  const fromState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
  const redirectFromState = fromState?.pathname ? `${fromState.pathname}${fromState.search ?? ""}` : null
  const redirectTarget =
    redirectParam ||
    redirectFromState ||
    (previewParam ? `/dashboard?preview=${encodeURIComponent(previewParam)}` : "/dashboard")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"email" | "password" | "code">("email")
  const [emailAddressId, setEmailAddressId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleContinueWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signIn || !isLoaded || !email.trim()) return
    setError(null)
    setLoading(true)
    try {
      const result = await signIn.create({ identifier: email.trim() })
      if (result.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId })
        navigate(redirectTarget, { replace: true })
        return
      }
      if (result.status === "needs_second_factor" || result.status === "needs_client_trust") {
        const emailCodeFactor = result.supportedSecondFactors?.find(
          (f): f is { strategy: "email_code"; emailAddressId: string } => f.strategy === "email_code"
        )
        if (emailCodeFactor) {
          await signIn.prepareSecondFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          })
          setEmailAddressId(emailCodeFactor.emailAddressId)
          setStep("code")
        } else {
          setError("Verificação adicional necessária.")
        }
        return
      }
      if (result.status === "needs_first_factor") {
        setStep("password")
        setError(null)
        return
      }
      setError("Tente novamente.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signIn || !isLoaded || !setActive) return
    setError(null)
    setLoading(true)
    try {
      const result = await signIn.attemptFirstFactor({ strategy: "password", password })
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        navigate(redirectTarget, { replace: true })
        return
      }
      if (result.status === "needs_second_factor" || result.status === "needs_client_trust") {
        const emailCodeFactor = result.supportedSecondFactors?.find(
          (f): f is { strategy: "email_code"; emailAddressId: string } => f.strategy === "email_code"
        )
        if (emailCodeFactor) {
          await signIn.prepareSecondFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          })
          setEmailAddressId(emailCodeFactor.emailAddressId)
          setStep("code")
        } else {
          setError("Verificação adicional necessária.")
        }
        return
      }
      setError("Senha incorreta. Tente novamente.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signIn || !isLoaded || !setActive) return
    setError(null)
    setLoading(true)
    try {
      const result = await signIn.attemptSecondFactor({ strategy: "email_code", code })
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        navigate(redirectTarget, { replace: true })
        return
      }
      setError("Código inválido. Tente novamente.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.")
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!signIn || !emailAddressId) return
    setError(null)
    setLoading(true)
    try {
      await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reenviar.")
    } finally {
      setLoading(false)
    }
  }

  const handleSignInWithGoogle = async () => {
    if (!signIn || !isLoaded) return
    setError(null)
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}${SSO_CALLBACK_PATH}`,
        redirectUrlComplete: redirectTarget,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar com Google.")
    }
  }

  const handleBack = () => {
    if (typeof signIn?.reset === "function") signIn.reset()
    setStep("email")
    setPassword("")
    setCode("")
    setEmailAddressId(null)
    setError(null)
  }

  if (!isLoaded || !isAuthLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F9F7F5]">
        <div className="text-muted-foreground">Carregando…</div>
      </main>
    )
  }

  if (isAuthSignedIn) {
    return <Navigate to={redirectTarget} replace />
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F5] px-4 py-8">
      <div className="w-full max-w-[400px] rounded-xl bg-white p-8 shadow-sm">
        {/* Logo / brand */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <ThumbsUp className="h-6 w-6 text-[#6B8E4C]" aria-hidden />
          <span className="text-lg font-semibold tracking-wide text-[#2D3748]">
            CLIENTE IDEAL
          </span>
        </div>
        <h1 className="text-center text-xl font-bold text-gray-900">
          Sign in to Cliente Ideal
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          Welcome back! Please sign in to continue
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleSignInWithGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-500">or</span>
            <span className="flex-1 border-t border-gray-200" />
          </div>

          {step === "email" && (
            <form onSubmit={handleContinueWithEmail} className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={loading}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#6B8E4C] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#5a7d3d] disabled:opacity-50"
              >
                {loading ? "Loading…" : "Continue"}
                <ChevronRight className="h-4 w-4 text-white" aria-hidden />
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handleSubmitPassword} className="space-y-4">
              <p className="text-sm text-gray-600">Digite sua senha para {email}</p>
              <label className="block text-sm font-medium text-gray-700">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                required
                disabled={loading}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#6B8E4C] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#5a7d3d] disabled:opacity-50"
              >
                {loading ? "Entrando…" : "Continue"}
              </button>
              <button
                type="button"
                onClick={handleBack}
                className="w-full text-sm text-gray-500 hover:underline"
              >
                Voltar
              </button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-sm text-gray-600">Enviamos um código para seu email.</p>
              <label className="block text-sm font-medium text-gray-700">Código</label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                required
                disabled={loading}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#6B8E4C] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#5a7d3d] disabled:opacity-50"
              >
                {loading ? "Verificando…" : "Verificar"}
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="w-full text-sm text-gray-500 hover:underline"
              >
                Reenviar código
              </button>
              <button
                type="button"
                onClick={handleBack}
                className="w-full text-sm text-gray-500 hover:underline"
              >
                Voltar ao login
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link to="/cadastrar" className="font-medium text-[#6B8E4C] hover:underline">
            Sign up
          </Link>
        </p>

        <p className="mt-6 text-center text-xs text-gray-400">
          Secured by Clerk
        </p>
      </div>

      <Link
        to="/"
        className="mt-8 text-sm text-gray-500 underline-offset-4 hover:underline"
      >
        Voltar à página inicial
      </Link>
    </main>
  )
}
