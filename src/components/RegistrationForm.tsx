import React from "react"

export const RegistrationForm = () => {
  return (
    <section className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm sm:max-w-lg">
        <header className="mb-6 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cadastro
          </p>
          <h2 className="text-2xl font-semibold leading-tight text-foreground">
            Criar conta
          </h2>
          <p className="text-sm text-muted-foreground">
            Preencha os dados abaixo para começar a usar a plataforma.
          </p>
        </header>

        <form className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground"
            >
              Nome completo
            </label>
            <input
              type="text"
              id="name"
              placeholder="Digite seu nome"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              E-mail
            </label>
            <input
              type="email"
              id="email"
              placeholder="seu@email.com"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Senha
            </label>
            <input
              type="password"
              id="password"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            Finalizar cadastro
          </button>
        </form>
      </div>
    </section>
  )
};