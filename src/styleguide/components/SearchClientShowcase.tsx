export function SearchClientShowcase() {
  return (
    <div className="p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Buscar cliente ideal</h1>
      
      <div className="bg-card p-6 rounded-[--radius] border border-border max-w-sm">
        <h2 className="text-lg font-semibold mb-2">Buscar cliente ideal</h2>
        <p className="text-muted-foreground text-sm mb-4">Digite um termo para iniciar a busca.</p>
        
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Palavra-chave</label>
            <input 
              type="text" 
              className="bg-background border border-input p-2 rounded-md" 
              placeholder="Ex: marketing B2B..." 
            />
          </div>
          <button className="bg-primary text-primary-foreground w-full py-2 rounded-md font-medium hover:opacity-90">
            Buscar
          </button>
        </div>
      </div>
    </div>
  )
}