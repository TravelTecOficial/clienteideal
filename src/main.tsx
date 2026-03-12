import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ClerkProvider } from "@clerk/clerk-react"
import "./index.css"
import App from "./App.tsx"

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!publishableKey) {
  throw new Error(
    "VITE_CLERK_PUBLISHABLE_KEY é obrigatório. Configure em .env"
  )
}

// Clerk em dev: script via proxy (mesmo origin). Default 5.x = UI estável; use VITE_CLERK_JS_VERSION=6 no .env se o dashboard exigir.
// Opcional: VITE_CLERK_JS_URL para URL absoluta; VITE_CLERK_JS_VERSION no .env para versão no proxy (vite.config).
const clerkJSUrl =
  import.meta.env.VITE_CLERK_JS_URL ||
  (import.meta.env.DEV && publishableKey.startsWith("pk_test_")
    ? `${window.location.origin}/clerk-js-dist/clerk.browser.js`
    : undefined)

// Em dev, se VITE_CLERK_FAPI estiver definida, as chamadas à Frontend API passam pelo proxy do Vite (evita CORS/530).
const clerkProxyUrl =
  import.meta.env.DEV && import.meta.env.VITE_CLERK_FAPI
    ? `${window.location.origin}/clerk-fapi`
    : undefined

// Meta SDK: inicializa FB para WhatsApp Embedded Signup (appId é público, seguro no client)
const metaAppId = import.meta.env.VITE_META_APP_ID as string | undefined
if (metaAppId) {
  ;(window as unknown as { fbAsyncInit?: () => void }).fbAsyncInit = function () {
    const FB = (window as unknown as { FB?: { init: (opts: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void } }).FB
    if (FB) FB.init({ appId: metaAppId, cookie: true, xfbml: true, version: "v21.0" })
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={publishableKey}
      clerkJSUrl={clerkJSUrl}
      clerkJSVariant="headless"
      proxyUrl={clerkProxyUrl}
      appearance={{
        variables: {
          colorPrimary: "hsl(var(--primary))",
          colorForeground: "hsl(var(--foreground))",
        },
      }}
    >
      <App />
    </ClerkProvider>
  </StrictMode>
)
