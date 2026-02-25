/**
 * GtmInjector: busca a configuração do GTM e injeta os scripts no head/body.
 * Executa uma vez na montagem. Sem UI.
 * Note: UI-level injection only. Backend validates content contains googletagmanager.com.
 */

import { useEffect, useRef } from "react"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase"

const GTM_ALLOWED_DOMAIN = "googletagmanager.com"

function isValidGtmContent(value: string | null | undefined): boolean {
  if (!value || value.trim() === "") return false
  return value.includes(GTM_ALLOWED_DOMAIN)
}

/** Extrai o conteúdo JavaScript de uma tag <script>...</script> */
function extractScriptContent(html: string): string {
  const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
  return match ? match[1].trim() : html.trim()
}

export function GtmInjector() {
  const injectedRef = useRef(false)

  useEffect(() => {
    if (injectedRef.current) return
    injectedRef.current = true

    const run = async () => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-gtm-config`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        })
        if (!res.ok) return

        const data = (await res.json()) as {
          gtm_head?: string | null
          gtm_body?: string | null
        }

        const gtm_head = data?.gtm_head
        const gtm_body = data?.gtm_body

        if (gtm_head && isValidGtmContent(gtm_head)) {
          const scriptContent = extractScriptContent(gtm_head)
          const script = document.createElement("script")
          script.textContent = scriptContent
          script.async = true
          document.head.appendChild(script)
        }

        if (gtm_body && isValidGtmContent(gtm_body)) {
          const wrapper = document.createElement("div")
          wrapper.innerHTML = gtm_body
          const firstChild = wrapper.firstElementChild
          if (firstChild) {
            document.body.insertBefore(firstChild, document.body.firstChild)
          }
        }
      } catch {
        // Silently fail - GTM is non-critical
      }
    }

    run()
  }, [])

  return null
}
