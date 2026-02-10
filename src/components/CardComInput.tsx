import { useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function CardComInput() {
  const [valor, setValor] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Note: UI-level check only. API enforcement required.
    console.log("Valor enviado:", valor)
  }

  return (
    <Card className="max-w-sm w-full">
      <CardHeader>
        <CardTitle>Buscar cliente ideal</CardTitle>
        <CardDescription>
          Digite um termo para iniciar a busca.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="cliente-input"
              className="text-sm font-medium text-foreground"
            >
              Palavra‑chave
            </label>
            <input
              id="cliente-input"
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Ex: marketing B2B, e-commerce..."
            />
          </div>

          <CardFooter className="px-0 pb-0">
            <Button type="submit" className="w-full">
              Buscar
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  )
}

