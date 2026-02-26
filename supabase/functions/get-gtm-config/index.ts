/**
 * Edge Function: get-gtm-config
 *
 * Retorna a configuração do Google Tag Manager (gtm_head, gtm_body).
 * GET sem autenticação - endpoint público para injeção nos scripts da aplicação.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Método não permitido." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6987ee'},body:JSON.stringify({sessionId:'6987ee',location:'get-gtm-config:32',message:'Environment variables check (Hypothesis A)',data:{supabaseUrl:!!supabaseUrl, supabaseServiceKey:!!supabaseServiceKey},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from("admin_gtm_config")
    .select("gtm_head, gtm_body")
    .limit(1)
    .maybeSingle()
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6987ee'},body:JSON.stringify({sessionId:'6987ee',location:'get-gtm-config:47',message:'Supabase query result (Hypothesis C)',data:{hasData:!!data, hasError:!!error},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6987ee'},body:JSON.stringify({sessionId:'6987ee',location:'get-gtm-config:50',message:'Supabase query error (Hypothesis C)',data:{errorMessage:error.message},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const row = data as { gtm_head: string | null; gtm_body: string | null } | null
  return new Response(
    JSON.stringify({
      gtm_head: row?.gtm_head ?? null,
      gtm_body: row?.gtm_body ?? null,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
