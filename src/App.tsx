import { Suspense, Component, type ReactNode } from "react"
import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AdminPage } from "@/pages/AdminPage"
import { AdminConfigPage } from "@/pages/AdminConfigPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { Planos } from "@/pages/Planos"
import VendedoresPage from "@/pages/vendedores"
import { ClienteIdealPage } from "@/pages/ClienteIdealPage"
import { QualificadorPage } from "@/pages/QualificadorPage"
import { LeadsPage } from "@/pages/LeadsPage"
import { OportunidadesPage } from "@/pages/OportunidadesPage"
import { AgendaPage } from "@/pages/AgendaPage"
import { AtendimentosPage } from "@/pages/AtendimentosPage"
import { BaseConhecimentoPage } from "@/pages/BaseConhecimentoPage"
import { ProdutosServicosPage } from "@/pages/ProdutosServicosPage"
import { SupabaseProvider } from "@/lib/supabase-context"
import { StyleguideLayout } from "@/styleguide/StyleguideLayout"
import { StyleguidePage } from "@/styleguide/StyleguidePage"
import { componentShowcases, blockShowcases } from "@/styleguide/registry"

function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex justify-end items-center gap-2 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/entrar"
          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Entrar
        </Link>
        <Link
          to="/cadastrar"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          Cadastrar
        </Link>
      </header>
    </main>
  )
}

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
      <Routes>
        <Route path="/" element={<HomePage />} />
        
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
          path="/dashboard/produtos-servicos"
          element={
            <SupabaseProvider>
              <ProtectedRoute>
                <ProdutosServicosPage />
              </ProtectedRoute>
            </SupabaseProvider>
          }
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