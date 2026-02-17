import { Suspense, Component, type ReactNode } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AdminPage } from "@/pages/admin/AdminPage"
import { AdminConfigPage } from "@/pages/admin/AdminConfigPage"
import { AdminPreviewPage } from "@/pages/admin/AdminPreviewPage"
import { DashboardPage } from "@/pages/dashboard/DashboardPage"
import { ProfilePage } from "@/pages/dashboard/ProfilePage"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { Planos } from "@/pages/Planos"
import VendedoresPage from "@/pages/dashboard/vendedores"
import { ClienteIdealPage } from "@/pages/dashboard/ClienteIdealPage"
import { QualificadorPage } from "@/pages/dashboard/QualificadorPage"
import { LeadsPage } from "@/pages/dashboard/LeadsPage"
import { OportunidadesPage } from "@/pages/dashboard/OportunidadesPage"
import { AgendaPage } from "@/pages/dashboard/AgendaPage"
import { AtendimentosPage } from "@/pages/dashboard/AtendimentosPage"
import { BaseConhecimentoPage } from "@/pages/dashboard/BaseConhecimentoPage"
import { ChatConhecimentoPage } from "@/pages/dashboard/ChatConhecimentoPage"
import { ProdutosServicosPage } from "@/pages/dashboard/ProdutosServicosPage"
import { ConfiguracoesPage } from "@/pages/dashboard/ConfiguracoesPage"
import ConsorcioPage from "@/pages/dashboard/consorcio"
import { IndicadoresPage } from "@/pages/dashboard/IndicadoresPage"
import { SupabaseProvider } from "@/lib/supabase-context"
import { Toaster } from "@/components/ui/toast"
import { StyleguideLayout } from "@/styleguide/StyleguideLayout"
import { StyleguidePage } from "@/styleguide/StyleguidePage"
import { componentShowcases, blockShowcases } from "@/styleguide/registry"
import { LandingPage } from "@/pages/LandingPage"
import { PrecosPage } from "@/pages/PrecosPage"

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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/precos" element={<PrecosPage />} />
        
        {/* Note o /* necessário para o Clerk funcionar em sub-rotas */}
        <Route path="/entrar/*" element={<LoginPage />} />
        <Route path="/cadastrar/*" element={<SignupPage />} />
        
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
                <DashboardPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/perfil"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/vendedores"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <VendedoresPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/cliente-ideal"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <ClienteIdealPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/qualificador"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <QualificadorPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/leads"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <LeadsPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/oportunidades"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <OportunidadesPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/agenda"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <AgendaPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/atendimentos"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <AtendimentosPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/base-conhecimento"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <BaseConhecimentoPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/chat-conhecimento"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <ChatConhecimentoPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/items"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <ProdutosServicosPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/configuracoes"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <ConfiguracoesPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/consorcio"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <ConsorcioPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/indicadores"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <IndicadoresPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
        />
        <Route
          path="/dashboard/produtos-servicos"
          element={<Navigate to="/dashboard/items" replace />}
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
          path="/admin/preview/:companyId"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <AdminPreviewPage />
              </ProtectedRoute>
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