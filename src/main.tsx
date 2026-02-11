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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={publishableKey}
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
