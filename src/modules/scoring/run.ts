// Orquestra o cálculo e a persistência das notas (job assíncrono).
// Notas são IMUTÁVEIS: cada execução cria novas linhas em Score/ScoreComponent com o runId e a
// versão do algoritmo; as anteriores só deixam de ser "isCurrent". Nada é sobrescrito.

import type { Db } from "@/lib/db";
import { invalidate } from "@/lib/cache";
import { audit } from "@/modules/audit/audit";
import { assignRanks } from "@/modules/ranking/rank";
import { getActiveAlgorithm, type Actor } from "./algorithm";
import { scoreAll } from "./engine";
import { loadInputs, type Period } from "./metrics";
import type { AlgorithmConfig, PoliticianInput, ScoreResult } from "./types";

/** Início da legislatura vigente (57ª: 01/02/2023). Parâmetro de operação, não de metodologia. */
export const CURRENT_TERM_START = new Date(Date.UTC(2023, 1, 1));

export type WindowSpec = { kind: "CUMULATIVE" | "ROLLING12"; label: string; period: Period; isCurrentMain: boolean };

function addMonthsUTC(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Janelas de cálculo: acumulado do mandato + janelas de 12 meses encerradas a cada aniversário. */
export function buildWindows(now: Date, termStart = CURRENT_TERM_START, minMonths = 3): WindowSpec[] {
  const windows: WindowSpec[] = [
    { kind: "CUMULATIVE", label: "Mandato atual", period: { start: termStart, end: now }, isCurrentMain: true },
  ];
  for (let k = 0; k < 8; k++) {
    const end = addMonthsUTC(now, -12 * k);
    const monthsAvailable = (end.getTime() - termStart.getTime()) / (30.4375 * 86_400_000);
    if (monthsAvailable < minMonths) break;
    const start = new Date(Math.max(addMonthsUTC(end, -12).getTime(), termStart.getTime()));
    windows.push({
      kind: "ROLLING12",
      label: `${MONTHS_PT[end.getUTCMonth()]}/${end.getUTCFullYear()}`,
      period: { start, end },
      isCurrentMain: false,
    });
  }
  return windows;
}

export type RunSummary = {
  runId: string;
  algorithmVersion: string;
  politicians: number;
  scored: number;
  insufficient: number;
  windows: number;
  durationMs: number;
};

type PersistArgs = {
  db: Db;
  runId: string;
  algorithmId: string;
  window: WindowSpec;
  inputs: PoliticianInput[];
  results: ScoreResult[];
  config: AlgorithmConfig;
};

async function persistWindow({ db, runId, algorithmId, window, inputs, results }: PersistArgs) {
  const ranks = assignRanks(
    results.map((r) => {
      const inp = inputs.find((i) => i.id === r.politicianId)!;
      return { id: r.politicianId, officeSlug: inp.officeSlug, stateUf: inp.stateUf, total: r.total };
    }),
  );

  await db.$transaction(
    async (tx) => {
      // Marca como não-atuais as notas anteriores do mesmo tipo/rótulo (histórico preservado).
      await tx.score.updateMany({
        where: { kind: window.kind, label: window.label, isCurrent: true, politicianId: { in: results.map((r) => r.politicianId) } },
        data: { isCurrent: false },
      });
      for (const r of results) {
        const inp = inputs.find((i) => i.id === r.politicianId)!;
        const rk = ranks.get(r.politicianId)!;
        await tx.score.create({
          data: {
            runId,
            politicianId: r.politicianId,
            algorithmVersionId: algorithmId,
            kind: window.kind,
            label: window.label,
            periodStart: window.period.start,
            periodEnd: window.period.end,
            status: r.status,
            total: r.total,
            technical: r.technical,
            popularApproval: r.popularApproval,
            popularVotes: r.popularVotes,
            confidence: r.confidence,
            confidenceScore: r.confidenceScore,
            coverage: r.coverage,
            rankOffice: rk.rankOffice,
            rankState: rk.rankState,
            totalOffice: rk.totalOffice,
            totalState: rk.totalState,
            percentileOffice: rk.percentileOffice,
            percentileState: rk.percentileState,
            isCurrent: true,
            details: JSON.stringify({
              warnings: r.warnings,
              months: Math.round(inp.months * 10) / 10,
              officeAverage: rk.officeAverage,
              stateAverage: rk.stateAverage,
            }),
            components: {
              create: [
                ...r.pillars.map((p) => ({
                  level: "PILLAR",
                  code: p.code,
                  parentCode: null,
                  name: p.name,
                  weight: p.weight,
                  points: p.points,
                  maxPoints: p.weight,
                  normalized: p.value,
                  rawValue: null,
                  peerAverage: null,
                  available: p.available,
                  info: `Cobertura de indicadores: ${Math.round(p.coverage * 100)}%`,
                })),
                ...r.indicators.map((i) => ({
                  level: "INDICATOR",
                  code: i.id,
                  parentCode: i.pillar,
                  name: i.name,
                  weight: i.weight,
                  points: i.points,
                  maxPoints: i.weight,
                  normalized: i.normalized,
                  rawValue: i.rawValue,
                  peerAverage: i.peerAverage,
                  available: i.available,
                  info: i.info,
                })),
              ],
            },
          },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}

export async function recalculateAll(
  db: Db,
  opts: { now?: Date; actor?: Actor; reason?: string } = {},
): Promise<RunSummary> {
  const t0 = Date.now();
  const now = opts.now ?? new Date();
  const algorithm = await getActiveAlgorithm(db);
  const runId = `run_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const windows = buildWindows(now, CURRENT_TERM_START, algorithm.config.params.minMonths);

  let polCount = 0;
  let scored = 0;
  let insufficient = 0;

  for (const w of windows) {
    const inputs = await loadInputs(db, w.period, { now });
    if (inputs.length === 0) continue;
    const results = scoreAll(inputs, algorithm.config);
    await persistWindow({ db, runId, algorithmId: algorithm.id, window: w, inputs, results, config: algorithm.config });
    if (w.kind === "CUMULATIVE") {
      polCount = inputs.length;
      scored = results.filter((r) => r.status === "OK").length;
      insufficient = results.length - scored;
    }
  }

  invalidate(); // limpa cache de ranking/perfis
  const durationMs = Date.now() - t0;

  await audit(db, {
    actorId: opts.actor?.id ?? null,
    actorLabel: opts.actor?.label ?? "sistema",
    action: "SCORES_RECALCULATED",
    entity: "Score",
    entityId: runId,
    after: { algorithm: algorithm.version, politicians: polCount, scored, insufficient, windows: windows.length },
    reason: opts.reason ?? "Recálculo de notas",
  });

  return { runId, algorithmVersion: algorithm.version, politicians: polCount, scored, insufficient, windows: windows.length, durationMs };
}
