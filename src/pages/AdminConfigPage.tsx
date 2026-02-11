import { useUser } from "@clerk/clerk-react"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin-layout"
import { isSaasAdmin } from "@/lib/use-saas-admin"

export function AdminConfigPage() {
  const { isLoaded, isSignedIn, user } = useUser()

  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/entrar" replace />
  if (!isSaasAdmin(user?.publicMetadata as Record<string, unknown>)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AdminLayout breadcrumb={{ label: "Configurações" }}>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Configurações</CardTitle>
          <CardDescription className="text-muted-foreground">
            Configurações da conta administrativa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Em breve você poderá configurar preferências da conta admin.
          </p>
        </CardContent>
      </Card>
    </AdminLayout>
  )
}
