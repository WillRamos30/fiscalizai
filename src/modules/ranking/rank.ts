// Ranking e percentis — funções PURAS. Só ranqueia quem tem nota (status OK).
// Comparações sempre dentro do mesmo cargo (e, para o recorte estadual, mesmo cargo + UF).

export type RankInput = {
  id: string;
  officeSlug: string;
  stateUf: string | null;
  total: number | null;
};

export type RankOutput = {
  id: string;
  rankOffice: number | null;
  totalOffice: number;
  rankState: number | null;
  totalState: number;
  percentileOffice: number | null; // 0..100: "acima de X% dos pares"
  percentileState: number | null;
  officeAverage: number | null;
  stateAverage: number | null;
};

function rankWithin(
  item: RankInput,
  group: RankInput[],
): { rank: number | null; total: number; percentile: number | null; average: number | null } {
  const scored = group.filter((g) => g.total != null) as (RankInput & { total: number })[];
  const total = scored.length;
  if (item.total == null || total === 0) {
    return { rank: null, total, percentile: null, average: total ? avg(scored.map((s) => s.total)) : null };
  }
  const x = item.total;
  const better = scored.filter((s) => s.total > x + 1e-9).length;
  const lower = scored.filter((s) => s.total < x - 1e-9).length;
  const equal = scored.filter((s) => Math.abs(s.total - x) <= 1e-9).length;
  const percentile = total > 1 ? ((lower + 0.5 * (equal - 1)) / (total - 1)) * 100 : null;
  return {
    rank: better + 1,
    total,
    percentile: percentile != null ? Math.round(percentile * 10) / 10 : null,
    average: avg(scored.map((s) => s.total)),
  };
}

function avg(v: number[]): number | null {
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
}

export function assignRanks(items: RankInput[]): Map<string, RankOutput> {
  const byOffice = new Map<string, RankInput[]>();
  const byState = new Map<string, RankInput[]>();
  for (const it of items) {
    const ko = it.officeSlug;
    byOffice.set(ko, [...(byOffice.get(ko) ?? []), it]);
    const ks = `${it.officeSlug}|${it.stateUf ?? ""}`;
    byState.set(ks, [...(byState.get(ks) ?? []), it]);
  }
  const out = new Map<string, RankOutput>();
  for (const it of items) {
    const o = rankWithin(it, byOffice.get(it.officeSlug)!);
    const s = rankWithin(it, byState.get(`${it.officeSlug}|${it.stateUf ?? ""}`)!);
    out.set(it.id, {
      id: it.id,
      rankOffice: o.rank,
      totalOffice: o.total,
      rankState: s.rank,
      totalState: s.total,
      percentileOffice: o.percentile,
      percentileState: s.percentile,
      officeAverage: o.average,
      stateAverage: s.average,
    });
  }
  return out;
}
