import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatScore } from "@/lib/utils";
import { STATES } from "@/modules/ingestion/reference";

function getScoreBadgeClass(score: number | null) {
  if (score == null) return "bg-surface-100 text-ink-500 border-surface-200";
  if (score >= 80) return "bg-good-50 text-good-700 border-good-200";
  if (score >= 50) return "bg-warn-50 text-warn-700 border-warn-200";
  return "bg-bad-50 text-bad-700 border-bad-200";
}

export default async function RankingPage(props: {
  searchParams?: Promise<{ q?: string; office?: string; state?: string; page?: string }>;
}) {
  const params = await props.searchParams;
  const q = params?.q?.trim() || "";
  // String vazia significa "Todos os cargos" (Deputados e Senadores)
  const office = params?.office?.trim() || "";
  const state = params?.state?.trim() || "";

  const page = parseInt((await props.searchParams)?.page || "1", 10);
  const pageSize = 50;

  // Busca do ranking real no banco de dados
  const allScores = await prisma.score.findMany({
    where: {
      isCurrent: true,
      status: "OK",
      kind: "CUMULATIVE",
      politician: {
        office: office ? { slug: office } : undefined,
        stateUf: state || undefined,
        searchText: q ? { contains: q, mode: "insensitive" } : undefined,
      },
    },
    orderBy: { technical: "desc" },
    include: {
      politician: {
        include: { party: true, office: true },
      },
    },
  });

  // Remove duplicatas causadas por race conditions no banco (mantendo a mais recente/maior nota)
  const seen = new Set();
  const uniqueScores = [];
  for (const score of allScores) {
    if (!seen.has(score.politicianId)) {
      seen.add(score.politicianId);
      uniqueScores.push(score);
    }
  }

  const totalCount = uniqueScores.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const scores = uniqueScores.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900 tracking-tight">Ranking Oficial do Brasil</h1>
          <p className="text-ink-500 mt-1">
            Desempenho de deputados e senadores avaliados por dados públicos oficiais (produção, gastos e integridade).
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-surface-200 text-sm font-medium text-ink-700 shadow-sm">
          Exibindo <span className="font-bold text-brand-600">{scores.length}</span> parlamentares
          {office ? ` • ${office === "senador" ? "Senado" : "Câmara"}` : " • Todos os cargos"}
          {state ? ` • UF: ${state}` : " • Brasil inteiro"}
        </div>
      </div>

      {/* Barra de Filtros */}
      <form className="bg-white p-5 rounded-xl shadow-sm border border-surface-200 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="q" className="block text-xs font-semibold text-ink-500 uppercase mb-1">
            Buscar Político
          </label>
          <input
            type="text"
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Nome do deputado ou senador..."
            className="w-full px-3 py-2 border border-surface-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>

        <div className="w-full sm:w-48">
          <label htmlFor="office" className="block text-xs font-semibold text-ink-500 uppercase mb-1">
            Cargo / Posição
          </label>
          <select
            id="office"
            name="office"
            defaultValue={office}
            className="w-full px-3 py-2 border border-surface-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-sm"
          >
            <option value="">Todos os Cargos</option>
            <option value="deputado-federal">Deputado Federal</option>
            <option value="senador">Senador</option>
          </select>
        </div>

        <div className="w-full sm:w-56">
          <label htmlFor="state" className="block text-xs font-semibold text-ink-500 uppercase mb-1">
            Estado (UF)
          </label>
          <select
            id="state"
            name="state"
            defaultValue={state}
            className="w-full px-3 py-2 border border-surface-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-sm"
          >
            <option value="">Todo o Brasil (27 UFs)</option>
            {STATES.map((s) => (
              <option key={s.uf} value={s.uf}>
                {s.uf} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-5 py-2 bg-ink-900 text-white font-medium rounded-md hover:bg-ink-700 transition-colors text-sm shadow-sm"
          >
            Filtrar
          </button>
          {(q || office || state) && (
            <Link
              href="/ranking"
              className="px-4 py-2 border border-surface-200 text-ink-700 font-medium rounded-md hover:bg-surface-50 transition-colors text-sm"
            >
              Limpar
            </Link>
          )}
        </div>
      </form>

      {/* Tabela do Ranking */}
      <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-50 text-ink-500 text-xs uppercase tracking-wider border-b border-surface-200">
                <th className="px-6 py-4 font-medium text-center w-20">Posição</th>
                <th className="px-6 py-4 font-medium">Parlamentar</th>
                <th className="px-6 py-4 font-medium">Cargo & Posição Oficial</th>
                <th className="px-6 py-4 font-medium">Partido / UF</th>
                <th className="px-6 py-4 font-medium text-center">Confiabilidade</th>
                <th className="px-6 py-4 font-medium text-right">Nota Técnica</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 text-sm">
              {scores.map((score, idx) => {
                const isSenator = score.politician.office?.slug === "senador";
                const rankCargo = score.rankOffice ? `#${score.rankOffice}` : null;
                const totalCargo = score.totalOffice ? `de ${score.totalOffice}` : "";
                const rankUF = score.rankState && score.politician.stateUf ? `#${score.rankState} em ${score.politician.stateUf}` : null;

                return (
                  <tr key={score.id} className="hover:bg-surface-50 transition-colors">
                    {/* Posição no Filtro */}
                    <td className="px-6 py-4 text-center">
                      <span className="font-extrabold text-ink-400 text-base">#{(page - 1) * pageSize + idx + 1}</span>
                    </td>

                    {/* Parlamentar com Foto Oficial */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {score.politician.photoUrl ? (
                            <img
                              src={score.politician.photoUrl}
                              alt={score.politician.politicalName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg">👤</span>
                          )}
                        </div>
                        <div>
                          <Link
                            href={`/politico/${score.politician.id}`}
                            className="font-bold text-ink-900 hover:text-brand-600 block text-base leading-snug"
                          >
                            {score.politician.politicalName}
                          </Link>
                          {score.politician.fullName !== score.politician.politicalName && (
                            <span className="text-xs text-ink-400 block truncate max-w-xs">
                              {score.politician.fullName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cargo e Posições Relativas */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            isSenator
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {isSenator ? "🏛️ Senador" : "🏢 Deputado Federal"}
                        </span>
                        <div className="flex flex-wrap gap-1 text-xs text-ink-600 mt-0.5">
                          {rankCargo && (
                            <span className="bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200" title="Posição entre parlamentares do mesmo cargo">
                              🏆 <strong>{rankCargo}</strong> {totalCargo}
                            </span>
                          )}
                          {rankUF && (
                            <span className="bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200" title="Posição no estado">
                              📍 <strong>{rankUF}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Partido / UF */}
                    <td className="px-6 py-4 font-medium text-ink-700 whitespace-nowrap">
                      <span className="font-bold">{score.politician.party?.acronym || "S/P"}</span>
                      <span className="text-ink-300 mx-1.5">•</span>
                      <span className="bg-surface-100 px-2 py-0.5 rounded border border-surface-200 font-semibold text-ink-800">
                        {score.politician.stateUf || "BR"}
                      </span>
                    </td>

                    {/* Confiabilidade */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                          score.confidence === "ALTA"
                            ? "bg-good-50 text-good-700 border border-good-200"
                            : score.confidence === "MEDIA"
                            ? "bg-warn-50 text-warn-700 border border-warn-200"
                            : "bg-bad-50 text-bad-700 border border-bad-200"
                        }`}
                      >
                        {score.confidence}
                      </span>
                    </td>

                    {/* Nota Técnica */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-lg font-black border ${getScoreBadgeClass(
                          score.technical
                        )}`}
                      >
                        {formatScore(score.technical)}
                      </span>
                      <span className="text-xs text-ink-400 block mt-0.5">/ 100</span>
                    </td>
                  </tr>
                );
              })}

              {scores.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-ink-500">
                    <p className="text-lg font-semibold text-ink-700">Nenhum parlamentar encontrado.</p>
                    <p className="text-sm text-ink-400 mt-1">
                      Tente alterar os filtros de cargo, estado ou termo de busca.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagina��o */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-4">
          <Link
            href={`/ranking?q=${q}&office=${office}&state=${state}&page=${Math.max(1, page - 1)}`}
            className={`px-4 py-2 border rounded-md font-medium text-sm transition-colors ${page === 1 ? "bg-surface-100 text-ink-300 pointer-events-none border-surface-200" : "bg-white text-ink-700 hover:bg-surface-50 border-surface-300"}`}
          >
            Anterior
          </Link>
          <span className="text-sm font-medium text-ink-500">
            P�gina {page} de {totalPages}
          </span>
          <Link
            href={`/ranking?q=${q}&office=${office}&state=${state}&page=${Math.min(totalPages, page + 1)}`}
            className={`px-4 py-2 border rounded-md font-medium text-sm transition-colors ${page === totalPages ? "bg-surface-100 text-ink-300 pointer-events-none border-surface-200" : "bg-white text-ink-700 hover:bg-surface-50 border-surface-300"}`}
          >
            Pr�xima
          </Link>
        </div>
      )}
    </div>
  );
}





