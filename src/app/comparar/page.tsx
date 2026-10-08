import { prisma } from "@/lib/db";
import { CompareSearch } from "@/components/CompareSearch";
import { CompareChart } from "@/components/CompareChart";
import Link from "next/link";
import { formatScore } from "@/lib/utils";

export default async function CompararPage(props: { searchParams: Promise<{ ids?: string }> }) {
  const searchParams = await props.searchParams;
  const ids = searchParams.ids ? searchParams.ids.split(",").filter(Boolean) : [];

  let politicians: any[] = [];
  if (ids.length > 0) {
    politicians = await prisma.politician.findMany({
      where: { id: { in: ids } },
      include: {
        party: true,
        office: true,
        scores: {
          where: { isCurrent: true },
          include: { components: true },
        }
      }
    });

    // Reorder based on input ids
    politicians.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }

  // Prepara os dados para o gráfico de Radar
  let chartData: any[] = [];
  const keys = politicians.map(p => p.politicalName);

  if (politicians.length > 0) {
    // Pegamos todos os códigos de pilares únicos (ignorando POPULAR para focar em métricas técnicas)
    const pillarCodes = new Set<string>();
    politicians.forEach(p => {
      p.scores[0]?.components.filter((c: any) => c.level === "PILLAR" && c.code !== "POPULAR").forEach((c: any) => pillarCodes.add(c.code));
    });

    // Para cada pilar, montamos um objeto com o subject e os valores de cada político
    pillarCodes.forEach(code => {
      // Pega o nome do pilar a partir do primeiro político que o tem
      let pillarName = code;
      for (const p of politicians) {
        const c = p.scores[0]?.components.find((c: any) => c.code === code);
        if (c) {
          pillarName = c.name;
          break;
        }
      }

      const dataPoint: any = { subject: pillarName, fullMark: 100 };
      politicians.forEach(p => {
        const comp = p.scores[0]?.components.find((c: any) => c.code === code);
        dataPoint[p.politicalName] = comp && comp.normalized != null ? Math.round(comp.normalized * 100) : 0;
      });
      chartData.push(dataPoint);
    });
  }

  return (
    <div className="space-y-10">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold text-ink-900 tracking-tight">Comparador de Políticos</h1>
        <p className="text-ink-500 max-w-2xl mx-auto">
          Adicione até 4 políticos para cruzar dados de desempenho, presença e uso de verbas.
        </p>
      </div>

      <CompareSearch />

      {politicians.length === 0 && (
        <div className="bg-surface-50 border border-surface-200 rounded-2xl p-12 text-center text-ink-500 shadow-inner">
          Busque por políticos acima para começar a comparar.
        </div>
      )}

      {politicians.length > 0 && (
        <div className="space-y-8">
          {/* Cartões dos Políticos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {politicians.map((p, idx) => {
              const score = p.scores[0];
              const otherIds = ids.filter(id => id !== p.id);
              
              return (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-surface-200 p-6 flex flex-col items-center text-center relative">
                  {/* Botão de remover */}
                  <Link 
                    href={otherIds.length > 0 ? `/comparar?ids=${otherIds.join(",")}` : "/comparar"}
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-surface-100 hover:bg-bad-100 hover:text-bad-600 text-ink-400 transition-colors"
                    title="Remover"
                  >
                    ×
                  </Link>

                  <div className="w-20 h-20 rounded-full bg-surface-200 border-2 border-white shadow-md flex items-center justify-center overflow-hidden mb-4">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.politicalName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">👤</span>
                    )}
                  </div>
                  <Link href={`/politico/${p.id}`} className="text-xl font-bold text-ink-900 hover:text-brand-600">
                    {p.politicalName}
                  </Link>
                  <p className="text-sm text-ink-500 font-medium mt-1">
                    {p.party?.acronym} / {p.stateUf}
                  </p>
                  
                  {score && (
                    <div className="mt-4 pt-4 border-t border-surface-100 w-full">
                      <p className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-1">Nota Técnica</p>
                      <div className="text-3xl font-black text-ink-900">
                        {formatScore(score.technical)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Gráfico Radar */}
          {politicians.length > 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-surface-200 p-6">
              <h2 className="text-xl font-bold mb-6 text-center">Cruzamento de Pilares</h2>
              <CompareChart data={chartData} keys={keys} />
            </div>
          )}
          
          {politicians.length === 1 && (
            <div className="text-center text-ink-500 italic p-6">
              Adicione mais um político para visualizar o gráfico comparativo.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
