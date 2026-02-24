import { Link } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function PrecosPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex justify-between items-center gap-4 px-4 py-4 sm:px-6 lg:px-8 border-b border-border">
        <Link to="/" className="flex-shrink-0">
          <img
            src="/logo-cliente-ideal.png"
            alt="Cliente Ideal Online"
            className="h-10 md:h-12 w-auto object-contain"
          />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/entrar"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            to="/cadastrar"
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
          >
            Cadastrar
          </Link>
        </div>
      </header>

      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Bem-vindo ao Cliente Ideal</h1>
            <p className="mt-2 text-muted-foreground">Acesso ao sistema</p>
          </div>

          <Card className="mx-auto max-w-xl">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Bem-vindo ao Cliente Ideal</CardTitle>
              <CardDescription>Acesso ao sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Seu acesso está pronto. Clique abaixo para continuar.
              </p>
              <Link
                to="/cadastrar"
                className="mt-6 inline-block rounded-md bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
              >
                Acessar sistema
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
