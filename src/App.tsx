import { Suspense, Component, type ReactNode } from "react"
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { DashboardRouteWrapper } from "@/components/DashboardRouteWrapper"
import { AdminPage } from "@/pages/admin/AdminPage"
import { AdminConfigPage } from "@/pages/admin/AdminConfigPage"
import PrecificacaoPage from "@/pages/admin/precificacao"
import { AdminEvolutionPage } from "@/pages/admin/AdminEvolutionPage"
import { AdminGtmPage } from "@/pages/admin/AdminGtmPage"
import { AdminPreviewPage } from "@/pages/admin/AdminPreviewPage"
import { AdminPersonasPage } from "@/pages/admin/AdminPersonasPage"
import { AdminQualificacaoPage } from "@/pages/admin/AdminQualificacaoPage"
import { AdminBriefingPage } from "@/pages/admin/AdminBriefingPage"
import { AdminPromptTemplatesPage } from "@/pages/admin/prompt-templates"
import { TemplateFormPage } from "@/pages/admin/prompt-templates/TemplateFormPage"
import { DashboardPage } from "@/pages/dashboard/DashboardPage"
import { ProfilePage } from "@/pages/dashboard/ProfilePage"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { Planos } from "@/pages/Planos"
import VendedoresPage from "@/pages/dashboard/vendedores"
import { ClienteIdealPage } from "@/pages/dashboard/ClienteIdealPage"
import { ClienteIdealFormPage } from "@/pages/dashboard/ideal-customer/ClienteIdealFormPage"
import { ClienteIdealContextLayout } from "@/pages/dashboard/cliente-ideal-context/ClienteIdealContextLayout"
import { PromptContextualTab } from "@/pages/dashboard/cliente-ideal-context/PromptContextualTab"
import { QualificadorContextualTab } from "@/pages/dashboard/cliente-ideal-context/QualificadorContextualTab"
import { ChatContextualTab } from "@/pages/dashboard/cliente-ideal-context/ChatContextualTab"
import { CampanhasContextualTab } from "@/pages/dashboard/cliente-ideal-context/CampanhasContextualTab"
import { DashboardContextualTab } from "@/pages/dashboard/cliente-ideal-context/DashboardContextualTab"
import { LeadsPage } from "@/pages/dashboard/LeadsPage"
import { LeadFormPage } from "@/pages/dashboard/leads/LeadFormPage"
import { OportunidadesPage } from "@/pages/dashboard/OportunidadesPage"
import { AgendaPage } from "@/pages/dashboard/AgendaPage"
import { AtendimentosPage } from "@/pages/dashboard/AtendimentosPage"
import { BaseConhecimentoPage } from "@/pages/dashboard/BaseConhecimentoPage"
import { ProdutosServicosPage } from "@/pages/dashboard/ProdutosServicosPage"
import { ConfiguracoesLayout } from "@/pages/dashboard/ConfiguracoesLayout"
import ConsorcioPage from "@/pages/dashboard/consorcio"
import { IndicadoresPage } from "@/pages/dashboard/IndicadoresPage"
import { SocialHubPage } from "@/pages/dashboard/SocialHubPage"
import { GMBLocalPage } from "@/pages/dashboard/GMBLocalPage"
import { SupabaseProvider } from "@/lib/supabase-context"
import { Toaster } from "@/components/ui/toast"
import { StyleguideLayout } from "@/styleguide/StyleguideLayout"
import { StyleguidePage } from "@/styleguide/StyleguidePage"
import { componentShowcases, blockShowcases } from "@/styleguide/registry"
import { LandingPage } from "@/pages/LandingPage"
import { PrecosPage } from "@/pages/PrecosPage"
import { PoliticaPrivacidadePage } from "@/pages/PoliticaPrivacidadePage"
import { TermosUsoPage } from "@/pages/TermosUsoPage"
import { GtmInjector } from "@/components/GtmInjector"
import { MetaInstagramCallbackPage } from "@/pages/auth/MetaInstagramCallbackPage"
import { WhatsappFacebookCallbackPage } from "@/pages/auth/WhatsappFacebookCallbackPage"
import { GoogleOAuthCallbackPage } from "@/pages/auth/GoogleOAuthCallbackPage"
import { SSOCallbackPage } from "@/pages/auth/SSOCallbackPage"

function ShowcaseFallback() {
  return <div className="flex min-h-[200px] items-center justify-center p-8 text-muted-foreground">Carregando…</div>
}

class ShowcaseErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error?: Error }> {
  state = { hasError: false, error: undefined as Error | undefined }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback ?? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-destructive">
          <p className="font-medium">Erro ao carregar o componente</p>
          <pre className="max-w-2xl overflow-auto rounded bg-muted p-3 text-xs">{this.state.error.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <GtmInjector />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/precos" element={<PrecosPage />} />
        <Route path="/politica-de-privacidade" element={<PoliticaPrivacidadePage />} />
        <Route path="/termos-de-uso" element={<TermosUsoPage />} />
        
        {/* Callback OAuth (ex.: Google) — rota mais específica antes de /entrar/* */}
        <Route path="/entrar/sso-callback" element={<SSOCallbackPage />} />
        {/* Note o /* necessário para o Clerk funcionar em sub-rotas */}
        <Route path="/entrar/*" element={<LoginPage />} />
        <Route path="/cadastrar/*" element={<SignupPage />} />

        <Route
          path="/auth/meta/callback"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <MetaInstagramCallbackPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/auth/facebook/callback"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <WhatsappFacebookCallbackPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/auth/google/callback"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <GoogleOAuthCallbackPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/planos"
          element={
            <SupabaseProvider>
              <Planos />
            </SupabaseProvider>
          }
        />
        
        <Route
          path="/dashboard"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <DashboardPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/perfil"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <ProfilePage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/vendedores"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <VendedoresPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/cliente-ideal"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <ClienteIdealPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/cliente-ideal/:id"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <ClienteIdealContextLayout />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        >
          <Route index element={<Navigate to="perfil" replace />} />
          <Route path="perfil" element={<ClienteIdealFormPage embedInLayout />} />
          <Route path="prompt" element={<PromptContextualTab />} />
          <Route path="qualificador" element={<QualificadorContextualTab />} />
          <Route path="chat" element={<ChatContextualTab />} />
          <Route path="campanhas" element={<CampanhasContextualTab />} />
          <Route path="dashboard" element={<DashboardContextualTab />} />
        </Route>
        <Route
          path="/dashboard/leads/novo"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <LeadFormPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/leads/:id"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <LeadFormPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/leads"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <LeadsPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/oportunidades"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <OportunidadesPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/agenda"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <AgendaPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/atendimentos"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <AtendimentosPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/base-conhecimento"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <BaseConhecimentoPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/social-hub"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <SocialHubPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/gmb-local"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <GMBLocalPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/items"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <ProdutosServicosPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/configuracoes"
          element={<Navigate to="/dashboard/configuracoes/empresa" replace />}
        />
        <Route
          path="/dashboard/configuracoes/:section"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <ConfiguracoesLayout />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/consorcio"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <ConsorcioPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/indicadores"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <DashboardRouteWrapper>
                  <IndicadoresPage />
                </DashboardRouteWrapper>
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/produtos-servicos"
          element={<Navigate to="/dashboard/items" replace />}
        />
        <Route
          path="/dashboard/qualificador"
          element={<Navigate to="/dashboard/cliente-ideal" replace />}
        />
        <Route
          path="/dashboard/chat-conhecimento"
          element={<Navigate to="/dashboard/cliente-ideal" replace />}
        />
        <Route
          path="/dashboard/prompt-atendimento"
          element={<Navigate to="/dashboard/cliente-ideal" replace />}
        />

        <Route
          path="/admin"
          element={
            <SupabaseProvider>
              <AdminPage />
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/configuracoes"
          element={
            <SupabaseProvider>
              <AdminConfigPage />
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/precificacao"
          element={
            <SupabaseProvider>
              <PrecificacaoPage />
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/evolution"
          element={
            <SupabaseProvider>
              <AdminEvolutionPage />
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/gtm"
          element={
            <SupabaseProvider>
              <AdminGtmPage />
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/preview/:companyId"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <AdminPreviewPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/personas"
          element={
            <SupabaseProvider>
              <AdminPersonasPage />
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/qualificacao"
          element={
            <SupabaseProvider>
              <AdminQualificacaoPage />
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/briefing"
          element={
            <SupabaseProvider>
              <AdminBriefingPage />
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/prompt-templates"
          element={
            <SupabaseProvider>
              <AdminPromptTemplatesPage />
            </SupabaseProvider>
          }
        />
        <Route
          path="/admin/prompt-templates/:id"
          element={
            <SupabaseProvider>
              <TemplateFormPage />
            </SupabaseProvider>
          }
        />

        <Route path="/styleguide" element={<StyleguideLayout />}>
          <Route index element={<StyleguidePage />} />
          {[...componentShowcases, ...blockShowcases].map(({ path, Component: ShowcaseComponent }) => (
            <Route
              key={path}
              path={path}
              element={
                <ShowcaseErrorBoundary>
                  <Suspense fallback={<ShowcaseFallback />}>
                    <ShowcaseComponent />
                  </Suspense>
                </ShowcaseErrorBoundary>
              }
            />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App