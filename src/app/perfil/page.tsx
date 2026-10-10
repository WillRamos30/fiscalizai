import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatScore } from "@/lib/utils";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      favorites: {
        include: {
          politician: {
            include: {
              party: true,
              office: true,
              scores: {
                where: { isCurrent: true, kind: "CUMULATIVE" }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      },
      popularVotes: {
        include: {
          fact: {
            include: {
              politician: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 10
      }
    }
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-surface-200">
        <h1 className="text-3xl font-extrabold text-ink-900">Meu Perfil</h1>
        <p className="text-ink-500 mt-1">Bem-vindo, {user.name}!</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-ink-900">Políticos Acompanhados</h2>
          {user.favorites.length === 0 ? (
            <div className="bg-surface-50 p-6 rounded-xl border border-surface-200 text-center text-ink-500 text-sm">
              Você ainda não acompanha nenhum político. <br />
              <Link href="/ranking" className="text-brand-600 font-medium hover:underline mt-2 inline-block">Explorar o Ranking Oficial</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {user.favorites.map((fav) => {
                const p = fav.politician;
                const score = p.scores[0]?.technical;
                return (
                  <Link key={fav.id} href={`/politico/${p.id}`} className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-surface-200 hover:border-brand-300 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-surface-200 flex-shrink-0 overflow-hidden">
                      {p.photoUrl ? <img src={p.photoUrl} alt={p.politicalName} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center w-full h-full text-xl">👤</span>}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-ink-900 leading-tight">{p.politicalName}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{p.party?.acronym} / {p.stateUf}</div>
                    </div>
                    <div className="text-right">
                      <div className={`px-2 py-1 rounded text-xs font-bold ${score && score >= 80 ? 'bg-good-500 text-white' : score && score >= 50 ? 'bg-warn-500 text-white' : 'bg-bad-500 text-white'}`}>
                        {formatScore(score)} / 100
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-ink-900">Seus Últimos Votos</h2>
          {user.popularVotes.length === 0 ? (
            <div className="bg-surface-50 p-6 rounded-xl border border-surface-200 text-center text-ink-500 text-sm">
              Você ainda não votou em nenhum acontecimento. <br />
              <Link href="/feed" className="text-brand-600 font-medium hover:underline mt-2 inline-block">Ir para o Feed</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {user.popularVotes.map((v) => (
                <div key={v.id} className="bg-white p-4 rounded-xl shadow-sm border border-surface-200 text-sm">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${v.value === 1 ? 'bg-good-100 text-good-700' : 'bg-bad-100 text-bad-700'}`}>
                      {v.value === 1 ? '👍 APROVOU' : '👎 DESAPROVOU'}
                    </span>
                    <Link href={`/politico/${v.fact.politicianId}`} className="text-ink-500 hover:text-brand-600 font-medium truncate">
                      {v.fact.politician.politicalName}
                    </Link>
                  </div>
                  <div className="text-ink-900 font-medium leading-snug">{v.fact.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
