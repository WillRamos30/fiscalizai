export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-ink-900 tracking-tight">Painel Administrativo</h1>
        <p className="text-ink-500 mt-1">Gerencie a plataforma, importações e avaliações.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Sincronização (ETL)</h2>
          <p className="text-sm text-ink-500 mb-4">Execute a coleta de dados e importação de fontes oficiais.</p>
          <button className="w-full py-2 bg-brand-600 text-white rounded-md font-medium text-sm hover:bg-brand-500 transition-colors">
            Forçar Sincronização
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Motor de Pontuação</h2>
          <p className="text-sm text-ink-500 mb-4">Recalcule as notas de todos os políticos com a versão atual.</p>
          <button className="w-full py-2 bg-brand-600 text-white rounded-md font-medium text-sm hover:bg-brand-500 transition-colors">
            Recalcular Notas
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-ink-900 mb-2">Auditoria</h2>
          <p className="text-sm text-ink-500 mb-4">Visualize os logs do sistema e alterações manuais.</p>
          <button className="w-full py-2 border border-surface-200 text-ink-700 rounded-md font-medium text-sm hover:bg-surface-50 transition-colors">
            Ver Logs
          </button>
        </div>
      </div>
    </div>
  );
}
