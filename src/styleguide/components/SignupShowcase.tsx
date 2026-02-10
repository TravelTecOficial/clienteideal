import { SignupForm } from "@/components/signup-form"

export function SignupShowcase() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Signup Block</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Exemplo do bloco de cadastro (signup) do shadcn/ui, renderizado dentro
          do styleguide para referência visual e de comportamento.
        </p>
      </div>

      <div className="max-w-sm rounded-[--radius] border border-border bg-card p-6">
        <SignupForm />
      </div>
    </div>
  )
}
