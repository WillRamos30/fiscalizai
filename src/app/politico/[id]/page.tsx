import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatScore } from "@/lib/utils";
import Link from "next/link";
import type { PillarResult, IndicatorResult } from "@/modules/scoring/types";
import { VoteButtons } from "@/components/VoteButtons";
import { FollowButton } from "@/components/FollowButton";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/session";

// Exemplo de uma cor baseada na nota (0-1 ou 0-100)
function getScoreColor(val: number | null, isPercent = false) {
  if (val == null) return "bg-surface-200 text-ink-500";
  const v = isPercent ? val * 100 : val;
  if (v >= 80) return "bg-good-500 text-white";
  if (v >= 50) return "bg-warn-500 text-white";
  return "bg-bad-500 text-white";
}

export default async function PoliticianPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  const userId = session?.sub;
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    include: {
      party: true,
      office: true,
      favorites: userId ? { where: { userId } } : false,
      facts: {
        where: { status: "PUBLICADO" },
        orderBy: { date: "desc" },
        take: 15,
      },
      scores: {
        where: { isCurrent: true },
        include: { components: true },
      },
    },
  });

  if (!politician) return notFound();

  const score = politician.scores[0];
  if (!score) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold">Sem dados de avaliação</h1>
        <p>Ainda não há nota calculada para {politician.politicalName}.</p>
      </div>
    );
  }

  // Componentes do score
  const pillars = score.components.filter(c => c.level === "PILLAR");
  const indicators = score.components.filter(c => c.level === "INDICATOR");

  return (
    <div className="space-y-8">
      {/* Header do Político */}
      <div className="bg-white rounded-2xl shadow-sm border border-surface-200 p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
        <div className="flex gap-6 items-center">
          <div className="w-24 h-24 rounded-full bg-surface-200 border-4 border-white shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
             {politician.photoUrl ? (
               <img src={politician.photoUrl} alt={politician.politicalName} className="w-full h-full object-cover" />
             ) : (
               <span className="text-4xl">👤</span>
             )}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-ink-900 tracking-tight">{politician.politicalName}</h1>
            <p className="text-lg text-ink-500 font-medium mt-1">
              {politician.office?.slug === "deputado-federal" ? "🏢 Deputado Federal" : "🏛️ Senador"} • {politician.party?.acronym} / {politician.stateUf}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {score.rankOffice && (
                <span className="px-2.5 py-1 bg-surface-100 text-ink-700 text-xs font-semibold rounded-md border border-surface-200">
                  🏆 Posição no cargo: <strong>#{score.rankOffice}</strong> {score.totalOffice ? `de ${score.totalOffice}` : ""}
                </span>
              )}
              {score.rankState && politician.stateUf && (
                <span className="px-2.5 py-1 bg-surface-100 text-ink-700 text-xs font-semibold rounded-md border border-surface-200">
                  📍 Posição em {politician.stateUf}: <strong>#{score.rankState}</strong> {score.totalState ? `de ${score.totalState}` : ""}
                </span>
              )}
              {score.percentileOffice != null && (
                <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-md border border-brand-200">
                  ⭐ Top <strong>{Math.max(1, Math.round(100 - score.percentileOffice))}%</strong> nacional
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface-50 rounded-xl p-6 text-center min-w-[200px] border border-surface-200 shadow-inner">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">Nota Técnica</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className={`text-5xl font-black ${score.technical && score.technical >= 80 ? 'text-good-600' : score.technical && score.technical >= 50 ? 'text-warn-600' : 'text-bad-600'}`}>
              {formatScore(score.technical)}
            </span>
            <span className="text-lg text-ink-500 font-medium">/ 100</span>
          </div>
          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-white text-xs font-semibold text-ink-700 shadow-sm border border-surface-200">
            Confiabilidade: {score.confidence}
          </div>
        </div>
      </div>

      {/* Grid de Pilares */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Desempenho por Pilar</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.filter(p => p.code !== "POPULAR").map(p => (
            <div key={p.code} className="bg-white rounded-xl shadow-sm border border-surface-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-ink-900">{p.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getScoreColor(p.normalized, true)}`}>
                    {p.normalized != null ? formatScore(p.normalized * 100) : "—"}
                  </span>
                </div>
                <p className="text-xs text-ink-500 mb-4">Peso no ranking: {p.weight}%</p>
              </div>

              {/* Indicadores do Pilar */}
              <div className="space-y-3 pt-4 border-t border-surface-100">
                {indicators.filter(i => i.parentCode === p.code).map(ind => (
                  <div key={ind.id} className="text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-ink-700 font-medium truncate pr-2" title={ind.name}>{ind.name}</span>
                      {ind.normalized !== null && (
                        <span className={`w-8 h-1.5 rounded-full ${getScoreColor(ind.normalized, true)}`} />
                      )}
                    </div>
                    <p className="text-xs text-ink-500 truncate" title={ind.info || ""}>{ind.info}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fatos do Político */}
      <div className="space-y-4 pt-6">
        <div className="flex justify-between items-end">
          <h2 className="text-2xl font-bold">Fatos Recentes</h2>
          <Link href="/feed" className="text-sm font-medium text-brand-600 hover:underline">
            Ver todos no Feed →
          </Link>
        </div>
        
        <div className="space-y-4">
          {politician.facts.map((fact) => (
            <div key={fact.id} className="bg-white rounded-xl shadow-sm border border-surface-200 p-5 flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded uppercase tracking-wide">
                    {fact.category}
                  </span>
                  <span className="text-ink-500">• {fact.date.toLocaleDateString('pt-BR')}</span>
                </div>
                <h3 className="text-base font-bold text-ink-900 leading-snug">{fact.title}</h3>
                <p className="text-ink-700 text-sm">{fact.description}</p>
                {fact.sourceUrl && (
                  <div className="pt-2">
                    <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-600 hover:underline border border-brand-200 bg-brand-50 px-2 py-1 rounded inline-flex items-center gap-1">
                      <span>??</span> Fonte Oficial
                    </a>
                  </div>
                )}
              </div>
              
              <VoteButtons
                factId={fact.id}
                votesUp={fact.votesUp}
                votesDown={fact.votesDown}
              />
            </div>
          ))}
          {politician.facts.length === 0 && (
            <div className="text-sm text-ink-500 italic p-6 bg-surface-50 rounded-xl text-center border border-surface-200">
              Nenhum fato registrado para este político.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



