import * as React from "react"

export interface NavItem {
  name: string
  href: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const FOUNDATION_ITEMS: NavItem[] = [
  { name: "Design Tokens", href: "/styleguide" },
]

export interface ComponentShowcaseEntry {
  name: string
  path: string
  Component: React.LazyExoticComponent<React.ComponentType<unknown>>
}

const STYLEGUIDE_BASE = "/styleguide"

function lazyShowcase(
  factory: () => Promise<{ default: React.ComponentType<unknown> }>
): React.LazyExoticComponent<React.ComponentType<unknown>> {
  return React.lazy(factory)
}

export const componentShowcases: ComponentShowcaseEntry[] = [
  {
    name: "Table",
    path: "components/table",
    Component: lazyShowcase(() =>
      import("@/styleguide/components/TableShowcase").then((m) => ({ default: m.TableShowcase }))
    ),
  },
  {
    name: "Bar Chart",
    path: "components/bar-chart",
    Component: lazyShowcase(() =>
      import("@/styleguide/components/BarChartShowcase").then((m) => ({ default: m.BarChartShowcase }))
    ),
  },
  {
    name: "Accordion",
    path: "components/accordion",
    Component: lazyShowcase(() =>
      import("@/styleguide/components/AccordionShowcase").then((m) => ({ default: m.AccordionShowcase }))
    ),
  },
  {
    name: "Card",
    path: "components/card",
    Component: lazyShowcase(() =>
      import("@/styleguide/components/CardShowcase").then((m) => ({ default: m.CardShowcase }))
    ),
  },
  {
    name: "Search Client",
    path: "components/search-client",
    Component: lazyShowcase(() =>
      import("@/styleguide/components/SearchClientShowcase").then((m) => ({ 
        default: m.SearchClientShowcase 
      }))
    ),
  },
  {
    name: "Calendar",
    path: "components/calendar",
    Component: lazyShowcase(() =>
      import("@/styleguide/components/CalendarShowcase").then((m) => ({
        default: m.CalendarShowcase,
      }))
    ),
  },
]

export const blockShowcases: ComponentShowcaseEntry[] = [
  {
    name: "Login",
    path: "blocks/login",
    Component: lazyShowcase(() =>
      import("@/styleguide/components/LoginShowcase").then((m) => ({
        default: m.LoginShowcase,
      }))
    ),
  },
  {
    name: "Signup",
    path: "blocks/signup",
    Component: lazyShowcase(() =>
      import("@/styleguide/components/SignupShowcase").then((m) => ({
        default: m.SignupShowcase,
      }))
    ),
  },
]

export const navigation: NavSection[] = [
  { title: "Foundation", items: FOUNDATION_ITEMS },
  {
    title: "Components",
    items: componentShowcases.map(({ name, path }) => ({
      name,
      href: `${STYLEGUIDE_BASE}/${path}`,
    })),
  },
  {
    title: "Blocks",
    items: blockShowcases.map(({ name, path }) => ({
      name,
      href: `${STYLEGUIDE_BASE}/${path}`,
    })),
  },
]