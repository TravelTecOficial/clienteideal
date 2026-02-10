import * as React from "react"

import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function CalendarShowcase() {
  const [date, setDate] = React.useState<Date | undefined>(new Date())

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Calendar
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Componente de calendário baseado em{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            react-day-picker
          </code>{" "}
          para seleção de datas no design system.
        </p>
      </div>

      <section className="grid gap-6 md:grid-cols-[minmax(0,_1fr)_minmax(0,_280px)]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Seleção simples</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border border-border bg-card"
            />
          </CardContent>
        </Card>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            O calendário usa tokens de cor (background, border, accent) e o
            componente <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              Button
            </code>{" "}
            para navegação entre meses.
          </p>
          <p>
            Data selecionada:{" "}
            <span className="font-medium text-foreground">
              {date ? date.toLocaleDateString() : "nenhuma data selecionada"}
            </span>
          </p>
        </div>
      </section>
    </div>
  )
}

