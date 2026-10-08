import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatScore, formatDateBR } from "@/lib/utils";

// Exemplo de uma cor baseada na nota
function getScoreColor(score: number | null) {
  if (score == null) return "bg-surface-200 text-ink-500";
  if (score >= 80) return "bg-good-500 text-white";
  if (score >= 50) return "bg-warn-500 text-white";
  return "bg-bad-500 text-white";
}

// Formatação monetária (pt-BR)
function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function HomePage() {
  // Busca os top 10 políticos do ranking técnico
  const topPoliticians = await prisma.score.findMany({
    where: { isCurrent: true, status: "OK", kind: "CUMULATIVE" },
    orderBy: { technical: "desc" },
    take: 10,
    include: {
      politician: {
        include: { party: true, office: true },
      },
    },
  });

  // Busca fatos recentes
  const recentFacts = await prisma.fact.findMany({
    where: { status: "PUBLICADO" },
    orderBy: { date: "desc" },
    take: 5,
    include: {
      politician: true,
    },
  });

  // Busca os maiores gastadores
  const topSpendersData = await prisma.expense.groupBy({
    by: ['politicianId'],
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 5
  });

  const spenderPoliticians = await prisma.politician.findMany({
    where: { id: { in: topSpendersData.map(s => s.politicianId) } },
    include: { party: true, office: true }
  });

  const topSpenders = topSpendersData.map(spend => {
    const pol = spenderPoliticians.find(p => p.id === spend.politicianId);
    return {
      politician: pol,
      totalSpent: spend._sum.amount || 0
    };
  }).filter(s => s.politician);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-16 bg-surface-100 dark:bg-surface-200 rounded-2xl shadow-sm px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-ink-900 mb-6 tracking-tight">
          O desempenho de quem te representa,<br className="hidden md:block" />
          <span className="text-brand-600">medido com dados reais.</span>
        </h1>
        <p className="text-lg text-ink-500 max-w-2xl mx-auto mb-8">
          Avaliamos deputados e senadores com base em produção legislativa, presença, gastos e integridade. Tudo baseado em fontes oficiais.
        </p>
        
        <form action="/ranking" method="GET" className="max-w-xl mx-auto flex gap-2">
          <input 
            type="text" 
            name="q"
            placeholder="Busque por deputado, senador ou estado..." 
            className="flex-1 px-4 py-3 rounded-lg border border-surface-200 bg-white dark:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-500 text-ink-900"
          />
          <button type="submit" className="px-6 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-500 transition-colors">
            Buscar
          </button>
        </form>
      </section>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left/Main Column: Ranking & Feeds */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* Top 10 Ranking */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-ink-900">
                🏆 Top 10 Melhores Pontuados
              </h2>
              <Link href="/ranking" className="text-brand-600 font-medium hover:underline text-sm">
                Ver Ranking Completo →
              </Link>
            </div>
            
            <div className="bg-white dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-200 text-ink-500 text-xs uppercase tracking-wider border-b border-surface-200">
                      <th className="px-6 py-3 font-medium">Posição</th>
                      <th className="px-6 py-3 font-medium">Político</th>
                      <th className="px-6 py-3 font-medium">Estado/Partido</th>
                      <th className="px-6 py-3 font-medium text-right">Nota Técnica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 text-sm">
                    {topPoliticians.map((score, idx) => (
                      <tr key={score.id} className="hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors">
                        <td className="px-6 py-4 font-bold text-ink-300">#{idx + 1}</td>
                        <td className="px-6 py-4 font-medium text-ink-900">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {score.politician.photoUrl ? (
                                <img src={score.politician.photoUrl} alt={score.politician.politicalName} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm">👤</span>
                              )}
                            </div>
                            <div>
                              <Link href={`/politico/${score.politician.id}`} className="hover:text-brand-600 block leading-tight">
                                {score.politician.politicalName}
                              </Link>
                              <span className="text-xs text-ink-500 block mt-0.5">
                                {score.politician.office?.slug === "senador" ? "🏛️ Senador" : "🏢 Dep. Federal"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-ink-500">
                          {score.politician.stateUf} • {score.politician.party?.acronym}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full font-bold text-xs ${getScoreColor(score.technical)}`}>
                            {formatScore(score.technical)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {topPoliticians.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-ink-500">
                          Nenhum dado disponível. Execute o seed para popular o banco.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Highlights Feed */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-ink-900">
              ⚡ Impacto e Acontecimentos em Tempo Real
            </h2>
            <div className="bg-white dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 p-6">
              <div className="space-y-8">
                {recentFacts.map(fact => (
                  <div key={fact.id} className="relative pl-6 border-l-2 border-brand-500">
                    <div className="absolute w-3 h-3 bg-brand-500 rounded-full -left-[7px] top-1 border-2 border-white dark:border-surface-100"></div>
                    <div className="flex gap-2 items-center text-xs font-semibold uppercase tracking-wide mb-1">
                      <span className="text-brand-600">{fact.category}</span>
                      <span className="text-ink-500">• {formatDateBR(fact.date)}</span>
                    </div>
                    <p className="text-base text-ink-900 leading-relaxed">
                      <Link href={`/politico/${fact.politician.id}`} className="font-bold hover:text-brand-600 mr-1">
                        {fact.politician.politicalName}
                      </Link>
                      {fact.title}
                    </p>
                    {fact.description && (
                      <p className="mt-2 text-sm text-ink-500 line-clamp-2">
                        {fact.description}
                      </p>
                    )}
                  </div>
                ))}
                {recentFacts.length === 0 && (
                  <div className="text-sm text-ink-500 italic">Nenhum fato recente.</div>
                )}
              </div>
              <div className="mt-8 text-center pt-6 border-t border-surface-200">
                <Link href="/feed" className="px-6 py-3 bg-surface-100 dark:bg-surface-200 text-ink-900 font-medium rounded-lg hover:bg-surface-200 transition-colors inline-block text-sm">
                  Acompanhar todo o histórico →
                </Link>
              </div>
            </div>
          </section>

          {/* Dinheiro Público Feed */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-ink-900">
              💰 Uso de Dinheiro Público (Maiores Gastos)
            </h2>
            <div className="bg-white dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-200 text-ink-500 text-xs uppercase tracking-wider border-b border-surface-200">
                      <th className="px-6 py-3 font-medium">Político</th>
                      <th className="px-6 py-3 font-medium">Cargo/Estado</th>
                      <th className="px-6 py-3 font-medium text-right">Total Gasto (Mandato)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 text-sm">
                    {topSpenders.map((spend) => (
                      <tr key={spend.politician!.id} className="hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors">
                        <td className="px-6 py-4 font-medium text-ink-900">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {spend.politician!.photoUrl ? (
                                <img src={spend.politician!.photoUrl!} alt={spend.politician!.politicalName} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm">👤</span>
                              )}
                            </div>
                            <Link href={`/politico/${spend.politician!.id}`} className="hover:text-brand-600 block leading-tight">
                              {spend.politician!.politicalName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-ink-500">
                          {spend.politician!.office?.slug === "senador" ? "Senador" : "Dep. Federal"} • {spend.politician!.stateUf}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-bold text-bad-600 dark:text-bad-500 text-base">
                            {formatCurrency(spend.totalSpent)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {topSpenders.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-ink-500">
                          Nenhum dado de gasto disponível.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

        </div>

        {/* Right Column: About FiscalizaI */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 bg-brand-900 text-white rounded-2xl shadow-lg p-8">
            <div className="text-3xl mb-4">👁️</div>
            <h3 className="text-2xl font-extrabold mb-4 leading-tight">
              Fiscalize quem você ajudou a eleger.
            </h3>
            <div className="space-y-4 text-brand-100 text-sm leading-relaxed">
              <p>
                O <strong>FiscalizaI</strong> é a sua ferramenta cívica para combater a desinformação e acompanhar de perto o trabalho real dos políticos brasileiros.
              </p>
              <p>
                Nosso objetivo é transformar dados abertos da Câmara e do Senado em um raio-X acessível, mostrando exatamente:
              </p>
              <ul className="list-disc pl-5 space-y-2 font-medium">
                <li>Projetos propostos e aprovados</li>
                <li>Presença em sessões</li>
                <li>Uso de dinheiro público</li>
                <li>Investigações e processos</li>
              </ul>
              <p className="pt-4 text-xs uppercase tracking-wider font-bold text-brand-200 border-t border-brand-700/50">
                100% Apartidário e Baseado em Dados Oficiais.
              </p>
            </div>
            <Link 
              href="/metodologia" 
              className="mt-8 block w-full text-center px-4 py-3 bg-white text-brand-900 font-bold rounded-xl hover:bg-brand-50 transition-colors"
            >
              Entenda nossa metodologia
            </Link>
          </div>
        </aside>

      </div>
    </div>
  );
}

