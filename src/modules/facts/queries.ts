// Consultas de leitura: feed de fatos ("Em destaque").

import type { Db } from "@/lib/db";
import { cached } from "@/lib/cache";
import { type FactCategory } from "@/lib/constants";
import { polSummaryInclude, toSummary, type PoliticianSummary } from "@/modules/ranking/queries";
import { summarize, type VoteSummary } from "@/modules/votes/service";

export type FactView = {
  id: string;
  title: string;
  description: string;
  category: FactCategory;
  date: string;
  periodStart: string | null;
  periodEnd: string | null;
  impact: string;
  isDemo: boolean;
  collectedAt: string;
  sourceName: string;
  sourceSlug: string;
  sourceUrl: string;
  sourceConnection: string;
  politician: PoliticianSummary;
  votes: VoteSummary;
};

export type FactFilters = {
  politicianSlug?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  sort?: "recentes" | "votados";
};

const factInclude = {
  source: { select: { name: true, slug: true, connection: true } },
  politician: { include: polSummaryInclude },
} as const;

type FactRow = Awaited<ReturnType<typeof loadRows>>[number];

async function loadRows(db: Db, where: object, orderBy: object[], skip: number, take: number) {
  return db.fact.findMany({ where, orderBy, skip, take, include: factInclude });
}

function toView(r: FactRow, myVotes: Record<string, 1 | -1>): FactView {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category as FactCategory,
    date: r.date.toISOString(),
    periodStart: r.periodStart?.toISOString() ?? null,
    periodEnd: r.periodEnd?.toISOString() ?? null,
    impact: r.impact,
    isDemo: r.isDemo,
    collectedAt: r.collectedAt.toISOString(),
    sourceName: r.source.name,
    sourceSlug: r.source.slug,
    sourceUrl: r.sourceUrl,
    sourceConnection: r.source.connection,
    politician: toSummary(r.politician),
    votes: summarize(r.id, r.votesUp, r.votesDown, myVotes[r.id] ?? null),
  };
}

export async function listFacts(db: Db, f: FactFilters = {}, userId?: string | null) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, f.pageSize ?? 12));
  const where = {
    status: "PUBLICADO",
    ...(f.category ? { category: f.category } : {}),
    ...(f.politicianSlug ? { politician: { slug: f.politicianSlug } } : {}),
  };
  const orderBy = f.sort === "votados" ? [{ votesUp: "desc" }, { date: "desc" }] : [{ date: "desc" }, { id: "asc" }];
  const [total, rows] = await Promise.all([
    db.fact.count({ where }),
    loadRows(db, where, orderBy, (page - 1) * pageSize, pageSize),
  ]);
  const my = userId
    ? Object.fromEntries(
        (await db.popularVote.findMany({ where: { userId, factId: { in: rows.map((r) => r.id) } }, select: { factId: true, value: true } })).map((v) => [v.factId, v.value as 1 | -1]),
      )
    : {};
  return { items: rows.map((r) => toView(r, my)), total, page, pageSize };
}

/** Feed da home: prioriza diversidade (um fato por político primeiro), depois completa por data. */
export async function getFeed(db: Db, limit = 6, userId?: string | null): Promise<FactView[]> {
  const base = await cached(`feed:${limit}`, 60_000, async () => {
    const rows = await loadRows(db, { status: "PUBLICADO" }, [{ date: "desc" }, { id: "asc" }], 0, 80);
    const seen = new Set<string>();
    const first: FactRow[] = [];
    const rest: FactRow[] = [];
    for (const r of rows) {
      if (!seen.has(r.politicianId)) {
        seen.add(r.politicianId);
        first.push(r);
      } else rest.push(r);
    }
    return [...first, ...rest].slice(0, limit);
  });
  // votos do usuário não podem ser cacheados globalmente
  const my = userId
    ? Object.fromEntries(
        (await db.popularVote.findMany({ where: { userId, factId: { in: base.map((r) => r.id) } }, select: { factId: true, value: true } })).map((v) => [v.factId, v.value as 1 | -1]),
      )
    : {};
  // contadores atualizados (cache de 60 s pode estar defasado): releitura leve
  const fresh = await db.fact.findMany({ where: { id: { in: base.map((r) => r.id) } }, select: { id: true, votesUp: true, votesDown: true } });
  const fm = new Map(fresh.map((x) => [x.id, x]));
  return base.map((r) => {
    const c = fm.get(r.id);
    return toView(c ? { ...r, votesUp: c.votesUp, votesDown: c.votesDown } : r, my);
  });
}
