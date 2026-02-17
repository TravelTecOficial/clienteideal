import { createContext, useContext, type ReactNode } from "react"

interface CompanyPreviewContextValue {
  companyId: string | null
}

const CompanyPreviewContext = createContext<CompanyPreviewContextValue>({
  companyId: null,
})

export function CompanyPreviewProvider({
  companyId,
  children,
}: {
  companyId: string | null
  children: ReactNode
}) {
  return (
    <CompanyPreviewContext.Provider value={{ companyId }}>
      {children}
    </CompanyPreviewContext.Provider>
  )
}

export function useCompanyPreview() {
  return useContext(CompanyPreviewContext)
}
