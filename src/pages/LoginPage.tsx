import { SignIn } from "@clerk/clerk-react"
import { Link, useLocation } from "react-router-dom"

export function LoginPage() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const redirectParam = searchParams.get("redirect")
  const previewParam = searchParams.get("preview")
  const fromState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
  const redirectFromState = fromState?.pathname
    ? `${fromState.pathname}${fromState.search ?? ""}`
    : null

  const redirectTarget =
    redirectParam ||
    redirectFromState ||
    (previewParam ? `/dashboard?preview=${encodeURIComponent(previewParam)}` : "/dashboard")

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ad401'},body:JSON.stringify({sessionId:'8ad401',runId:'cliente-ideal-post-fix',hypothesisId:'H6',location:'LoginPage.tsx:redirectTarget',message:'Login redirect target resolved',data:{redirectParam,redirectFromState,previewParam,redirectTarget,path:location.pathname,search:location.search},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-sm flex-col items-center justify-center">
        <SignIn 
          path="/entrar" 
          routing="path" 
          signUpUrl="/cadastrar"
          forceRedirectUrl={redirectTarget}
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