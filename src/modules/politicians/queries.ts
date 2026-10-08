// Consultas de leitura: políticos (listagem, busca/autocomplete, perfil completo, comparação).

import type { Db } from "@/lib/db";
import { cached } from "@/lib/cache";
import { normalizeText, safeJson } from "@/lib/utils";
import { loadInputs } from "@/modules/scoring/metrics";
import { CURRENT_TERM_START } from "@/modules/scoring/run";
import { polSummaryInclude, toSummary, type PoliticianSummary } from "@/modules/ranking/queries";

export type ScoreSnapshot = {
  total: number | null;
  technical: number | null;
  popularApproval: number | null;
  popularVotes: number;
  status: string;
  confidence: string;
  confidenceScore: number;
  coverage: number;
  rankOffice: number | null;
  totalOffice: number | null;
  rankState: number | null;
  totalState: number | null;
  percentileOffice: number | null;
  percentileState: number | null;
  officeAverage: number | null;
  stateAverage: number | null;
  warnings: string[];
  months: number;
  label: string;
  periodStart: string;
  periodEnd: string;
  computedAt: string;
  algorithmVersion: string;
};

export type ComponentView = {
  level: string;
  code: string;
  parentCode: string | null;
  name: string;
  weight: number;
  points: number | null;
  maxPoints: number;
  normalized: number | null;
  rawValue: number | null;
  peerAverage: number | null;
  available: boolean;
  info: string | null;
};

type ScoreRow = Awaited<ReturnType<typeof fetchCurrentScore>>;

async function fetchCurrentScore(db: Db, politicianId: string) {
  return db.score.findFirst({
    where: { politicianId, kind: "CUMULATIVE", isCurrent: true },
    include: { components: true, algorithm: { select: { version: true } } },
    orderBy: { computedAt: "desc" },
  });
}

function toSnapshot(s: NonNullable<ScoreRow>): ScoreSnapshot {
  const d = safeJson<{ warnings?: string[]; months?: number; officeAverage?: number | null; stateAverage?: number | null }>(s.details, {});
  return {
    total: s.total,
    technical: s.technical,
    popularApproval: s.popularApproval,
    popularVotes: s.popularVotes,
    status: s.status,
    confidence: s.confidence,
    confidenceScore: s.confidenceScore,
    coverage: s.coverage,
    rankOffice: s.rankOffice,
    totalOffice: s.totalOffice,
    rankState: s.rankState,
    totalState: s.totalState,
    percentileOffice: s.percentileOffice,
    percentileState: s.percentileState,
    officeAverage: d.officeAverage ?? null,
    stateAverage: d.stateAverage ?? null,
    warnings: d.warnings ?? [],
    months: d.months ?? 0,
    label: s.label,
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    computedAt: s.computedAt.toISOString(),
    algorithmVersion: s.algorithm.version,
  };
}

// ───────────────────────── Listagem ─────────────────────────

export type PoliticianListFilters = {
  q?: string;
  office?: string;
  state?: string;
  party?: string;
  sort?: "nome" | "nota";
  page?: number;
  pageSize?: number;
};

export type PoliticianListItem = PoliticianSummary & { total: number | null; scoreStatus: string | null };

export async function listPoliticians(db: Db, f: PoliticianListFilters = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 24));
  const tokens = f.q ? normalizeText(f.q).split(" ").filter(Boolean) : [];
  const where = {
    ...(f.office ? { office: { slug: f.office } } : {}),
    ...(f.state ? { stateUf: f.state.toUpperCase() } : {}),
    ...(f.party ? { party: { acronym: f.party.toUpperCase() } } : {}),
    ...(tokens.length ? { AND: tokens.map((t) => ({ searchText: { contains: t } })) } : {}),
    office: { active: true, ...(f.office ? { slug: f.office } : {}) },
  };
  const [total, rows] = await Promise.all([
    db.politician.count({ where }),
    db.politician.findMany({
      where,
      include: { ...polSummaryInclude, scores: { where: { kind: "CUMULATIVE", isCurrent: true }, select: { total: true, status: true }, take: 1 } },
      orderBy: f.sort === "nota" ? [{ politicalName: "asc" }] : [{ politicalName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  let items: PoliticianListItem[] = rows.map((r) => ({
    ...toSummary(r),
    total: r.scores[0]?.total ?? null,
    scoreStatus: r.scores[0]?.status ?? null,
  }));
  if (f.sort === "nota") items = items.sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  return { items, total, page, pageSize };
}

// ───────────────────────── Busca / autocomplete ─────────────────────────

export type SearchHit = PoliticianSummary & { total: number | null };

/**
 * Busca por nome completo, nome político, partido, cargo ou UF.
 * Todos os termos digitados precisam aparecer (E); ordena por: prefixo do nome político primeiro.
 */
export async function searchPoliticians(db: Db, q: string, limit = 8): Promise<SearchHit[]> {
  const norm = normalizeText(q);
  if (norm.length < 2) return [];
  const tokens = norm.split(" ").filter(Boolean).slice(0, 6);
  const rows = await db.politician.findMany({
    where: { office: { active: true }, AND: tokens.map((t) => ({ searchText: { contains: t } })) },
    include: { ...polSummaryInclude, scores: { where: { kind: "CUMULATIVE", isCurrent: true }, select: { total: true }, take: 1 } },
    take: 50,
  });
  const scored = rows.map((r) => {
    const name = normalizeText(r.politicalName);
    const full = normalizeText(r.fullName);
    let rank = 3;
    if (name.startsWith(norm)) rank = 0;
    else if (name.split(" ").some((w) => w.startsWith(tokens[0]))) rank = 1;
    else if (full.includes(tokens[0])) rank = 2;
    return { r, rank };
  });
  scored.sort((a, b) => a.rank - b.rank || a.r.politicalName.localeCompare(b.r.politicalName, "pt-BR"));
  return scored.slice(0, Math.min(limit, 20)).map(({ r }) => ({ ...toSummary(r), total: r.scores[0]?.total ?? null }));
}

// ───────────────────────── Perfil ─────────────────────────

export type HistoryPoint = { label: string; periodEnd: string; total: number | null; technical: number | null; status: string };

export async function getPoliticianProfile(db: Db, slug: string) {
  const pol = await db.politician.findUnique({
    where: { slug },
    include: {
      ...polSummaryInclude,
      state: true,
      mandates: { where: { isCurrent: true }, take: 1 },
      committees: { orderBy: { startDate: "desc" } },
      legalCases: { orderBy: { date: "desc" } },
      assets: { orderBy: { year: "desc" } },
      elections: { orderBy: { year: "desc" } },
      coverages: { include: { source: { select: { name: true, slug: true } } } },
    },
  });
  if (!pol) return null;

  const [scoreRow, historyRows] = await Promise.all([
    fetchCurrentScore(db, pol.id),
    db.score.findMany({
      where: { politicianId: pol.id, kind: "ROLLING12", isCurrent: true },
      orderBy: { periodEnd: "asc" },
      select: { label: true, periodEnd: true, total: true, technical: true, status: true },
    }),
  ]);

  const score = scoreRow ? toSnapshot(scoreRow) : null;
  const components: ComponentView[] = scoreRow
    ? scoreRow.components.map((c) => ({
        level: c.level,
        code: c.code,
        parentCode: c.parentCode,
        name: c.name,
        weight: c.weight,
        points: c.points,
        maxPoints: c.maxPoints,
        normalized: c.normalized,
        rawValue: c.rawValue,
        peerAverage: c.peerAverage,
        available: c.available,
        info: c.info,
      }))
    : [];

  const history: HistoryPoint[] = historyRows.map((h) => ({
    label: h.label,
    periodEnd: h.periodEnd.toISOString(),
    total: h.total,
    technical: h.technical,
    status: h.status,
  }));
  // variação nos últimos 12 meses = janela mais recente vs. a anterior (ambas com nota)
  const valid = history.filter((h) => h.total != null);
  const delta12m = valid.length >= 2 ? Math.round(((valid[valid.length - 1].total as number) - (valid[valid.length - 2].total as number)) * 10) / 10 : null;

  const periodEnd = scoreRow?.periodEnd ?? new Date();
  const inputs = await loadInputs(db, { start: CURRENT_TERM_START, end: periodEnd }, { politicianIds: [pol.id], now: new Date() });
  const metrics = inputs[0]?.metrics ?? {};
  const months = inputs[0]?.months ?? 0;

  const expenseByCat = await db.expense.groupBy({
    by: ["category"],
    where: { politicianId: pol.id, date: { gte: CURRENT_TERM_START, lte: periodEnd } },
    _sum: { amount: true },
  });
  const projectStats = await db.project.groupBy({ by: ["status", "role"], where: { politicianId: pol.id }, _count: { _all: true } });

  return {
    politician: { ...toSummary(pol), bio: pol.bio, stateName: pol.state?.name ?? null, updatedAt: pol.updatedAt.toISOString() },
    mandate: pol.mandates[0]
      ? {
          legislature: pol.mandates[0].legislature,
          startDate: pol.mandates[0].startDate.toISOString(),
          endDate: pol.mandates[0].endDate?.toISOString() ?? null,
        }
      : null,
    score,
    components,
    history,
    delta12m,
    metrics,
    months,
    expenseByCategory: expenseByCat.map((e) => ({ category: e.category, amount: e._sum.amount ?? 0 })).sort((a, b) => b.amount - a.amount),
    projectStats: projectStats.map((p) => ({ status: p.status, role: p.role, count: p._count._all })),
    committees: pol.committees.map((c) => ({ name: c.name, role: c.role, startDate: c.startDate.toISOString(), endDate: c.endDate?.toISOString() ?? null })),
    legalCases: pol.legalCases.map((l) => ({
      id: l.id,
      caseNumber: l.caseNumber,
      court: l.court,
      stage: l.stage,
      description: l.description,
      date: l.date.toISOString(),
      isActive: l.isActive,
      updatedAt: l.updatedAt.toISOString(),
    })),
    assets: pol.assets.map((a) => ({ year: a.year, description: a.description, value: a.value })),
    elections: pol.elections.map((e) => ({ year: e.year, officeSlug: e.officeSlug, stateUf: e.stateUf, result: e.result, votes: e.votes, accountsStatus: e.accountsStatus })),
    coverages: pol.coverages.map((c) => ({
      domain: c.domain,
      available: c.available,
      completeness: c.completeness,
      lastUpdatedAt: c.lastUpdatedAt.toISOString(),
      sourceName: c.source?.name ?? null,
    })),
  };
}

export type PoliticianProfile = NonNullable<Awaited<ReturnType<typeof getPoliticianProfile>>>;

export async function getAllSlugs(db: Db): Promise<{ slug: string; updatedAt: Date }[]> {
  return cached("slugs", 60_000, () => db.politician.findMany({ where: { office: { active: true } }, select: { slug: true, updatedAt: true } }));
}

// ───────────────────────── Comparação ─────────────────────────

export async function getComparison(db: Db, slugs: string[]) {
  const unique = [...new Set(slugs)].slice(0, 4);
  const pols = await db.politician.findMany({ where: { slug: { in: unique } }, include: polSummaryInclude });
  const ordered = unique.map((s) => pols.find((p) => p.slug === s)).filter(Boolean) as typeof pols;
  const result = [];
  for (const p of ordered) {
    const row = await fetchCurrentScore(db, p.id);
    const score = row ? toSnapshot(row) : null;
    const comps = row?.components ?? [];
    const inputs = await loadInputs(db, { start: CURRENT_TERM_START, end: row?.periodEnd ?? new Date() }, { politicianIds: [p.id] });
    const m = inputs[0]?.metrics ?? {};
    const pillar = (code: string) => {
      const c = comps.find((x) => x.level === "PILLAR" && x.code === code);
      return c ? { points: c.points, max: c.maxPoints, normalized: c.normalized, available: c.available } : null;
    };
    result.push({
      politician: toSummary(p),
      score,
      pillars: ["LEG", "PRE", "EFE", "GAS", "TRA", "INT", "POP"].map((code) => ({ code, ...(pillar(code) ?? { points: null, max: 0, normalized: null, available: false }) })),
      metrics: {
        attendanceRate: (m.attendance_rate as number | null) ?? null,
        projectsAuthored: (m.projects_authored as number | null) ?? null,
        projectsApproved: (m.projects_approved as number | null) ?? null,
        spendTotal: (m.spend_total as number | null) ?? null,
        months: inputs[0]?.months ?? 0,
        transparency: pillar("TRA")?.normalized != null ? Math.round((pillar("TRA")!.normalized as number) * 100) : null,
      },
    });
  }
  return result;
}

export type ComparisonEntry = Awaited<ReturnType<typeof getComparison>>[number];
