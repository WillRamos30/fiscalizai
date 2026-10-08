import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatDateBR } from "@/lib/utils";
import { VoteButtons } from "@/components/VoteButtons";

export default async function FeedPage() {
  const facts = await prisma.fact.findMany({
    where: { status: "PUBLICADO" },
    orderBy: { date: "desc" },
    take: 50,
    include: {
      politician: {
        include: { party: true }
      },
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-ink-900 tracking-tight">Acontecimentos</h1>
        <p className="text-ink-500 mt-1">Acompanhe os fatos mais recentes e avalie.</p>
      </div>

      <div className="space-y-6">
        {facts.map((fact) => (
          <div key={fact.id} className="bg-white rounded-xl shadow-sm border border-surface-200 p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded uppercase tracking-wide text-xs">
                  {fact.category}
                </span>
                <span className="text-ink-500">{formatDateBR(fact.date)}</span>
              </div>
              <h2 className="text-lg font-bold text-ink-900 leading-snug">{fact.title}</h2>
              <p className="text-ink-700 text-sm">{fact.description}</p>
              
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-ink-500">Político:</span>
                <Link href={`/politico/${fact.politician.id}`} className="text-sm font-semibold text-ink-900 hover:text-brand-600">
                  {fact.politician.politicalName} ({fact.politician.party?.acronym} / {fact.politician.stateUf})
                </Link>
              </div>
            </div>
            
            {/* Votação via Client Component */}
            <VoteButtons
              factId={fact.id}
              votesUp={fact.votesUp}
              votesDown={fact.votesDown}
            />
          </div>
        ))}
        {facts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-surface-200 text-ink-500">
            Nenhum fato registrado.
          </div>
        )}
      </div>
    </div>
  );
}
