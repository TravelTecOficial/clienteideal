import { Link, useLocation, Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"
import { navigation } from "./navigation"

export function StyleguideLayout() {
  const location = useLocation()

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed left-0 top-0 z-30 h-screen w-64 border-r border-border bg-card">
        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((section) => (
            <div key={section.title} className="mb-4">
              <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h2>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 pl-64">
        <Outlet />
      </main>
    </div>
  )
}
