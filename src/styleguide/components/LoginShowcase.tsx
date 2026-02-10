import { LoginForm } from "@/components/login-form"

export function LoginShowcase() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Login Block</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Exemplo do bloco de login do shadcn/ui, renderizado dentro do styleguide
          para referência visual e de comportamento.
        </p>
      </div>

      <div className="max-w-sm rounded-[--radius] border border-border bg-card p-6">
        <LoginForm />
      </div>
    </div>
  )
}

