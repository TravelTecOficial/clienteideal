import { Suspense, Component, type ReactNode } from "react"
import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import { StyleguideLayout } from "@/styleguide/StyleguideLayout"
import { StyleguidePage } from "@/styleguide/StyleguidePage"
import { componentShowcases, blockShowcases } from "@/styleguide/registry"
import { CardComInput } from "@/components/CardComInput"
import { RegistrationForm } from "@/components/RegistrationForm"

function HomePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row">
        <section className="flex flex-1 flex-col items-start justify-center gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Cliente Ideal
            </h1>
            <p className="max-w-md text-sm text-muted-foreground sm:text-base">
              Encontre, cadastre e gerencie seus clientes ideais com uma
              experiência simples e visualmente consistente.
            </p>
          </div>

          <Link
            to="/styleguide"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ir para Design System (Styleguide)
          </Link>

          <div className="mt-4 max-w-md">
            <CardComInput />
          </div>
        </section>

        <section className="flex flex-1 items-center">
          <RegistrationForm />
        </section>
      </div>
    </main>
  )
}

/** Fallback enquanto o showcase lazy carrega. */
function ShowcaseFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center p-8 text-muted-foreground">
      Carregando…
    </div>
  )
}

/** Captura erros de lazy load ou render do showcase (evita tela branca). */
class ShowcaseErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-destructive">
            <p className="font-medium">Erro ao carregar o componente</p>
            <pre className="max-w-2xl overflow-auto rounded bg-muted p-3 text-xs">
              {this.state.error.message}
            </pre>
          </div>
        )
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
        <Route path="/styleguide" element={<StyleguideLayout />}>
          <Route index element={<StyleguidePage />} />
          {componentShowcases.map(({ path, Component: ShowcaseComponent }) => (
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
          {blockShowcases.map(({ path, Component: ShowcaseComponent }) => (
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
