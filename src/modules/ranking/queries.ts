// Consultas de leitura: ranking. Lê notas PRÉ-CALCULADAS (tabela Score) — nunca recalcula nada
// no acesso. Resultados em cache com TTL curto e invalidados quando um recálculo termina.

import type { Db } from "@/lib/db";
import { cached } from "@/lib/cache";

export const PERIOD_OPTIONS = [
  { value: "mandato", label: "Mandato atual (acumulado)" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "12m-1", label: "12 meses anteriores" },
  { value: "12m-2", label: "24–12 meses atrás" },
] as const;

export type RankingSort = "geral" | "tecnico" | "popular";

export type RankingFilters = {
  office?: string;
  state?: string;
  party?: string;
  period?: string;
  minScore?: number;
  maxScore?: number;
  sort?: RankingSort;
  page?: number;
  pageSize?: number;
};

export type PoliticianSummary = {
  id: string;
  slug: string;
  fullName: string;
  politicalName: string;
  stateUf: string | null;
  status: string;
  isDemo: boolean;
  photoUrl: string | null;
  officeSlug: string;
  officeName: string;
  partyAcronym: string | null;
  partyName: string | null;
};

export type RankingItem = {
  position: number;
  politician: PoliticianSummary;
  total: number | null;
  technical: number | null;
  popularApproval: number | null;
  popularVotes: number;
  confidence: string;
  percentileOffice: number | null;
  scoreLabel: string;
  periodStart: string;
  periodEnd: string;
};

export type RankingResult = {
  items: RankingItem[];
  total: number;
  page: number;
  pageSize: number;
  period: string;
  periodLabel: string;
};

export const polSummaryInclude = {
  office: { select: { slug: true, name: true } },
  party: { select: { acronym: true, name: true } },
} as const;

export function toSummary(p: {
  id: string;
  slug: string;
  fullName: string;
  politicalName: string;
  stateUf: string | null;
  status: string;
  isDemo: boolean;
  photoUrl: string | null;
  office: { slug: string; name: string };
  party: { acronym: string; name: string } | null;
}): PoliticianSummary {
  return {
    id: p.id,
    slug: p.slug,
    fullName: p.fullName,
    politicalName: p.politicalName,
    stateUf: p.stateUf,
    status: p.status,
    isDemo: p.isDemo,
    photoUrl: p.photoUrl,
    officeSlug: p.office.slug,
    officeName: p.office.name,
    partyAcronym: p.party?.acronym ?? null,
    partyName: p.party?.name ?? null,
  };
}

/** Resolve o filtro de período em (kind, label) do Score. */
export async function resolveWindow(db: Db, period = "mandato"): Promise<{ kind: string; label: string; display: string } | null> {
  if (period === "mandato") return { kind: "CUMULATIVE", label: "Mandato atual", display: "Mandato atual (acumulado)" };
  const m = /^12m(?:-(\d))?$/.exec(period);
  if (!m) return { kind: "CUMULATIVE", label: "Mandato atual", display: "Mandato atual (acumulado)" };
  const k = m[1] ? Number(m[1]) : 0;
  const rows = await db.score.findMany({
    where: { kind: "ROLLING12", isCurrent: true },
    select: { label: true, periodEnd: true },
    distinct: ["label"],
    orderBy: { periodEnd: "desc" },
  });
  const row = rows[k];
  if (!row) return null;
  return { kind: "ROLLING12", label: row.label, display: `12 meses até ${row.label}` };
}

export async function getRanking(db: Db, f: RankingFilters = {}): Promise<RankingResult> {
  const key = `ranking:${JSON.stringify(f)}`;
  return cached(key, 60_000, () => computeRanking(db, f));
}

async function computeRanking(db: Db, f: RankingFilters): Promise<RankingResult> {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 20));
  const sort: RankingSort = f.sort ?? "geral";
  const win = await resolveWindow(db, f.period);
  if (!win) return { items: [], total: 0, page, pageSize, period: f.period ?? "mandato", periodLabel: "Período indisponível" };

  const where = {
    isCurrent: true,
    kind: win.kind,
    label: win.label,
    status: "OK",
    ...(sort === "popular" ? { popularApproval: { not: null } } : {}),
    ...(f.minScore != null || f.maxScore != null
      ? { total: { ...(f.minScore != null ? { gte: f.minScore } : {}), ...(f.maxScore != null ? { lte: f.maxScore } : {}) } }
      : {}),
    politician: {
      ...(f.office ? { office: { slug: f.office } } : {}),
      ...(f.state ? { stateUf: f.state.toUpperCase() } : {}),
      ...(f.party ? { party: { acronym: f.party.toUpperCase() } } : {}),
    },
  };
  const orderBy =
    sort === "popular"
      ? [{ popularApproval: "desc" as const }, { popularVotes: "desc" as const }, { total: "desc" as const }]
      : sort === "tecnico"
        ? [{ technical: "desc" as const }, { total: "desc" as const }]
        : [{ total: "desc" as const }, { technical: "desc" as const }];

  const [total, rows] = await Promise.all([
    db.score.count({ where }),
    db.score.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { politician: { include: polSummaryInclude } },
    }),
  ]);

  const { scoreLabel } = await import("@/lib/constants");
  const items: RankingItem[] = rows.map((r, i) => ({
    position: (page - 1) * pageSize + i + 1,
    politician: toSummary(r.politician),
    total: r.total,
    technical: r.technical,
    popularApproval: r.popularApproval,
    popularVotes: r.popularVotes,
    confidence: r.confidence,
    percentileOffice: r.percentileOffice,
    scoreLabel: scoreLabel(r.total),
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
  }));
  return { items, total, page, pageSize, period: f.period ?? "mandato", periodLabel: win.display };
}

/** Opções para os filtros (cargos ativos, UFs e partidos com políticos). */
export async function getFilterOptions(db: Db) {
  return cached("filters", 5 * 60_000, async () => {
    const [offices, states, parties] = await Promise.all([
      db.office.findMany({ where: { active: true }, select: { slug: true, name: true }, orderBy: { name: "asc" } }),
      db.politician.findMany({ distinct: ["stateUf"], where: { stateUf: { not: null } }, select: { stateUf: true }, orderBy: { stateUf: "asc" } }),
      db.party.findMany({ where: { politicians: { some: {} } }, select: { acronym: true, name: true }, orderBy: { acronym: "asc" } }),
    ]);
    return { offices, states: states.map((s) => s.stateUf as string), parties };
  });
}
